package com.example.shizukumonitor

import android.content.Context
import androidx.annotation.Keep

@Keep
class ProcessUserService : IProcessService.Stub {
    constructor() : super()
    constructor(context: Context) : super()

    override fun listProcesses(): String {
        val proc = Runtime.getRuntime().exec(arrayOf("sh", "-c", "ps -A -o PID,PPID,USER,RSS,NAME"))
        val stdout = proc.inputStream.bufferedReader().use { it.readText() }
        val stderr = proc.errorStream.bufferedReader().use { it.readText() }
        proc.waitFor()
        return stdout.ifBlank { stderr }
    }
}
