package com.example.shizukumonitor

import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

object ConsoleClient {
    fun normalizeOrigin(raw: String): String {
        val trimmed = raw.trim()
        val withScheme = if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
            trimmed
        } else {
            "https://$trimmed"
        }
        val url = URL(withScheme)
        val port = if (url.port != -1 && url.port != url.defaultPort) ":${url.port}" else ""
        return "${url.protocol}://${url.host}$port"
    }

    fun ingest(origin: String, body: JSONObject): JSONObject {
        val conn = URL("${normalizeOrigin(origin)}/api/ingest").openConnection() as HttpURLConnection
        conn.requestMethod = "POST"
        conn.setRequestProperty("Content-Type", "application/json")
        conn.doOutput = true
        conn.connectTimeout = 12000
        conn.readTimeout = 12000
        val bytes = body.toString().toByteArray(Charsets.UTF_8)
        conn.setFixedLengthStreamingMode(bytes.size)
        conn.outputStream.use { it.write(bytes) }
        val stream = if (conn.responseCode in 200..299) conn.inputStream else conn.errorStream
        val text = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
        if (conn.responseCode !in 200..299) {
            throw IOException(text.ifBlank { "HTTP ${conn.responseCode}" })
        }
        return if (text.isBlank()) JSONObject() else JSONObject(text)
    }
}
