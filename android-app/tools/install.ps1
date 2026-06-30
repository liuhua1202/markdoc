# 马克档 · 一键构建并安装到小米 14
# 用法：.\tools\install.ps1
# 前置：开启 USB 调试，连接电脑

$ErrorActionPreference = "Continue"
$root = Split-Path -Parent $PSScriptRoot

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  马克档 · 一键构建并安装" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查 adb
$adb = Get-Command adb -ErrorAction SilentlyContinue
if (-not $adb) {
    Write-Host "❌ 未找到 adb，请先安装 Android SDK Platform Tools" -ForegroundColor Red
    Write-Host "   下载地址: https://developer.android.com/tools/releases/platform-tools" -ForegroundColor Yellow
    exit 1
}

# 检查设备
Write-Host "📱 检测连接的设备..." -ForegroundColor Cyan
$devices = adb devices
if ($devices -notmatch "device$") {
    Write-Host "❌ 未检测到设备，请检查：" -ForegroundColor Red
    Write-Host "   1. 手机 USB 调试已开启（设置 → 开发者选项）" -ForegroundColor Yellow
    Write-Host "   2. 数据线已连接，授权了调试" -ForegroundColor Yellow
    Write-Host "" -ForegroundColor Yellow
    Write-Host "当前 adb 设备列表：" -ForegroundColor Yellow
    Write-Host $devices -ForegroundColor Yellow
    exit 1
}
Write-Host "✓ 设备已连接" -ForegroundColor Green
Write-Host ""

# 显示设备信息
Write-Host "📋 设备信息：" -ForegroundColor Cyan
adb shell getprop ro.product.model
adb shell getprop ro.build.version.release
adb shell getprop ro.build.version.sdk
Write-Host ""

# 构建 APK
Write-Host "🔨 开始构建 Debug APK..." -ForegroundColor Cyan
Push-Location $root
try {
    & .\gradlew.bat assembleDebug
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ 构建失败" -ForegroundColor Red
        Pop-Location
        exit 1
    }
} catch {
    Write-Host "❌ 构建异常: $_" -ForegroundColor Red
    Pop-Location
    exit 1
}
Pop-Location
Write-Host "✓ 构建完成" -ForegroundColor Green
Write-Host ""

# 安装
$apkPath = Join-Path $root "app\build\outputs\apk\debug\app-debug.apk"
Write-Host "📦 安装 APK..." -ForegroundColor Cyan
adb install -r $apkPath

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  ✓ 安装成功！" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "🚀 启动 App:" -ForegroundColor Cyan
    adb shell am start -n com.makemdown.app.debug/com.makemdown.app.MainActivity
    Write-Host ""
    Write-Host "💡 调试提示:" -ForegroundColor Cyan
    Write-Host "   - 实时日志: adb logcat -s MainActivity WebAppInterface chromium" -ForegroundColor Yellow
    Write-Host "   - Chrome DevTools: chrome://inspect/#devices" -ForegroundColor Yellow
    Write-Host "   - 卸载: adb uninstall com.makemdown.app.debug" -ForegroundColor Yellow
} else {
    Write-Host "❌ 安装失败，请检查上方错误" -ForegroundColor Red
}