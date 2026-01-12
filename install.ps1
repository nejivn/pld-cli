#!/usr/bin/env pwsh
# PLD CLI - Quick Install Script
# Usage: irm https://raw.githubusercontent.com/laiduc1312209/pld-cli/main/install.ps1 | iex

$ErrorActionPreference = "Stop"

Write-Host "📤 Installing PLD CLI..." -ForegroundColor Cyan

# Configuration - Fetch latest version from GitHub
Write-Host "Fetching latest version..." -ForegroundColor Yellow
try {
    $latestRelease = Invoke-RestMethod -Uri "https://api.github.com/repos/laiduc1312209/pld-cli/releases/latest" -Headers @{ "User-Agent" = "pld-cli-installer" }
    $tagName = $latestRelease.tag_name
    $version = $tagName -replace '^v', ''
    Write-Host "Latest version: v$version" -ForegroundColor Green
}
catch {
    Write-Host "⚠️  Could not fetch latest version, using default..." -ForegroundColor Yellow
    $tagName = "v1.0.2"
    $version = "1.0.2"
}

$installDir = "$env:LOCALAPPDATA\pld-cli"
$zipUrl = "https://github.com/laiduc1312209/pld-cli/archive/refs/tags/$tagName.zip"
$tempZip = "$env:TEMP\pld-cli.zip"

# Check Node.js
Write-Host "Checking Node.js..." -ForegroundColor Yellow
if (!(Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Error: Node.js is required but not installed." -ForegroundColor Red
    Write-Host "Please install Node.js from: https://nodejs.org" -ForegroundColor Yellow
    exit 1
}

# Download
Write-Host "Downloading PLD CLI v$version..." -ForegroundColor Yellow
Invoke-WebRequest -Uri $zipUrl -OutFile $tempZip

# Extract
Write-Host "Extracting..." -ForegroundColor Yellow
if (Test-Path $installDir) {
    Remove-Item $installDir -Recurse -Force
}
Expand-Archive -Path $tempZip -DestinationPath "$env:TEMP\pld-cli-temp" -Force
Move-Item "$env:TEMP\pld-cli-temp\pld-cli-$tagName" $installDir -Force
Remove-Item "$env:TEMP\pld-cli-temp" -Recurse -Force
Remove-Item $tempZip -Force

# Install dependencies
Write-Host "Installing dependencies..." -ForegroundColor Yellow
Push-Location $installDir
npm install --production --silent
Pop-Location

# Create batch wrapper
$batchContent = @"
@echo off
node "$installDir\index.js" %*
"@
$batchPath = "$installDir\pld.cmd"
$batchContent | Out-File -FilePath $batchPath -Encoding ASCII

# Add to PATH
Write-Host "Adding to PATH..." -ForegroundColor Yellow
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notlike "*$installDir*") {
    [Environment]::SetEnvironmentVariable(
        "Path",
        "$userPath;$installDir",
        "User"
    )
    $env:Path = "$env:Path;$installDir"
}

Write-Host "`n✅ PLD CLI installed successfully!" -ForegroundColor Green
Write-Host "`n📝 Next steps:" -ForegroundColor Cyan
Write-Host "  1. Restart your terminal" -ForegroundColor White
Write-Host "  2. Run: pld --config" -ForegroundColor White
Write-Host "  3. Run: pld -s <file>" -ForegroundColor White
Write-Host "`nInstalled to: $installDir" -ForegroundColor Gray
