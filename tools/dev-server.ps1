# 马克档 · 一键启动本地调试服务器
# 用法：.\tools\dev-server.ps1 [-Port 8765] [-NoBrowser]
# 访问：http://localhost:8765/?debug=1

param(
    [int]$Port = 8765,
    [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  马克档 · 本地调试服务器" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查 Python
$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) {
    Write-Host "❌ 未找到 Python" -ForegroundColor Red
    Write-Host "   下载: https://www.python.org/downloads/" -ForegroundColor Yellow
    exit 1
}

# 检查端口
$inUse = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($inUse) {
    Write-Host "⚠️  端口 $Port 已被占用，尝试 $Port+1..." -ForegroundColor Yellow
    $Port = $Port + 1
}

Set-Location $root

# 启动 HTTP 服务器（后台）
Write-Host "📂 工作目录: $root" -ForegroundColor Cyan
Write-Host "🌐 端口: $Port" -ForegroundColor Cyan
Write-Host ""

$serverJob = Start-Job -ScriptBlock {
    param($p, $r)
    Set-Location $r
    python -m http.server $p
} -ArgumentList $Port, $root

Start-Sleep -Seconds 2

# 健康检查
try {
    $r = Invoke-WebRequest -Uri "http://localhost:$Port/" -UseBasicParsing -TimeoutSec 5
    if ($r.StatusCode -eq 200) {
        Write-Host "✓ 服务器已启动" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ 服务器启动失败: $_" -ForegroundColor Red
    Stop-Job $serverJob -ErrorAction SilentlyContinue
    Remove-Job $serverJob -ErrorAction SilentlyContinue
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  调试入口" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  主应用:    " -NoNewline -ForegroundColor White
Write-Host "http://localhost:$Port/" -ForegroundColor Yellow
Write-Host "  调试模式:  " -NoNewline -ForegroundColor White
Write-Host "http://localhost:$Port/?debug=1" -ForegroundColor Yellow
Write-Host "  源码同步:  " -NoNewline -ForegroundColor White
Write-Host ".\tools\sync-web.ps1" -ForegroundColor Yellow
Write-Host ""

# 打开浏览器
if (-not $NoBrowser) {
    Write-Host "🚀 打开浏览器..." -ForegroundColor Cyan
    Start-Process "http://localhost:$Port/?debug=1"
}

Write-Host ""
Write-Host "💡 Chrome DevTools 调试技巧:" -ForegroundColor Cyan
Write-Host "   - F12 打开 DevTools" -ForegroundColor White
Write-Host "   - Console 面板查看 console.log" -ForegroundColor White
Write-Host "   - Application > Local Storage 查看持久化数据" -ForegroundColor White
Write-Host "   - Network 面板看 marked.js 加载" -ForegroundColor White
Write-Host "   - Sources 面板设置断点（找到 index.html）" -ForegroundColor White
Write-Host "   - 移动端模拟: Ctrl+Shift+M / Cmd+Shift+M" -ForegroundColor White
Write-Host ""
Write-Host "按 Ctrl+C 停止服务器..." -ForegroundColor Yellow

# 等待用户中断
try {
    while ($true) {
        Start-Sleep -Seconds 1
        if ($serverJob.State -in @('Failed', 'Completed')) {
            Write-Host "服务器已退出" -ForegroundColor Red
            break
        }
    }
} finally {
    Write-Host ""
    Write-Host "🛑 停止服务器..." -ForegroundColor Yellow
    Stop-Job $serverJob -ErrorAction SilentlyContinue
    Remove-Job $serverJob -ErrorAction SilentlyContinue
}