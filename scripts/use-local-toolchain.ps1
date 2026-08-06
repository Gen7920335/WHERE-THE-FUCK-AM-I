$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$DotnetDir = Join-Path $RepoRoot ".tools\dotnet"
$NodeDir = Join-Path $RepoRoot ".tools\node-v24.19.0-win-x64"
$DotnetExe = Join-Path $DotnetDir "dotnet.exe"
$NodeExe = Join-Path $NodeDir "node.exe"
$NpmExe = Join-Path $NodeDir "npm.cmd"

if (-not (Test-Path -LiteralPath $DotnetExe) -or -not (Test-Path -LiteralPath $NodeExe)) {
    throw "Local toolchain is missing. Run .\scripts\bootstrap.ps1 first."
}

$env:DOTNET_ROOT = $DotnetDir
$env:DOTNET_CLI_TELEMETRY_OPTOUT = "1"
$env:DOTNET_NOLOGO = "1"
$env:NUGET_PACKAGES = Join-Path $RepoRoot ".tools\nuget-packages"
$env:PATH = "$NodeDir;$DotnetDir;$env:PATH"
