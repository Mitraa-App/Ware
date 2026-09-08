package com.example.shizukumonitor.model

data class ProcessInfo(
    val pid: Int,
    val ppid: Int,
    val user: String,
    val status: String,
    val name: String,
    val memoryKB: Long = 0,
    val cpuUsage: Double = 0.0,
    val timestamp: Long = System.currentTimeMillis()
) {
    val memoryMB: Double
        get() = memoryKB / 1024.0
}
