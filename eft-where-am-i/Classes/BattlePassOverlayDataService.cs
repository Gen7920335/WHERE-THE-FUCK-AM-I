using System.Globalization;
using Newtonsoft.Json.Linq;

namespace eft_where_am_i.Classes
{
    internal sealed class BattlePassOverlaySnapshot
    {
        public string map { get; set; } = string.Empty;
        public List<BattlePassOverlayMarker> markers { get; set; } = new();
    }

    internal sealed class BattlePassOverlayMarker
    {
        public double left { get; set; }
        public double top { get; set; }
        public double elevation { get; set; }
        public string title { get; set; } = string.Empty;
        public string details { get; set; } = string.Empty;
    }

    internal sealed class BattlePassOverlayDataService
    {
        private sealed record MapDefinition(
            string Slug,
            (double X, double Z, double Left, double Top)[] Anchors);

        private static readonly Dictionary<string, MapDefinition> Maps = CreateMapDefinitions();
        private readonly Dictionary<string, BattlePassOverlaySnapshot> cache = new(StringComparer.OrdinalIgnoreCase);
        private JObject? sourceData;

        public BattlePassOverlaySnapshot GetMapSnapshot(string mapSlug)
        {
            if (string.IsNullOrWhiteSpace(mapSlug) || !Maps.TryGetValue(mapSlug, out MapDefinition? map))
            {
                return new BattlePassOverlaySnapshot { map = mapSlug ?? string.Empty };
            }

            if (cache.TryGetValue(mapSlug, out BattlePassOverlaySnapshot? cached))
            {
                return cached;
            }

            JObject data = LoadSourceData();
            var snapshot = new BattlePassOverlaySnapshot { map = mapSlug };
            if (data["maps"]?[mapSlug] is JArray locations)
            {
                foreach (JObject location in locations.OfType<JObject>())
                {
                    if (location["position"] is not JArray position
                        || position.Count < 3
                        || !TryReadDouble(position[0], out double worldX)
                        || !TryReadDouble(position[1], out double elevation)
                        || !TryReadDouble(position[2], out double worldZ)
                        || !TryProject(map, worldX, worldZ, out double left, out double top)
                        || left < -5 || left > 105 || top < -5 || top > 105)
                    {
                        continue;
                    }

                    string details = string.Join(" · ", new[]
                    {
                        location["documents"]?.ToString(),
                        location["detail"]?.ToString(),
                        location["confidence"] is JToken confidence ? $"Confidence: {confidence}" : null,
                        location["coordinateNote"]?.ToString()
                    }.Where(value => !string.IsNullOrWhiteSpace(value)));

                    snapshot.markers.Add(new BattlePassOverlayMarker
                    {
                        left = left,
                        top = top,
                        elevation = elevation,
                        title = location["title"]?.ToString() ?? "Battle Pass document",
                        details = details
                    });
                }
            }

            cache[mapSlug] = snapshot;
            AppLogger.Info("BattlePassOverlay", $"Loaded {snapshot.markers.Count} markers for {mapSlug}.");
            return snapshot;
        }

        private JObject LoadSourceData()
        {
            if (sourceData != null)
            {
                return sourceData;
            }

            string path = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "html", "battle-pass-locations.json");
            sourceData = File.Exists(path) ? JObject.Parse(File.ReadAllText(path)) : new JObject();
            return sourceData;
        }

        private static bool TryProject(MapDefinition map, double worldX, double worldZ, out double left, out double top)
        {
            left = 0;
            top = 0;
            var a = map.Anchors[0];
            var b = map.Anchors[1];
            var c = map.Anchors[2];
            double abX = b.X - a.X;
            double abZ = b.Z - a.Z;
            double acX = c.X - a.X;
            double acZ = c.Z - a.Z;
            double pointX = worldX - a.X;
            double pointZ = worldZ - a.Z;
            double determinant = (abX * acZ) - (abZ * acX);
            if (Math.Abs(determinant) < 0.000001)
            {
                return false;
            }

            double alongTop = ((pointX * acZ) - (pointZ * acX)) / determinant;
            double alongLeft = ((abX * pointZ) - (abZ * pointX)) / determinant;
            left = a.Left + (alongTop * (b.Left - a.Left)) + (alongLeft * (c.Left - a.Left));
            top = a.Top + (alongTop * (b.Top - a.Top)) + (alongLeft * (c.Top - a.Top));
            return true;
        }

        private static bool TryReadDouble(JToken? token, out double value)
        {
            value = 0;
            return token != null && double.TryParse(token.ToString(), NumberStyles.Float, CultureInfo.InvariantCulture, out value);
        }

        private static Dictionary<string, MapDefinition> CreateMapDefinitions()
        {
            static (double, double, double, double)[] A(params (double, double, double, double)[] values) => values;
            return new Dictionary<string, MapDefinition>(StringComparer.OrdinalIgnoreCase)
            {
                ["factory"] = new("factory", A((77, 67.4, 0, 0), (77, -64.5, 100, 0), (-65.5, 67.4, 0, 100))),
                ["customs"] = new("customs", A((698, -307, 0, 0), (-372, -307, 100, 0), (698, 237, 0, 100))),
                ["woods"] = new("woods", A((646, -914, 0, 0), (-761, -914, 100, 0), (646, 442, 0, 100))),
                ["shoreline"] = new("shoreline", A((504, -415, 0, 0), (-1056, -415, 100, 0), (504, 618, 0, 100))),
                ["interchange"] = new("interchange", A((598, -442, 0, 0), (-433, -442, 100, 0), (598, 426, 0, 100))),
                ["lab"] = new("lab", A((-287, -477, 0, 0), (-287, -193, 100, 0), (-80, -477, 0, 100))),
                ["reserve"] = new("reserve", A((289, -274, 0, 0), (-303, -274, 100, 0), (289, 272, 0, 100))),
                ["lighthouse"] = new("lighthouse", A((515, -998, 0, 0), (-545, -998, 100, 0), (515, 725, 0, 100))),
                ["streets"] = new("streets", A((323, -295, 0, 0), (-280, -295, 100, 0), (323, 532, 0, 100))),
                ["ground-zero"] = new("ground-zero", A((249, -124, 0, 0), (-99, -124, 100, 0), (249, 364, 0, 100))),
                ["terminal"] = new("terminal", A((463, -580, 0, 0), (-433, -580, 100, 0), (463, 475, 0, 100))),
                ["labyrinth"] = new("labyrinth", A((-52, -37, 0, 0), (-52, 76, 100, 0), (53, -37, 0, 100))),
                ["icebreaker"] = new("icebreaker", A((77, -64.5, 0, 0), (-65.5, -64.5, 100, 0), (77, 67.4, 0, 100)))
            };
        }
    }
}
