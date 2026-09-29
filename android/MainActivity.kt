package com.midi.controller.keyboard

import android.content.Context
import android.media.midi.MidiDeviceInfo
import android.media.midi.MidiInputPort
import android.media.midi.MidiManager
import android.os.Bundle
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import androidx.appcompat.app.AppCompatActivity

/**
 * MainActivity Android nativa compatível com Android 10+ (API 29+)
 * Fornece interface WebView de alto desempenho com suporte completo a
 * Web MIDI, Web Bluetooth e integração com o MidiManager do Android.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private var midiManager: MidiManager? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Inicializa o MidiManager nativo do Android 10+
        midiManager = getSystemService(Context.MIDI_SERVICE) as? MidiManager

        webView = WebView(this).apply {
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                databaseEnabled = true
                mediaPlaybackRequiresUserGesture = false
                cacheMode = WebSettings.LOAD_DEFAULT
                mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            }

            webChromeClient = object : WebChromeClient() {
                override fun onPermissionRequest(request: PermissionRequest) {
                    // Concede permissões para MIDI e Bluetooth requisitadas pela WebView
                    request.grant(request.resources)
                }
            }

            // Carrega a aplicação web compilada localmente ou em produção
            loadUrl("file:///android_asset/dist/index.html")
        }

        setContentView(webView)
    }

    /**
     * Exemplo de envio de Note On diretamente pelo MidiManager nativo do Android
     */
    fun sendNativeMidiNote(port: MidiInputPort, channel: Int, note: Int, isNoteOn: Boolean) {
        val statusByte = if (isNoteOn) (0x90 or (channel - 1)) else (0x80 or (channel - 1))
        val velocity = if (isNoteOn) 64 else 0
        val buffer = byteArrayOf(statusByte.toByte(), note.toByte(), velocity.toByte())
        port.send(buffer, 0, buffer.size)
    }
}
