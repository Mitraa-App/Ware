export type DeviceStatus = "online" | "idle" | "offline";
export type ConsoleTab = "overview" | "screen" | "apps" | "files" | "processes" | "logs" | "shell";

export type ProcessRow = {
  pid: number;
  ppid: number;
  user: string;
  name: string;
  memoryKB: number;
  cpu: number;
};

export type AppRow = {
  pkg: string;
  kind: string;
};

export type FileRow = {
  name: string;
  dir: boolean;
  size: number;
};

export type DeviceInfo = {
  wifi: string;
  uptime: string;
  storage: string;
  ip: string;
  battery: string;
};

export type Device = {
  id: string;
  name: string;
  model: string;
  android: string;
  status: DeviceStatus;
  battery: number;
  lastSeen: number;
  processes: ProcessRow[];
  apps: AppRow[];
  files: FileRow[];
  fileCwd: string;
  logs: string;
  shellOut: string;
  screenshot: string;
  info: DeviceInfo;
};

export type Sample = { t: number; cpu: number; mem: number };
