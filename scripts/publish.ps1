[CmdletBinding()]
param(
    [ValidateSet("win-x64")]
    [string]$Runtime = "win-x64",
    [switch]$FrameworkDependent
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

$Mode = if ($FrameworkDependent) { "framework-dependent" } else { "self-contained" }
$OutputDir = Join-Path $RepoRoot "artifacts\publish\$Runtime-$Mode"
$SelfContained = if ($FrameworkDependent) { "false" } else { "true" }

& $NpmExe ci --prefix (Join-Path $RepoRoot "eft-where-am-i")
if ($LASTEXITCODE -ne 0) { throw "npm ci failed with exit code $LASTEXITCODE." }
& $NpmExe run build:css --prefix (Join-Path $RepoRoot "eft-where-am-i")
if ($LASTEXITCODE -ne 0) { throw "CSS build failed with exit code $LASTEXITCODE." }

& $DotnetExe publish $ProjectFile `
    -c Release `
    -r $Runtime `
    --self-contained $SelfContained `
    -p:PublishSingleFile=false `
    -p:IncludeNativeLibrariesForSelfExtract=false `
    -o $OutputDir
if ($LASTEXITCODE -ne 0) { throw "Publish failed with exit code $LASTEXITCODE." }

Write-Host "Publish complete: $OutputDir"
