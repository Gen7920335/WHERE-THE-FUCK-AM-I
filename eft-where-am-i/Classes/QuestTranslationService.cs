using Newtonsoft.Json;

namespace eft_where_am_i.Classes
{
    internal sealed class KoreanGameLocalizationCatalog
    {
        public int schemaVersion { get; set; }
        public Dictionary<string, string> locations { get; set; } = new(StringComparer.Ordinal);
        public Dictionary<string, string> questNames { get; set; } = new(StringComparer.Ordinal);
        public Dictionary<string, string> itemNames { get; set; } = new(StringComparer.Ordinal);
        public Dictionary<string, string> questSteps { get; set; } = new(StringComparer.Ordinal);
    }

    internal sealed class QuestTranslationService
    {
        private readonly object loadLock = new();
        private Task<KoreanGameLocalizationCatalog>? koreanCatalogTask;

        public Task<KoreanGameLocalizationCatalog> GetKoreanCatalogAsync()
        {
            lock (loadLock)
            {
                koreanCatalogTask ??= LoadKoreanCatalogAsync();
                return koreanCatalogTask;
            }
        }

        private static async Task<KoreanGameLocalizationCatalog> LoadKoreanCatalogAsync()
        {
            try
            {
                string path = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "translations", "game-ko.json");
                string json = await File.ReadAllTextAsync(path);
                KoreanGameLocalizationCatalog? catalog = JsonConvert.DeserializeObject<KoreanGameLocalizationCatalog>(json);
                if (catalog == null)
                {
                    throw new InvalidDataException("The Korean game localization catalog is empty.");
                }

                AppLogger.Info(
                    "QuestTranslation",
                    $"Loaded {catalog.questNames.Count} quest names, {catalog.questSteps.Count} quest instructions, " +
                    $"{catalog.itemNames.Count} item names, and {catalog.locations.Count} locations.");
                return catalog;
            }
            catch (Exception ex)
            {
                AppLogger.Warn("QuestTranslation", $"Unable to load the bundled Korean catalog: {ex.Message}");
                return new KoreanGameLocalizationCatalog();
            }
        }
    }
}
