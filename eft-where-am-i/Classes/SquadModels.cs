using System.Globalization;
using Newtonsoft.Json;

namespace eft_where_am_i.Classes
{
    public sealed class MapRouteNode
    {
        public string id { get; set; } = string.Empty;
        public string map { get; set; } = string.Empty;
        public string creatorId { get; set; } = string.Empty;
        public string creatorName { get; set; } = string.Empty;
        public int participantSlot { get; set; }
        public double left { get; set; }
        public double top { get; set; }
        public int? floor { get; set; }
        public long createdAt { get; set; }

        public MapRouteNode Copy() => new()
        {
            id = id,
            map = map,
            creatorId = creatorId,
            creatorName = creatorName,
            participantSlot = participantSlot,
            left = left,
            top = top,
            floor = floor,
            createdAt = createdAt
        };
    }

    public sealed class MapPing
    {
        public string id { get; set; } = string.Empty;
        public string map { get; set; } = string.Empty;
        public string creatorId { get; set; } = string.Empty;
        public string creatorName { get; set; } = string.Empty;
        public int participantSlot { get; set; }
        public double left { get; set; }
        public double top { get; set; }
        public int? floor { get; set; }
        public long createdAt { get; set; }

        public MapPing Copy() => new()
        {
            id = id,
            map = map,
            creatorId = creatorId,
            creatorName = creatorName,
            participantSlot = participantSlot,
            left = left,
            top = top,
            floor = floor,
            createdAt = createdAt
        };
    }

    internal sealed class SquadPosition
    {
        public string playerId { get; set; } = string.Empty;
        public string name { get; set; } = string.Empty;
        public string map { get; set; } = string.Empty;
        public double x { get; set; }
        public double y { get; set; }
        public double z { get; set; }
        public double qx { get; set; }
        public double qy { get; set; }
        public double qz { get; set; }
        public double qw { get; set; } = 1;
        public long timestamp { get; set; }

        public SquadPosition Copy() => new()
        {
            playerId = playerId,
            name = name,
            map = map,
            x = x,
            y = y,
            z = z,
            qx = qx,
            qy = qy,
            qz = qz,
            qw = qw,
            timestamp = timestamp
        };
    }

    internal sealed class SquadOverlaySnapshot
    {
        public string map { get; set; } = string.Empty;
        public List<SquadOverlayMember> members { get; set; } = new();
    }

    internal sealed class SquadOverlayMember
    {
        public string id { get; set; } = string.Empty;
        public string name { get; set; } = string.Empty;
        public double left { get; set; }
        public double top { get; set; }
        public double elevation { get; set; }
        public double direction { get; set; }
    }

    internal static class SquadPositionParser
    {
        public static bool TryParseScreenshotName(string fileName, string map, out SquadPosition position)
        {
            position = new SquadPosition();
            string nameWithoutExtension = Path.GetFileNameWithoutExtension(fileName ?? string.Empty);
            string[] parts = nameWithoutExtension.Split('_');
            if (parts.Length < 3)
            {
                return false;
            }

            string[] coordinates = parts[1].Split(',');
            string[] rotation = parts[2].Split(',');
            if (coordinates.Length < 3 || rotation.Length < 4
                || !TryDouble(coordinates[0], out double x)
                || !TryDouble(coordinates[1], out double y)
                || !TryDouble(coordinates[2], out double z)
                || !TryDouble(rotation[0], out double qx)
                || !TryDouble(rotation[1], out double qy)
                || !TryDouble(rotation[2], out double qz)
                || !TryDouble(rotation[3], out double qw))
            {
                return false;
            }

            position = new SquadPosition
            {
                map = map ?? string.Empty,
                x = x,
                y = y,
                z = z,
                qx = qx,
                qy = qy,
                qz = qz,
                qw = qw,
                timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
            };
            return true;
        }

        public static SquadOverlaySnapshot CreateOverlay(string map, IEnumerable<SquadPosition> positions)
        {
            var snapshot = new SquadOverlaySnapshot { map = map ?? string.Empty };
            foreach (SquadPosition position in positions)
            {
                if (!string.Equals(position.map, snapshot.map, StringComparison.OrdinalIgnoreCase)
                    || !TarkovMarketMapProjection.TryProject(position.map, position.x, position.z, out double left, out double top)
                    || !TarkovMarketMapProjection.TryProjectDirection(
                        position.map,
                        position.x,
                        position.z,
                        position.qx,
                        position.qy,
                        position.qz,
                        position.qw,
                        out double direction)
                    || left < -5 || left > 105 || top < -5 || top > 105)
                {
                    continue;
                }

                snapshot.members.Add(new SquadOverlayMember
                {
                    id = position.playerId,
                    name = position.name,
                    left = left,
                    top = top,
                    elevation = position.y,
                    direction = direction
                });
            }
            return snapshot;
        }

        private static bool TryDouble(string value, out double result) =>
            double.TryParse(value.Trim(), NumberStyles.Float, CultureInfo.InvariantCulture, out result);
    }

    internal sealed class SquadNetworkMessage
    {
        public string type { get; set; } = string.Empty;
        public SquadPosition? position { get; set; }
        public MapPing? ping { get; set; }
        public MapRouteNode? routeNode { get; set; }
        public string map { get; set; } = string.Empty;
        public string pingId { get; set; } = string.Empty;
        public string routeNodeId { get; set; } = string.Empty;
        public string playerId { get; set; } = string.Empty;
        public int participantSlot { get; set; }
    }

    internal sealed class SquadHandshakeMessage
    {
        public string type { get; set; } = string.Empty;
        public string salt { get; set; } = string.Empty;
        public string challenge { get; set; } = string.Empty;
        public string proof { get; set; } = string.Empty;
        public string playerId { get; set; } = string.Empty;
        public string name { get; set; } = string.Empty;
        public string error { get; set; } = string.Empty;
    }

    internal sealed class SquadEncryptedEnvelope
    {
        [JsonProperty("n")]
        public string nonce { get; set; } = string.Empty;

        [JsonProperty("c")]
        public string cipherText { get; set; } = string.Empty;

        [JsonProperty("t")]
        public string tag { get; set; } = string.Empty;
    }
}
