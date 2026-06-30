package com.makemdown.app

import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Settings
import android.util.Log
import java.lang.reflect.Method

/**
 * 设备工具 —— 检测厂商 ROM，做针对性适配
 *
 * 主要解决 MIUI / HyperOS 的几个特殊行为：
 * 1. WebView 渲染引擎是魔改版 Chromium，部分 API 表现不一致
 * 2. 后台进程管理激进，localStorage 容易被清
 * 3. 字体系统会替换 WebView 的字体
 * 4. 自启动权限默认关闭，影响后台任务
 */
object DeviceUtils {

    private const val TAG = "DeviceUtils"

    // 已知厂商
    val isXiaomi: Boolean
        get() = Build.MANUFACTURER.equals("Xiaomi", ignoreCase = true) ||
                Build.BRAND.equals("Redmi", ignoreCase = true) ||
                Build.BRAND.equals("Xiaomi", ignoreCase = true)

    val isHuawei: Boolean
        get() = Build.MANUFACTURER.equals("HUAWEI", ignoreCase = true)

    val isOppo: Boolean
        get() = Build.MANUFACTURER.equals("OPPO", ignoreCase = true)

    val isVivo: Boolean
        get() = Build.MANUFACTURER.equals("vivo", ignoreCase = true)

    val isSamsung: Boolean
        get() = Build.MANUFACTURER.equals("samsung", ignoreCase = true)

    val isHonor: Boolean
        get() = Build.MANUFACTURER.equals("HONOR", ignoreCase = true)

    /**
     * 是否运行在 MIUI / HyperOS
     */
    val isMiui: Boolean by lazy {
        try {
            val systemProperties = Class.forName("android.os.SystemProperties")
            val get: Method = systemProperties.getMethod("get", String::class.java, String::class.java)
            val miuiVersion = get.invoke(null, "ro.miui.ui.version.name", "") as String
            val hyperOsVersion = get.invoke(null, "ro.hyperos.version", "") as String
            miuiVersion.isNotEmpty() || hyperOsVersion.isNotEmpty()
        } catch (_: Exception) {
            // 非小米设备反射失败是正常的
            false
        }
    }

    /**
     * 获取 MIUI 版本号（用于调试日志）
     */
    fun getMiuiVersion(): String {
        return try {
            val systemProperties = Class.forName("android.os.SystemProperties")
            val get = systemProperties.getMethod("get", String::class.java, String::class.java)
            val miui = get.invoke(null, "ro.miui.ui.version.name", "") as String
            val hyperOs = get.invoke(null, "ro.hyperos.version", "") as String
            when {
                hyperOs.isNotEmpty() -> "HyperOS $hyperOs"
                miui.isNotEmpty() -> "MIUI $miui"
                else -> "Unknown"
            }
        } catch (_: Exception) {
            "Unknown"
        }
    }

    /**
     * MIUI 是否开启了「省电模式」
     * 省电模式下 WebView 后台 JS 会被节流
     */
    fun isMiuiPowerSaveMode(context: Context): Boolean {
        if (!isXiaomi) return false
        return try {
            val powerSave = Settings.Global.getInt(context.contentResolver, "power_save_mode", 0)
            powerSave == 1
        } catch (_: Exception) {
            false
        }
    }

    /**
     * 获取 MIUI WebView 包名
     */
    fun getMiuiWebViewPackage(): String? {
        return try {
            // 通过 PackageManager 查询哪些应用能处理 http URL
            val intent = android.content.Intent(android.content.Intent.ACTION_VIEW)
            intent.data = android.net.Uri.parse("http://example.com")
            val ctx = MarkdownApplication.instance
            val pm = ctx.packageManager
            val resolveInfos = pm.queryIntentActivities(intent, 0)
            resolveInfos.firstOrNull { r ->
                r.activityInfo.packageName.contains("webview", ignoreCase = true)
            }?.activityInfo?.packageName
        } catch (e: Exception) {
            Log.w(TAG, "查询 MIUI WebView 失败", e)
            null
        }
    }

    /**
     * 完整设备信息（用于调试日志）
     */
    fun deviceInfo(context: Context): String {
        return buildString {
            append("Device: ${Build.MANUFACTURER} ${Build.MODEL}\n")
            append("Brand: ${Build.BRAND}\n")
            append("Android: ${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT})\n")
            append("ROM: ${getMiuiVersion()}\n")
            append("MIUI PowerSave: ${isMiuiPowerSaveMode(context)}\n")
            append("WebView Package: ${getMiuiWebViewPackage() ?: "Default"}\n")
            append("Package: ${context.packageName}\n")
        }
    }
}