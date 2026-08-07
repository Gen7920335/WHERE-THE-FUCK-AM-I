using System.Net;
using System.Net.Sockets;
using eft_where_am_i.Classes;

static int ReserveUdpPort()
{
    using var socket = new UdpClient(new IPEndPoint(IPAddress.Loopback, 0));
    return ((IPEndPoint)socket.Client.LocalEndPoint!).Port;
}

int port = ReserveUdpPort();
const string password = "smoke-test-password-2026";
using var host = new SquadSyncService();
using var client = new SquadSyncService();
using var wrongPasswordClient = new SquadSyncService();
var hostSawClient = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
var clientSawHost = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
bool hostAcceptedWrongPassword = false;

host.MembersChanged += members =>
{
    if (members.Any(member => member.name == "Client" && member.map == "customs" && Math.Abs(member.x - 44.5) < 0.01))
        hostSawClient.TrySetResult(true);
    if (members.Any(member => member.name == "WrongPassword")) hostAcceptedWrongPassword = true;
};
client.MembersChanged += members =>
{
    if (members.Any(member => member.name == "Host" && member.map == "customs" && Math.Abs(member.z - 99.25) < 0.01))
        clientSawHost.TrySetResult(true);
};

host.Configure("host", "Host", "unused", "", password, port);
client.Configure("client", "Client", "unused", "127.0.0.1", password, port);
wrongPasswordClient.Configure("client", "WrongPassword", "unused", "127.0.0.1", "definitely-the-wrong-password", port);
host.UpdatePose("customs", 10, 20, 99.25, 0, 0, 0, 1);
client.UpdatePose("customs", 44.5, 2, 3, 0, 0, 0, 1);
wrongPasswordClient.UpdatePose("customs", 7, 8, 9, 0, 0, 0, 1);

Task exchange = Task.WhenAll(hostSawClient.Task, clientSawHost.Task);
Task completed = await Task.WhenAny(exchange, Task.Delay(TimeSpan.FromSeconds(10)));
if (completed != exchange)
    throw new InvalidOperationException("Direct squad host/client loopback exchange timed out.");

await Task.Delay(1500);
if (hostAcceptedWrongPassword) throw new InvalidOperationException("Host accepted a packet encrypted with the wrong password.");

Console.WriteLine($"Direct squad smoke test passed on UDP {port}: encrypted host/client poses exchanged; wrong password rejected.");
