#!/usr/bin/env pwsh
# ============================================================
# INERTIA - Build & Release Script
# ============================================================
# Builds the app in release mode, extracts the signature,
# and generates the latest.json update manifest.
#
# Prerequisites:
#   - Run generate-signing-key.ps1 first
#   - Set TAURI_SIGNING_PRIVATE_KEY and TAURI_SIGNING_PRIVATE_KEY_PASSWORD
#
# Usage:
#   .\scripts\build-release.ps1 -Version "1.0.1" -Notes "Bug fixes"
# ============================================================

param(
    [Parameter(Mandatory=$true)]
    [string]$Version,

    [string]$Notes = "Update available",

    [string]$GithubUser = "Haiderali27-hub",
    [string]$GithubRepo = "inertia-pos-releases"
)

$rootDir = Split-Path $PSScriptRoot -Parent
$tauriDir = Join-Path $rootDir "src-tauri"

Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "  INERTIA Release Builder v$Version" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""

# Validate signing env vars
$keyPath = "$env:USERPROFILE\.tauri\inertia.key"
if (-not $env:TAURI_SIGNING_PRIVATE_KEY) {
    if (Test-Path $keyPath) {
        # Pass the FILE PATH — Tauri v2 accepts path or raw content
        $env:TAURI_SIGNING_PRIVATE_KEY = $keyPath
        Write-Host "Loaded private key path: $keyPath" -ForegroundColor Green
    } else {
        Write-Error "Key file not found at $keyPath. Run scripts\generate-signing-key.ps1 first."
        exit 1
    }
} else {
    # If user set it to file contents, replace with path for reliability
    if (Test-Path $keyPath) {
        $env:TAURI_SIGNING_PRIVATE_KEY = $keyPath
    }
}

if (-not $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD) {
    $pwd = Read-Host -Prompt "Enter private key password" -AsSecureString
    $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($pwd)
    )
}

# Build
Write-Host "Building release..." -ForegroundColor Yellow
Set-Location $rootDir
npm run tauri build
if ($LASTEXITCODE -ne 0) {
    Write-Error "Build failed!"
    exit 1
}

# Find signed updater artifact.
# With createUpdaterArtifacts="v1Compatible", Tauri creates *.nsis.zip + *.nsis.zip.sig.
# Some setups may still produce *-setup.exe + *-setup.exe.sig.
$nsisDir = Join-Path $tauriDir "target\release\bundle\nsis"

$installer = Get-ChildItem -Path $nsisDir -Filter "*.nsis.zip" -ErrorAction SilentlyContinue | Select-Object -First 1
$sigFile   = Get-ChildItem -Path $nsisDir -Filter "*.nsis.zip.sig" -ErrorAction SilentlyContinue | Select-Object -First 1

if (-not $installer -or -not $sigFile) {
    $installer = Get-ChildItem -Path $nsisDir -Filter "*-setup.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
    $sigFile   = Get-ChildItem -Path $nsisDir -Filter "*-setup.exe.sig" -ErrorAction SilentlyContinue | Select-Object -First 1
}

if (-not $installer) {
    Write-Error "Could not find built artifact in target\release\bundle\nsis\"
    exit 1
}

if (-not $sigFile) {
    Write-Error "Could not find signature file. Enable bundle.createUpdaterArtifacts in tauri.conf.json and verify signing env vars."
    exit 1
}

$signature   = (Get-Content $sigFile.FullName -Raw).Trim()
$pubDate     = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
$downloadUrl = "https://github.com/$GithubUser/$GithubRepo/releases/download/v$Version/$($installer.Name)"

# Generate latest.json
$manifest = @{
    version  = $Version
    notes    = $Notes
    pub_date = $pubDate
    platforms = @{
        "windows-x86_64" = @{
            signature = $signature.Trim()
            url       = $downloadUrl
        }
    }
}

$manifestPath = Join-Path $rootDir "scripts\latest.json"
$manifestJson = $manifest | ConvertTo-Json -Depth 5
[System.IO.File]::WriteAllText($manifestPath, $manifestJson, [System.Text.UTF8Encoding]::new($false))

Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "  BUILD COMPLETE" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Installer:    $($installer.FullName)" -ForegroundColor Green
Write-Host "Manifest:     $manifestPath" -ForegroundColor Green
Write-Host ""
Write-Host "NEXT STEPS:" -ForegroundColor Yellow
Write-Host "1. Create GitHub release: https://github.com/$GithubUser/$GithubRepo/releases/new" -ForegroundColor White
Write-Host "   - Tag: v$Version" -ForegroundColor White
Write-Host "   - Upload: $($installer.Name)" -ForegroundColor White
Write-Host ""
Write-Host "2. Update the manifest URL in scripts\latest.json if needed" -ForegroundColor White
Write-Host ""
Write-Host "3. Push latest.json to your releases repo (raw URL must match tauri.conf.json endpoint):" -ForegroundColor White
Write-Host "   https://raw.githubusercontent.com/$GithubUser/$GithubRepo/main/latest.json" -ForegroundColor Green
Write-Host ""
