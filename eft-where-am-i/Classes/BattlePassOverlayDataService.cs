using System.Globalization;
using System.Text.RegularExpressions;
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

                    string confidenceLabel = location["coordinateBasis"]?.ToString() switch
                    {
                        "reported-poi-center" => "제보 POI 기준 추정 좌표",
                        "reported-room-reference" => "방 내부 기준점 보정 좌표",
                        "photo-topdown-room-alignment" => "제보 사진·실제 상면도 구역 정합 좌표",
                        "transit-anchor-affine" => "지도 가장자리 3곳 이상 정합 좌표",
                        "reported-world-coordinate" => "제보 월드 좌표",
                        _ when location["confidence"]?.ToString() == "reported" => "단일/추가 제보 좌표",
                        _ => "복수 제보 확인 좌표"
                    };
                    string details = string.Join(" · ", new[]
                    {
                        location["documents"]?.ToString(),
                        confidenceLabel,
                        location["coordinateNote"]?.ToString()
                    }.Where(value => !string.IsNullOrWhiteSpace(value)));

                    string title = location["title"]?.ToString() ?? "Battle Pass document";
                    string locationDescription = location["detail"]?.ToString() ?? string.Empty;
                    int floor = InferFloorLevel(mapSlug, title, elevation);
                    List<BattlePassOverlayPhoto> photos = ReadPhotos(location);
                    if (photos.Count == 0 && location["photoIds"] is JArray photoIds)
                    {
                        photos = BattlePassPhotoCatalog.GetPhotosByIds(
                            mapSlug,
                            title,
                            photoIds.Values<string>().Where(value => !string.IsNullOrWhiteSpace(value))!);
                    }
                    snapshot.markers.Add(new BattlePassOverlayMarker
                    {
                        left = left,
                        top = top,
                        elevation = elevation,
                        floor = floor,
                        title = title,
                        locationDescription = locationDescription,
                        details = details,
                        coordinateCertain = IsCoordinateCertain(location),
                        photos = photos,
                        photoSourceUrl = location["photoSourceUrl"]?.ToString() ?? BattlePassPhotoCatalog.SourceUrl
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

        private static bool IsCoordinateCertain(JObject location)
        {
            if (location["coordinateCertain"]?.Type == JTokenType.Boolean)
            {
                return location["coordinateCertain"]!.Value<bool>();
            }

            if (string.Equals(
                location["coordinateBasis"]?.ToString(),
                "reported-world-coordinate",
                StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }

            // Non-prefixed photo IDs are coordinates imported from the checked
            // interactive-map dataset. '@' IDs are unresolved references and do
            // not qualify as coordinate evidence.
            return location["photoIds"] is JArray photoIds
                && photoIds.Values<string>().Any(id =>
                    !string.IsNullOrWhiteSpace(id)
                    && !id.StartsWith('@'));
        }

        private static int InferFloorLevel(string mapSlug, string title, double elevation)
        {
            string normalizedTitle = title ?? string.Empty;

            Match explicitFloor = Regex.Match(
                normalizedTitle,
                @"\b(?:level\s*|floor\s*|)([1-5])\s*f\b|\blevel\s*([1-5])\b",
                RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
            if (explicitFloor.Success)
            {
                string value = explicitFloor.Groups[1].Success
                    ? explicitFloor.Groups[1].Value
                    : explicitFloor.Groups[2].Value;
                if (int.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out int floor))
                {
                    return floor;
                }
            }

            Match roomNumber = Regex.Match(
                normalizedTitle,
                @"\b([2-5])\d{2}\b",
                RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
            if (roomNumber.Success
                && int.TryParse(roomNumber.Groups[1].Value, NumberStyles.Integer, CultureInfo.InvariantCulture, out int roomFloor))
            {
                return roomFloor;
            }

            if (Regex.IsMatch(normalizedTitle, @"\b(?:basement|bunker|underground|d2)\b", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant))
            {
                return 0;
            }

            if (Regex.IsMatch(normalizedTitle, @"\b(?:upstairs|upper|above)\b", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant))
            {
                return 2;
            }

            return mapSlug.ToLowerInvariant() switch
            {
                "factory" when elevation < 0 => 0,
                "factory" when elevation < 3 => 1,
                "factory" when elevation < 7 => 2,
                "factory" => 3,
                "customs" when Regex.IsMatch(normalizedTitle, @"\bBig Red\b.*\bdirector office\b", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant) => 2,
                "customs" when elevation >= 6 => 2,
                "ground-zero" when elevation >= 27 => 2,
                "streets" when elevation >= 5 => 2,
                "lab" when elevation >= 3.5 => 2,
                "icebreaker" when elevation >= 6 => 3,
                "icebreaker" when elevation >= 2 => 2,
                _ => 1
            };
        }

    }
}
