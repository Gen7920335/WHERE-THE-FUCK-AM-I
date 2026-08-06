[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$ToolsDir = Join-Path $RepoRoot ".tools"
$DotnetVersion = "10.0.302"
$NodeVersion = "24.19.0"
$DotnetDir = Join-Path $ToolsDir "dotnet"
$NodeDir = Join-Path $ToolsDir "node-v$NodeVersion-win-x64"
$DotnetExe = Join-Path $DotnetDir "dotnet.exe"
$NodeExe = Join-Path $NodeDir "node.exe"
$NpmExe = Join-Path $NodeDir "npm.cmd"

function Assert-LastExitCode([string]$Step) {
    if ($LASTEXITCODE -ne 0) {
        throw "$Step failed with exit code $LASTEXITCODE."
    }
}

New-Item -ItemType Directory -Force -Path $ToolsDir | Out-Null

if (-not (Test-Path -LiteralPath $DotnetExe)) {
    Write-Host "Installing .NET SDK $DotnetVersion into .tools/dotnet..."
    $DotnetInstallScript = Join-Path ([IO.Path]::GetTempPath()) "eft-where-am-i-dotnet-install.ps1"
    Invoke-WebRequest -UseBasicParsing -Uri "https://dot.net/v1/dotnet-install.ps1" -OutFile $DotnetInstallScript
    & powershell -NoProfile -ExecutionPolicy Bypass -File $DotnetInstallScript `
        -Version $DotnetVersion `
        -InstallDir $DotnetDir `
        -NoPath
    Assert-LastExitCode ".NET SDK installation"
}

if (-not (Test-Path -LiteralPath $NodeExe)) {
    Write-Host "Installing Node.js $NodeVersion into .tools..."
    $ArchiveName = "node-v$NodeVersion-win-x64.zip"
    $NodeArchive = Join-Path ([IO.Path]::GetTempPath()) $ArchiveName
    $NodeBaseUri = "https://nodejs.org/dist/v$NodeVersion"

    Invoke-WebRequest -UseBasicParsing -Uri "$NodeBaseUri/$ArchiveName" -OutFile $NodeArchive
    $Checksums = (Invoke-WebRequest -UseBasicParsing -Uri "$NodeBaseUri/SHASUMS256.txt").Content
    $ChecksumLine = ($Checksums -split "`n" | Where-Object { $_ -match "\s+$([regex]::Escape($ArchiveName))$" } | Select-Object -First 1)
    if (-not $ChecksumLine) {
        throw "Could not find the Node.js archive checksum."
    }

    $ExpectedHash = ($ChecksumLine -split "\s+")[0].ToUpperInvariant()
    $ActualHash = (Get-FileHash -LiteralPath $NodeArchive -Algorithm SHA256).Hash.ToUpperInvariant()
    if ($ActualHash -ne $ExpectedHash) {
        throw "Node.js archive checksum mismatch."
    }

    Expand-Archive -LiteralPath $NodeArchive -DestinationPath $ToolsDir -Force
}

. (Join-Path $PSScriptRoot "use-local-toolchain.ps1")

Write-Host "Toolchain:"
& $DotnetExe --version
Assert-LastExitCode ".NET version check"
& $NodeExe --version
Assert-LastExitCode "Node.js version check"
& $NpmExe --version
Assert-LastExitCode "npm version check"

Write-Host "Restoring Node.js dependencies..."
& $NpmExe ci --prefix (Join-Path $RepoRoot "eft-where-am-i")
Assert-LastExitCode "npm ci"

Write-Host "Restoring .NET dependencies..."
& $DotnetExe restore (Join-Path $RepoRoot "eft-where-am-i\eft-where-am-i.csproj")
Assert-LastExitCode "dotnet restore"

Write-Host "Bootstrap complete. Run .\scripts\verify.ps1 next."
