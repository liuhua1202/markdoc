# 同步根目录的 web 资源到 ios-app/www/
# 用法：.\sync.ps1
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$src = $root
$dst = Join-Path $root "ios-app\www"

Write-Host "同步 web 资源 → ios-app/www/" -ForegroundColor Cyan

# 清理 www/
if (Test-Path $dst) {
    Remove-Item "$dst\*" -Recurse -Force -Exclude @("assets","node_modules")
}

# 复制核心文件
foreach ($item in @("index.html", "logo.svg", "manifest.json", "sw.js")) {
    $s = Join-Path $src $item
    $d = Join-Path $dst $item
    if (Test-Path $s) {
        Copy-Item $s $d -Force
        Write-Host "  ✓ $item" -ForegroundColor Green
    }
}

# 复制目录
foreach ($dir in @("vendor", "icons")) {
    $s = Join-Path $src $dir
    $d = Join-Path $dst $dir
    if (Test-Path $s) {
        New-Item -ItemType Directory -Force -Path $d | Out-Null
        Copy-Item "$s\*" $d -Recurse -Force
        Write-Host "  ✓ $dir/" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "✓ 同步完成" -ForegroundColor Green
Write-Host "下一步：在 Mac 上运行 cd ios-app; npm install; npx cap add ios; npx cap sync" -ForegroundColor Yellow