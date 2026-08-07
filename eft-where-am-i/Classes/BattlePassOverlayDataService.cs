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
        private readonly Dictionary<string, BattlePassOverlaySnapshot> cache = new(StringComparer.OrdinalIgnoreCase);
        private JObject? sourceData;

        public BattlePassOverlaySnapshot GetMapSnapshot(string mapSlug)
        {
            if (string.IsNullOrWhiteSpace(mapSlug))
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
                        || !TarkovMarketMapProjection.TryProject(mapSlug, worldX, worldZ, out double left, out double top)
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

        private static bool TryReadDouble(JToken? token, out double value)
        {
            value = 0;
            return token != null && double.TryParse(token.ToString(), NumberStyles.Float, CultureInfo.InvariantCulture, out value);
        }

    }
}
