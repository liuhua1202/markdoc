# 同步根目录 index.html 到 Android assets
# 用法：.\tools\sync-web.ps1
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$src = Join-Path $root "index.html"
$dst = Join-Path $root "android-app\app\src\main\assets\index.html"

if (-not (Test-Path $src)) {
    Write-Error "找不到源文件: $src"
}

Write-Host "正在同步 $src → $dst" -ForegroundColor Cyan
Copy-Item $src $dst -Force
Write-Host "✓ 同步完成" -ForegroundColor Green
Write-Host ""
Write-Host "下一步: " -NoNewline
Write-Host "cd android-app; .\gradlew.bat assembleDebug" -ForegroundColor Yellow