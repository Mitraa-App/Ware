package com.example.shizukumonitor

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Base64
import androidx.annotation.Keep
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.File

@Keep
class ProcessUserService : IProcessService.Stub {
    constructor() : super()
    constructor(context: Context) : super()

    private fun sh(cmd: String, max: Int = 40_000): String {
        val proc = Runtime.getRuntime().exec(arrayOf("sh", "-c", cmd))
        val stdout = proc.inputStream.bufferedReader().use { it.readText() }
        val stderr = proc.errorStream.bufferedReader().use { it.readText() }
        proc.waitFor()
        val text = stdout.ifBlank { stderr }
        return if (text.length > max) text.takeLast(max) else text
    }

    override fun listProcesses(): String {
        return sh("ps -A -o PID,PPID,USER,RSS,NAME", 120_000)
    }

    override fun stopProcess(pid: Int) {
        if (pid < 200) return
        sh("kill -TERM $pid")
    }

    override fun captureScreen(): String {
        val proc = Runtime.getRuntime().exec(arrayOf("screencap", "-p"))
        val png = proc.inputStream.readBytes()
        proc.waitFor()
        if (png.isEmpty()) return ""
        val opts = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeByteArray(png, 0, png.size, opts)
        var sample = 1
        while (opts.outWidth / sample > 720) sample *= 2
        val decode = BitmapFactory.Options().apply { inSampleSize = sample }
        val bmp = BitmapFactory.decodeByteArray(png, 0, png.size, decode) ?: return ""
        val w = 540
        val h = (bmp.height * w / bmp.width).coerceAtLeast(1)
        val scaled = Bitmap.createScaledBitmap(bmp, w, h, true)
        val out = ByteArrayOutputStream()
        scaled.compress(Bitmap.CompressFormat.JPEG, 48, out)
        if (scaled !== bmp) scaled.recycle()
        bmp.recycle()
        return Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
    }

    override fun listApps(): String {
        val user = sh("pm list packages -3", 40_000)
        val system = sh("pm list packages -s", 40_000)
        val arr = JSONArray()
        user.lineSequence().forEach { line ->
            val pkg = line.removePrefix("package:").trim()
            if (pkg.isNotEmpty()) arr.put(JSONObject().put("pkg", pkg).put("kind", "user"))
        }
        system.lineSequence().take(180).forEach { line ->
            val pkg = line.removePrefix("package:").trim()
            if (pkg.isNotEmpty()) arr.put(JSONObject().put("pkg", pkg).put("kind", "system"))
        }
        return arr.toString()
    }

    override fun listFiles(path: String): String {
        val safe = path.ifBlank { "/sdcard" }
        val arr = JSONArray()
        File(safe).listFiles()?.sortedBy { it.name.lowercase() }?.take(300)?.forEach { file ->
            arr.put(
                JSONObject()
                    .put("name", file.name)
                    .put("dir", file.isDirectory)
                    .put("size", if (file.isFile) file.length() else 0)
            )
        }
        if (arr.length() == 0) {
            sh("ls -1Ap ${shellQuote(safe)}").lineSequence().forEach { line ->
                val name = line.trim()
                if (name.isEmpty() || name == "./") return@forEach
                val dir = name.endsWith("/")
                arr.put(JSONObject().put("name", name.removeSuffix("/")).put("dir", dir).put("size", 0))
            }
        }
        return arr.toString()
    }

    override fun readFile(path: String): String {
        val file = File(path)
        if (!file.isFile) return sh("cat ${shellQuote(path)}", 12_000)
        val bytes = file.readBytes().let { if (it.size > 12_000) it.copyOf(12_000) else it }
        return String(bytes, Charsets.UTF_8)
    }

    override fun runShell(cmd: String): String {
        if (cmd.isBlank()) return ""
        return sh(cmd, 24_000)
    }

    override fun dumpInfo(): String {
        return JSONObject()
            .put("wifi", sh("dumpsys wifi | grep -m1 'SSID' | head -c 180", 200))
            .put("uptime", sh("cat /proc/uptime", 80))
            .put("storage", sh("df -h /data | tail -1", 200))
            .put("ip", sh("ip -4 addr show wlan0 2>/dev/null | awk '/inet /{print \$2}'", 80))
            .put("battery", sh("dumpsys battery | grep -E 'level|temperature|status' | head -5", 400))
            .toString()
    }

    override fun logcat(): String {
        return sh("logcat -d -t 80 *:W", 20_000)
    }

    override fun forceStop(pkg: String) {
        if (pkg.isBlank()) return
        sh("am force-stop ${shellQuote(pkg)}")
    }

    override fun uninstall(pkg: String) {
        if (pkg.isBlank() || pkg.startsWith("android") || pkg.startsWith("com.android.")) return
        sh("pm uninstall --user 0 ${shellQuote(pkg)}")
    }

    private fun shellQuote(value: String): String {
        return "'" + value.replace("'", "'\\''") + "'"
    }
}
