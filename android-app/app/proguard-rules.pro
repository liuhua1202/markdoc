# 保留 WebView 相关的反射调用
-keepclassmembers class * extends android.webkit.WebViewClient {
    public void onPageStarted(android.webkit.WebView, java.lang.String, android.graphics.Bitmap);
    public void onPageFinished(android.webkit.WebView, java.lang.String);
}

# 保留 JS 接口
-keepclassmembers class com.markdoc.app.** {
    @android.webkit.JavascriptInterface <methods>;
}

# 保留 JS 接口注解
-keep @android.webkit.JavascriptInterface class * { *; }

# Kotlin 元数据
-keep class kotlin.Metadata { *; }