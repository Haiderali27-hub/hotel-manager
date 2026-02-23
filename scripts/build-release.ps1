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
if (-not $env:TAURI_SIGNING_PRIVATE_KEY) {
    $keyPath = "$env:USERPROFILE\.tauri\inertia.key"
    if (Test-Path $keyPath) {
        $env:TAURI_SIGNING_PRIVATE_KEY = Get-Content $keyPath -Raw
        Write-Host "Loaded private key from $keyPath" -ForegroundColor Green
    } else {
        Write-Error "TAURI_SIGNING_PRIVATE_KEY not set and key file not found at $keyPath"
        Write-Host "Run scripts\generate-signing-key.ps1 first." -ForegroundColor Red
        exit 1
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

# Find the built installer (Tauri v2 produces .exe + .exe.sig in the nsis folder)
$nsisDir   = Join-Path $tauriDir "target\release\bundle\nsis"
$installer = Get-ChildItem -Path $nsisDir -Filter "*-setup.exe" | Select-Object -First 1
$sigFile   = Get-ChildItem -Path $nsisDir -Filter "*-setup.exe.sig" | Select-Object -First 1

if (-not $installer) {
    Write-Error "Could not find built installer in target\release\bundle\nsis\"
    exit 1
}

if (-not $sigFile) {
    Write-Error "Could not find signature file (.exe.sig). Make sure TAURI_SIGNING_PRIVATE_KEY is set correctly."
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
