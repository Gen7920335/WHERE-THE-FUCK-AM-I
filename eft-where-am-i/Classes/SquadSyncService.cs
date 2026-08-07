using System.Collections.Concurrent;
using System.Net;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;
using Newtonsoft.Json;

namespace eft_where_am_i.Classes
{
    /// <summary>
    /// Shares the latest screenshot pose either by LAN multicast or through a
    /// player-hosted UDP endpoint. Direct host/client packets are authenticated
    /// and encrypted with a key derived from the room password; the password is
    /// never sent over the network.
    /// </summary>
    public sealed class SquadSyncService : IDisposable
    {
        private const int ProtocolVersion = 2;
        private const int MaxPacketBytes = 32 * 1024;
        private static readonly IPAddress MulticastGroup = IPAddress.Parse("239.255.38.73");
        private static readonly byte[] WireMagic = Encoding.ASCII.GetBytes("WTF2");
        private static readonly byte[] AssociatedData = Encoding.ASCII.GetBytes("wtfai-squad-v2");
        private static readonly byte[] PasswordSalt = Encoding.ASCII.GetBytes("WHERE-THE-FUCK-AM-I/direct-squad/v2");

        private readonly string _senderId = Guid.NewGuid().ToString("N");
        private readonly ConcurrentDictionary<string, SquadMember> _members = new();
        private readonly ConcurrentDictionary<string, IPEndPoint> _clientEndpoints = new();
        private readonly ConcurrentDictionary<string, long> _clientSequences = new();
        private readonly object _poseLock = new();
        private CancellationTokenSource? _cancel;
        private UdpClient? _receiver;
        private UdpClient? _sender;
        private Task? _receiveTask;
        private Task? _sendTask;
        private SquadMember? _latestPose;
        private byte[]? _sessionKey;
        private IPEndPoint? _serverEndpoint;
        private string _mode = "off";
        private string _room = "eft-local";
        private string _host = string.Empty;
        private string _password = string.Empty;
        private string _name = "Player";
        private string _lastStatusState = string.Empty;
        private long _sendSequence;
        private long _lastHostSequence;
        private string _hostSenderId = string.Empty;
        private DateTimeOffset _lastHostMessageAt = DateTimeOffset.MinValue;
        private int _port;

        public event Action<IReadOnlyList<SquadMember>>? MembersChanged;
        public event Action<SquadConnectionStatus>? StatusChanged;

        public void Configure(string? mode, string? name, string? room, string? host, string? password, int port)
        {
            mode = NormalizeMode(mode);
            name = string.IsNullOrWhiteSpace(name) ? "Player" : name.Trim();
            room = string.IsNullOrWhiteSpace(room) ? "eft-local" : room.Trim();
            host = host?.Trim() ?? string.Empty;
            password ??= string.Empty;
            port = Math.Clamp(port, 1024, 65535);

            bool unchanged = mode != "off" && _cancel != null && _mode == mode && _port == port &&
                _room == room && _host == host && _password == password && _name == name;
            _mode = mode;
            _name = name;
            _room = room;
            _host = host;
            _password = password;

            if (mode == "off")
            {
                Stop();
                PublishStatus("off", "Squad sharing is off.");
                return;
            }
            if (unchanged) return;

            Stop();
            if ((mode == "host" || mode == "client") && password.Length < 8)
            {
                PublishStatus("error", "Direct mode requires a password of at least 8 characters.");
                return;
            }

            try
            {
                _sessionKey = mode == "lan" ? null : Rfc2898DeriveBytes.Pbkdf2(
                    Encoding.UTF8.GetBytes(password), PasswordSalt, 210_000, HashAlgorithmName.SHA256, 32);
                Start(port);
            }
            catch (Exception ex)
            {
                AppLogger.Error("SquadSync", $"Could not start {mode} sync: {ex.Message}");
                Stop();
                PublishStatus("error", $"Could not start {mode} mode: {ex.Message}");
            }
        }

        public void UpdatePose(string map, double x, double y, double z, double qx, double qy, double qz, double qw)
        {
            lock (_poseLock)
            {
                _latestPose = new SquadMember
                {
                    id = _senderId,
                    name = _name,
                    map = map,
                    x = x,
                    y = y,
                    z = z,
                    qx = qx,
                    qy = qy,
                    qz = qz,
                    qw = qw,
                    lastSeen = DateTimeOffset.UtcNow
                };
            }
        }

        private static string NormalizeMode(string? mode) => mode?.Trim().ToLowerInvariant() switch
        {
            "lan" => "lan",
            "host" => "host",
            "client" => "client",
            _ => "off"
        };

        private void Start(int port)
        {
            _port = port;
            _cancel = new CancellationTokenSource();

            if (_mode == "lan")
            {
                _receiver = new UdpClient(AddressFamily.InterNetwork);
                _receiver.Client.SetSocketOption(SocketOptionLevel.Socket, SocketOptionName.ReuseAddress, true);
                _receiver.Client.Bind(new IPEndPoint(IPAddress.Any, port));
                _receiver.JoinMulticastGroup(MulticastGroup);
                _sender = new UdpClient(AddressFamily.InterNetwork) { MulticastLoopback = true, Ttl = 1 };
                PublishStatus("listening", $"LAN multicast active on UDP {port}.");
            }
            else if (_mode == "host")
            {
                _receiver = new UdpClient(new IPEndPoint(IPAddress.Any, port));
                PublishStatus("listening", $"Hosting on UDP {port}. Forward this port to this PC.");
            }
            else
            {
                _serverEndpoint = ResolveServerEndpoint(_host, port);
                _receiver = new UdpClient(AddressFamily.InterNetwork);
                _receiver.Connect(_serverEndpoint);
                PublishStatus("connecting", $"Connecting to {_serverEndpoint.Address}:{port}...");
            }

            _receiveTask = ReceiveLoopAsync(_cancel.Token);
            _sendTask = SendLoopAsync(_cancel.Token);
        }

        private static IPEndPoint ResolveServerEndpoint(string host, int port)
        {
            if (string.IsNullOrWhiteSpace(host)) throw new InvalidOperationException("Enter the host IP address or DNS name.");
            if (IPAddress.TryParse(host, out IPAddress? parsed) && parsed.AddressFamily == AddressFamily.InterNetwork)
                return new IPEndPoint(parsed, port);

            IPAddress? address = Dns.GetHostAddresses(host).FirstOrDefault(item => item.AddressFamily == AddressFamily.InterNetwork);
            return address == null
                ? throw new InvalidOperationException("The host name did not resolve to an IPv4 address.")
                : new IPEndPoint(address, port);
        }

        private async Task ReceiveLoopAsync(CancellationToken token)
        {
            while (!token.IsCancellationRequested && _receiver != null)
            {
                try
                {
                    UdpReceiveResult result = await _receiver.ReceiveAsync(token);
                    if (result.Buffer.Length == 0 || result.Buffer.Length > MaxPacketBytes) continue;

                    if (_mode == "lan")
                    {
                        ReceiveLanPacket(result.Buffer);
                    }
                    else
                    {
                        SquadWireMessage? message = DecryptMessage(result.Buffer);
                        if (message == null || message.version != ProtocolVersion) continue;
                        if (_mode == "host") ReceiveClientMessage(message, result.RemoteEndPoint);
                        else ReceiveHostMessage(message);
                    }
                }
                catch (OperationCanceledException) { break; }
                catch (ObjectDisposedException) { break; }
                catch (CryptographicException) { }
                catch (Exception ex) { AppLogger.Warn("SquadSync", $"Receive failed: {ex.Message}"); }
            }
        }

        private void ReceiveLanPacket(byte[] buffer)
        {
            string json = Encoding.UTF8.GetString(buffer);
            LanSquadPacket? packet = JsonConvert.DeserializeObject<LanSquadPacket>(json);
            if (packet == null || packet.version != 1 || packet.senderId == _senderId || packet.room != _room ||
                string.IsNullOrWhiteSpace(packet.senderId) || string.IsNullOrWhiteSpace(packet.map)) return;

            _members[packet.senderId] = packet.ToMember();
            PublishMembers();
        }

        private void ReceiveClientMessage(SquadWireMessage message, IPEndPoint endpoint)
        {
            if (message.type != "pose" || message.member == null || message.member.id == _senderId ||
                string.IsNullOrWhiteSpace(message.member.id)) return;
            if (message.senderId != message.member.id) return;
            if (_clientSequences.TryGetValue(message.member.id, out long previousSequence) && message.sequence <= previousSequence) return;
            _clientSequences[message.member.id] = message.sequence;

            SquadMember member = message.member;
            member.name = string.IsNullOrWhiteSpace(member.name) ? "Squad" : member.name.Trim();
            member.lastSeen = DateTimeOffset.UtcNow;
            _members[member.id] = member;
            _clientEndpoints[member.id] = endpoint;
            PublishMembers();
            PublishStatus("connected", $"Hosting on UDP {_port} · {_clientEndpoints.Count} client(s).");
        }

        private void ReceiveHostMessage(SquadWireMessage message)
        {
            if (message.type != "snapshot" || message.members == null) return;
            if (string.IsNullOrWhiteSpace(message.senderId)) return;
            if (_hostSenderId != message.senderId)
            {
                _hostSenderId = message.senderId;
                _lastHostSequence = 0;
            }
            if (message.sequence <= _lastHostSequence) return;
            _lastHostSequence = message.sequence;
            _lastHostMessageAt = DateTimeOffset.UtcNow;
            _members.Clear();
            foreach (SquadMember member in message.members)
            {
                if (member.id == _senderId || string.IsNullOrWhiteSpace(member.id)) continue;
                member.lastSeen = DateTimeOffset.UtcNow;
                _members[member.id] = member;
            }
            PublishMembers();
            PublishStatus("connected", $"Connected to {_serverEndpoint?.Address}:{_port}.");
        }

        private async Task SendLoopAsync(CancellationToken token)
        {
            while (!token.IsCancellationRequested)
            {
                try
                {
                    if (_mode == "lan") await SendLanPoseAsync(token);
                    else if (_mode == "host") await SendHostSnapshotAsync(token);
                    else if (_mode == "client") await SendClientPoseAsync(token);

                    PruneMembers();
                    await Task.Delay(1000, token);
                }
                catch (OperationCanceledException) { break; }
                catch (ObjectDisposedException) { break; }
                catch (Exception ex) { AppLogger.Warn("SquadSync", $"Send failed: {ex.Message}"); }
            }
        }

        private async Task SendLanPoseAsync(CancellationToken token)
        {
            SquadMember? pose = CopyLatestPose();
            if (pose == null || _sender == null) return;
            var packet = LanSquadPacket.FromMember(pose, _room);
            byte[] bytes = Encoding.UTF8.GetBytes(JsonConvert.SerializeObject(packet));
            await _sender.SendAsync(bytes, new IPEndPoint(MulticastGroup, _port), token);
        }

        private async Task SendClientPoseAsync(CancellationToken token)
        {
            if (_receiver == null || _serverEndpoint == null) return;
            SquadMember pose = CopyLatestPose() ?? new SquadMember { id = _senderId, name = _name, map = string.Empty };
            byte[] bytes = EncryptMessage(new SquadWireMessage
            {
                version = ProtocolVersion,
                type = "pose",
                senderId = _senderId,
                sequence = Interlocked.Increment(ref _sendSequence),
                sentAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                member = pose
            });
            await _receiver.SendAsync(bytes, token);
        }

        private async Task SendHostSnapshotAsync(CancellationToken token)
        {
            if (_receiver == null || _clientEndpoints.IsEmpty) return;
            var members = _members.Values.Select(CloneMember).ToList();
            SquadMember? hostPose = CopyLatestPose();
            if (hostPose != null) members.Add(hostPose);
            byte[] bytes = EncryptMessage(new SquadWireMessage
            {
                version = ProtocolVersion,
                type = "snapshot",
                senderId = _senderId,
                sequence = Interlocked.Increment(ref _sendSequence),
                sentAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                members = members
            });
            foreach (IPEndPoint endpoint in _clientEndpoints.Values.Distinct())
                await _receiver.SendAsync(bytes, endpoint, token);
        }

        private SquadMember? CopyLatestPose()
        {
            lock (_poseLock)
            {
                if (_latestPose == null) return null;
                SquadMember copy = CloneMember(_latestPose);
                copy.name = _name;
                copy.lastSeen = DateTimeOffset.UtcNow;
                return copy;
            }
        }

        private byte[] EncryptMessage(SquadWireMessage message)
        {
            if (_sessionKey == null) throw new InvalidOperationException("No direct squad session key is configured.");
            byte[] plaintext = Encoding.UTF8.GetBytes(JsonConvert.SerializeObject(message));
            byte[] nonce = RandomNumberGenerator.GetBytes(12);
            byte[] tag = new byte[16];
            byte[] ciphertext = new byte[plaintext.Length];
            using (var aes = new AesGcm(_sessionKey, tag.Length))
                aes.Encrypt(nonce, plaintext, ciphertext, tag, AssociatedData);

            byte[] result = new byte[WireMagic.Length + nonce.Length + tag.Length + ciphertext.Length];
            Buffer.BlockCopy(WireMagic, 0, result, 0, WireMagic.Length);
            Buffer.BlockCopy(nonce, 0, result, WireMagic.Length, nonce.Length);
            Buffer.BlockCopy(tag, 0, result, WireMagic.Length + nonce.Length, tag.Length);
            Buffer.BlockCopy(ciphertext, 0, result, WireMagic.Length + nonce.Length + tag.Length, ciphertext.Length);
            return result;
        }

        private SquadWireMessage? DecryptMessage(byte[] packet)
        {
            if (_sessionKey == null || packet.Length < WireMagic.Length + 12 + 16 ||
                !packet.AsSpan(0, WireMagic.Length).SequenceEqual(WireMagic)) return null;

            ReadOnlySpan<byte> nonce = packet.AsSpan(WireMagic.Length, 12);
            ReadOnlySpan<byte> tag = packet.AsSpan(WireMagic.Length + 12, 16);
            ReadOnlySpan<byte> ciphertext = packet.AsSpan(WireMagic.Length + 28);
            byte[] plaintext = new byte[ciphertext.Length];
            using (var aes = new AesGcm(_sessionKey, tag.Length))
                aes.Decrypt(nonce, ciphertext, tag, plaintext, AssociatedData);
            return JsonConvert.DeserializeObject<SquadWireMessage>(Encoding.UTF8.GetString(plaintext));
        }

        private void PruneMembers()
        {
            DateTimeOffset cutoff = DateTimeOffset.UtcNow.AddSeconds(-5);
            bool changed = false;
            foreach (var pair in _members)
            {
                if (pair.Value.lastSeen >= cutoff) continue;
                changed |= _members.TryRemove(pair.Key, out _);
                _clientEndpoints.TryRemove(pair.Key, out _);
                _clientSequences.TryRemove(pair.Key, out _);
            }
            if (changed)
            {
                PublishMembers();
                if (_mode == "host") PublishStatus("listening", $"Hosting on UDP {_port} · {_clientEndpoints.Count} client(s).");
            }
            if (_mode == "client" && _lastHostMessageAt != DateTimeOffset.MinValue &&
                _lastHostMessageAt < DateTimeOffset.UtcNow.AddSeconds(-5))
                PublishStatus("connecting", $"Connection to {_serverEndpoint?.Address}:{_port} was lost; retrying...");
        }

        private void PublishMembers() => MembersChanged?.Invoke(_members.Values.OrderBy(member => member.name).ToList());

        private void PublishStatus(string state, string message)
        {
            string statusKey = $"{state}\n{message}";
            if (_lastStatusState == statusKey) return;
            _lastStatusState = statusKey;
            StatusChanged?.Invoke(new SquadConnectionStatus { mode = _mode, state = state, message = message });
        }

        public void Stop()
        {
            _cancel?.Cancel();
            try { if (_mode == "lan") _receiver?.DropMulticastGroup(MulticastGroup); } catch { }
            _receiver?.Dispose();
            _sender?.Dispose();
            _receiver = null;
            _sender = null;
            _serverEndpoint = null;
            _sessionKey = null;
            _cancel?.Dispose();
            _cancel = null;
            _receiveTask = null;
            _sendTask = null;
            _members.Clear();
            _clientEndpoints.Clear();
            _clientSequences.Clear();
            _lastHostSequence = 0;
            _hostSenderId = string.Empty;
            _lastHostMessageAt = DateTimeOffset.MinValue;
            MembersChanged?.Invoke(Array.Empty<SquadMember>());
        }

        public void Dispose() => Stop();

        private static SquadMember CloneMember(SquadMember member) => new()
        {
            id = member.id,
            name = member.name,
            map = member.map,
            x = member.x,
            y = member.y,
            z = member.z,
            qx = member.qx,
            qy = member.qy,
            qz = member.qz,
            qw = member.qw,
            lastSeen = member.lastSeen
        };

        private sealed class SquadWireMessage
        {
            public int version { get; set; }
            public string type { get; set; } = string.Empty;
            public string senderId { get; set; } = string.Empty;
            public long sequence { get; set; }
            public long sentAt { get; set; }
            public SquadMember? member { get; set; }
            public List<SquadMember>? members { get; set; }
        }

        private sealed class LanSquadPacket
        {
            public int version { get; set; }
            public string room { get; set; } = string.Empty;
            public string senderId { get; set; } = string.Empty;
            public string name { get; set; } = string.Empty;
            public string map { get; set; } = string.Empty;
            public double x { get; set; }
            public double y { get; set; }
            public double z { get; set; }
            public double qx { get; set; }
            public double qy { get; set; }
            public double qz { get; set; }
            public double qw { get; set; }
            public long sentAt { get; set; }

            public SquadMember ToMember() => new()
            {
                id = senderId,
                name = string.IsNullOrWhiteSpace(name) ? "Squad" : name,
                map = map,
                x = x,
                y = y,
                z = z,
                qx = qx,
                qy = qy,
                qz = qz,
                qw = qw,
                lastSeen = DateTimeOffset.UtcNow
            };

            public static LanSquadPacket FromMember(SquadMember member, string room) => new()
            {
                version = 1,
                room = room,
                senderId = member.id,
                name = member.name,
                map = member.map,
                x = member.x,
                y = member.y,
                z = member.z,
                qx = member.qx,
                qy = member.qy,
                qz = member.qz,
                qw = member.qw,
                sentAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
            };
        }
    }

    public sealed class SquadMember
    {
        public string id { get; set; } = string.Empty;
        public string name { get; set; } = string.Empty;
        public string map { get; set; } = string.Empty;
        public double x { get; set; }
        public double y { get; set; }
        public double z { get; set; }
        public double qx { get; set; }
        public double qy { get; set; }
        public double qz { get; set; }
        public double qw { get; set; }
        [JsonIgnore] public DateTimeOffset lastSeen { get; set; }
    }

    public sealed class SquadConnectionStatus
    {
        public string mode { get; set; } = "off";
        public string state { get; set; } = "off";
        public string message { get; set; } = string.Empty;
    }
}
