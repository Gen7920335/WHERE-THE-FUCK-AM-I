using Newtonsoft.Json.Linq;

namespace eft_where_am_i.Classes
{
    internal sealed class QuestOverlaySnapshot
    {
        public string map { get; set; } = string.Empty;
        public List<QuestOverlayMarker> markers { get; set; } = new();
    }

    internal sealed class QuestOverlayMarker
    {
        public string questId { get; set; } = string.Empty;
        public string quest { get; set; } = string.Empty;
        public string objectiveId { get; set; } = string.Empty;
        public string objective { get; set; } = string.Empty;
        public string objectiveType { get; set; } = string.Empty;
        public string category { get; set; } = string.Empty;
        public bool optional { get; set; }
        public double left { get; set; }
        public double top { get; set; }
        public double elevation { get; set; }
    }

    internal sealed class QuestOverlayDataService
    {
        private readonly Dictionary<string, QuestOverlaySnapshot> cache = new(StringComparer.OrdinalIgnoreCase);
        private JObject? sourceData;

        public QuestOverlaySnapshot GetMapSnapshot(string mapSlug)
        {
            if (string.IsNullOrWhiteSpace(mapSlug))
            {
                return new QuestOverlaySnapshot { map = mapSlug ?? string.Empty };
            }

            if (cache.TryGetValue(mapSlug, out QuestOverlaySnapshot? cached))
            {
                return cached;
            }

            var snapshot = new QuestOverlaySnapshot { map = mapSlug };
            JObject data = LoadSourceData();
            if (data["maps"]?[mapSlug] is not JArray markers)
            {
                cache[mapSlug] = snapshot;
                return snapshot;
            }

            foreach (JObject marker in markers.OfType<JObject>())
            {
                double? worldX = marker["x"]?.Value<double?>();
                double? elevation = marker["y"]?.Value<double?>();
                double? worldZ = marker["z"]?.Value<double?>();
                if (!worldX.HasValue
                    || !elevation.HasValue
                    || !worldZ.HasValue
                    || !TarkovMarketMapProjection.TryProject(mapSlug, worldX.Value, worldZ.Value, out double left, out double top)
                    || left < 0 || left > 100 || top < 0 || top > 100)
                {
                    continue;
                }

                snapshot.markers.Add(new QuestOverlayMarker
                {
                    questId = marker["questId"]?.ToString() ?? string.Empty,
                    quest = marker["quest"]?.ToString() ?? string.Empty,
                    objectiveId = marker["objectiveId"]?.ToString() ?? string.Empty,
                    objective = marker["objective"]?.ToString() ?? string.Empty,
                    objectiveType = marker["objectiveType"]?.ToString() ?? string.Empty,
                    category = marker["category"]?.ToString() ?? string.Empty,
                    optional = marker["optional"]?.Value<bool?>() ?? false,
                    left = left,
                    top = top,
                    elevation = elevation.Value
                });
            }

            cache[mapSlug] = snapshot;
            AppLogger.Info("QuestOverlay", $"Loaded {snapshot.markers.Count} independent quest markers for {mapSlug}.");
            return snapshot;
        }

        private JObject LoadSourceData()
        {
            if (sourceData != null)
            {
                return sourceData;
            }

            string path = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "html", "quest-marker-locations.json");
            sourceData = File.Exists(path) ? JObject.Parse(File.ReadAllText(path)) : new JObject();
            return sourceData;
        }
    }
}
