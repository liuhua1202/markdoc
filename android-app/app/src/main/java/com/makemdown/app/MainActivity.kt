package com.makemdown.app

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
import com.makemdown.app.databinding.ActivityMainBinding
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
    ) { uri: Uri? -> uri?.let { handleImportedFile(it) } }

    private val openDocumentLauncher = registerForActivityResult(
        ActivityResultContracts.OpenDocument()
    ) { uri: Uri? -> uri?.let { handleImportedFile(it) } }

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
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
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
            WebAppInterface(this) { openFilePicker() },
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
            val js = """
                (function() {
                    try {
                        var content = localStorage.getItem('makemdown.content.v1');
                        if (!content || content.length < 10) {
                            if (window.importMarkdown) {
                                window.importMarkdown(${jsString(backupContent)});
                                return 'restored';
                            }
                        }
                        return 'has-content';
                    } catch(e) { return 'error:' + e.message; }
                })();
            """.trimIndent()
            webView.evaluateJavascript(js) { value -> Log.i(TAG, "备份恢复: $value") }
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
        try {
            openDocumentLauncher.launch(arrayOf("text/markdown", "text/plain", "*/*"))
        } catch (e: Throwable) {
            Log.e(TAG, "SAF 失败，回退", e)
            try { filePickerLauncher.launch("*/*") } catch (e2: Throwable) {
                Log.e(TAG, "GetContent 也失败", e2)
                showToastLong("文件选择器不可用")
            }
        }
    }

    private fun handleImportedFile(uri: Uri) {
        try {
            val text = contentResolver.openInputStream(uri)?.use { stream ->
                BufferedReader(InputStreamReader(stream, Charsets.UTF_8)).readText()
            } ?: run { showToastLong("读取失败"); return }
            val js = "if(window.importMarkdown){window.importMarkdown(${jsString(text)});}else{alert('导入接口未就绪');}"
            webView.evaluateJavascript(js, null)
            showToastLong("已导入文件")
        } catch (e: Throwable) {
            Log.e(TAG, "导入失败", e)
            showToastLong("导入失败：${e.message}")
        }
    }

    private fun handleIntent(intent: Intent?) {
        intent ?: return
        if (Intent.ACTION_VIEW == intent.action) {
            val uri = intent.data
            if (uri != null) {
                binding.webview.postDelayed({ handleImportedFile(uri) }, 500)
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
            getSharedPreferences("makemdown_prefs", MODE_PRIVATE)
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
            webView.evaluateJavascript("localStorage.getItem('makemdown.content.v1')") { value ->
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