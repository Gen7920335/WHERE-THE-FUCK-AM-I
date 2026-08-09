using System.IO.Compression;
using System.Net;
using System.Text;
using System.Text.RegularExpressions;
using Newtonsoft.Json.Linq;

namespace eft_where_am_i.Classes
{
    internal sealed class QuestTranslationService
    {
        private const string DataRoot = "https://json.tarkov.dev/regular";
        private static readonly HttpClient HttpClient = CreateHttpClient();
        private readonly object loadLock = new();
        private Task<Dictionary<string, string>>? koreanTranslationTask;

        public Task<Dictionary<string, string>> GetKoreanTranslationsAsync()
        {
            lock (loadLock)
            {
                koreanTranslationTask ??= LoadKoreanTranslationsAsync();
                return koreanTranslationTask;
            }
        }

        private static HttpClient CreateHttpClient()
        {
            var handler = new HttpClientHandler
            {
                AutomaticDecompression = DecompressionMethods.GZip | DecompressionMethods.Deflate
            };
            var client = new HttpClient(handler)
            {
                Timeout = TimeSpan.FromSeconds(15)
            };
            client.DefaultRequestHeaders.UserAgent.ParseAdd("WhereTheFuckAmI/1.0");
            return client;
        }

        private static async Task<Dictionary<string, string>> LoadKoreanTranslationsAsync()
        {
            try
            {
                Task<(JObject English, JObject Korean)> tasksRequest = LoadLocalePairAsync("tasks");
                Task<(JObject English, JObject Korean)> itemsRequest = LoadLocalePairAsync("items");
                Task<(JObject English, JObject Korean)> mapsRequest = LoadLocalePairAsync("maps");
                await Task.WhenAll(tasksRequest, itemsRequest, mapsRequest);

                (JObject tasksEnglish, JObject tasksKorean) = await tasksRequest;
                (JObject itemsEnglish, JObject itemsKorean) = await itemsRequest;
                (JObject mapsEnglish, JObject mapsKorean) = await mapsRequest;

                List<(string English, string Korean)> protectedTerms = new();
                AddNamePairs(protectedTerms, tasksEnglish, tasksKorean);
                AddNamePairs(protectedTerms, itemsEnglish, itemsKorean);
                AddNamePairs(protectedTerms, mapsEnglish, mapsKorean);
                protectedTerms = protectedTerms
                    .Where(pair => pair.English.Length >= 3 && pair.Korean.Length >= 2)
                    .Distinct()
                    .OrderByDescending(pair => pair.Korean.Length)
                    .ToList();

                var candidates = new Dictionary<string, HashSet<string>>(StringComparer.Ordinal);
                foreach (JProperty property in tasksEnglish.Properties())
                {
                    string english = property.Value.Type == JTokenType.String
                        ? property.Value.ToString().Trim()
                        : string.Empty;
                    string korean = tasksKorean[property.Name]?.Type == JTokenType.String
                        ? tasksKorean[property.Name]!.ToString().Trim()
                        : string.Empty;
                    if (string.IsNullOrWhiteSpace(english)
                        || string.IsNullOrWhiteSpace(korean)
                        || string.Equals(english, korean, StringComparison.Ordinal))
                    {
                        continue;
                    }

                    korean = RestoreProperNouns(english, korean, protectedTerms);
                    if (!ContainsHangul(korean))
                    {
                        continue;
                    }

                    if (!candidates.TryGetValue(english, out HashSet<string>? variants))
                    {
                        variants = new HashSet<string>(StringComparer.Ordinal);
                        candidates[english] = variants;
                    }
                    variants.Add(korean);
                }

                Dictionary<string, string> translations = candidates
                    .Where(pair => pair.Value.Count == 1)
                    .ToDictionary(pair => pair.Key, pair => pair.Value.First(), StringComparer.Ordinal);
                AppLogger.Info("QuestTranslation", $"Loaded {translations.Count} unambiguous Korean quest strings.");
                return translations;
            }
            catch (Exception ex)
            {
                AppLogger.Warn("QuestTranslation", $"Unable to load Korean quest strings: {ex.Message}");
                return new Dictionary<string, string>(StringComparer.Ordinal);
            }
        }

        private static async Task<(JObject English, JObject Korean)> LoadLocalePairAsync(string endpoint)
        {
            Task<JObject> englishRequest = LoadLocaleAsync($"{DataRoot}/{endpoint}_en");
            Task<JObject> koreanRequest = LoadLocaleAsync($"{DataRoot}/{endpoint}_ko");
            await Task.WhenAll(englishRequest, koreanRequest);
            return (await englishRequest, await koreanRequest);
        }

        private static async Task<JObject> LoadLocaleAsync(string url)
        {
            byte[] bytes = await HttpClient.GetByteArrayAsync(url);
            JObject document = JObject.Parse(Encoding.UTF8.GetString(bytes));
            return document["data"] as JObject ?? new JObject();
        }

        private static void AddNamePairs(List<(string English, string Korean)> target, JObject english, JObject korean)
        {
            foreach (JProperty property in english.Properties())
            {
                if (!property.Name.EndsWith(" name", StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                string englishName = property.Value.Type == JTokenType.String ? property.Value.ToString().Trim() : string.Empty;
                string koreanName = korean[property.Name]?.Type == JTokenType.String
                    ? korean[property.Name]!.ToString().Trim()
                    : string.Empty;
                if (!string.IsNullOrWhiteSpace(englishName)
                    && !string.IsNullOrWhiteSpace(koreanName)
                    && !string.Equals(englishName, koreanName, StringComparison.OrdinalIgnoreCase))
                {
                    target.Add((englishName, koreanName));
                }
            }
        }

        private static string RestoreProperNouns(
            string englishSource,
            string koreanTranslation,
            IReadOnlyList<(string English, string Korean)> protectedTerms)
        {
            string restored = Regex.Replace(
                koreanTranslation,
                @"[\p{IsHangulSyllables}\p{IsHangulJamo}\s]+\(([^)]+)\)",
                match => englishSource.Contains(match.Groups[1].Value, StringComparison.OrdinalIgnoreCase)
                    ? match.Groups[1].Value
                    : match.Value,
                RegexOptions.CultureInvariant);

            foreach ((string english, string korean) in protectedTerms)
            {
                if (!englishSource.Contains(english, StringComparison.OrdinalIgnoreCase)
                    || !restored.Contains(korean, StringComparison.Ordinal))
                {
                    continue;
                }

                restored = restored.Replace(korean, english, StringComparison.Ordinal);
            }

            return restored;
        }

        private static bool ContainsHangul(string value) =>
            Regex.IsMatch(value, @"[\p{IsHangulSyllables}\p{IsHangulJamo}]", RegexOptions.CultureInvariant);
    }
}
