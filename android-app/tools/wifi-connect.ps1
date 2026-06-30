# 无线调试连接（无需 USB 数据线）
# 用法：.\tools\wifi-connect.ps1 -Ip <手机IP> [ -Port 5555 ]
# 首次需用 USB 连一次：adb tcpip 5555

param(
    [Parameter(Mandatory=$true)]
    [string]$Ip,

    [int]$Port = 5555
)

Write-Host "🔌 正在连接 $Ip:$Port ..." -ForegroundColor Cyan
adb connect "$Ip`:$Port"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ 连接成功" -ForegroundColor Green
    Write-Host ""
    Write-Host "现在可以拔掉 USB 线，运行 .\tools\install.ps1 安装 APK" -ForegroundColor Yellow
} else {
    Write-Host "❌ 连接失败" -ForegroundColor Red
    Write-Host "请确保：" -ForegroundColor Yellow
    Write-Host "  1. 手机和电脑在同一 WiFi 网络" -ForegroundColor Yellow
    Write-Host "  2. 手机已开启 USB 调试并执行过 'adb tcpip 5555'" -ForegroundColor Yellow
    Write-Host "  3. 防火墙允许 adb 通信" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "已连接设备：" -ForegroundColor Cyan
adb devices