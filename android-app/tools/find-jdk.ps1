<#
.SYNOPSIS
  自动定位本机 JDK 17/21 并设置 $env:JAVA_HOME + $env:Path。

.DESCRIPTION
  探测顺序(命中即停):
    1. 显式传入 -JavaHome
    2. 当前会话已设置的 $env:JAVA_HOME(且 javac 可用)
    3. Windows 注册表: HKLM:\SOFTWARE\JavaSoft\JDK  (CurrentVersion → JavaHome)
    4. Windows 注册表: HKLM:\SOFTWARE\Eclipse Adoptium\JDK
    5. 常见安装路径扫描:
         C:\Java\jdk-*        C:\Program Files\Java\jdk-*
         C:\Program Files\Eclipse Adoptium\jdk-*
         C:\Program Files\Microsoft\jdk-*
         C:\Program Files\Zulu\zulu-*
    6. 常见 GraalVM:  C:\Program Files\GraalVM\*
    7. PATH 上的 java(.exe)  拿 .NET reflection 解析
  命中后,优先选 17.x;若仅有 21+/24+ 则取最大版本(Android 工具链对 ≥17 都 OK)。

.PARAMETER PreferVersion
  首选主版本,默认 17。

.PARAMETER SetEnv
  是否把命中路径写回 $env:JAVA_HOME / $env:Path,默认 $true。
  设为 $false 时只输出路径,不修改当前会话。

.EXAMPLE
  . "$PSScriptRoot\find-jdk.ps1"
  & "$PSScriptRoot\..\gradlew" assembleRelease

.EXAMPLE
  & "$PSScriptRoot\find-jdk.ps1" -PreferVersion 21
#>
[CmdletBinding()]
param(
    [int]$PreferVersion = 17,
    [string]$JavaHome,
    [switch]$NoSetEnv = $false   # 若传 -NoSetEnv 则不修改会话环境
)

$ErrorActionPreference = 'Stop'

function Test-JavaHome {
    param([string]$Path)
    if (-not (Test-Path $Path)) { return $false }
    $javac = Join-Path $Path 'bin\javac.exe'
    $java  = Join-Path $Path 'bin\java.exe'
    return ((Test-Path $javac) -and (Test-Path $java))
}

function Get-JavaHomeFromRegistry {
    $candidates = New-Object System.Collections.Generic.List[string]
    $keys = @(
        'HKLM:\SOFTWARE\JavaSoft\JDK',
        'HKLM:\SOFTWARE\JavaSoft\Java Development Kit',
        'HKLM:\SOFTWARE\Eclipse Adoptium\JDK',
        'HKLM:\SOFTWARE\WOW6432Node\JavaSoft\JDK',
        'HKLM:\SOFTWARE\WOW6432Node\Eclipse Adoptium\JDK'
    )
    foreach ($k in $keys) {
        if (-not (Test-Path $k)) { continue }
        try {
            $ver = (Get-ItemProperty -Path $k -ErrorAction SilentlyContinue).CurrentVersion
            if ($ver) {
                $home = (Get-ItemProperty -Path "$k\$ver" -ErrorAction SilentlyContinue).JavaHome
                if ($home) { $candidates.Add($home) }
            }
            # 顺手把所有版本都收一遍
            Get-ChildItem -Path $k -ErrorAction SilentlyContinue | ForEach-Object {
                $h = (Get-ItemProperty -Path $_.PsPath -ErrorAction SilentlyContinue).JavaHome
                if ($h) { $candidates.Add($h) }
            }
        } catch {}
    }
    return $candidates | Sort-Object -Unique
}

function Get-JavaHomeFromFilesystem {
    $roots = @(
        'C:\Java',
        'C:\Program Files\Java',
        'C:\Program Files\Eclipse Adoptium',
        'C:\Program Files\Microsoft',
        'C:\Program Files\Zulu',
        'C:\Program Files\GraalVM',
        'C:\Program Files\BellSoft',
        'C:\Program Files\Amazon Corretto',
        'C:\Program Files\OpenJDK',
        'C:\Program Files (x86)\Java',
        'D:\Java',
        'D:\JDK'
    )
    $found = New-Object System.Collections.Generic.List[string]
    foreach ($r in $roots) {
        if (-not (Test-Path $r)) { continue }
        Get-ChildItem -Path $r -Directory -ErrorAction SilentlyContinue | ForEach-Object {
            if ($_.Name -match '^jdk-?(\d+(\.\d+)*)|^zulu-(\d+(\.\d+)*)|^(jdk|openjdk)-?(\d+(\.\d+)*)') {
                $found.Add($_.FullName)
            }
        }
    }
    return $found
}

function Get-JavaHomeFromPath {
    $cmd = (Get-Command java -ErrorAction SilentlyContinue)
    if (-not $cmd) { return @() }
    $javaExe = $cmd.Source
    # 上溯到 JDK 根
    $bin = Split-Path $javaExe -Parent
    $home = Split-Path $bin -Parent
    if (Test-JavaHome $home) { @($home) } else { @() }
}

function Select-BestJdk {
    param([string[]]$Homes, [int]$Prefer)
    $valid = $Homes | Where-Object { Test-JavaHome $_ } | ForEach-Object {
        $ver = & "$_\bin\java.exe" -version 2>&1 | Select-String -Pattern '"(\d+)\.' | ForEach-Object { [int]$_.Matches[0].Groups[1].Value }
        [pscustomobject]@{ Home = $_; Major = if ($ver) { $ver } else { 0 } }
    } | Sort-Object -Property Major -Descending

    if (-not $valid) { return $null }
    # 优先取主版本等于 Prefer 的;否则取最高主版本
    $best = $valid | Where-Object { $_.Major -eq $Prefer } | Select-Object -First 1
    if (-not $best) {
        # 跳过 < 17 的(Android Gradle Plugin ≥ 8 需要 17+)
        $best = $valid | Where-Object { $_.Major -ge 17 } | Select-Object -First 1
    }
    if (-not $best) { $best = $valid | Select-Object -First 1 }
    return $best
}

# --- 主流程 ---
if ($NoSetEnv) {
    $env_old_java = $null
    $env_old_path = $null
} else {
    $env_old_java = $env:JAVA_HOME
    $env_old_path = $env:Path
}

$candidates = New-Object System.Collections.Generic.List[string]

if ($JavaHome)            { $candidates.Add($JavaHome) }
if ($env:JAVA_HOME -and (Test-Path $env:JAVA_HOME)) { $candidates.Add($env:JAVA_HOME) }

foreach ($h in (Get-JavaHomeFromRegistry))  { if ($h) { $candidates.Add($h) } }
foreach ($h in (Get-JavaHomeFromFilesystem)) { if ($h) { $candidates.Add($h) } }
foreach ($h in (Get-JavaHomeFromPath))      { if ($h) { $candidates.Add($h) } }

$best = Select-BestJdk -Homes ($candidates | Sort-Object -Unique) -Prefer $PreferVersion

if (-not $best) {
    Write-Error "未在本机找到可用的 JDK (>=17)。请安装 JDK 17+ 后重试,或用 -JavaHome 显式指定路径。"
    exit 1
}

Write-Host "[find-jdk] 使用 JDK $($best.Major) → $($best.Home)"

if (-not $NoSetEnv) {
    $env:JAVA_HOME = $best.Home
    $env:Path = "$($best.Home)\bin;$env:Path"
    Set-Location (Get-Location)  # 触发 prompt 重读
}

return $best
