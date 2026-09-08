import { getSql } from "@/lib/db";
import type { AppRow, Device, DeviceInfo, FileRow, ProcessRow } from "./types";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function makePairingCode(): string {
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

export function normalizeCode(raw: unknown): string {
  if (typeof raw !== "string") throw new Error("Pairing code required");
  const code = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (code.length < 4 || code.length > 12) throw new Error("Pairing code looks wrong");
  return code;
}

function clip(value: unknown, max: number, fallback = ""): string {
  if (typeof value !== "string") return fallback;
  return value.trim().slice(0, max) || fallback;
}

function num(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function jsonVal(raw: unknown): unknown {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return raw;
}

export function parseProcesses(raw: unknown): ProcessRow[] {
  const src = jsonVal(raw);
  if (!Array.isArray(src)) return [];
  const rows: ProcessRow[] = [];
  for (const item of src.slice(0, 200)) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const pid = Math.round(num(row.pid));
    if (pid <= 0) continue;
    rows.push({
      pid,
      ppid: Math.max(0, Math.round(num(row.ppid))),
      user: clip(row.user, 32, "app"),
      name: clip(row.name, 120, "unknown"),
      memoryKB: Math.max(0, num(row.memoryKB)),
      cpu: Math.max(0, Math.min(100, num(row.cpu))),
    });
  }
  return rows;
}

export function parseApps(raw: unknown): AppRow[] {
  const src = jsonVal(raw);
  if (!Array.isArray(src)) return [];
  const rows: AppRow[] = [];
  for (const item of src.slice(0, 400)) {
    if (typeof item === "string") {
      rows.push({ pkg: item.slice(0, 180), kind: "app" });
      continue;
    }
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const pkg = clip(row.pkg ?? row.name, 180);
    if (!pkg) continue;
    rows.push({ pkg, kind: clip(row.kind, 16, "app") });
  }
  return rows;
}

export function parseFiles(raw: unknown): FileRow[] {
  const src = jsonVal(raw);
  if (!Array.isArray(src)) return [];
  const rows: FileRow[] = [];
  for (const item of src.slice(0, 300)) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const name = clip(row.name, 240);
    if (!name) continue;
    rows.push({ name, dir: Boolean(row.dir), size: Math.max(0, num(row.size)) });
  }
  return rows;
}

export function parseInfo(raw: unknown): DeviceInfo {
  const src = jsonVal(raw);
  const row = src && typeof src === "object" ? (src as Record<string, unknown>) : {};
  return {
    wifi: clip(row.wifi, 200, "—"),
    uptime: clip(row.uptime, 80, "—"),
    storage: clip(row.storage, 200, "—"),
    ip: clip(row.ip, 80, "—"),
    battery: clip(row.battery, 200, "—"),
  };
}

function ageMs(value: unknown): number {
  const t = value instanceof Date ? value.getTime() : Date.parse(String(value ?? ""));
  if (!Number.isFinite(t)) return Number.POSITIVE_INFINITY;
  return Date.now() - t;
}

function statusFromAge(ms: number): Device["status"] {
  if (ms < 12_000) return "online";
  if (ms < 90_000) return "idle";
  return "offline";
}

export async function issueCode(): Promise<string> {
  const sql = await getSql();
  for (let i = 0; i < 8; i++) {
    const code = makePairingCode();
    try {
      await sql.query(`insert into pairing_codes (code) values ($1)`, [code]);
      return code;
    } catch {
      /* collision */
    }
  }
  throw new Error("Could not issue a pairing code");
}

export async function codeExists(code: string): Promise<boolean> {
  const sql = await getSql();
  const rows = await sql.query<{ code: string }>(
    `select code from pairing_codes where code = $1 limit 1`,
    [code],
  );
  return rows.length > 0;
}

export type CommandRow = { id: number; action: string; pid: number | null; arg: string | null };

export async function upsertDevice(input: {
  code: string;
  id: string;
  name: string;
  model: string;
  android: string;
  battery: number;
  processes: ProcessRow[];
  apps?: AppRow[];
  files?: FileRow[];
  fileCwd?: string;
  logs?: string;
  shellOut?: string;
  screenshot?: string;
  info?: DeviceInfo;
}): Promise<{ commands: CommandRow[] }> {
  const sql = await getSql();
  const id = clip(input.id, 64).replace(/[^a-zA-Z0-9._-]/g, "");
  if (!id) throw new Error("Device id required");
  await sql.query(
    `insert into devices (
       id, pairing_code, name, model, android, battery, last_seen, processes,
       info, apps, files, logs, shell_out, screenshot, file_cwd
     ) values ($1,$2,$3,$4,$5,$6,now(),$7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb,$11,$12,$13,$14)
     on conflict (id) do update set
       pairing_code = excluded.pairing_code,
       name = excluded.name,
       model = excluded.model,
       android = excluded.android,
       battery = excluded.battery,
       last_seen = now(),
       processes = excluded.processes,
       info = case when excluded.info = '{}'::jsonb then devices.info else excluded.info end,
       apps = case when excluded.apps = '[]'::jsonb then devices.apps else excluded.apps end,
       files = case when excluded.files = '[]'::jsonb then devices.files else excluded.files end,
       logs = case when excluded.logs = '' then devices.logs else excluded.logs end,
       shell_out = case when excluded.shell_out = '' then devices.shell_out else excluded.shell_out end,
       screenshot = case when excluded.screenshot = '' then devices.screenshot else excluded.screenshot end,
       file_cwd = case when excluded.file_cwd = '/sdcard' and devices.file_cwd is not null then devices.file_cwd else excluded.file_cwd end`,
    [
      id,
      input.code,
      clip(input.name, 80, "Phone"),
      clip(input.model, 80, "Android"),
      clip(input.android, 16, "?"),
      Math.max(0, Math.min(100, Math.round(input.battery))),
      JSON.stringify(input.processes),
      JSON.stringify(input.info ?? {}),
      JSON.stringify(input.apps ?? []),
      JSON.stringify(input.files ?? []),
      clip(input.logs, 24_000),
      clip(input.shellOut, 24_000),
      clip(input.screenshot, 900_000),
      clip(input.fileCwd, 240, "/sdcard"),
    ],
  );
  const commands = await sql.query<CommandRow>(
    `select id, action, pid, arg from device_commands
     where device_id = $1 and pairing_code = $2
     order by id asc
     limit 20`,
    [id, input.code],
  );
  if (commands.length > 0) {
    const lastId = commands[commands.length - 1]?.id;
    if (lastId) {
      await sql.query(
        `delete from device_commands where device_id = $1 and pairing_code = $2 and id <= $3`,
        [id, input.code, lastId],
      );
    }
  }
  return { commands };
}

export async function listDevices(code: string): Promise<Device[]> {
  const sql = await getSql();
  await sql.query(`delete from devices where last_seen < now() - interval '15 minutes'`);
  const rows = await sql.query<{
    id: string;
    name: string;
    model: string;
    android: string;
    battery: number;
    last_seen: string | Date;
    processes: unknown;
    info: unknown;
    apps: unknown;
    files: unknown;
    logs: string;
    shell_out: string;
    screenshot: string;
    file_cwd: string;
  }>(
    `select id, name, model, android, battery, last_seen, processes, info, apps, files, logs, shell_out, screenshot, file_cwd
     from devices where pairing_code = $1
     order by last_seen desc`,
    [code],
  );
  return rows.map((row) => {
    const age = ageMs(row.last_seen);
    return {
      id: row.id,
      name: row.name,
      model: row.model,
      android: row.android,
      battery: Number(row.battery) || 0,
      lastSeen: Date.now() - (Number.isFinite(age) ? age : 0),
      status: statusFromAge(age),
      processes: parseProcesses(row.processes),
      apps: parseApps(row.apps),
      files: parseFiles(row.files),
      fileCwd: row.file_cwd || "/sdcard",
      logs: row.logs || "",
      shellOut: row.shell_out || "",
      screenshot: row.screenshot || "",
      info: parseInfo(row.info),
    };
  });
}

export async function enqueueCommand(
  code: string,
  deviceId: string,
  action: string,
  pid?: number,
  arg?: string,
): Promise<void> {
  const allowed = new Set(["stop", "shell", "files", "read", "uninstall", "forcestop", "screenshot"]);
  if (!allowed.has(action)) throw new Error("Unknown command");
  if (action === "stop" && (pid ?? 0) < 200) throw new Error("Refusing to stop a system process");
  const sql = await getSql();
  const owned = await sql.query<{ id: string }>(
    `select id from devices where id = $1 and pairing_code = $2 limit 1`,
    [deviceId, code],
  );
  if (owned.length === 0) throw new Error("Device is not on this pairing code");
  await sql.query(
    `insert into device_commands (device_id, pairing_code, action, pid, arg) values ($1, $2, $3, $4, $5)`,
    [deviceId, code, action, pid ?? null, clip(arg, 2000) || null],
  );
}

export async function enqueueStop(code: string, deviceId: string, pid: number): Promise<void> {
  await enqueueCommand(code, deviceId, "stop", pid);
}
