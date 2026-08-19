using System.Collections.Concurrent;
using System.Net;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;
using Newtonsoft.Json;

namespace eft_where_am_i.Classes
{
    internal sealed class SquadNetworkService : IDisposable
    {
        private const int ProtocolVersion = 1;
        private const int KeyIterations = 150_000;
        private const int MaxClients = 8;
        private readonly string localPlayerId = Guid.NewGuid().ToString("N");
        private readonly ConcurrentDictionary<string, SquadPosition> positions = new(StringComparer.OrdinalIgnoreCase);
        private readonly ConcurrentDictionary<string, MapPing> pings = new(StringComparer.OrdinalIgnoreCase);
        private readonly ConcurrentDictionary<string, PeerConnection> hostPeers = new(StringComparer.OrdinalIgnoreCase);
        private CancellationTokenSource? cancellation;
        private TcpListener? listener;
        private PeerConnection? serverConnection;
        private string password = string.Empty;
        private string localName = "Player";
        private string hostName = "Host";
        private bool disposed;

        public event Action<string>? StatusChanged;
        public event Action? ParticipantsChanged;
        public event Action? PositionsChanged;
        public event Action<MapPing>? PingReceived;
        public event Action<string, string>? PingDeleted;
        public event Action<string>? PingsCleared;

        public bool IsHost { get; private set; }
        public bool IsConnected { get; private set; }
        public int Port { get; private set; }
        public string ModeLabel => !IsConnected ? "Disconnected" : IsHost ? "Host" : "Client";

        public async Task StartHostAsync(int port, string sessionPassword, string displayName)
        {
            ValidateArguments(port, sessionPassword, displayName);
            Stop();

            cancellation = new CancellationTokenSource();
            password = sessionPassword;
            localName = NormalizeName(displayName);
            Port = port;
            IsHost = true;
            IsConnected = true;
            listener = new TcpListener(IPAddress.Any, port);
            listener.Start(MaxClients);
            _ = AcceptLoopAsync(cancellation.Token);
            RaiseStatus($"Hosting on 0.0.0.0:{port}");
            ParticipantsChanged?.Invoke();
            await Task.CompletedTask;
        }

        public async Task JoinAsync(string host, int port, string sessionPassword, string displayName)
        {
            ValidateArguments(port, sessionPassword, displayName);
            if (string.IsNullOrWhiteSpace(host))
            {
                throw new ArgumentException("Host address is required.", nameof(host));
            }

            Stop();
            cancellation = new CancellationTokenSource();
            password = sessionPassword;
            localName = NormalizeName(displayName);
            Port = port;

            var client = new TcpClient(AddressFamily.InterNetwork);
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellation.Token);
            timeout.CancelAfter(TimeSpan.FromSeconds(10));
            try
            {
                await client.ConnectAsync(host.Trim(), port, timeout.Token);
                serverConnection = await AuthenticateAsClientAsync(client, timeout.Token);
                IsHost = false;
                IsConnected = true;
                _ = ClientReadLoopAsync(serverConnection, cancellation.Token);
                RaiseStatus($"Connected to {host.Trim()}:{port}");
                ParticipantsChanged?.Invoke();
            }
            catch
            {
                client.Dispose();
                Stop();
                throw;
            }
        }

        public void UpdateLocalPosition(SquadPosition source)
        {
            if (!IsConnected || source == null)
            {
                return;
            }

            SquadPosition position = source.Copy();
            position.playerId = localPlayerId;
            position.name = localName;
            position.timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            positions[localPlayerId] = position;
            PositionsChanged?.Invoke();

            var message = new SquadNetworkMessage { type = "position", position = position };
            if (IsHost)
            {
                _ = BroadcastAsync(message, null, cancellation?.Token ?? CancellationToken.None);
            }
            else if (serverConnection != null)
            {
                _ = SafeSendAsync(serverConnection, message, cancellation?.Token ?? CancellationToken.None);
            }
        }

        public void PublishPing(MapPing source)
        {
            if (!IsConnected || source == null || !IsValidPing(source))
            {
                return;
            }

            MapPing ping = source.Copy();
            ping.creatorId = localPlayerId;
            ping.creatorName = localName;
            pings[ping.id] = ping;
            var message = new SquadNetworkMessage { type = "ping-upsert", ping = ping };
            if (IsHost)
            {
                _ = BroadcastAsync(message, null, cancellation?.Token ?? CancellationToken.None);
            }
            else if (serverConnection != null)
            {
                _ = SafeSendAsync(serverConnection, message, cancellation?.Token ?? CancellationToken.None);
            }
        }

        public void ClearPings(string map)
        {
            string normalizedMap = NormalizeMap(map);
            if (!IsConnected || normalizedMap.Length == 0)
            {
                return;
            }

            RemovePingsForMap(normalizedMap);
            var message = new SquadNetworkMessage { type = "ping-clear", map = normalizedMap };
            if (IsHost)
            {
                _ = BroadcastAsync(message, null, cancellation?.Token ?? CancellationToken.None);
            }
            else if (serverConnection != null)
            {
                _ = SafeSendAsync(serverConnection, message, cancellation?.Token ?? CancellationToken.None);
            }
        }

        public void DeletePing(string map, string pingId)
        {
            string normalizedMap = NormalizeMap(map);
            if (!IsConnected || normalizedMap.Length == 0 || !IsValidPingId(pingId))
            {
                return;
            }

            RemovePing(normalizedMap, pingId);
            var message = new SquadNetworkMessage
            {
                type = "ping-delete",
                map = normalizedMap,
                pingId = pingId
            };
            if (IsHost)
            {
                _ = BroadcastAsync(message, null, cancellation?.Token ?? CancellationToken.None);
            }
            else if (serverConnection != null)
            {
                _ = SafeSendAsync(serverConnection, message, cancellation?.Token ?? CancellationToken.None);
            }
        }

        public IReadOnlyList<SquadPosition> GetRemotePositions() => positions.Values
            .Where(position => !string.Equals(position.playerId, localPlayerId, StringComparison.OrdinalIgnoreCase))
            .Select(position => position.Copy())
            .OrderBy(position => position.name, StringComparer.OrdinalIgnoreCase)
            .ToList();

        public IReadOnlyList<string> GetParticipantNames()
        {
            var names = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { localName };
            if (IsHost)
            {
                foreach (PeerConnection peer in hostPeers.Values)
                {
                    names.Add(peer.Name);
                }
            }
            else if (IsConnected)
            {
                names.Add(hostName);
                foreach (SquadPosition position in positions.Values)
                {
                    names.Add(position.name);
                }
            }
            return names.OrderBy(name => name, StringComparer.OrdinalIgnoreCase).ToList();
        }

        public void Stop()
        {
            cancellation?.Cancel();
            listener?.Stop();
            listener = null;
            serverConnection?.Dispose();
            serverConnection = null;
            foreach (PeerConnection peer in hostPeers.Values)
            {
                peer.Dispose();
            }
            hostPeers.Clear();
            positions.Clear();
            pings.Clear();
            cancellation?.Dispose();
            cancellation = null;
            IsConnected = false;
            IsHost = false;
            Port = 0;
            if (!disposed)
            {
                RaiseStatus("Disconnected");
                ParticipantsChanged?.Invoke();
                PositionsChanged?.Invoke();
            }
        }

        private async Task AcceptLoopAsync(CancellationToken token)
        {
            while (!token.IsCancellationRequested && listener != null)
            {
                TcpClient? client = null;
                try
                {
                    client = await listener.AcceptTcpClientAsync(token);
                    if (hostPeers.Count >= MaxClients)
                    {
                        client.Dispose();
                        continue;
                    }
                    _ = HandleAcceptedClientAsync(client, token);
                }
                catch (OperationCanceledException)
                {
                    client?.Dispose();
                    break;
                }
                catch (ObjectDisposedException)
                {
                    client?.Dispose();
                    break;
                }
                catch (Exception ex)
                {
                    client?.Dispose();
                    RaiseStatus($"Accept failed: {ex.Message}");
                }
            }
        }

        private async Task HandleAcceptedClientAsync(TcpClient client, CancellationToken token)
        {
            PeerConnection? peer = null;
            try
            {
                using var timeout = CancellationTokenSource.CreateLinkedTokenSource(token);
                timeout.CancelAfter(TimeSpan.FromSeconds(10));
                peer = await AuthenticateAsHostAsync(client, timeout.Token);
                if (!hostPeers.TryAdd(peer.PlayerId, peer))
                {
                    throw new InvalidOperationException("Duplicate player ID.");
                }

                foreach (SquadPosition position in positions.Values)
                {
                    await peer.SendAsync(new SquadNetworkMessage { type = "position", position = position }, token);
                }
                foreach (MapPing ping in pings.Values.OrderBy(value => value.createdAt))
                {
                    await peer.SendAsync(new SquadNetworkMessage { type = "ping-upsert", ping = ping.Copy() }, token);
                }

                RaiseStatus($"{peer.Name} joined");
                ParticipantsChanged?.Invoke();
                await HostPeerReadLoopAsync(peer, token);
            }
            catch (OperationCanceledException)
            {
            }
            catch (Exception ex)
            {
                RaiseStatus($"Client rejected: {ex.Message}");
            }
            finally
            {
                client.Dispose();
                if (peer != null && hostPeers.TryRemove(peer.PlayerId, out _))
                {
                    positions.TryRemove(peer.PlayerId, out _);
                    await BroadcastAsync(
                        new SquadNetworkMessage { type = "remove", playerId = peer.PlayerId },
                        null,
                        token);
                    RaiseStatus($"{peer.Name} left");
                    ParticipantsChanged?.Invoke();
                    PositionsChanged?.Invoke();
                }
                peer?.Dispose();
            }
        }

        private async Task HostPeerReadLoopAsync(PeerConnection peer, CancellationToken token)
        {
            while (!token.IsCancellationRequested)
            {
                SquadNetworkMessage? message = await peer.ReceiveAsync(token);
                if (message == null)
                {
                    break;
                }

                if (message.type == "position" && message.position != null)
                {
                    message.position.playerId = peer.PlayerId;
                    message.position.name = peer.Name;
                    message.position.timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
                    positions[peer.PlayerId] = message.position.Copy();
                    PositionsChanged?.Invoke();
                    await BroadcastAsync(message, peer.PlayerId, token);
                }
                else if (message.type == "ping-upsert" && message.ping != null && IsValidPing(message.ping))
                {
                    MapPing ping = message.ping.Copy();
                    ping.creatorId = peer.PlayerId;
                    ping.creatorName = peer.Name;
                    pings[ping.id] = ping;
                    PingReceived?.Invoke(ping.Copy());
                    await BroadcastAsync(new SquadNetworkMessage { type = "ping-upsert", ping = ping }, peer.PlayerId, token);
                }
                else if (message.type == "ping-clear")
                {
                    string map = NormalizeMap(message.map);
                    if (map.Length == 0) continue;
                    RemovePingsForMap(map);
                    PingsCleared?.Invoke(map);
                    await BroadcastAsync(new SquadNetworkMessage { type = "ping-clear", map = map }, null, token);
                }
                else if (message.type == "ping-delete" && IsValidPingId(message.pingId))
                {
                    string map = NormalizeMap(message.map);
                    if (map.Length == 0) continue;
                    RemovePing(map, message.pingId);
                    PingDeleted?.Invoke(map, message.pingId);
                    await BroadcastAsync(new SquadNetworkMessage
                    {
                        type = "ping-delete",
                        map = map,
                        pingId = message.pingId
                    }, null, token);
                }
            }
        }

        private async Task ClientReadLoopAsync(PeerConnection connection, CancellationToken token)
        {
            try
            {
                while (!token.IsCancellationRequested)
                {
                    SquadNetworkMessage? message = await connection.ReceiveAsync(token);
                    if (message == null)
                    {
                        break;
                    }

                    if (message.type == "position" && message.position != null
                        && !string.Equals(message.position.playerId, localPlayerId, StringComparison.OrdinalIgnoreCase))
                    {
                        positions[message.position.playerId] = message.position.Copy();
                        ParticipantsChanged?.Invoke();
                        PositionsChanged?.Invoke();
                    }
                    else if (message.type == "remove" && !string.IsNullOrWhiteSpace(message.playerId))
                    {
                        positions.TryRemove(message.playerId, out _);
                        ParticipantsChanged?.Invoke();
                        PositionsChanged?.Invoke();
                    }
                    else if (message.type == "ping-upsert" && message.ping != null && IsValidPing(message.ping))
                    {
                        MapPing ping = message.ping.Copy();
                        pings[ping.id] = ping;
                        PingReceived?.Invoke(ping.Copy());
                    }
                    else if (message.type == "ping-clear")
                    {
                        string map = NormalizeMap(message.map);
                        if (map.Length == 0) continue;
                        RemovePingsForMap(map);
                        PingsCleared?.Invoke(map);
                    }
                    else if (message.type == "ping-delete" && IsValidPingId(message.pingId))
                    {
                        string map = NormalizeMap(message.map);
                        if (map.Length == 0) continue;
                        RemovePing(map, message.pingId);
                        PingDeleted?.Invoke(map, message.pingId);
                    }
                }
            }
            catch (OperationCanceledException)
            {
            }
            catch (Exception ex)
            {
                RaiseStatus($"Connection lost: {ex.Message}");
            }
            finally
            {
                if (!token.IsCancellationRequested)
                {
                    Stop();
                }
            }
        }

        private async Task BroadcastAsync(SquadNetworkMessage message, string? exceptPlayerId, CancellationToken token)
        {
            foreach (PeerConnection peer in hostPeers.Values)
            {
                if (string.Equals(peer.PlayerId, exceptPlayerId, StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }
                await SafeSendAsync(peer, message, token);
            }
        }

        private void RemovePingsForMap(string map)
        {
            foreach (KeyValuePair<string, MapPing> entry in pings)
            {
                if (string.Equals(entry.Value.map, map, StringComparison.OrdinalIgnoreCase))
                {
                    pings.TryRemove(entry.Key, out _);
                }
            }
        }

        private void RemovePing(string map, string pingId)
        {
            if (pings.TryGetValue(pingId, out MapPing? ping)
                && string.Equals(ping.map, map, StringComparison.OrdinalIgnoreCase))
            {
                pings.TryRemove(pingId, out _);
            }
        }

        private static bool IsValidPingId(string? pingId) =>
            !string.IsNullOrWhiteSpace(pingId) && pingId.Length <= 80;

        private static bool IsValidPing(MapPing ping) =>
            !string.IsNullOrWhiteSpace(ping.id)
            && ping.id.Length <= 80
            && NormalizeMap(ping.map).Length > 0
            && double.IsFinite(ping.left)
            && double.IsFinite(ping.top)
            && ping.left >= 0 && ping.left <= 100
            && ping.top >= 0 && ping.top <= 100;

        private static string NormalizeMap(string? map)
        {
            string value = (map ?? string.Empty).Trim().ToLowerInvariant();
            return value.Length <= 64 ? value : string.Empty;
        }

        private static async Task SafeSendAsync(PeerConnection peer, SquadNetworkMessage message, CancellationToken token)
        {
            try
            {
                await peer.SendAsync(message, token);
            }
            catch (OperationCanceledException)
            {
            }
            catch
            {
                peer.Dispose();
            }
        }

        private async Task<PeerConnection> AuthenticateAsHostAsync(TcpClient client, CancellationToken token)
        {
            var reader = CreateReader(client);
            var writer = CreateWriter(client);
            byte[] salt = RandomNumberGenerator.GetBytes(16);
            byte[] challenge = RandomNumberGenerator.GetBytes(32);
            await WritePlainAsync(writer, new SquadHandshakeMessage
            {
                type = $"hello-{ProtocolVersion}",
                salt = Convert.ToBase64String(salt),
                challenge = Convert.ToBase64String(challenge)
            }, token);

            SquadHandshakeMessage auth = await ReadPlainAsync(reader, token);
            if (auth.type != "auth" || string.IsNullOrWhiteSpace(auth.playerId) || string.IsNullOrWhiteSpace(auth.name))
            {
                throw new InvalidOperationException("Invalid authentication message.");
            }

            byte[] key = DeriveKey(password, salt);
            byte[] expected = ComputeProof(key, $"client|{Convert.ToBase64String(challenge)}|{auth.playerId}|{NormalizeName(auth.name)}");
            byte[] actual = Convert.FromBase64String(auth.proof);
            if (!CryptographicOperations.FixedTimeEquals(expected, actual))
            {
                await WritePlainAsync(writer, new SquadHandshakeMessage { type = "error", error = "Wrong password" }, token);
                throw new UnauthorizedAccessException("Wrong password.");
            }

            await WritePlainAsync(writer, new SquadHandshakeMessage
            {
                type = "accepted",
                name = localName,
                proof = Convert.ToBase64String(ComputeProof(key, $"server|{Convert.ToBase64String(challenge)}|{auth.playerId}"))
            }, token);
            return new PeerConnection(client, reader, writer, key, auth.playerId, NormalizeName(auth.name));
        }

        private async Task<PeerConnection> AuthenticateAsClientAsync(TcpClient client, CancellationToken token)
        {
            var reader = CreateReader(client);
            var writer = CreateWriter(client);
            SquadHandshakeMessage hello = await ReadPlainAsync(reader, token);
            if (hello.type != $"hello-{ProtocolVersion}")
            {
                throw new InvalidOperationException("Unsupported squad protocol.");
            }

            byte[] salt = Convert.FromBase64String(hello.salt);
            byte[] key = DeriveKey(password, salt);
            string normalizedName = NormalizeName(localName);
            await WritePlainAsync(writer, new SquadHandshakeMessage
            {
                type = "auth",
                playerId = localPlayerId,
                name = normalizedName,
                proof = Convert.ToBase64String(ComputeProof(key, $"client|{hello.challenge}|{localPlayerId}|{normalizedName}"))
            }, token);

            SquadHandshakeMessage accepted = await ReadPlainAsync(reader, token);
            if (accepted.type == "error")
            {
                throw new UnauthorizedAccessException(accepted.error);
            }
            byte[] expected = ComputeProof(key, $"server|{hello.challenge}|{localPlayerId}");
            byte[] actual = Convert.FromBase64String(accepted.proof);
            if (accepted.type != "accepted" || !CryptographicOperations.FixedTimeEquals(expected, actual))
            {
                throw new UnauthorizedAccessException("Host authentication failed.");
            }
            hostName = NormalizeName(accepted.name);
            return new PeerConnection(client, reader, writer, key, "host", hostName);
        }

        private static StreamReader CreateReader(TcpClient client) =>
            new(client.GetStream(), new UTF8Encoding(false), false, 4096, leaveOpen: true);

        private static StreamWriter CreateWriter(TcpClient client) =>
            new(client.GetStream(), new UTF8Encoding(false), 4096, leaveOpen: true) { AutoFlush = true, NewLine = "\n" };

        private static async Task WritePlainAsync(StreamWriter writer, SquadHandshakeMessage message, CancellationToken token)
        {
            await writer.WriteLineAsync(JsonConvert.SerializeObject(message).AsMemory(), token);
        }

        private static async Task<SquadHandshakeMessage> ReadPlainAsync(StreamReader reader, CancellationToken token)
        {
            string? line = await reader.ReadLineAsync(token);
            if (string.IsNullOrWhiteSpace(line) || line.Length > 64 * 1024)
            {
                throw new IOException("Connection closed during authentication.");
            }
            return JsonConvert.DeserializeObject<SquadHandshakeMessage>(line)
                ?? throw new InvalidDataException("Invalid authentication data.");
        }

        private static byte[] DeriveKey(string value, byte[] salt) =>
            Rfc2898DeriveBytes.Pbkdf2(Encoding.UTF8.GetBytes(value), salt, KeyIterations, HashAlgorithmName.SHA256, 32);

        private static byte[] ComputeProof(byte[] key, string value)
        {
            using var hmac = new HMACSHA256(key);
            return hmac.ComputeHash(Encoding.UTF8.GetBytes(value));
        }

        private static void ValidateArguments(int port, string sessionPassword, string displayName)
        {
            if (port is < 1024 or > 65535)
            {
                throw new ArgumentOutOfRangeException(nameof(port), "Port must be between 1024 and 65535.");
            }
            if (string.IsNullOrWhiteSpace(sessionPassword) || sessionPassword.Length < 4)
            {
                throw new ArgumentException("Password must contain at least 4 characters.", nameof(sessionPassword));
            }
            if (string.IsNullOrWhiteSpace(displayName))
            {
                throw new ArgumentException("Player name is required.", nameof(displayName));
            }
        }

        private static string NormalizeName(string value)
        {
            string normalized = (value ?? string.Empty).Trim();
            if (normalized.Length == 0)
            {
                return "Player";
            }
            return normalized.Length <= 24 ? normalized : normalized[..24];
        }

        private void RaiseStatus(string message)
        {
            AppLogger.Info("Squad", message);
            StatusChanged?.Invoke(message);
        }

        public void Dispose()
        {
            if (disposed)
            {
                return;
            }
            disposed = true;
            Stop();
        }

        private sealed class PeerConnection : IDisposable
        {
            private readonly TcpClient client;
            private readonly StreamReader reader;
            private readonly StreamWriter writer;
            private readonly byte[] key;
            private readonly SemaphoreSlim writeLock = new(1, 1);
            private bool disposed;

            public PeerConnection(
                TcpClient client,
                StreamReader reader,
                StreamWriter writer,
                byte[] key,
                string playerId,
                string name)
            {
                this.client = client;
                this.reader = reader;
                this.writer = writer;
                this.key = key;
                PlayerId = playerId;
                Name = name;
                client.NoDelay = true;
            }

            public string PlayerId { get; }
            public string Name { get; }

            public async Task SendAsync(SquadNetworkMessage message, CancellationToken token)
            {
                byte[] plainText = Encoding.UTF8.GetBytes(JsonConvert.SerializeObject(message));
                byte[] nonce = RandomNumberGenerator.GetBytes(12);
                byte[] cipherText = new byte[plainText.Length];
                byte[] tag = new byte[16];
                using (var aes = new AesGcm(key, tag.Length))
                {
                    aes.Encrypt(nonce, plainText, cipherText, tag);
                }

                string line = JsonConvert.SerializeObject(new SquadEncryptedEnvelope
                {
                    nonce = Convert.ToBase64String(nonce),
                    cipherText = Convert.ToBase64String(cipherText),
                    tag = Convert.ToBase64String(tag)
                });

                await writeLock.WaitAsync(token);
                try
                {
                    await writer.WriteLineAsync(line.AsMemory(), token);
                }
                finally
                {
                    writeLock.Release();
                }
            }

            public async Task<SquadNetworkMessage?> ReceiveAsync(CancellationToken token)
            {
                string? line = await reader.ReadLineAsync(token);
                if (line == null)
                {
                    return null;
                }
                if (line.Length > 64 * 1024)
                {
                    throw new InvalidDataException("Squad packet is too large.");
                }

                SquadEncryptedEnvelope envelope = JsonConvert.DeserializeObject<SquadEncryptedEnvelope>(line)
                    ?? throw new InvalidDataException("Invalid squad packet.");
                byte[] nonce = Convert.FromBase64String(envelope.nonce);
                byte[] cipherText = Convert.FromBase64String(envelope.cipherText);
                byte[] tag = Convert.FromBase64String(envelope.tag);
                byte[] plainText = new byte[cipherText.Length];
                using (var aes = new AesGcm(key, tag.Length))
                {
                    aes.Decrypt(nonce, cipherText, tag, plainText);
                }
                return JsonConvert.DeserializeObject<SquadNetworkMessage>(Encoding.UTF8.GetString(plainText));
            }

            public void Dispose()
            {
                if (disposed)
                {
                    return;
                }
                disposed = true;
                client.Dispose();
                reader.Dispose();
                writer.Dispose();
                writeLock.Dispose();
                CryptographicOperations.ZeroMemory(key);
            }
        }
    }
}
