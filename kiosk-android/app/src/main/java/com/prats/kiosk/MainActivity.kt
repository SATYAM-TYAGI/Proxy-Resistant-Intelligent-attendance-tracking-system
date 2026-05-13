package com.prats.kiosk

import android.annotation.SuppressLint
import android.os.Bundle
import android.provider.Settings
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {

    @SuppressLint("SetJavaScriptEnabled", "HardwareIds")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val wv = WebView(this)
        setContentView(wv)
        val secureId =
            Settings.Secure.getString(contentResolver, Settings.Secure.ANDROID_ID)
                ?: "unknown-device"
        val base = getString(R.string.kiosk_base_url).trimEnd('/')
        val url = "$base/device?nativeDevice=${android.net.Uri.encode(secureId)}"
        wv.settings.javaScriptEnabled = true
        wv.settings.domStorageEnabled = true
        wv.webChromeClient = WebChromeClient()
        wv.webViewClient = WebViewClient()
        wv.loadUrl(url)
    }
}
