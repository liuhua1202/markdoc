package com.markdoc.app

import android.app.AlertDialog
import android.content.Intent
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.provider.Settings
import android.util.Log
import android.view.View
import android.webkit.*
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.markdoc.app.databinding.ActivityMainBinding
import java.io.BufferedReader
import java.io.InputStreamReader

/**
 * 马克档主 Activity
 *
 * 设计原则：
 * - 关键路径全部 try/catch，单点失败不能让整个 App 崩
 * - 启动失败时降级显示纯文本错误（不让用户看到崩溃对话框）
 * - 提供「查看崩溃日志」入口
 */
class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var webView: WebView
    private var webViewReady = false

    private val batteryOptimizationLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { /* 用户选择结果 */ }

    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { /* 用户授权结果 */ }

    private val filePickerLauncher = registerForActivityResult(
        ActivityResultContracts.GetContent()
    ) { uri: Uri? -> uri?.let { handleImportedFile(listOf(it)) } }

    // 多文件选择器：替代旧的 openDocumentLauncher（只支持单文件）
    // 用 OpenMultipleDocuments 让用户能一次选多个 .md / .json
    private val openDocumentMultipleLauncher = registerForActivityResult(
        ActivityResultContracts.OpenMultipleDocuments()
    ) { uris: List<Uri>? ->
        if (uris.isNullOrEmpty()) {
            // 没选文件视为取消;target 已经回退到原值(下一次 openFilePicker 会刷新)
            return@registerForActivityResult
        }
        handleImportedFile(uris)
    }

    private val openDocumentLauncher = registerForActivityResult(
        ActivityResultContracts.OpenDocument()
    ) { uri: Uri? -> uri?.let { handleImportedFile(listOf(it)) } }

    /**
     * CreateDocument - 让用户选位置保存导出文件
     * 用通配 mime 让用户在任意目录保存任意扩展名
     * （写入什么内容由我们决定，SAF 只给个 file URI）
     */
    private val createDocumentLauncher = registerForActivityResult(
        ActivityResultContracts.CreateDocument("text/plain")
    ) { uri: Uri? -> handleSavedFile(uri) }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        try {
            doOnCreate(savedInstanceState)
        } catch (t: Throwable) {
            // 启动失败兜底 —— 不弹系统崩溃框，直接显示错误
            Log.e(TAG, "onCreate 失败，降级到错误界面", t)
            showFallbackErrorScreen(t)
        }
    }

    private fun doOnCreate(savedInstanceState: Bundle?) {
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        Log.i(TAG, "========== 马克档启动 ==========")
        Log.i(TAG, DeviceUtils.deviceInfo(this))

        // 显式启用硬件加速
        try {
            window.setFlags(
                android.view.WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
                android.view.WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED
            )
        } catch (e: Throwable) {
            Log.w(TAG, "硬件加速标志设置失败", e)
        }

        setupSystemUI()

        // WebView 初始化失败不应该让 App 崩溃
        try {
            setupWebView()
            webViewReady = true
        } catch (t: Throwable) {
            Log.e(TAG, "WebView 初始化失败", t)
            webViewReady = false
            showWebViewErrorScreen(t)
            return
        }

        restoreFromBackupIfNeeded()
        loadApp()

        handleIntent(intent)

        // 延迟请求权限 / 弹窗 —— 等待 Activity 完全 attach
        Handler(Looper.getMainLooper()).postDelayed({
            try {
                requestNotificationPermissionIfNeeded()
            } catch (e: Throwable) {
                Log.w(TAG, "通知权限请求失败", e)
            }
            try {
                promptBatteryOptimizationIfNeeded()
            } catch (e: Throwable) {
                Log.w(TAG, "电池优化提示失败", e)
            }
        }, 800)

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webViewReady && webView.canGoBack()) {
                    webView.goBack()
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        })
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        try { handleIntent(intent) } catch (e: Throwable) { Log.e(TAG, "onNewIntent", e) }
    }

    private fun setupSystemUI() {
        WindowCompat.setDecorFitsSystemWindows(window, true)
        val isDark = isNightMode()

        try {
            window.addFlags(android.view.WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS)
            window.clearFlags(android.view.WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS)
        } catch (_: Throwable) {}

        window.statusBarColor = ContextCompat.getColor(this,
            if (isDark) R.color.status_bar_dark else R.color.status_bar_light)
        WindowInsetsControllerCompat(window, window.decorView).apply {
            isAppearanceLightStatusBars = !isDark
            isAppearanceLightNavigationBars = !isDark
        }
    }

    private fun isNightMode(): Boolean {
        val mode = resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK
        return mode == Configuration.UI_MODE_NIGHT_YES
    }

    private fun setupWebView() {
        webView = binding.webview

        try {
            webView.setLayerType(View.LAYER_TYPE_HARDWARE, null)
        } catch (e: Throwable) {
            Log.w(TAG, "LAYER_TYPE_HARDWARE 失败，回退到默认", e)
        }

        webView.settings.apply {
            javaScriptEnabled = true
            javaScriptCanOpenWindowsAutomatically = false
            domStorageEnabled = true
            databaseEnabled = true
            cacheMode = WebSettings.LOAD_DEFAULT
            useWideViewPort = true
            loadWithOverviewMode = true
            builtInZoomControls = false
            displayZoomControls = false
            setSupportZoom(false)
            allowFileAccess = true
            allowContentAccess = true
            try { allowFileAccessFromFileURLs = true } catch (_: Throwable) {}
            try { allowUniversalAccessFromFileURLs = true } catch (_: Throwable) {}
            textZoom = 100
            mediaPlaybackRequiresUserGesture = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            try { saveFormData = false } catch (_: Throwable) {}
            try { setGeolocationEnabled(false) } catch (_: Throwable) {}
            userAgentString = "$userAgentString MakemdownApp/${BuildConfig.VERSION_NAME} ${DeviceUtils.getMiuiVersion()}"
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url?.toString() ?: return false
                if (url.startsWith("http://") || url.startsWith("https://")) {
                    if (url != "about:blank" && !url.contains("cdn.jsdelivr.net")) {
                        try { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) } catch (_: Exception) {}
                        return true
                    }
                }
                if (url.startsWith("file://") || url.startsWith("data:") ||
                    url.startsWith("javascript:") || url.contains("#")) {
                    return false
                }
                return false
            }

            override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) {
                binding.progress.visibility = View.VISIBLE
                binding.progress.progress = 30
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                try {
                    binding.progress.progress = 100
                    binding.progress.animate().alpha(0f).setDuration(200).withEndAction {
                        binding.progress.visibility = View.GONE
                        binding.progress.alpha = 1f
                    }.start()
                    view?.evaluateJavascript(
                        "(function(){if(window.onNativeReady)window.onNativeReady();})();",
                        null
                    )
                    checkAndRestoreBackup()
                } catch (e: Throwable) {
                    Log.w(TAG, "onPageFinished", e)
                }
            }

            override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                Log.w(TAG, "WebView 加载错误: ${error?.description}")
            }

            override fun onRenderProcessGone(view: WebView?, detail: android.webkit.RenderProcessGoneDetail?): Boolean {
                Log.e(TAG, "渲染进程崩溃，重建")
                try { view?.destroy() } catch (_: Throwable) {}
                try { setupWebView(); loadApp() } catch (e: Throwable) { Log.e(TAG, "重建失败", e) }
                showToastLong("WebView 渲染异常，已尝试恢复")
                return true
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                binding.progress.progress = newProgress
                if (newProgress >= 100) {
                    binding.progress.animate().alpha(0f).setDuration(200).withEndAction {
                        binding.progress.visibility = View.GONE
                        binding.progress.alpha = 1f
                    }.start()
                }
            }
        }

        webView.setOnLongClickListener {
            try {
                val result = webView.hitTestResult
                if (result.type == WebView.HitTestResult.IMAGE_TYPE ||
                    result.type == WebView.HitTestResult.SRC_IMAGE_ANCHOR_TYPE) {
                    result.extra?.let { url ->
                        showToastLong("长按图片保存：${url.take(40)}...")
                    }
                }
            } catch (_: Throwable) {}
            false
        }

        webView.addJavascriptInterface(
            WebAppInterface(
                context = this,
                onOpenFilePicker = { openFilePicker() },
                onSaveFile = { openSaveFilePicker() }
            ),
            "Android"
        )
    }

    private fun loadApp() {
        try {
            webView.loadUrl("file:///android_asset/index.html")
        } catch (e: Throwable) {
            Log.e(TAG, "loadUrl 失败", e)
            showToastLong("加载失败：" + e.message)
        }
    }

    private fun restoreFromBackupIfNeeded() {
        // 实际逻辑在 onPageFinished 中执行
    }

    private fun checkAndRestoreBackup() {
        try {
            val backupContent = DataBackup.load(this) ?: return
            if (backupContent.isEmpty()) return

            // 修复 B11: onPageFinished 第一次触发时,JS 端 importMarkdown 还没注册。
            // 用轮询: 如果函数不存在,过 200ms 重试,最多 3 次。
            val attempts = intArrayOf(0)
            val maxAttempts = 3
            val payload = jsString(backupContent)
            val tryRestore = object : Runnable {
                override fun run() {
                    if (!webViewReady) return
                    attempts[0] += 1
                    val js = """
                        (function() {
                            try {
                                var content = localStorage.getItem('markdoc.content.v1');
                                if (content && content.length >= 10) return 'has-content';
                                if (window.importMarkdown) {
                                    window.importMarkdown($payload);
                                    return 'restored';
                                }
                                return 'not-ready';
                            } catch(e) { return 'error:' + e.message; }
                        })();
                    """.trimIndent()
                    webView.evaluateJavascript(js) { value ->
                        Log.i(TAG, "备份恢复 #$attempts[0]: $value")
                        if (value == "\"not-ready\"" && attempts[0] < maxAttempts) {
                            webView.postDelayed(this, 200)
                        }
                    }
                }
            }
            webView.postDelayed(tryRestore, 100)
        } catch (e: Throwable) {
            Log.w(TAG, "checkAndRestoreBackup", e)
        }
    }

    private fun jsString(s: String): String {
        val escaped = s
            .replace("\\", "\\\\")
            .replace("'", "\\'")
            .replace("\n", "\\n")
            .replace("\r", "\\r")
            .replace("\t", "\\t")
            .replace("<", "\\u003c")
        return "'$escaped'"
    }

    private fun openFilePicker() {
        // 优先用多文件选择器（OpenMultipleDocuments）—— 支持一次选多个 .md / .json
        // 在编辑器模式下也用多选：用户可以一次选一个 .md 或者多个 .json
        try {
            openDocumentMultipleLauncher.launch(arrayOf("text/markdown", "text/plain", "application/json", "*/*"))
        } catch (e: Throwable) {
            Log.e(TAG, "多文件 SAF 失败，回退单选", e)
            try { openDocumentLauncher.launch(arrayOf("text/markdown", "text/plain", "application/json", "*/*")) }
            catch (e2: Throwable) {
                Log.e(TAG, "单文件 SAF 也失败，回退 GetContent", e2)
                try { filePickerLauncher.launch("*/*") } catch (e3: Throwable) {
                    Log.e(TAG, "GetContent 也失败", e3)
                    showToastLong("文件选择器不可用")
                }
            }
        }
    }

    /**
     * 调起 SAF ACTION_CREATE_DOCUMENT，让用户在任意目录选位置保存文件
     * mime/filename 由 WebAppInterface 在 companion 中暂存
     */
    private fun openSaveFilePicker() {
        try {
            val filename = WebAppInterface.pendingFilename.ifBlank { "markdoc.md" }
            val mime = WebAppInterface.pendingMimeType.ifBlank { "text/plain" }
            createDocumentLauncher.launch(filename)
        } catch (e: Throwable) {
            Log.e(TAG, "saveFile 启动 SAF 失败", e)
            // JS 端 60s 超时兜底，此处不再单独通知
        }
    }

    /**
     * SAF CreateDocument 回调：用户已选位置 → 写入内容 → 通知 JS
     */
    private fun handleSavedFile(uri: Uri?) {
        if (uri == null) {
            notifySaveResult("cancel")
            return
        }
        try {
            val content = WebAppInterface.pendingContent
            contentResolver.openOutputStream(uri)?.use { stream ->
                stream.write(content.toByteArray(Charsets.UTF_8))
            }
            val name = WebAppInterface.pendingFilename.ifBlank { "文件" }
            showToastLong("已保存 $name")
            notifySaveResult("ok")
        } catch (e: Throwable) {
            Log.e(TAG, "写入失败", e)
            notifySaveResult("error:${e.message ?: "unknown"}")
        } finally {
            // 清空 pending,避免下一次误用
            WebAppInterface.pendingContent = ""
            WebAppInterface.pendingFilename = ""
            WebAppInterface.pendingMimeType = "text/plain"
        }
    }

    private fun notifySaveResult(status: String) {
        try {
            val safe = status.replace("\\", "\\\\").replace("'", "\\'")
            webView.evaluateJavascript(
                "if(window.__onAndroidSaveFile){window.__onAndroidSaveFile('$safe');}",
                null
            )
        } catch (e: Throwable) {
            Log.w(TAG, "save result 回调失败", e)
        }
    }

    private fun handleImportedFile(uris: List<Uri>) {
        if (uris.isEmpty()) return
        // 取出本次 launch 的 target，再清空（pendingTarget 是一次性的，避免污染下次）
        val target = WebAppInterface.pendingImportTarget.ifBlank { "editor" }
        WebAppInterface.pendingImportTarget = "editor"

        // 串行读文件并回调 JS，避免并发 evaluateJavascript 竞态
        Thread {
            try {
                uris.forEachIndexed { idx, uri ->
                    try {
                        val text = contentResolver.openInputStream(uri)?.use { stream ->
                            BufferedReader(InputStreamReader(stream, Charsets.UTF_8)).readText()
                        } ?: run {
                            webView.post { showToastLong("读取失败") }
                            return@forEachIndexed
                        }
                        val name = uri.lastPathSegment?.substringAfterLast('/') ?: ""
                        // 透传 target 给 JS，方便 ImportManager 路由到 editor / library
                        val js = "if(window.importMarkdown){window.importMarkdown(${jsString(text)},${jsString(name)},${jsString(target)});}else{console.warn('importMarkdown 未就绪');}"
                        webView.post { webView.evaluateJavascript(js, null) }
                    } catch (inner: Throwable) {
                        Log.e(TAG, "读取单个文件失败", inner)
                        webView.post { showToastLong("读取失败：${inner.message}") }
                    }
                }
            } catch (e: Throwable) {
                Log.e(TAG, "导入失败", e)
                webView.post { showToastLong("导入失败：${e.message}") }
            }
        }.start()
    }

    private fun handleIntent(intent: Intent?) {
        intent ?: return
        if (Intent.ACTION_VIEW == intent.action) {
            val uri = intent.data
            if (uri != null) {
                binding.webview.postDelayed({ handleImportedFile(listOf(uri)) }, 500)
            }
        }
    }

    private fun requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            try {
                val granted = ContextCompat.checkSelfPermission(
                    this, android.Manifest.permission.POST_NOTIFICATIONS
                ) == PackageManager.PERMISSION_GRANTED
                if (!granted) {
                    notificationPermissionLauncher.launch(android.Manifest.permission.POST_NOTIFICATIONS)
                }
            } catch (e: Throwable) {
                Log.w(TAG, "通知权限请求", e)
            }
        }
    }

    private fun promptBatteryOptimizationIfNeeded() {
        if (!DeviceUtils.isXiaomi) return

        val prefs = try {
            getSharedPreferences("markdoc_prefs", MODE_PRIVATE)
        } catch (e: Throwable) {
            Log.w(TAG, "SharedPreferences 不可用", e)
            return
        }
        val asked = prefs.getBoolean("battery_asked", false)
        if (asked) return

        val pm = try {
            getSystemService(POWER_SERVICE) as? PowerManager
        } catch (e: Throwable) {
            Log.w(TAG, "PowerManager 获取失败", e)
            null
        } ?: return

        try {
            if (pm.isIgnoringBatteryOptimizations(packageName)) return
        } catch (e: Throwable) {
            Log.w(TAG, "isIgnoringBatteryOptimizations 调用失败", e)
            // 旧版 / 部分定制 ROM 可能不支持
        }

        try {
            AlertDialog.Builder(this)
                .setTitle("⚡ 建议开启电池优化白名单")
                .setMessage(
                    "检测到你的设备是小米/红米。\n\n" +
                    "MIUI/HyperOS 默认会激进清理后台进程，可能导致编辑内容意外丢失。\n\n" +
                    "开启电池优化白名单后，应用将不会被自动清理，编辑更安心。"
                )
                .setPositiveButton("去设置") { _, _ ->
                    prefs.edit().putBoolean("battery_asked", true).apply()
                    try {
                        val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
                        intent.data = Uri.parse("package:$packageName")
                        batteryOptimizationLauncher.launch(intent)
                    } catch (e: Throwable) {
                        try {
                            startActivity(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
                        } catch (_: Throwable) {}
                    }
                }
                .setNegativeButton("稍后") { _, _ ->
                    prefs.edit().putBoolean("battery_asked", true).apply()
                }
                .setNeutralButton("查看日志") { _, _ ->
                    prefs.edit().putBoolean("battery_asked", true).apply()
                    showCrashLogDialog()
                }
                .setCancelable(true)
                .show()
        } catch (e: Throwable) {
            Log.e(TAG, "电池优化对话框显示失败", e)
        }
    }

    /**
     * 显示崩溃日志对话框（用户可截图或复制内容）
     */
    private fun showCrashLogDialog() {
        try {
            val log = CrashHandler.getLastCrashLog(this)
            val msg = if (log.isNullOrEmpty()) {
                "✓ 没有崩溃日志\n\n所有运行都正常。"
            } else {
                "最近的崩溃日志：\n\n${log.take(2000)}"
            }
            AlertDialog.Builder(this)
                .setTitle("崩溃日志")
                .setMessage(msg)
                .setPositiveButton("复制") { _, _ ->
                    try {
                        val cm = getSystemService(android.content.Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
                        cm.setPrimaryClip(android.content.ClipData.newPlainText("crash log", log ?: ""))
                        Toast.makeText(this, "已复制到剪贴板", Toast.LENGTH_SHORT).show()
                    } catch (_: Throwable) {}
                }
                .setNegativeButton("关闭", null)
                .show()
        } catch (e: Throwable) {
            Log.e(TAG, "showCrashLogDialog", e)
        }
    }

    /**
     * 降级错误界面 —— WebView 初始化失败时显示
     */
    private fun showWebViewErrorScreen(t: Throwable) {
        try {
            val layout = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(48, 96, 48, 48)
                setBackgroundColor(0xFFFDFCF7.toInt())
            }
            val tv = TextView(this).apply {
                text = buildString {
                    appendLine("⚠️ WebView 初始化失败")
                    appendLine()
                    appendLine("这通常是小米 MIUI / HyperOS WebView 引擎的兼容性问题。")
                    appendLine()
                    appendLine("请尝试：")
                    appendLine("1. 设置 → 应用管理 → 马克档 → 卸载更新 / 清除数据")
                    appendLine("2. 更新 Google WebView（应用商店搜索）")
                    appendLine("3. 或者更新系统 WebView 组件")
                    appendLine()
                    appendLine("━━━━━━━━━━━━━━━━━━")
                    appendLine("技术详情：")
                    appendLine(t.javaClass.simpleName + ": " + t.message)
                    appendLine()
                    append("完整日志：")
                    appendLine(CrashHandler.getLastCrashLog(this@MainActivity)?.take(1500) ?: "无")
                }
                textSize = 14f
                setTextColor(0xFF1A1829.toInt())
            }
            val scroll = ScrollView(this)
            scroll.addView(tv)
            layout.addView(scroll, LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.MATCH_PARENT
            ))
            setContentView(layout)
        } catch (e: Throwable) {
            Log.e(TAG, "降级界面也失败", e)
        }
    }

    /**
     * 兜底错误界面 —— onCreate 本身失败
     */
    private fun showFallbackErrorScreen(t: Throwable) {
        try {
            // 把崩溃写入文件
            CrashHandler.getLastCrashLog(this)
            setContentView(TextView(this).apply {
                text = "启动失败：${t.message}\n\n请查看崩溃日志或反馈给开发者。"
                setPadding(48, 96, 48, 48)
                textSize = 16f
            })
        } catch (_: Throwable) {}
    }

    private fun showToastLong(msg: String) {
        try { Toast.makeText(this, msg, Toast.LENGTH_LONG).show() } catch (_: Throwable) {}
    }

    override fun onResume() {
        super.onResume()
        try { webView.onResume() } catch (_: Throwable) {}
    }

    override fun onPause() {
        super.onPause()
        try {
            webView.onPause()
            // 兜底备份
            webView.evaluateJavascript("localStorage.getItem('markdoc.content.v1')") { value ->
                try {
                    if (value != null && value != "null") {
                        val content = value.removePrefix("\"").removeSuffix("\"")
                            .replace("\\n", "\n").replace("\\\"", "\"").replace("\\\\", "\\")
                        DataBackup.save(this@MainActivity, content)
                    }
                } catch (_: Throwable) {}
            }
        } catch (_: Throwable) {}
    }

    override fun onDestroy() {
        try { webView.destroy() } catch (_: Throwable) {}
        super.onDestroy()
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        try {
            setupSystemUI()
            webView.evaluateJavascript(
                "if(window.onSystemThemeChange){window.onSystemThemeChange(${isNightMode()});}",
                null
            )
        } catch (_: Throwable) {}
    }

    companion object {
        private const val TAG = "MainActivity"
    }
}