# 抓取马克档运行日志（帮助诊断闪退）
# 用法：.\tools\grab-logs.ps1
# 前置：USB 连接手机，开启 USB 调试

$ErrorActionPreference = "Continue"
$env:JAVA_HOME = "C:\Java\jdk-17.0.2"
$env:Path = "$env:JAVA_HOME\bin;$env:Path"

$adb = Get-Command adb -ErrorAction SilentlyContinue
if (-not $adb) {
    Write-Host "❌ 未找到 adb，请先安装 Android SDK Platform Tools" -ForegroundColor Red
    exit 1
}

Write-Host "📱 设备检测..." -ForegroundColor Cyan
$devices = adb devices
if ($devices -notmatch "device$") {
    Write-Host "❌ 未检测到设备" -ForegroundColor Red
    Write-Host "请检查：USB 调试已开 + 数据线已连 + 已授权" -ForegroundColor Yellow
    exit 1
}

$ts = Get-Date -Format "yyyyMMdd_HHmmss"
$outDir = Join-Path $PSScriptRoot "..\logs"
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }
$outFile = Join-Path $outDir "markdoc-logs-$ts.txt"

Write-Host "🔍 清空 logcat 缓存..." -ForegroundColor Cyan
adb logcat -c
Write-Host "🚀 启动马克档..." -ForegroundColor Cyan
adb shell am start -n com.markdoc.app.debug/com.markdoc.app.MainActivity 2>$null

adb shell am start -n com.markdoc.app/com.markdoc.app.MainActivity 2>$null
Write-Host ""
Write-Host "📝 开始抓取日志（30 秒）..." -ForegroundColor Cyan
Write-Host "   现在请在手机上重现闪退 / 操作 App" -ForegroundColor Yellow
Write-Host "   Ctrl+C 中断抓取" -ForegroundColor Yellow
Write-Host ""

# 抓 30 秒日志
$proc = Start-Process -FilePath "adb" -ArgumentList "logcat", "-v", "time" `
    -RedirectStandardOutput $outFile `
    -NoNewWindow -PassThru
Start-Sleep -Seconds 30
try { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue } catch {}

# 拉崩溃日志文件（如果有）
Write-Host ""
Write-Host "📂 拉取 App 内部崩溃日志..." -ForegroundColor Cyan
$crashDir = Join-Path $outDir "crash_$ts"
New-Item -ItemType Directory -Path $crashDir -Force | Out-Null
foreach ($pkg in @("com.markdoc.app", "com.markdoc.app.debug")) {
    adb shell "run-as $pkg ls files/logs 2>/dev/null" | ForEach-Object {
        $fname = $_.Trim()
        if ($fname -and $fname -ne "ls:" -and $fname -notmatch "not found") {
            adb pull "files/logs/$fname" "$crashDir\$fname" 2>$null
            adb shell "run-as $pkg cat files/logs/$fname" 2>$null | Out-File -Append -Encoding UTF8 "$crashDir\$fname.txt"
        }
    }
}

Write-Host ""
Write-Host "=====================================" -ForegroundColor Green
Write-Host "✓ 日志已保存" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green
Write-Host "主日志: $outFile" -ForegroundColor Cyan
Write-Host "崩溃日志: $crashDir" -ForegroundColor Cyan
Write-Host ""
Write-Host "如果 App 闪退，请把以下文件发给开发者：" -ForegroundColor Yellow
Write-Host "  - $outFile" -ForegroundColor White
Write-Host "  - $crashDir\*.txt" -ForegroundColor White
Write-Host ""
Write-Host "最后 50 行日志预览：" -ForegroundColor Cyan
Get-Content $outFile | Select-Object -Last 50 | ForEach-Object {
    if ($_ -match "FATAL|AndroidRuntime|ERROR") {
        Write-Host $_ -ForegroundColor Red
    } elseif ($_ -match "MainActivity|CrashHandler|WebApp") {
        Write-Host $_ -ForegroundColor Yellow
    } else {
        Write-Host $_ -ForegroundColor Gray
    }
}