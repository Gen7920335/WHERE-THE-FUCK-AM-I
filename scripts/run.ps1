[CmdletBinding()]
param(
    [ValidateSet("Debug", "Release")]
    [string]$Configuration = "Debug"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$ProjectFile = Join-Path $RepoRoot "eft-where-am-i\eft-where-am-i.csproj"

if (-not (Test-Path -LiteralPath (Join-Path $RepoRoot ".tools\dotnet\dotnet.exe"))) {
    & (Join-Path $PSScriptRoot "bootstrap.ps1")
    if ($LASTEXITCODE -ne 0) { throw "Bootstrap failed." }
}

. (Join-Path $PSScriptRoot "use-local-toolchain.ps1")

& $DotnetExe build $ProjectFile -c $Configuration
if ($LASTEXITCODE -ne 0) { throw "Build failed with exit code $LASTEXITCODE." }

$OutputDir = Join-Path $RepoRoot "eft-where-am-i\bin\$Configuration\net10.0-windows"
$AppExe = Join-Path $OutputDir "EFT-Where-Am-I.exe"
if (-not (Test-Path -LiteralPath $AppExe)) {
    throw "Application executable is missing: $AppExe"
}

# The app stores settings relative to its working directory. Running from the
# output folder keeps generated settings, logs, and SQLite files out of source.
Push-Location $OutputDir
try {
    & $AppExe
}
finally {
    Pop-Location
}
