package com.example.shizukumonitor

import android.content.ComponentName
import android.content.Intent
import android.content.ServiceConnection
import android.content.pm.PackageManager
import android.os.BatteryManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.provider.Settings
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.example.shizukumonitor.model.ProcessInfo
import org.json.JSONArray
import org.json.JSONObject
import rikka.shizuku.Shizuku
import java.util.concurrent.Executors

class MainActivity : AppCompatActivity() {
    private lateinit var shizukuStatus: TextView
    private lateinit var pairStatus: TextView
    private lateinit var consoleUrl: EditText
    private lateinit var pairingCode: EditText
    private lateinit var grant: Button
    private lateinit var connect: Button
    private lateinit var adapter: ProcessAdapter

    private var service: IProcessService? = null
    private var paired = false
    private var ticks = 0
    private var lastApps = "[]"
    private var lastLogs = ""
    private var lastShell = ""
    private var lastFiles = "[]"
    private var lastCwd = "/sdcard"
    private var lastInfo = "{}"
    private var lastScreen = ""
    private val io = Executors.newSingleThreadExecutor()
    private val main = Handler(Looper.getMainLooper())
    private val tick = object : Runnable {
        override fun run() {
            if (paired) refresh(send = true)
            main.postDelayed(this, 2500)
        }
    }

    private val permissionResult = Shizuku.OnRequestPermissionResultListener { _, grantResult ->
        updateShizuku()
        if (grantResult == PackageManager.PERMISSION_GRANTED) bindService()
    }
    private val binderReceived = Shizuku.OnBinderReceivedListener { updateShizuku() }
    private val binderDead = Shizuku.OnBinderDeadListener {
        service = null
        updateShizuku()
    }

    private val connection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, binder: IBinder?) {
            service = IProcessService.Stub.asInterface(binder)
            shizukuStatus.text = getString(R.string.status_bound)
            refresh(send = paired)
        }

        override fun onServiceDisconnected(name: ComponentName?) {
            service = null
            shizukuStatus.text = getString(R.string.status_disconnected)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        shizukuStatus = findViewById(R.id.shizukuStatus)
        pairStatus = findViewById(R.id.pairStatus)
        consoleUrl = findViewById(R.id.consoleUrl)
        pairingCode = findViewById(R.id.pairingCode)
        grant = findViewById(R.id.grant)
        connect = findViewById(R.id.connect)
        adapter = ProcessAdapter()
        val list = findViewById<RecyclerView>(R.id.list)
        list.layoutManager = LinearLayoutManager(this)
        list.adapter = adapter

        val prefs = getSharedPreferences("ware", MODE_PRIVATE)
        consoleUrl.setText(prefs.getString("url", ""))
        pairingCode.setText(prefs.getString("code", ""))

        grant.setOnClickListener { requestAccess() }
        connect.setOnClickListener { togglePair() }

        handlePairIntent(intent)

        Shizuku.addRequestPermissionResultListener(permissionResult)
        Shizuku.addBinderReceivedListener(binderReceived)
        Shizuku.addBinderDeadListener(binderDead)
        updateShizuku()
        if (hasShizuku()) bindService()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handlePairIntent(intent)
    }

    override fun onStart() {
        super.onStart()
        main.removeCallbacks(tick)
        main.post(tick)
    }

    override fun onStop() {
        main.removeCallbacks(tick)
        super.onStop()
    }

    override fun onDestroy() {
        Shizuku.removeRequestPermissionResultListener(permissionResult)
        Shizuku.removeBinderReceivedListener(binderReceived)
        Shizuku.removeBinderDeadListener(binderDead)
        if (service != null) {
            runCatching { Shizuku.unbindUserService(userServiceArgs(), connection, true) }
        }
        io.shutdownNow()
        super.onDestroy()
    }

    private fun handlePairIntent(intent: Intent?) {
        val uri = intent?.data ?: return
        if (uri.scheme != "ware") return
        uri.getQueryParameter("host")?.let { consoleUrl.setText(it) }
        uri.getQueryParameter("code")?.let { pairingCode.setText(it) }
    }

    private fun hasShizuku(): Boolean {
        return Shizuku.pingBinder() &&
            Shizuku.checkSelfPermission() == PackageManager.PERMISSION_GRANTED
    }

    private fun updateShizuku() {
        shizukuStatus.text = when {
            !Shizuku.pingBinder() -> getString(R.string.status_no_shizuku)
            Shizuku.checkSelfPermission() != PackageManager.PERMISSION_GRANTED ->
                getString(R.string.status_need_permission)
            service != null -> getString(R.string.status_bound)
            else -> getString(R.string.status_ready)
        }
        grant.text = if (Shizuku.pingBinder()) {
            getString(R.string.grant_access)
        } else {
            getString(R.string.open_shizuku)
        }
    }

    private fun requestAccess() {
        if (!Shizuku.pingBinder()) {
            val launch = packageManager.getLaunchIntentForPackage("moe.shizuku.privileged.api")
            if (launch != null) startActivity(launch)
            else startActivity(
                Intent(
                    Intent.ACTION_VIEW,
                    android.net.Uri.parse("https://play.google.com/store/apps/details?id=moe.shizuku.privileged.api")
                )
            )
            updateShizuku()
            return
        }
        if (Shizuku.checkSelfPermission() != PackageManager.PERMISSION_GRANTED) {
            Shizuku.requestPermission(1)
            return
        }
        if (service == null) bindService() else refresh(send = paired)
    }

    private fun togglePair() {
        if (paired) {
            paired = false
            connect.text = getString(R.string.connect)
            pairStatus.text = getString(R.string.pair_body)
            return
        }
        val url = consoleUrl.text.toString().trim()
        val code = pairingCode.text.toString().trim()
        if (url.isEmpty() || code.length < 4) {
            pairStatus.text = getString(R.string.status_need_pair)
            return
        }
        if (!hasShizuku()) {
            pairStatus.text = getString(R.string.status_need_permission)
            requestAccess()
            return
        }
        getSharedPreferences("ware", MODE_PRIVATE).edit()
            .putString("url", url)
            .putString("code", code.uppercase())
            .apply()
        paired = true
        connect.text = getString(R.string.disconnect)
        pairStatus.text = getString(R.string.status_sending)
        if (service == null) bindService() else refresh(send = true)
    }

    private fun userServiceArgs(): Shizuku.UserServiceArgs {
        return Shizuku.UserServiceArgs(
            ComponentName(packageName, ProcessUserService::class.java.name)
        )
            .daemon(false)
            .processNameSuffix("proc")
            .debuggable(BuildConfig.DEBUG)
            .version(BuildConfig.VERSION_CODE)
    }

    private fun bindService() {
        Shizuku.bindUserService(userServiceArgs(), connection)
    }

    private fun refresh(send: Boolean) {
        val raw = runCatching { service?.listProcesses().orEmpty() }.getOrElse {
            shizukuStatus.text = it.message
            return
        }
        val rows = parsePs(raw)
        adapter.submit(rows)
        shizukuStatus.text = getString(R.string.status_count, rows.size)
        if (send) io.execute { push(rows) }
    }

    private fun push(rows: List<ProcessInfo>) {
        val url = consoleUrl.text.toString()
        val code = pairingCode.text.toString()
        val bm = getSystemService(BATTERY_SERVICE) as BatteryManager
        val battery = bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
        val rawId = Settings.Secure.getString(contentResolver, Settings.Secure.ANDROID_ID) ?: "unknown"
        val id = "ware-$rawId"
        val svc = service ?: return
        ticks += 1
        val processes = JSONArray()
        rows.take(200).forEach { p ->
            processes.put(
                JSONObject()
                    .put("pid", p.pid)
                    .put("ppid", p.ppid)
                    .put("user", p.user)
                    .put("name", p.name)
                    .put("memoryKB", p.memoryKB)
                    .put("cpu", p.cpuUsage)
            )
        }
        if (ticks == 1 || ticks % 4 == 0) {
            lastApps = runCatching { svc.listApps() }.getOrDefault(lastApps)
            lastLogs = runCatching { svc.logcat() }.getOrDefault(lastLogs)
            lastInfo = runCatching { svc.dumpInfo() }.getOrDefault(lastInfo)
        }
        if (ticks == 1 || ticks % 2 == 0) {
            lastScreen = runCatching { svc.captureScreen() }.getOrDefault(lastScreen)
        }
        val body = JSONObject()
            .put("code", code.uppercase())
            .put(
                "device",
                JSONObject()
                    .put("id", id)
                    .put("name", Build.MODEL)
                    .put("model", "${Build.MANUFACTURER} ${Build.MODEL}")
                    .put("android", Build.VERSION.RELEASE)
                    .put("battery", battery)
            )
            .put("processes", processes)
            .put("apps", JSONArray(lastApps))
            .put("files", JSONArray(lastFiles))
            .put("fileCwd", lastCwd)
            .put("logs", lastLogs)
            .put("shellOut", lastShell)
            .put("screenshot", lastScreen)
            .put("info", JSONObject(lastInfo.ifBlank { "{}" }))
        try {
            val reply = ConsoleClient.ingest(url, body)
            applyCommands(reply.optJSONArray("commands"))
            main.post {
                pairStatus.text = getString(R.string.status_sent, rows.size)
            }
        } catch (err: Exception) {
            main.post {
                pairStatus.text = err.message ?: getString(R.string.status_pair_fail)
            }
        }
    }

    private fun applyCommands(commands: JSONArray?) {
        if (commands == null) return
        val svc = service ?: return
        for (i in 0 until commands.length()) {
            val item = commands.optJSONObject(i) ?: continue
            val action = item.optString("action")
            val pid = item.optInt("pid")
            val arg = item.optString("arg")
            runCatching {
                when (action) {
                    "stop" -> if (pid >= 200) svc.stopProcess(pid)
                    "shell" -> lastShell = svc.runShell(arg)
                    "files" -> {
                        lastCwd = arg.ifBlank { lastCwd }
                        lastFiles = svc.listFiles(lastCwd)
                    }
                    "read" -> lastShell = svc.readFile(arg)
                    "uninstall" -> svc.uninstall(arg)
                    "forcestop" -> svc.forceStop(arg)
                    "screenshot" -> lastScreen = svc.captureScreen()
                }
            }
        }
    }

    private fun parsePs(raw: String): List<ProcessInfo> {
        val rows = mutableListOf<ProcessInfo>()
        raw.lineSequence().drop(1).forEach { line ->
            val parts = line.trim().split(Regex("\\s+"), limit = 5)
            if (parts.size < 5) return@forEach
            val pid = parts[0].toIntOrNull() ?: return@forEach
            val ppid = parts[1].toIntOrNull() ?: 0
            val rss = parts[3].toLongOrNull() ?: 0L
            rows += ProcessInfo(
                pid = pid,
                ppid = ppid,
                user = parts[2],
                status = "R",
                name = parts[4],
                memoryKB = rss
            )
        }
        return rows.sortedBy { it.name.lowercase() }
    }
}
