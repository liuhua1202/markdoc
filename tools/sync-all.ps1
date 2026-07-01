# 同步根目录的 web 资源到所有平台
# 用法：.\tools\sync-all.ps1

$root = Split-Path -Parent $PSScriptRoot
$ErrorActionPreference = "Continue"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  同步 web 资源到所有平台" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. 同步到 Android assets
Write-Host "[1/3] Android assets" -ForegroundColor Yellow
Copy-Item "$root\index.html" "$root\android-app\app\src\main\assets\index.html" -Force
Write-Host "  ✓ android-app/app/src/main/assets/index.html" -ForegroundColor Green

# 2. 同步到 Desktop (Electron)
Write-Host "[2/3] Electron desktop" -ForegroundColor Yellow
$desktopAssets = "$root\desktop-app\src\assets"
Copy-Item "$root\index.html" "$root\desktop-app\src\index.html" -Force
Write-Host "  ✓ desktop-app/src/index.html" -ForegroundColor Green

# 3. 同步到 iOS www
Write-Host "[3/3] iOS Capacitor www" -ForegroundColor Yellow
$iosWww = "$root\ios-app\www"
foreach ($item in @("index.html", "logo.svg", "manifest.json", "sw.js")) {
    $s = Join-Path $root $item
    $d = Join-Path $iosWww $item
    if (Test-Path $s) {
        Copy-Item $s $d -Force
        Write-Host "  ✓ ios-app/www/$item" -ForegroundColor Green
    }
}
foreach ($dir in @("vendor", "icons")) {
    $s = Join-Path $root $dir
    $d = Join-Path $iosWww $dir
    if (Test-Path $s) {
        New-Item -ItemType Directory -Force -Path $d | Out-Null
        Copy-Item "$s\*" $d -Recurse -Force
        Write-Host "  ✓ ios-app/www/$dir/" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "✓ 全部同步完成" -ForegroundColor Green
Write-Host ""
Write-Host "下一步:" -ForegroundColor Yellow
Write-Host "  • Android: cd android-app; .\gradlew.bat assembleDebug" -ForegroundColor White
Write-Host "  • Desktop: cd desktop-app; npm install; npm start" -ForegroundColor White
Write-Host "  • iOS:     cd ios-app; npm install; npx cap sync (需要 Mac)" -ForegroundColor White
Write-Host "  • PWA:     markdoc-pwa.zip 已包含最新资源" -ForegroundColor White