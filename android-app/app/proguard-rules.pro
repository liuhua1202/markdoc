# 保留 WebView 相关的反射调用
-keepclassmembers class * extends android.webkit.WebViewClient {
    public void onPageStarted(android.webkit.WebView, java.lang.String, android.graphics.Bitmap);
    public void onPageFinished(android.webkit.WebView, java.lang.String);
}

# 保留整个 WebAppInterface 类(虽然 addJavascriptInterface 用的是对象引用,
# 但保留类名让崩溃栈和日志更可读)
-keep class com.markdoc.app.WebAppInterface { *; }
-keep class com.markdoc.app.WebAppInterface$Companion { *; }

# 保留所有 @JavascriptInterface 标注的方法名(JS 端按方法名调用)
-keepclassmembers class com.markdoc.app.** {
    @android.webkit.JavascriptInterface <methods>;
}

# 保留 JS 接口注解本身
-keep @android.webkit.JavascriptInterface class * { *; }

# Kotlin 元数据
-keep class kotlin.Metadata { *; }
-keepclassmembers class kotlin.Metadata { *; }

# CrashHandler/DataBackup/MarkdownApplication/DeviceUtils 是 object 单例,
# 混淆会破坏 INSTANCE 字段,保留类成员避免 NPE
-keep class com.markdoc.app.CrashHandler { *; }
-keep class com.markdoc.app.CrashHandler$* { *; }
-keep class com.markdoc.app.DataBackup { *; }
-keep class com.markdoc.app.DataBackup$* { *; }
-keep class com.markdoc.app.MarkdownApplication { *; }
-keep class com.markdoc.app.MarkdownApplication$* { *; }
-keep class com.markdoc.app.DeviceUtils { *; }
-keep class com.markdoc.app.DeviceUtils$* { *; }

# ActivityBinding (viewBinding 生成)
-keep class com.markdoc.app.databinding.** { *; }
