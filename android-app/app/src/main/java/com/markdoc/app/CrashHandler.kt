package com.markdoc.app

import android.content.Context
import android.os.Build
import android.util.Log
import java.io.File
import java.io.PrintWriter
import java.io.StringWriter
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * 全局异常捕获器
 *
 * 任何未捕获的崩溃都会：
 * 1. 写入 logs/crash_YYYYMMDD_HHMMSS.log
 * 2. 触发系统默认崩溃处理（保留 ANR / 系统崩溃体验）
 * 3. 用户可以用 adb 拉取日志：adb pull /data/data/com.markdoc.app/files/logs/
 *
 * 这是开发期的救命稻草 —— 闪退时不需要 USB 调试就能定位问题。
 */
object CrashHandler {

    private const val TAG = "CrashHandler"
    private const val LOG_DIR = "logs"
    private const val MAX_LOGS = 20  // 最多保留 20 个日志文件

    fun init(context: Context) {
        val appCtx = context.applicationContext
        val defaultHandler = Thread.getDefaultUncaughtExceptionHandler()

        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            try {
                val timestamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())
                val logFile = File(appCtx.filesDir, "$LOG_DIR/crash_$timestamp.log")

                logFile.parentFile?.mkdirs()

                val sw = StringWriter()
                PrintWriter(sw).use { throwable.printStackTrace(it) }

                val log = buildString {
                    appendLine("=== 马克档 Crash Report ===")
                    appendLine("Time: $timestamp")
                    appendLine("Thread: ${thread.name} (id=${thread.id})")
                    appendLine("Android: ${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT})")
                    appendLine("Device: ${Build.MANUFACTURER} ${Build.MODEL}")
                    appendLine("Brand: ${Build.BRAND}")
                    appendLine("ROM: ${DeviceUtils.getMiuiVersion()}")
                    appendLine("Package: ${appCtx.packageName}")
                    appendLine("WebView: ${DeviceUtils.getMiuiWebViewPackage() ?: "default"}")
                    appendLine()
                    appendLine("=== Stack Trace ===")
                    append(sw.toString())
                }

                logFile.writeText(log)
                Log.e(TAG, "Crash logged to: ${logFile.absolutePath}")

                // 清理旧日志
                cleanupOldLogs(appCtx)

            } catch (e: Exception) {
                Log.e(TAG, "写入崩溃日志失败", e)
            }

            // 调用系统默认处理器（保留原崩溃体验）
            defaultHandler?.uncaughtException(thread, throwable)
        }
    }

    private fun cleanupOldLogs(context: Context) {
        try {
            val logDir = File(context.filesDir, LOG_DIR)
            if (!logDir.exists()) return
            val files = logDir.listFiles { f -> f.name.startsWith("crash_") }
                ?.sortedByDescending { it.lastModified() }
                ?: return
            if (files.size > MAX_LOGS) {
                files.drop(MAX_LOGS).forEach { it.delete() }
            }
        } catch (_: Exception) {}
    }

    /**
     * 获取最新的崩溃日志内容（用于 UI 显示）
     */
    fun getLastCrashLog(context: Context): String? {
        return try {
            val logDir = File(context.filesDir, LOG_DIR)
            val last = logDir.listFiles { f -> f.name.startsWith("crash_") }
                ?.maxByOrNull { it.lastModified() }
                ?: return null
            last.readText()
        } catch (_: Exception) {
            null
        }
    }

    /**
     * 获取所有崩溃日志文件路径（用于 adb pull）
     */
    fun listLogFiles(context: Context): List<File> {
        val logDir = File(context.filesDir, LOG_DIR)
        return logDir.listFiles { f -> f.name.startsWith("crash_") }?.toList() ?: emptyList()
    }
}