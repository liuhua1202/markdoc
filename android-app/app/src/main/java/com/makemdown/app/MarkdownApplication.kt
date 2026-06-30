package com.makemdown.app

import android.app.Application
import android.webkit.WebView
import com.google.android.material.color.DynamicColors

/**
 * 马克档 Application
 *
 * 初始化工作：
 * 1. 注册全局异常捕获器（闪退自动写日志到 filesDir/logs/）
 * 2. 启用 Material You 动态色（Android 12+ 设备将根据壁纸自动调整主题色）
 * 3. 启用 WebView 远程调试（debug 包）
 */
class MarkdownApplication : Application() {

    override fun onCreate() {
        super.onCreate()

        instance = this

        // 1. 全局异常捕获 —— 闪退不再"凭空消失"
        CrashHandler.init(this)

        // 2. Android 12+ 启用 Material You 动态色（失败时不影响主流程）
        try {
            DynamicColors.applyToActivitiesIfAvailable(this)
        } catch (e: Throwable) {
            android.util.Log.w("MarkdownApp", "DynamicColors 初始化失败", e)
        }

        // 3. 启用 WebView 调试（仅 debug 包）
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
    }

    companion object {
        @JvmStatic
        lateinit var instance: MarkdownApplication
            private set
    }
}