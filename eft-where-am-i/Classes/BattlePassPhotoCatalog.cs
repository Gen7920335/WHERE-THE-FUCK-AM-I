namespace eft_where_am_i.Classes
{
    internal sealed class BattlePassOverlayPhoto
    {
        public string url { get; set; } = string.Empty;
        public string caption { get; set; } = string.Empty;
    }

    internal static class BattlePassPhotoCatalog
    {
        public const string SourceUrl = "https://github.com/Perofunyang/battlepass_interactive_map";
        private const string ImageBaseUrl = "https://perofunyang.github.io/battlepass_interactive_map/assets/previews";

        private sealed record PhotoRule(string Map, string[] TitleParts, string[] PhotoIds);

        private static readonly PhotoRule[] Rules =
        {
            Rule("customs", new[] { "Big Red - director" }, "financial-3-1-2-1", "project-3-1-2-1"),
            Rule("customs", new[] { "Big Red south" }, "financial-3-0-1-1"),
            Rule("customs", new[] { "Crackhouse" }, "financial-2-2-2-1", "financial-2-2-2-2", "financial-2-0-1-1", "project-2-2-2-1", "project-2-2-2-2"),
            Rule("customs", new[] { "2-story Dorms" }, "financial-5-2-1-1", "financial-5-2-2-1", "project-5-2-2-1"),
            Rule("customs", new[] { "3-story Dorms 212" }, "financial-5-1-2-1", "project-5-1-2-1"),
            Rule("customs", new[] { "Dorms 304" }, "financial-5-1-3-1"),
            Rule("customs", new[] { "Stronghold" }, "financial-2-1-1-1"),
            Rule("customs", new[] { "Old Gas" }, "project-1-7-1-1"),
            Rule("customs", new[] { "Warehouse 17", "Sniper warehouse" }, "financial-2-6-3-1", "project-2-6-2-1", "project-2-6-3-1"),
            Rule("customs", new[] { "Garage office" }, "project-1-3-2-1"),

            Rule("interchange", new[] { "OLI Logistics" }, "blueprint-1-4-1"),

            Rule("ground-zero", new[] { "TerraGroup HQ", "TerraGroup science" }, "medical-3-2-3-1", "medical-3-2-3-2", "medical-3-2-4-1", "medical-3-2-4-2", "user-3-2-3-1", "user-3-2-3-2", "user-3-2-4-1", "user-3-2-4-2", "user-3-2-5-2"),
            Rule("ground-zero", new[] { "Olive restaurant", "TerraGroup-front cafe" }, "medical-4-2-1-1", "medical-5-0-1-1", "user-3-3-1-1", "user-4-2-2-1", "user-4-0-1-1"),
            Rule("ground-zero", new[] { "Mira exfil" }, "user-2-0-1-1"),
            Rule("ground-zero", new[] { "Black SUV" }, "medical-6-0-1-1", "user-3-1-1-1"),

            Rule("streets", new[] { "Office near Relax" }, "financial-2-8-1-1"),
            Rule("streets", new[] { "Dental clinic" }, "user-5-1-2-1"),

            Rule("lab", new[] { "Blue outer office", "Office bay above Blue" }, "medical-1-1", "medical-1-2"),
            Rule("lab", new[] { "Blue keycard" }, "medical-1-5"),
            Rule("lab", new[] { "Black keycard" }, "medical-1-6"),
            Rule("lab", new[] { "Green keycard" }, "medical-2-1", "medical-2-4"),
            Rule("lab", new[] { "Cat conference" }, "medical-2-5"),
            Rule("lab", new[] { "Double Black", "Glass office above Black" }, "user-2-1", "user-2-11"),
            Rule("lab", new[] { "Parking exfil" }, "user-2-7"),
            Rule("lab", new[] { "Manager office" }, "user-2-6", "user-2-10"),
            Rule("lab", new[] { "Residential Unit" }, "user-2-3", "user-2-4", "user-2-5", "user-2-9"),

            Rule("woods", new[] { "Crashed airplane" }, "technical-5-1"),
            Rule("woods", new[] { "USEC camp" }, "technical-1-2", "test-1-2", "test-1-3", "test-1-4"),
            Rule("woods", new[] { "Old sawmill" }, "technical-2-1-2", "test-2-1-1", "test-2-2-2"),
            Rule("woods", new[] { "Village brick" }, "test-2-2-1"),
            Rule("woods", new[] { "Military Checkpoint" }, "technical-1-4", "test-3-1"),
            Rule("woods", new[] { "Large Scav Bunker" }, "technical-1-3", "technical-2-1"),
            Rule("woods", new[] { "Sniper Mountain" }, "technical-2-3"),
            Rule("woods", new[] { "Sawmill Cabin", "Sawmill rectangular" }, "test-4-1", "test-4-2"),

            Rule("reserve", new[] { "Dome RB-RSLA" }, "pmc-6-1-2-1"),
            Rule("reserve", new[] { "Dome RB-KORL" }, "pmc-6-1-2-2", "project-6-1-2-1"),
            Rule("reserve", new[] { "Dome RB-KPRL" }, "pmc-6-0-1-1"),
            Rule("reserve", new[] { "K Buildings K4" }, "pmc-3-4-1-1"),
            Rule("reserve", new[] { "Checkpoint Fence" }, "pmc-6-0-1-2", "project-6-0-1-1"),
            Rule("reserve", new[] { "D2 command" }, "pmc-8-3-2-1", "project-8-0-1", "project-8-0-2"),
            Rule("reserve", new[] { "White Horse" }, "pmc-4-1-3-1"),

            Rule("lighthouse", new[] { "WTP Building 2" }, "pmc-2-2-1-1"),
            Rule("lighthouse", new[] { "WTP Building 3" }, "technical-2-3-2-1"),
            Rule("lighthouse", new[] { "Train station" }, "technical-1-1-1-1"),
            Rule("lighthouse", new[] { "Scav village red house - 1F" }, "technical-3-6-1-1"),
            Rule("lighthouse", new[] { "Scav village red house - 2F" }, "pmc-3-6-2-1"),
            Rule("lighthouse", new[] { "Chalet tennis" }, "pmc-4-2-1-1", "technical-4-2-1-1"),
            Rule("lighthouse", new[] { "Northern seaside" }, "technical-4-3-2-1"),
            Rule("lighthouse", new[] { "Main Chalet", "USEC/Main Chalet" }, "pmc-4-2-1-2", "technical-4-1-1-1", "technical-4-1-3-1"),

            Rule("shoreline", new[] { "Locked Cottage" }, "technical-6-2-1-1", "test-6-2-1-1"),
            Rule("shoreline", new[] { "Vehicle Extract" }, "technical-3-0-1-1"),
            Rule("shoreline", new[] { "HEP power" }, "technical-7-1-1-1"),
            Rule("shoreline", new[] { "Smugglers base" }, "technical-3-1-1-1", "test-3-2-1-1"),
            Rule("shoreline", new[] { "Pier building" }, "technical-10-1-1-1", "test-10-1-1-1"),
            Rule("shoreline", new[] { "Resort West Wing 316" }, "technical-2-1-316-1"),
            Rule("shoreline", new[] { "Resort West Wing 211" }, "test-2-1-211-1"),
            Rule("shoreline", new[] { "Resort East Wing 212" }, "technical-2-3-212-1"),
            Rule("shoreline", new[] { "Resort East Wing 218" }, "test-2-3-218-1"),
            Rule("shoreline", new[] { "Resort East Wing 326" }, "test-2-3-326-1"),
            Rule("shoreline", new[] { "Resort admin" }, "technical-2-2-2-1"),
            Rule("shoreline", new[] { "Radio tower" }, "technical-8-2-1-1", "test-8-2-1-1"),
            Rule("shoreline", new[] { "Weather station" }, "technical-8-1-3-1", "test-8-1-2-1"),
            Rule("shoreline", new[] { "Resort front" }, "test-2-0-1-1"),
            Rule("shoreline", new[] { "Village white-car" }, "test-4-1-1-1"),

            Rule("labyrinth", new[] { "Wooden box" }, "blueprints-1"),
            Rule("labyrinth", new[] { "Dead worker by Observation" }, "medical-2"),
            Rule("labyrinth", new[] { "Table by sixth" }, "medical-3"),
            Rule("labyrinth", new[] { "Dead worker by Assembly" }, "medical-1"),
            Rule("labyrinth", new[] { "Scientist inside" }, "medical-4"),

            Rule("icebreaker", new[] { "Medical Office", "Medical storage" }, "pmc-1-1", "test-1-1"),
            Rule("icebreaker", new[] { "Canteen" }, "pmc-3-1", "test-3-1"),
            Rule("icebreaker", new[] { "Green-flare" }, "pmc-4-1", "test-1-2"),
            Rule("icebreaker", new[] { "Drone room" }, "pmc-1-2", "test-2-1")
        };

        public static List<BattlePassOverlayPhoto> GetPhotos(string mapSlug, string title, int floor)
        {
            IEnumerable<string> ids = Rules
                .Where(rule => string.Equals(rule.Map, mapSlug, StringComparison.OrdinalIgnoreCase)
                    && rule.TitleParts.Any(part => title.Contains(part, StringComparison.OrdinalIgnoreCase)))
                .SelectMany(rule => rule.PhotoIds);

            if (!ids.Any() && string.Equals(mapSlug, "factory", StringComparison.OrdinalIgnoreCase))
            {
                string level = floor <= 0 ? "0" : Math.Min(floor, 3).ToString();
                ids = FactoryFloorPhotos(level);
            }

            return GetPhotosByIds(mapSlug, title, ids);
        }

        public static List<BattlePassOverlayPhoto> GetPhotosByIds(
            string mapSlug,
            string title,
            IEnumerable<string> photoIds)
        {
            return photoIds
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Select((id, index) => new BattlePassOverlayPhoto
                {
                    url = BuildImageUrl(mapSlug, id),
                    caption = $"{title} · 제보 사진 {index + 1}"
                })
                .ToList();
        }

        private static PhotoRule Rule(string map, string[] titleParts, params string[] photoIds) =>
            new(map, titleParts, photoIds);

        private static IEnumerable<string> FactoryFloorPhotos(string level)
        {
            string[] blueprintIds = level switch
            {
                "3" => new[] { "blueprint-3-1", "blueprint-3-2", "blueprint-3-3", "blueprint-3-4" },
                "2" => new[] { "blueprint-2-1" },
                "0" => new[] { "blueprint-0-1", "blueprint-0-2" },
                _ => new[] { "blueprint-1-1", "blueprint-1-2", "blueprint-1-3", "blueprint-1-4", "blueprint-1-5", "blueprint-1-6", "blueprint-1-7", "blueprint-1-8" }
            };
            string[] projectIds = level switch
            {
                "3" => new[] { "project-3-1", "project-3-2", "project-3-3", "project-3-4" },
                "2" => new[] { "project-2-1", "project-2-2" },
                "0" => new[] { "project-0-1", "project-0-2" },
                _ => new[] { "project-1-1", "project-1-2", "project-1-3", "project-1-4", "project-1-5", "project-1-6", "project-1-7" }
            };
            return blueprintIds.Concat(projectIds);
        }

        private static string BuildImageUrl(string mapSlug, string id)
        {
            string sourceMap = mapSlug switch
            {
                "ground-zero" => "ground_zero",
                "streets" => "streets_of_tarkov",
                _ => mapSlug
            };
            if (id.StartsWith('@'))
            {
                return $"{ImageBaseUrl}/{sourceMap}/{id[1..]}.webp";
            }
            int separator = id.IndexOf('-');
            string category = separator > 0 ? id[..separator] : string.Empty;
            if (string.Equals(category, "blueprint", StringComparison.OrdinalIgnoreCase))
            {
                category = "blueprints";
            }
            string file = separator > 0 ? id[(separator + 1)..] : id;
            return $"{ImageBaseUrl}/{sourceMap}/{category}/{file}.webp";
        }
    }
}
