using System.Globalization;
using Newtonsoft.Json.Linq;

namespace eft_where_am_i.Classes
{
    internal sealed class QuestOverlaySnapshot
    {
        public string map { get; set; } = string.Empty;
        public List<QuestOverlayQuest> quests { get; set; } = new();
    }

    internal sealed class QuestOverlayQuest
    {
        public string id { get; set; } = string.Empty;
        public string name { get; set; } = string.Empty;
        public string nameKo { get; set; } = string.Empty;
        public List<string> aliases { get; set; } = new();
        public List<QuestOverlayMarker> markers { get; set; } = new();
    }

    internal sealed class QuestOverlayMarker
    {
        public string objectiveId { get; set; } = string.Empty;
        public double left { get; set; }
        public double top { get; set; }
        public string floor { get; set; } = string.Empty;
        public string description { get; set; } = string.Empty;
        public string descriptionKo { get; set; } = string.Empty;
    }

    /// <summary>
    /// Builds an independent quest marker snapshot from public Tarkov data.
    /// The remote map page never receives the source datasets and its own quest state is not changed.
    /// </summary>
    internal sealed class QuestOverlayDataService
    {
        private const string TasksUrl = "https://json.tarkov.dev/regular/tasks";
        private const string EnglishUrl = "https://json.tarkov.dev/regular/tasks_en";
        private const string KoreanUrl = "https://json.tarkov.dev/regular/tasks_ko";
        private const string ObjectiveGpsUrl = "https://raw.githubusercontent.com/TarkovTracker/tarkovdata/master/objective_gps.json";

        private static readonly HttpClient Http = CreateHttpClient();
        private readonly SemaphoreSlim loadGate = new(1, 1);
        private readonly Dictionary<string, QuestOverlaySnapshot> mapCache = new(StringComparer.OrdinalIgnoreCase);
        private SourceData? sourceData;

        private sealed class SourceData
        {
            public JObject Tasks { get; init; } = new();
            public JObject English { get; init; } = new();
            public JObject Korean { get; init; } = new();
            public JObject ObjectiveGps { get; init; } = new();
        }

        private sealed record MapDefinition(
            string Slug,
            HashSet<string> MapIds,
            (double X, double Z, double Left, double Top)[] Anchors);

        private static readonly Dictionary<string, MapDefinition> Maps = CreateMapDefinitions();

        public async Task<QuestOverlaySnapshot> GetMapSnapshotAsync(string mapSlug)
        {
            if (string.IsNullOrWhiteSpace(mapSlug) || !Maps.TryGetValue(mapSlug, out MapDefinition? map))
            {
                return new QuestOverlaySnapshot { map = mapSlug ?? string.Empty };
            }

            if (mapCache.TryGetValue(mapSlug, out QuestOverlaySnapshot? cached))
            {
                return cached;
            }

            SourceData data = await LoadSourceDataAsync();
            QuestOverlaySnapshot snapshot = BuildSnapshot(map, data);
            mapCache[mapSlug] = snapshot;
            return snapshot;
        }

        private async Task<SourceData> LoadSourceDataAsync()
        {
            if (sourceData != null)
            {
                return sourceData;
            }

            await loadGate.WaitAsync();
            try
            {
                if (sourceData != null)
                {
                    return sourceData;
                }

                Task<string> tasksRequest = Http.GetStringAsync(TasksUrl);
                Task<string> englishRequest = Http.GetStringAsync(EnglishUrl);
                Task<string> koreanRequest = Http.GetStringAsync(KoreanUrl);
                Task<string> gpsRequest = Http.GetStringAsync(ObjectiveGpsUrl);
                await Task.WhenAll(tasksRequest, englishRequest, koreanRequest, gpsRequest);

                sourceData = new SourceData
                {
                    Tasks = JObject.Parse(await tasksRequest)["data"]?["tasks"] as JObject ?? new JObject(),
                    English = JObject.Parse(await englishRequest)["data"] as JObject ?? new JObject(),
                    Korean = JObject.Parse(await koreanRequest)["data"] as JObject ?? new JObject(),
                    ObjectiveGps = JObject.Parse(await gpsRequest)
                };

                AppLogger.Info("QuestOverlay", $"Loaded {sourceData.Tasks.Count} public quests and {sourceData.ObjectiveGps.Count} objective coordinates.");
                return sourceData;
            }
            finally
            {
                loadGate.Release();
            }
        }

        private static QuestOverlaySnapshot BuildSnapshot(MapDefinition map, SourceData data)
        {
            var snapshot = new QuestOverlaySnapshot { map = map.Slug };

            foreach (JProperty taskProperty in data.Tasks.Properties())
            {
                if (taskProperty.Value is not JObject task)
                {
                    continue;
                }

                string nameKey = task["name"]?.ToString() ?? string.Empty;
                string englishName = Translate(data.English, nameKey);
                string koreanName = Translate(data.Korean, nameKey);
                var quest = new QuestOverlayQuest
                {
                    id = taskProperty.Name,
                    name = englishName,
                    nameKo = koreanName,
                    aliases = new[] { englishName, koreanName }
                        .Where(value => !string.IsNullOrWhiteSpace(value))
                        .Distinct(StringComparer.OrdinalIgnoreCase)
                        .ToList()
                };

                if (task["objectives"] is not JArray objectives)
                {
                    continue;
                }

                foreach (JObject objective in objectives.OfType<JObject>())
                {
                    string objectiveId = objective["id"]?.ToString() ?? string.Empty;
                    string descriptionKey = objective["description"]?.ToString() ?? string.Empty;
                    string englishDescription = Translate(data.English, descriptionKey);
                    string koreanDescription = Translate(data.Korean, descriptionKey);

                    if (!string.IsNullOrEmpty(objectiveId)
                        && data.ObjectiveGps[objectiveId] is JObject gps
                        && map.MapIds.Contains(gps["map"]?.ToString() ?? string.Empty)
                        && TryReadDouble(gps["leftPercent"], out double gpsLeft)
                        && TryReadDouble(gps["topPercent"], out double gpsTop))
                    {
                        AddMarker(quest, new QuestOverlayMarker
                        {
                            objectiveId = objectiveId,
                            left = gpsLeft,
                            top = gpsTop,
                            floor = gps["floor"]?.ToString() ?? string.Empty,
                            description = englishDescription,
                            descriptionKo = koreanDescription
                        });
                        continue;
                    }

                    if (objective["zones"] is not JArray zones)
                    {
                        continue;
                    }

                    foreach (JObject zone in zones.OfType<JObject>())
                    {
                        if (!map.MapIds.Contains(zone["map"]?.ToString() ?? string.Empty)
                            || zone["position"] is not JObject position
                            || !TryReadDouble(position["x"], out double worldX)
                            || !TryReadDouble(position["z"], out double worldZ)
                            || !TryProject(map, worldX, worldZ, out double left, out double top))
                        {
                            continue;
                        }

                        AddMarker(quest, new QuestOverlayMarker
                        {
                            objectiveId = objectiveId,
                            left = left,
                            top = top,
                            description = englishDescription,
                            descriptionKo = koreanDescription
                        });
                    }
                }

                if (!string.IsNullOrWhiteSpace(quest.name))
                {
                    snapshot.quests.Add(quest);
                }
            }

            snapshot.quests.Sort((left, right) => string.Compare(left.name, right.name, StringComparison.CurrentCultureIgnoreCase));
            return snapshot;
        }

        private static void AddMarker(QuestOverlayQuest quest, QuestOverlayMarker marker)
        {
            if (!double.IsFinite(marker.left) || !double.IsFinite(marker.top)
                || marker.left < -5 || marker.left > 105 || marker.top < -5 || marker.top > 105)
            {
                return;
            }

            bool duplicate = quest.markers.Any(existing =>
                string.Equals(existing.objectiveId, marker.objectiveId, StringComparison.OrdinalIgnoreCase)
                && Math.Abs(existing.left - marker.left) < 0.01
                && Math.Abs(existing.top - marker.top) < 0.01);
            if (!duplicate)
            {
                quest.markers.Add(marker);
            }
        }

        private static bool TryProject(MapDefinition map, double worldX, double worldZ, out double left, out double top)
        {
            left = 0;
            top = 0;
            if (map.Anchors.Length < 3)
            {
                return false;
            }

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

        private static string Translate(JObject translations, string key)
        {
            if (string.IsNullOrWhiteSpace(key))
            {
                return string.Empty;
            }

            string value = translations[key]?.ToString() ?? string.Empty;
            return string.IsNullOrWhiteSpace(value) ? key : value;
        }

        private static HttpClient CreateHttpClient()
        {
            var client = new HttpClient { Timeout = TimeSpan.FromSeconds(30) };
            client.DefaultRequestHeaders.UserAgent.ParseAdd("where-the-fuck-am-i/1.0");
            return client;
        }

        private static Dictionary<string, MapDefinition> CreateMapDefinitions()
        {
            static HashSet<string> Ids(params string[] ids) => new(ids, StringComparer.OrdinalIgnoreCase);
            static (double, double, double, double)[] Anchors(params (double, double, double, double)[] values) => values;

            return new Dictionary<string, MapDefinition>(StringComparer.OrdinalIgnoreCase)
            {
                ["factory"] = new("factory", Ids("55f2d3fd4bdc2d5f408b4567", "59fc81d786f774390775787e"), Anchors((77, 67.4, 0, 0), (77, -64.5, 100, 0), (-65.5, 67.4, 0, 100))),
                ["customs"] = new("customs", Ids("56f40101d2720b2a4d8b45d6"), Anchors((698, -307, 0, 0), (-372, -307, 100, 0), (698, 237, 0, 100))),
                ["woods"] = new("woods", Ids("5704e3c2d2720bac5b8b4567"), Anchors((646, -914, 0, 0), (-761, -914, 100, 0), (646, 442, 0, 100))),
                ["shoreline"] = new("shoreline", Ids("5704e554d2720bac5b8b456e"), Anchors((504, -415, 0, 0), (-1056, -415, 100, 0), (504, 618, 0, 100))),
                ["interchange"] = new("interchange", Ids("5714dbc024597771384a510d"), Anchors((598, -442, 0, 0), (-433, -442, 100, 0), (598, 426, 0, 100))),
                ["lab"] = new("lab", Ids("5b0fc42d86f7744a585f9105", "6a294a5b5eb5f9a1700417b7"), Anchors((-287, -477, 0, 0), (-287, -193, 100, 0), (-80, -477, 0, 100))),
                ["reserve"] = new("reserve", Ids("5704e5fad2720bc05b8b4567"), Anchors((289, -274, 0, 0), (-303, -274, 100, 0), (289, 272, 0, 100))),
                ["lighthouse"] = new("lighthouse", Ids("5704e4dad2720bb55b8b4567"), Anchors((515, -998, 0, 0), (-545, -998, 100, 0), (515, 725, 0, 100))),
                ["streets"] = new("streets", Ids("5714dc692459777137212e12"), Anchors((323, -295, 0, 0), (-280, -295, 100, 0), (323, 532, 0, 100))),
                ["ground-zero"] = new("ground-zero", Ids("653e6760052c01c1c805532f", "65b8d6f5cdde2479cb2a3125", "68236e8153654e8c1200798a"), Anchors((249, -124, 0, 0), (-99, -124, 100, 0), (249, 364, 0, 100))),
                ["terminal"] = new("terminal", Ids("65cc8f81a9aac3e77d0cfd3e"), Anchors((463, -580, 0, 0), (-433, -580, 100, 0), (463, 475, 0, 100))),
                ["labyrinth"] = new("labyrinth", Ids("6733700029c367a3d40b02af"), Anchors((-52, -37, 0, 0), (-52, 76, 100, 0), (53, -37, 0, 100))),
                ["icebreaker"] = new("icebreaker", Ids("69af492a4819ea4ba10a69c5"), Anchors((77, -64.5, 0, 0), (-65.5, -64.5, 100, 0), (77, 67.4, 0, 100)))
            };
        }
    }
}
