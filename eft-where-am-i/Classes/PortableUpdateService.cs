using System.Diagnostics;
using System.IO.Compression;
using System.Net.Http.Headers;
using System.Reflection;
using System.Security.Cryptography;
using System.Text.Json;

namespace eft_where_am_i.Classes
{
    internal sealed record PortableRelease(
        Version Version,
        string Tag,
        Uri DownloadUrl,
        string AssetName,
        long Size,
        string? Sha256);

    internal static class PortableUpdateService
    {
        private const string RepositoryApi = "https://api.github.com/repos/Gen7920335/WHERE-THE-FUCK-AM-I/releases/latest";
        private const string ExecutableName = "WHERE THE FUCK AM I.exe";
        private const long MaximumArchiveBytes = 512L * 1024 * 1024;
        private const long MaximumExtractedBytes = 1024L * 1024 * 1024;
        private static readonly SemaphoreSlim UpdateLock = new(1, 1);

        public static async Task CheckAndInstallAsync(IWin32Window owner, bool interactive)
        {
            if (!await UpdateLock.WaitAsync(0))
            {
                if (interactive)
                    MessageBox.Show(owner, "이미 업데이트를 확인하고 있습니다.\nAn update check is already running.", "업데이트 / Update");
                return;
            }

            try
            {
                if (Debugger.IsAttached)
                {
                    if (interactive)
                        MessageBox.Show(owner, "디버거 실행 중에는 업데이트하지 않습니다.\nUpdates are disabled while debugging.", "업데이트 / Update");
                    return;
                }

                PortableRelease? release = await GetLatestReleaseAsync();
                if (release == null)
                {
                    if (interactive)
                        MessageBox.Show(owner, "현재 최신 버전을 사용 중입니다.\nYou are using the latest version.", "업데이트 확인 / Update Check");
                    return;
                }

                DialogResult result = MessageBox.Show(
                    owner,
                    $"새로운 업데이트(v{release.Version})가 있습니다.\n지금 다운로드하고 적용한 뒤 재시작하시겠습니까?\n\n" +
                    $"A new update (v{release.Version}) is available.\nDownload, apply, and restart now?",
                    "업데이트 알림 / Update Notification",
                    MessageBoxButtons.YesNo,
                    MessageBoxIcon.Information);

                if (result != DialogResult.Yes)
                    return;

                Cursor? previousCursor = Cursor.Current;
                Cursor.Current = Cursors.WaitCursor;
                try
                {
                    string stagedExecutable = await DownloadAndStageAsync(release);
                    LaunchUpdateHelper(stagedExecutable);
                }
                finally
                {
                    Cursor.Current = previousCursor;
                }

                Environment.Exit(0);
            }
            catch (Exception ex)
            {
                AppLogger.Error("PortableUpdater", ex.ToString());
                if (interactive)
                {
                    MessageBox.Show(
                        owner,
                        $"업데이트 중 오류가 발생했습니다.\n{ex.Message}\n\nUpdate failed.\n{ex.Message}",
                        "업데이트 오류 / Update Error",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Error);
                }
            }
            finally
            {
                UpdateLock.Release();
            }
        }

        internal static async Task<PortableRelease?> GetLatestReleaseAsync(CancellationToken cancellationToken = default)
        {
            using HttpClient client = CreateHttpClient();
            using HttpResponseMessage response = await client.GetAsync(RepositoryApi, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
            response.EnsureSuccessStatusCode();

            await using Stream responseStream = await response.Content.ReadAsStreamAsync(cancellationToken);
            using JsonDocument document = await JsonDocument.ParseAsync(responseStream, cancellationToken: cancellationToken);
            JsonElement root = document.RootElement;

            string tag = root.GetProperty("tag_name").GetString() ?? throw new InvalidDataException("GitHub release tag is missing.");
            Version releaseVersion = ParseVersion(tag);
            if (releaseVersion <= GetCurrentVersion())
                return null;

            JsonElement? selectedAsset = null;
            string exactName = $"WHERE-THE-FUCK-AM-I-v{releaseVersion.ToString(3)}-win-x64-portable.zip";
            foreach (JsonElement asset in root.GetProperty("assets").EnumerateArray())
            {
                string name = asset.GetProperty("name").GetString() ?? string.Empty;
                if (name.Equals(exactName, StringComparison.OrdinalIgnoreCase))
                {
                    selectedAsset = asset;
                    break;
                }

                if (selectedAsset == null && name.EndsWith("-win-x64-portable.zip", StringComparison.OrdinalIgnoreCase))
                    selectedAsset = asset;
            }

            if (selectedAsset == null)
                throw new InvalidDataException($"Release {tag} does not contain a Windows portable ZIP.");

            JsonElement selected = selectedAsset.Value;
            string assetName = selected.GetProperty("name").GetString()!;
            string downloadUrl = selected.GetProperty("browser_download_url").GetString()
                ?? throw new InvalidDataException("Release download URL is missing.");
            long size = selected.TryGetProperty("size", out JsonElement sizeElement) ? sizeElement.GetInt64() : 0;
            if (size <= 0 || size > MaximumArchiveBytes)
                throw new InvalidDataException($"Unexpected update archive size: {size} bytes.");

            string? digest = selected.TryGetProperty("digest", out JsonElement digestElement)
                ? digestElement.GetString()
                : null;
            string? sha256 = digest?.StartsWith("sha256:", StringComparison.OrdinalIgnoreCase) == true
                ? digest[7..]
                : null;

            return new PortableRelease(releaseVersion, tag, new Uri(downloadUrl), assetName, size, sha256);
        }

        private static async Task<string> DownloadAndStageAsync(PortableRelease release, CancellationToken cancellationToken = default)
        {
            string updateRoot = Path.Combine(GetUpdateRoot(), Guid.NewGuid().ToString("N"));
            string archivePath = Path.Combine(updateRoot, release.AssetName);
            string payloadRoot = Path.Combine(updateRoot, "payload");
            Directory.CreateDirectory(payloadRoot);

            try
            {
                using HttpClient client = CreateHttpClient();
                using HttpResponseMessage response = await client.GetAsync(release.DownloadUrl, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
                response.EnsureSuccessStatusCode();

                await using (Stream input = await response.Content.ReadAsStreamAsync(cancellationToken))
                await using (FileStream output = new(archivePath, FileMode.CreateNew, FileAccess.Write, FileShare.None, 81920, true))
                {
                    byte[] buffer = new byte[81920];
                    long total = 0;
                    int read;
                    while ((read = await input.ReadAsync(buffer, cancellationToken)) > 0)
                    {
                        total += read;
                        if (total > MaximumArchiveBytes)
                            throw new InvalidDataException("The downloaded update is too large.");
                        await output.WriteAsync(buffer.AsMemory(0, read), cancellationToken);
                    }
                }

                long downloadedSize = new FileInfo(archivePath).Length;
                if (downloadedSize != release.Size)
                    throw new InvalidDataException($"Update size mismatch. Expected {release.Size}, downloaded {downloadedSize}.");

                if (!string.IsNullOrWhiteSpace(release.Sha256))
                {
                    await using FileStream archive = File.OpenRead(archivePath);
                    string actualHash = Convert.ToHexString(await SHA256.HashDataAsync(archive, cancellationToken));
                    if (!actualHash.Equals(release.Sha256, StringComparison.OrdinalIgnoreCase))
                        throw new InvalidDataException("Update SHA-256 verification failed.");
                }

                ExtractArchiveSafely(archivePath, payloadRoot);
                string stagedExecutable = Path.Combine(payloadRoot, ExecutableName);
                if (!File.Exists(stagedExecutable))
                    throw new InvalidDataException($"The update does not contain {ExecutableName}.");

                FileVersionInfo versionInfo = FileVersionInfo.GetVersionInfo(stagedExecutable);
                Version stagedVersion = ParseVersion(versionInfo.ProductVersion ?? versionInfo.FileVersion ?? "0.0.0");
                if (stagedVersion != release.Version)
                    throw new InvalidDataException($"Update version mismatch. Release is {release.Version}, executable is {stagedVersion}.");

                return stagedExecutable;
            }
            catch
            {
                TryDeleteDirectory(updateRoot);
                throw;
            }
        }

        private static void ExtractArchiveSafely(string archivePath, string destinationRoot)
        {
            string root = Path.GetFullPath(destinationRoot) + Path.DirectorySeparatorChar;
            long extractedBytes = 0;
            using ZipArchive archive = ZipFile.OpenRead(archivePath);
            foreach (ZipArchiveEntry entry in archive.Entries)
            {
                string normalizedName = entry.FullName.Replace('\\', '/');
                if (string.IsNullOrWhiteSpace(normalizedName))
                    continue;

                string destination = Path.GetFullPath(Path.Combine(destinationRoot, normalizedName.Replace('/', Path.DirectorySeparatorChar)));
                if (!destination.StartsWith(root, StringComparison.OrdinalIgnoreCase))
                    throw new InvalidDataException($"Unsafe path in update archive: {entry.FullName}");

                if (normalizedName.EndsWith('/'))
                {
                    Directory.CreateDirectory(destination);
                    continue;
                }

                extractedBytes += entry.Length;
                if (extractedBytes > MaximumExtractedBytes)
                    throw new InvalidDataException("The extracted update is too large.");

                Directory.CreateDirectory(Path.GetDirectoryName(destination)!);
                entry.ExtractToFile(destination, false);
            }
        }

        private static void LaunchUpdateHelper(string stagedExecutable)
        {
            string targetDirectory = Path.GetFullPath(AppContext.BaseDirectory);
            ProcessStartInfo startInfo = new(stagedExecutable)
            {
                UseShellExecute = false,
                WorkingDirectory = Path.GetDirectoryName(stagedExecutable)!
            };
            startInfo.ArgumentList.Add("--apply-portable-update");
            startInfo.ArgumentList.Add(targetDirectory);
            startInfo.ArgumentList.Add(Environment.ProcessId.ToString());

            if (Process.Start(startInfo) == null)
                throw new InvalidOperationException("Unable to start the update helper.");
        }

        public static bool TryRunApplyMode(string[] args)
        {
            if (args.Length != 3 || !args[0].Equals("--apply-portable-update", StringComparison.Ordinal))
                return false;

            string? targetDirectory = null;
            try
            {
                string sourceDirectory = Path.GetFullPath(AppContext.BaseDirectory);
                targetDirectory = Path.GetFullPath(args[1]);
                string targetRoot = Path.GetPathRoot(targetDirectory) ?? string.Empty;
                if (targetDirectory.TrimEnd(Path.DirectorySeparatorChar).Equals(targetRoot.TrimEnd(Path.DirectorySeparatorChar), StringComparison.OrdinalIgnoreCase))
                    throw new InvalidOperationException("Refusing to update a filesystem root.");
                if (sourceDirectory.Equals(targetDirectory, StringComparison.OrdinalIgnoreCase))
                    throw new InvalidOperationException("Update source and destination are the same directory.");
                if (!File.Exists(Path.Combine(sourceDirectory, ExecutableName)) || !File.Exists(Path.Combine(targetDirectory, ExecutableName)))
                    throw new InvalidOperationException("The portable application directory is invalid.");
                if (!int.TryParse(args[2], out int parentProcessId))
                    throw new InvalidOperationException("The updater received an invalid process id.");

                WaitForProcessExit(parentProcessId);
                CopyPayload(sourceDirectory, targetDirectory);

                Process.Start(new ProcessStartInfo(Path.Combine(targetDirectory, ExecutableName))
                {
                    UseShellExecute = true,
                    WorkingDirectory = targetDirectory
                });
            }
            catch (Exception ex)
            {
                try { File.WriteAllText(Path.Combine(AppContext.BaseDirectory, "update-error.log"), ex.ToString()); } catch { }
                MessageBox.Show(
                    $"업데이트 적용에 실패했습니다. 기존 프로그램은 그대로 유지됩니다.\n{ex.Message}\n\n" +
                    $"Failed to apply the update. The existing application was left in place.\n{ex.Message}",
                    "업데이트 오류 / Update Error",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error);

                try
                {
                    if (targetDirectory != null && File.Exists(Path.Combine(targetDirectory, ExecutableName)))
                    {
                        Process.Start(new ProcessStartInfo(Path.Combine(targetDirectory, ExecutableName))
                        {
                            UseShellExecute = true,
                            WorkingDirectory = targetDirectory
                        });
                    }
                }
                catch
                {
                    // The error dialog already explains where the updater log is stored.
                }
            }

            return true;
        }

        private static void WaitForProcessExit(int processId)
        {
            try
            {
                using Process process = Process.GetProcessById(processId);
                if (!process.WaitForExit(60_000))
                    throw new TimeoutException("The running application did not close within 60 seconds.");
            }
            catch (ArgumentException)
            {
                // The process already exited.
            }
        }

        private static void CopyPayload(string sourceDirectory, string targetDirectory)
        {
            string sourceRoot = Path.GetFullPath(sourceDirectory) + Path.DirectorySeparatorChar;
            string targetRoot = Path.GetFullPath(targetDirectory) + Path.DirectorySeparatorChar;
            string settingsPath = Path.Combine("assets", "settings.json");
            string backupRoot = Path.Combine(Path.GetTempPath(), "WHERE-THE-FUCK-AM-I", "backups", Guid.NewGuid().ToString("N"));
            List<(string Destination, string? Backup)> appliedFiles = [];

            try
            {
                foreach (string sourceFile in Directory.EnumerateFiles(sourceDirectory, "*", SearchOption.AllDirectories))
                {
                    string relativePath = Path.GetRelativePath(sourceDirectory, sourceFile);
                    if (relativePath.Equals(settingsPath, StringComparison.OrdinalIgnoreCase) && File.Exists(Path.Combine(targetDirectory, relativePath)))
                        continue;
                    if (relativePath.Equals("app.log", StringComparison.OrdinalIgnoreCase) ||
                        relativePath.Equals("quest_saves.db", StringComparison.OrdinalIgnoreCase) ||
                        relativePath.Equals("update-error.log", StringComparison.OrdinalIgnoreCase))
                        continue;

                    string validatedSource = Path.GetFullPath(sourceFile);
                    string destination = Path.GetFullPath(Path.Combine(targetDirectory, relativePath));
                    if (!validatedSource.StartsWith(sourceRoot, StringComparison.OrdinalIgnoreCase) ||
                        !destination.StartsWith(targetRoot, StringComparison.OrdinalIgnoreCase))
                        throw new InvalidOperationException("Unsafe update file path.");

                    string? backup = null;
                    if (File.Exists(destination))
                    {
                        backup = Path.Combine(backupRoot, relativePath);
                        Directory.CreateDirectory(Path.GetDirectoryName(backup)!);
                        File.Copy(destination, backup, true);
                    }

                    Directory.CreateDirectory(Path.GetDirectoryName(destination)!);
                    CopyFileWithRetry(validatedSource, destination);
                    appliedFiles.Add((destination, backup));
                }
            }
            catch (Exception updateError)
            {
                List<Exception> rollbackErrors = [];
                for (int index = appliedFiles.Count - 1; index >= 0; index--)
                {
                    (string destination, string? backup) = appliedFiles[index];
                    try
                    {
                        if (backup == null)
                            File.Delete(destination);
                        else
                            CopyFileWithRetry(backup, destination);
                    }
                    catch (Exception rollbackError)
                    {
                        rollbackErrors.Add(rollbackError);
                    }
                }

                if (rollbackErrors.Count > 0)
                    throw new AggregateException("The update failed and one or more files could not be rolled back.", [updateError, .. rollbackErrors]);
                throw;
            }
            finally
            {
                TryDeleteDirectory(backupRoot);
            }
        }

        private static void CopyFileWithRetry(string source, string destination)
        {
            Exception? lastError = null;
            for (int attempt = 0; attempt < 20; attempt++)
            {
                string temporary = destination + ".update-" + Guid.NewGuid().ToString("N") + ".tmp";
                try
                {
                    File.Copy(source, temporary, true);
                    File.Move(temporary, destination, true);
                    return;
                }
                catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
                {
                    lastError = ex;
                    try { File.Delete(temporary); } catch { }
                    Thread.Sleep(250);
                }
            }

            throw new IOException($"Unable to replace {destination}.", lastError);
        }

        public static void CleanupStaleUpdateDirectories()
        {
            string root = GetUpdateRoot();
            if (!Directory.Exists(root))
                return;

            foreach (string directory in Directory.EnumerateDirectories(root))
            {
                try
                {
                    if (Directory.GetCreationTimeUtc(directory) < DateTime.UtcNow.AddDays(-1))
                        Directory.Delete(directory, true);
                }
                catch
                {
                    // A running updater may still be using the directory.
                }
            }
        }

        private static HttpClient CreateHttpClient()
        {
            HttpClient client = new() { Timeout = TimeSpan.FromMinutes(5) };
            client.DefaultRequestHeaders.UserAgent.Add(new ProductInfoHeaderValue("WHERE-THE-FUCK-AM-I-Updater", GetCurrentVersion().ToString(3)));
            client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/vnd.github+json"));
            client.DefaultRequestHeaders.Add("X-GitHub-Api-Version", "2022-11-28");
            return client;
        }

        private static Version GetCurrentVersion()
        {
            return NormalizeVersion(Assembly.GetEntryAssembly()?.GetName().Version ?? new Version(0, 0, 0));
        }

        private static Version ParseVersion(string value)
        {
            string clean = value.Trim().TrimStart('v', 'V');
            int suffix = clean.IndexOfAny(['-', '+']);
            if (suffix >= 0)
                clean = clean[..suffix];
            if (!Version.TryParse(clean, out Version? version))
                throw new InvalidDataException($"Invalid release version: {value}");
            return NormalizeVersion(version);
        }

        private static Version NormalizeVersion(Version version)
        {
            return new Version(version.Major, version.Minor, Math.Max(0, version.Build), Math.Max(0, version.Revision));
        }

        private static string GetUpdateRoot()
        {
            return Path.Combine(Path.GetTempPath(), "WHERE-THE-FUCK-AM-I", "updates");
        }

        private static void TryDeleteDirectory(string path)
        {
            try { if (Directory.Exists(path)) Directory.Delete(path, true); } catch { }
        }
    }
}
