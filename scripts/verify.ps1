[CmdletBinding()]
param(
    [ValidateSet("Debug", "Release")]
    [string]$Configuration = "Debug"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$ProjectDir = Join-Path $RepoRoot "eft-where-am-i"
$ProjectFile = Join-Path $ProjectDir "eft-where-am-i.csproj"
$SquadSmokeProject = Join-Path $RepoRoot "tests\SquadSyncSmoke\SquadSyncSmoke.csproj"
$ReleaseWorkflow = Join-Path $RepoRoot ".github\workflows\release.yml"

if (-not (Test-Path -LiteralPath (Join-Path $RepoRoot ".tools\dotnet\dotnet.exe"))) {
    & (Join-Path $PSScriptRoot "bootstrap.ps1")
    if ($LASTEXITCODE -ne 0) { throw "Bootstrap failed." }
}

. (Join-Path $PSScriptRoot "use-local-toolchain.ps1")

function Assert-LastExitCode([string]$Step) {
    if ($LASTEXITCODE -ne 0) {
        throw "$Step failed with exit code $LASTEXITCODE."
    }
}

Write-Host "Installing the locked Node.js dependency graph..."
& $NpmExe ci --prefix $ProjectDir
Assert-LastExitCode "npm ci"

Write-Host "Checking Node.js dependencies for high-severity vulnerabilities..."
& $NpmExe audit --prefix $ProjectDir --audit-level=high
Assert-LastExitCode "npm audit"

Write-Host "Building Tailwind CSS..."
& $NpmExe run build:css --prefix $ProjectDir
Assert-LastExitCode "Tailwind CSS build"

Write-Host "Checking map JavaScript and three-anchor calibration..."
& $NodeExe --check (Join-Path $ProjectDir "html\map.js")
Assert-LastExitCode "map.js syntax check"
& $NodeExe (Join-Path $RepoRoot "scripts\verify-map-calibration.mjs")
Assert-LastExitCode "map calibration check"
& $NodeExe (Join-Path $RepoRoot "scripts\verify-map-features.mjs")
Assert-LastExitCode "map feature coverage check"
& $NodeExe (Join-Path $RepoRoot "scripts\verify-upstream-parity.mjs")
Assert-LastExitCode "upstream feature parity check"
& $NodeExe (Join-Path $RepoRoot "scripts\audit-battle-pass-coordinates.mjs")
Assert-LastExitCode "Battle Pass coordinate audit"

Write-Host "Validating JSON assets..."
@(
    (Join-Path $ProjectDir "assets\settings.json"),
    (Join-Path $ProjectDir "floor_db.json"),
    (Join-Path $ProjectDir "html\battle-pass-locations.json"),
    (Join-Path $ProjectDir "html\map-markers.json"),
    (Join-Path $ProjectDir "html\quest-locations.json"),
    (Join-Path $ProjectDir "translations\en.json"),
    (Join-Path $ProjectDir "translations\ko.json")
) | ForEach-Object {
    Get-Content -Raw -Encoding UTF8 -LiteralPath $_ | ConvertFrom-Json | Out-Null
}

Write-Host "Restoring and building the WinForms application..."
& $DotnetExe restore $ProjectFile
Assert-LastExitCode "dotnet restore"
& $DotnetExe build $ProjectFile -c $Configuration --no-restore
Assert-LastExitCode "dotnet build"

Write-Host "Running encrypted direct squad loopback test..."
& $DotnetExe run --project $SquadSmokeProject -c $Configuration
Assert-LastExitCode "direct squad smoke test"

$OutputDir = Join-Path $ProjectDir "bin\$Configuration\net10.0-windows"
@(
    "WHERE THE FUCK AM I.exe",
    "assets\css\tailwind.css",
    "assets\settings.json",
    "floor_db.json",
    "html\map.css",
    "html\map.html",
    "html\map.js",
    "html\battle-pass-locations.json",
    "html\map-markers.json",
    "html\panel.html",
    "html\quest-locations.json",
    "html\settings.html",
    "translations\en.json",
    "translations\ko.json"
) | ForEach-Object {
    $RequiredPath = Join-Path $OutputDir $_
    if (-not (Test-Path -LiteralPath $RequiredPath)) {
        throw "Required build output is missing: $RequiredPath"
    }
}

$AppExePath = Join-Path $OutputDir "WHERE THE FUCK AM I.exe"
$AppDllPath = Join-Path $OutputDir "WHERE THE FUCK AM I.dll"
$AssemblyIdentity = [System.Reflection.AssemblyName]::GetAssemblyName($AppDllPath)
if ($AssemblyIdentity.Name -ne "WHERE THE FUCK AM I") {
    throw "Unexpected assembly name: $($AssemblyIdentity.Name)"
}
$VersionInfo = [System.Diagnostics.FileVersionInfo]::GetVersionInfo($AppExePath)
if ($VersionInfo.ProductName -ne "WHERE THE FUCK AM I" -or $VersionInfo.FileDescription -ne "WHERE THE FUCK AM I") {
    throw "Unexpected application branding: ProductName='$($VersionInfo.ProductName)', FileDescription='$($VersionInfo.FileDescription)'"
}

Write-Host "Checking installer and portable release workflow..."
$ReleaseWorkflowText = Get-Content -Raw -Encoding UTF8 -LiteralPath $ReleaseWorkflow
@(
    'github.repository',
    'WHERE THE FUCK AM I.exe',
    '*-Setup.exe',
    '*-Portable.zip',
    '--self-contained true',
    'gh release create'
) | ForEach-Object {
    if (-not $ReleaseWorkflowText.Contains($_)) {
        throw "Release workflow is missing required token: $_"
    }
}
if ($ReleaseWorkflowText.Contains('https://github.com/karpitony/eft-where-am-i') -or $ReleaseWorkflowText.Contains('EFT-Where-Am-I.exe')) {
    throw "Release workflow still targets the upstream repository or old executable name."
}

git -C $RepoRoot diff --check
Assert-LastExitCode "git diff --check"

Write-Host "Verification complete: $OutputDir"
