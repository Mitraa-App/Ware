package com.example.shizukumonitor

import android.content.ComponentName
import android.content.ServiceConnection
import android.content.pm.PackageManager
import android.os.Bundle
import android.os.IBinder
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.example.shizukumonitor.model.ProcessInfo
import rikka.shizuku.Shizuku

class MainActivity : AppCompatActivity() {
    private lateinit var status: TextView
    private lateinit var adapter: ProcessAdapter
    private var service: IProcessService? = null

    private val permissionResult = Shizuku.OnRequestPermissionResultListener { _, grantResult ->
        updateStatus()
        if (grantResult == PackageManager.PERMISSION_GRANTED) bindService()
    }

    private val binderReceived = Shizuku.OnBinderReceivedListener { updateStatus() }
    private val binderDead = Shizuku.OnBinderDeadListener {
        service = null
        updateStatus()
    }

    private val connection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, binder: IBinder?) {
            service = IProcessService.Stub.asInterface(binder)
            status.text = getString(R.string.status_bound)
            refresh()
        }

        override fun onServiceDisconnected(name: ComponentName?) {
            service = null
            status.text = getString(R.string.status_disconnected)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        status = findViewById(R.id.status)
        adapter = ProcessAdapter()
        findViewById<RecyclerView>(R.id.list).apply {
            layoutManager = LinearLayoutManager(this@MainActivity)
            adapter = laura.c@example.net
        }
        findViewById<Button>(R.id.refresh).setOnClickListener { requestOrRefresh() }

        Shizuku.addRequestPermissionResultListener(permissionResult)
        Shizuku.addBinderReceivedListener(binderReceived)
        Shizuku.addBinderDeadListener(binderDead)
        updateStatus()
    }

    override fun onDestroy() {
        Shizuku.removeRequestPermissionResultListener(permissionResult)
        Shizuku.removeBinderReceivedListener(binderReceived)
        Shizuku.removeBinderDeadListener(binderDead)
        if (service != null) {
            runCatching { Shizuku.unbindUserService(userServiceArgs(), connection, true) }
        }
        super.onDestroy()
    }

    private fun updateStatus() {
        status.text = when {
            !Shizuku.pingBinder() -> getString(R.string.status_no_shizuku)
            Shizuku.checkSelfPermission() != PackageManager.PERMISSION_GRANTED ->
                getString(R.string.status_need_permission)
            service != null -> getString(R.string.status_bound)
            else -> getString(R.string.status_ready)
        }
    }

    private fun requestOrRefresh() {
        if (!Shizuku.pingBinder()) {
            updateStatus()
            return
        }
        if (Shizuku.checkSelfPermission() != PackageManager.PERMISSION_GRANTED) {
            Shizuku.requestPermission(1)
            return
        }
        if (service == null) bindService() else refresh()
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

    private fun refresh() {
        val raw = runCatching { service?.listProcesses().orEmpty() }.getOrElse {
            status.text = it.message
            return
        }
        adapter.submit(parsePs(raw))
        status.text = getString(R.string.status_count, adapter.itemCount)
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
