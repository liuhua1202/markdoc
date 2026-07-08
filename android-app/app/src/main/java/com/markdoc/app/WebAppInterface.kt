package com.markdoc.app

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.MimeTypeMap
import android.widget.Toast
import androidx.core.content.FileProvider
import java.io.File
import java.io.FileOutputStream

/**
 * WebAppInterface - 暴露给 WebView 内 JS 的原生桥接
 *
 * 调用方式：window.Android.xxx()
 *
 * 命名空间:
 * - isNative()         : 检查是否运行在原生 App 内
 * - getPlatform()      : 获取平台信息 (android / web)
 * - shareText()        : 分享文本（调用系统分享面板）
 * - shareFile()        : 分享文件（保存 .md 到缓存目录后分享）
 * - saveToDownloads()  : 保存 Markdown 到 Downloads 目录（Android 10+）
 * - saveFile()         : 调起 SAF 让用户选择位置保存文件（.md / .html / .json / .pdf）
 * - openFilePicker()   : 打开系统文件选择器（导入 .md）
 * - copyToClipboard()  : 复制到剪贴板
 * - getStatusBarHeight(): 通知 JS 状态栏高度（用于适配刘海屏）
 * - showToast()        : 显示原生 Toast
 * - exitApp()          : 退出 App
 */
class WebAppInterface(
    private val context: Context,
    private val onOpenFilePicker: () -> Unit,
    private val onSaveFile: () -> Unit
) {

    /**
     * 检查是否运行在原生容器内（用于 JS 判断展示哪些功能）
     */
    @JavascriptInterface
    fun isNative(): Boolean = true

    /**
     * 获取平台字符串
     */
    @JavascriptInterface
    fun getPlatform(): String = "android"

    /**
     * 获取 Android 版本
     */
    @JavascriptInterface
    fun getAndroidVersion(): Int = Build.VERSION.SDK_INT

    /**
     * 显示原生 Toast（Toast.show() 必须主线程）
     */
    @JavascriptInterface
    fun showToast(message: String) {
        android.os.Handler(android.os.Looper.getMainLooper()).post {
            try { Toast.makeText(context, message, Toast.LENGTH_SHORT).show() } catch (_: Throwable) {}
        }
    }

    /**
     * 复制文本到剪贴板
     */
    @JavascriptInterface
    fun copyToClipboard(text: String, label: String = "马克档") {
        try {
            val cm = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            val clip = ClipData.newPlainText(label, text)
            cm.setPrimaryClip(clip)
        } catch (e: Exception) {
            Log.e(TAG, "复制失败", e)
        }
    }

    /**
     * 分享 Markdown 文本（需要主线程）
     */
    @JavascriptInterface
    fun shareText(text: String, title: String = "分享 Markdown") {
        android.os.Handler(android.os.Looper.getMainLooper()).post {
            try {
                val intent = Intent(Intent.ACTION_SEND).apply {
                    type = "text/markdown"
                    putExtra(Intent.EXTRA_SUBJECT, "马克档分享")
                    putExtra(Intent.EXTRA_TEXT, text)
                }
                context.startActivity(Intent.createChooser(intent, title)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            } catch (e: Throwable) {
                Log.e(TAG, "分享失败", e)
            }
        }
    }

    /**
     * 保存 Markdown 到 Downloads（Android 10+ 使用 MediaStore，10 以下直接写文件）
     * - 旧 API（抽屉"下载 .md 文件"按钮专用）
     * - 新版"选位置"导出请用 saveFile()
     */
    @JavascriptInterface
    fun saveToDownloads(content: String, filename: String) {
        try {
            val finalName = if (filename.endsWith(".md", ignoreCase = true))
                filename else "$filename.md"

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val resolver = context.contentResolver
                val collection = MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
                val item = android.content.ContentValues().apply {
                    put(MediaStore.MediaColumns.DISPLAY_NAME, finalName)
                    put(MediaStore.MediaColumns.MIME_TYPE, "text/markdown")
                    put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/马克档")
                }
                val uri = resolver.insert(collection, item)
                if (uri != null) {
                    resolver.openOutputStream(uri)?.use { it.write(content.toByteArray(Charsets.UTF_8)) }
                    showToast("已保存到 Downloads/马克档/$finalName")
                }
            } else {
                @Suppress("DEPRECATION")
                val downloads = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
                val targetDir = File(downloads, "马克档")
                if (!targetDir.exists()) targetDir.mkdirs()
                val target = File(targetDir, finalName)
                FileOutputStream(target).use { it.write(content.toByteArray(Charsets.UTF_8)) }
                showToast("已保存到 ${target.absolutePath}")
            }
        } catch (e: Exception) {
            Log.e(TAG, "保存失败", e)
            showToast("保存失败：${e.message}")
        }
    }

    /**
     * 触发文件选择器（由 Activity 回调 onOpenFilePicker）
     * target: "editor" 覆盖当前编辑器 / "library" 导入到文档库（多文件）
     * @JavascriptInterface 在 Binder 线程池调用，需要切到主线程
     */
    @JavascriptInterface
    fun openFilePicker(target: String = "editor") {
        android.os.Handler(android.os.Looper.getMainLooper()).post {
            try {
                pendingImportTarget = target.ifBlank { "editor" }
                onOpenFilePicker.invoke()
            } catch (e: Throwable) {
                Log.e(TAG, "openFilePicker", e)
            }
        }
    }

    /**
     * 调起 SAF 让用户选择文件位置保存（.md / .html / .json / .pdf 等）
     * 流程：
     *   1) 把 content/filename/mimeType 暂存到 companion
     *   2) 通过 onSaveFile 回调让 Activity 调起 createDocumentLauncher
     *   3) Activity 拿到用户选择的 Uri 后写入内容
     *   4) Activity 通过 window.__onAndroidSaveFile 回调 JS 通知成功/取消
     */
    @JavascriptInterface
    fun saveFile(content: String, filename: String, mimeType: String) {
        android.os.Handler(android.os.Looper.getMainLooper()).post {
            try {
                pendingContent = content
                pendingFilename = filename
                pendingMimeType = mimeType.ifBlank { "text/plain" }
                onSaveFile.invoke()
            } catch (e: Throwable) {
                Log.e(TAG, "saveFile 失败", e)
            }
        }
    }

    /**
     * 退出 App（需要主线程）
     */
    @JavascriptInterface
    fun exitApp() {
        android.os.Handler(android.os.Looper.getMainLooper()).post {
            try {
                if (context is android.app.Activity) {
                    context.finish()
                }
            } catch (e: Throwable) {
                Log.e(TAG, "exitApp", e)
            }
        }
    }

    /**
     * 震动反馈（导出成功等场景使用）
     */
    @JavascriptInterface
    fun haptic(durationMs: Int = 20) {
        try {
            val vibrator = context.getSystemService(Context.VIBRATOR_SERVICE)
                    as android.os.Vibrator
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(android.os.VibrationEffect.createOneShot(
                    durationMs.toLong(),
                    android.os.VibrationEffect.DEFAULT_AMPLITUDE
                ))
            } else {
                @Suppress("DEPRECATION")
                vibrator.vibrate(durationMs.toLong())
            }
        } catch (_: Exception) { /* 无权限时静默失败 */ }
    }

    /**
     * 把当前编辑器内容备份到本地文件
     * 解决 MIUI/HyperOS 杀进程导致 localStorage 数据丢失
     */
    @JavascriptInterface
    fun dataBackup(content: String) {
        DataBackup.save(context, content)
    }

    /**
     * 清除本地备份（清空编辑器时调用）
     */
    @JavascriptInterface
    fun dataBackupClear() {
        DataBackup.clear(context)
    }

    /**
     * 暴露给 JS 的设备信息（用于 UI 提示，如显示"小米14"标识）
     */
    @JavascriptInterface
    fun getDeviceInfo(): String {
        return com.markdoc.app.DeviceUtils.deviceInfo(context)
    }

    companion object {
        private const val TAG = "WebAppInterface"

        // 待保存文件（WebAppInterface 触发，由 MainActivity 的 launcher 接收）
        // 字段为 public 让同进程的其他类（MainActivity）可读写
        @Volatile
        var pendingFilename: String = ""
        @Volatile
        var pendingMimeType: String = "text/plain"
        @Volatile
        var pendingContent: String = ""

        // 待导入目标（editor / library），由 openFilePicker 设置，由 launcher 接收
        @Volatile
        var pendingImportTarget: String = "editor"
    }
}