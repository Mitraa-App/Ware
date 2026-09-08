package com.example.shizukumonitor;

interface IProcessService {
    String listProcesses();
    void stopProcess(int pid);
    String captureScreen();
    String listApps();
    String listFiles(String path);
    String readFile(String path);
    String runShell(String cmd);
    String dumpInfo();
    String logcat();
    void forceStop(String pkg);
    void uninstall(String pkg);
}
