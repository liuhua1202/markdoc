$ErrorActionPreference = 'Stop'

$root = 'C:\Users\liuhua\Desktop\Github\markdown'
$assets = Join-Path $root 'android-app\app\src\main\assets'

# 1) clean and recreate assets root
if (Test-Path $assets) { Remove-Item $assets -Recurse -Force }
New-Item -ItemType Directory -Force -Path $assets | Out-Null

# 2) copy root files
$rootFiles = @('index.html', 'manifest.json', 'sw.js', 'logo.svg')
foreach ($f in $rootFiles) {
    $src = Join-Path $root $f
    if (Test-Path $src) {
        Copy-Item -Path $src -Destination (Join-Path $assets $f) -Force
        Write-Host "  + $f" -ForegroundColor Gray
    } else {
        Write-Host "  ! missing: $f" -ForegroundColor Yellow
    }
}

# 3) copy root dirs (vendor, icons)
$rootDirs = @('vendor', 'icons')
foreach ($d in $rootDirs) {
    $srcDir = Join-Path $root $d
    if (Test-Path $srcDir) {
        $dstDir = Join-Path $assets $d
        New-Item -ItemType Directory -Force -Path $dstDir | Out-Null
        Copy-Item -Path (Join-Path $srcDir '*') -Destination $dstDir -Recurse -Force
        $count = (Get-ChildItem -Recurse -File -Path $dstDir | Measure-Object).Count
        Write-Host "  + $d/ ($count files)" -ForegroundColor Gray
    } else {
        Write-Host "  ! missing: $d" -ForegroundColor Yellow
    }
}

Write-Host ''
Write-Host "Assets sync done: $assets" -ForegroundColor Green
