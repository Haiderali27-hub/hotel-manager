#!/usr/bin/env pwsh
# ============================================================
# INERTIA - Tauri Updater Signing Key Generator
# ============================================================
# Run this ONCE to generate the update signing keypair.
# Keep the private key SAFE - never commit it to git.
#
# Usage (in PowerShell):
#   .\scripts\generate-signing-key.ps1
#
# After running, copy the PUBLIC KEY printed at the end
# and paste it into src-tauri\tauri.conf.json under:
#   "plugins" > "updater" > "pubkey"
# ============================================================

$keyDir = "$env:USERPROFILE\.tauri"
$keyPath = "$keyDir\inertia.key"

# Create key directory if needed
if (-not (Test-Path $keyDir)) {
    New-Item -ItemType Directory -Path $keyDir | Out-Null
}

Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "  INERTIA Signing Key Generator" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "This will generate a signing keypair for the Tauri updater." -ForegroundColor Yellow
Write-Host "You will be prompted to set a password for the private key." -ForegroundColor Yellow
Write-Host ""
Write-Host "The private key will be saved to:" -ForegroundColor White
Write-Host "  $keyPath" -ForegroundColor Green
Write-Host ""
Write-Host "IMPORTANT: Never commit the private key to git!" -ForegroundColor Red
Write-Host ""

# Run the key generation
npx tauri signer generate -w "$keyPath"

$pubPath = "$keyPath.pub"
if (Test-Path $pubPath) {
    $pubkey   = (Get-Content $pubPath -Raw).Trim()
    $confPath = Join-Path (Split-Path $PSScriptRoot -Parent) "src-tauri\tauri.conf.json"
    $conf     = Get-Content $confPath -Raw | ConvertFrom-Json
    $conf.plugins.updater.pubkey = $pubkey
    # Write WITHOUT BOM — serde_json (Rust) rejects UTF-8 BOM
    [System.IO.File]::WriteAllText($confPath, ($conf | ConvertTo-Json -Depth 10), [System.Text.UTF8Encoding]::new($false))
    Write-Host ""
    Write-Host "✅ Public key automatically written to tauri.conf.json!" -ForegroundColor Green
}

Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "  NEXT STEPS" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Set these env vars before building (each session):" -ForegroundColor White
Write-Host "   `$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content '$keyPath' -Raw" -ForegroundColor Green
Write-Host "   `$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = 'your-password'" -ForegroundColor Green
Write-Host ""
Write-Host "Then build:" -ForegroundColor White
Write-Host "   .\scripts\build-release.ps1 -Version '1.0.0' -Notes 'Initial release'" -ForegroundColor Green
Write-Host ""
