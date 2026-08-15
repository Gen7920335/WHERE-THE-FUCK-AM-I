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
        public int floor { get; set; }
        public string title { get; set; } = string.Empty;
        public string locationDescription { get; set; } = string.Empty;
        public string details { get; set; } = string.Empty;
        public bool coordinateCertain { get; set; }
        public List<BattlePassOverlayPhoto> photos { get; set; } = new();
        public string photoSourceUrl { get; set; } = string.Empty;
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
                    if (location["mapPosition"] is not JArray mapPosition
                        || mapPosition.Count < 2
                        || !TryReadDouble(mapPosition[0], out double left)
                        || !TryReadDouble(mapPosition[1], out double top)
                        || left < 0 || left > 100 || top < 0 || top > 100)
                    {
                        continue;
                    }

                    double elevation = TryReadDouble(location["elevation"], out double parsedElevation)
                        ? parsedElevation
                        : 0;
                    int floor = location["floor"]?.Value<int?>() ?? 1;
                    string sourceCoordinate = location["sourcePosition"] is JArray sourcePosition
                        ? $"원본 좌표 [{string.Join(", ", sourcePosition.Values<string>())}]"
                        : string.Empty;
                    string details = string.Join(" · ", new[]
                    {
                        location["documents"]?.ToString(),
                        sourceCoordinate,
                        location["coordinateValidation"]?["checked"]?.Value<bool>() == true ? "좌표 검증 완료" : string.Empty,
                        location["photoValidation"]?["checked"]?.Value<bool>() == true ? "사진 검증 완료" : string.Empty
                    }.Where(value => !string.IsNullOrWhiteSpace(value)));

                    snapshot.markers.Add(new BattlePassOverlayMarker
                    {
                        left = left,
                        top = top,
                        elevation = elevation,
                        floor = floor,
                        title = location["title"]?.ToString() ?? "Battle Pass document",
                        locationDescription = location["detail"]?.ToString() ?? string.Empty,
                        details = details,
                        coordinateCertain = location["coordinateCertain"]?.Value<bool?>() ?? false,
                        photos = ReadPhotos(location),
                        photoSourceUrl = location["photoSourceUrl"]?.ToString() ?? string.Empty
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
            value = token?.Value<double?>() ?? 0;
            return token != null && double.IsFinite(value);
        }

        private static List<BattlePassOverlayPhoto> ReadPhotos(JObject location)
        {
            if (location["photos"] is not JArray photos)
            {
                return new List<BattlePassOverlayPhoto>();
            }

            return photos
                .OfType<JObject>()
                .Select(photo => new BattlePassOverlayPhoto
                {
                    url = photo["url"]?.ToString() ?? string.Empty,
                    caption = photo["caption"]?.ToString() ?? string.Empty
                })
                .Where(photo => !string.IsNullOrWhiteSpace(photo.url))
                .ToList();
        }
    }
}
