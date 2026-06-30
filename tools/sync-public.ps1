# 同步根目录的 web 资源到 public/ (部署用)
# 用法：.\sync-public.ps1
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

Write-Host "同步 web 资源 → public/" -ForegroundColor Cyan

# 清理 public/
if (Test-Path "$root\public") {
    Remove-Item "$root\public\*" -Recurse -Force
}

# 复制核心文件
foreach ($item in @("index.html", "manifest.json", "sw.js", "logo.svg")) {
    $s = Join-Path $root $item
    $d = Join-Path "$root\public" $item
    if (Test-Path $s) {
        Copy-Item $s $d -Force
        Write-Host "  ✓ $item" -ForegroundColor Green
    }
}

# 复制目录
foreach ($dir in @("vendor", "icons")) {
    $s = Join-Path $root $dir
    $d = Join-Path "$root\public" $dir
    if (Test-Path $s) {
        New-Item -ItemType Directory -Force -Path $d | Out-Null
        Copy-Item "$s\*" $d -Recurse -Force
        Write-Host "  ✓ $dir/" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "✓ 同步完成，public/ 可以直接部署" -ForegroundColor Green
Write-Host ""
Write-Host "部署选项:" -ForegroundColor Cyan
Write-Host "  • GitHub Pages:  推送到 main 分支，自动部署" -ForegroundColor White
Write-Host "  • Vercel:        vercel --prod" -ForegroundColor White
Write-Host "  • Netlify:       netlify deploy --prod --dir=public" -ForegroundColor White
Write-Host "  • Cloudflare:    Pages → 选 public/ 作为输出" -ForegroundColor White