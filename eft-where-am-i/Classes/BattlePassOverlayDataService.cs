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
            double Width,
            double Height,
            double Rotation,
            double XOffset,
            double YOffset,
            double Ratio);

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

                    string confidenceLabel = location["coordinateBasis"]?.ToString() == "reported-poi-center"
                        ? "제보 POI 기준 추정 좌표"
                        : location["confidence"]?.ToString() == "reported"
                            ? "단일/추가 제보 좌표"
                            : "복수 제보 확인 좌표";
                    string details = string.Join(" · ", new[]
                    {
                        location["documents"]?.ToString(),
                        location["detail"]?.ToString(),
                        confidenceLabel,
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
            if (map.Width <= 0 || map.Height <= 0 || map.Ratio <= 0)
            {
                return false;
            }

            // Tarkov Market's native marker plane is geometry.x = EFT world Z and
            // geometry.y = EFT world X. Apply its production gamePosToMapPos logic.
            double gameX = worldZ;
            double gameY = worldX;
            double radians = -map.Rotation * Math.PI / 180.0;
            double rotatedX = (gameX * Math.Cos(radians)) - (gameY * Math.Sin(radians));
            double rotatedY = (gameX * Math.Sin(radians)) + (gameY * Math.Cos(radians));
            double mapX = map.XOffset - (rotatedX * map.Ratio);
            double mapY = map.YOffset - (rotatedY * map.Ratio);
            left = (mapX / map.Width) * 100.0;
            top = (mapY / map.Height) * 100.0;
            return double.IsFinite(left) && double.IsFinite(top);
        }

        private static bool TryReadDouble(JToken? token, out double value)
        {
            value = 0;
            return token != null && double.TryParse(token.ToString(), NumberStyles.Float, CultureInfo.InvariantCulture, out value);
        }

        private static Dictionary<string, MapDefinition> CreateMapDefinitions()
        {
            return new Dictionary<string, MapDefinition>(StringComparer.OrdinalIgnoreCase)
            {
                // Tarkov Market map settings observed from its production map bundle
                // on 2026-08-08 (size + transform passed to gamePosToMapPos).
                ["factory"] = new("factory", 3600, 3600, 0, 1800, 1850, 10),
                ["customs"] = new("customs", 4400, 3200, 90, 2600, 1600, 2),
                ["interchange"] = new("interchange", 4000, 3900, 90, 2166, 2004, 2),
                ["woods"] = new("woods", 4800, 4800, 90, 2200, 2840, 2),
                ["shoreline"] = new("shoreline", 3700, 3100, 90, 1570, 1450, 1),
                ["reserve"] = new("reserve", 3200, 3000, 105, 1600, 1520, 2),
                ["lighthouse"] = new("lighthouse", 3100, 3700, 90, 1550, 2050, 1),
                ["streets"] = new("streets", 3260, 3500, 90, 1660, 1420, 2),
                ["lab"] = new("lab", 5500, 4200, 180, 6100, 4050, 10),
                ["ground-zero"] = new("ground-zero", 2800, 3100, 90, 1600, 1300, 2),
                ["labyrinth"] = new("labyrinth", 3300, 3200, 180, 1485, 1602, 10),
                ["icebreaker"] = new("icebreaker", 5000, 8400, 90, 2500, 4200, 25)
            };
        }
    }
}
