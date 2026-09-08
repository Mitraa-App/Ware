import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  AppWindow,
  Copy,
  Cpu,
  Folder,
  HardDrive,
  Monitor,
  Radio,
  RefreshCw,
  ScrollText,
  Search,
  Smartphone,
  Square,
  Terminal,
} from "lucide-react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useWare } from "@/lib/ware/store";
import type { ConsoleTab, Device, DeviceStatus } from "@/lib/ware/types";

const NAV = [
  { to: "/", label: "Console", icon: Activity },
  { to: "/apk", label: "Companion APK", icon: Smartphone },
] as const;

const TABS: { id: ConsoleTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "screen", label: "Screen" },
  { id: "apps", label: "Apps" },
  { id: "files", label: "Files" },
  { id: "processes", label: "Processes" },
  { id: "logs", label: "Logs" },
  { id: "shell", label: "Shell" },
];

function statusBadge(status: DeviceStatus) {
  if (status === "online") return <Badge variant="live">Live</Badge>;
  if (status === "idle") return <Badge variant="warn">Idle</Badge>;
  return <Badge variant="off">Offline</Badge>;
}

function fmtMem(kb: number) {
  if (kb > 1024 * 1024) return `${(kb / 1024 / 1024).toFixed(1)} GB`;
  if (kb > 1024) return `${(kb / 1024).toFixed(0)} MB`;
  return `${kb.toFixed(0)} KB`;
}

function ago(ts: number) {
  if (!ts) return "waiting";
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  return `${Math.round(s / 60)}m ago`;
}

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    /* ignore */
  }
}

export function Shell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="min-h-dvh bg-bg text-fg">
      <div className="mx-auto flex min-h-dvh max-w-[1400px]">
        <aside className="hidden w-56 shrink-0 flex-col border-r border-border px-4 py-6 md:flex">
          <div className="px-2">
            <p className="font-mono text-xs tracking-[0.28em] text-muted">WARE</p>
            <p className="mt-1 text-sm text-subtle">Device console</p>
          </div>
          <nav className="mt-8 flex flex-1 flex-col gap-1">
            {NAV.map(({ to, label, icon: Icon }) => {
              const active = pathname === to;
              return (
                <Link
                  key={to}
                  to={to}
                  className={`flex h-11 items-center gap-2 rounded-sm px-3 text-sm transition-colors duration-150 ${
                    active ? "bg-elevated text-fg" : "text-muted hover:bg-elevated hover:text-fg"
                  }`}
                >
                  <Icon className="size-4" strokeWidth={1.75} />
                  {label}
                </Link>
              );
            })}
          </nav>
          <p className="px-3 font-mono text-xs text-subtle">Owner admin</p>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 md:px-8">
            <div className="flex items-center gap-3 md:hidden">
              <span className="font-mono text-xs tracking-[0.28em] text-muted">WARE</span>
            </div>
            <div className="hidden text-sm text-muted md:block">
              Full admin of a phone you granted on the device
            </div>
            <div className="flex gap-2 md:hidden">
              {NAV.map(({ to, label }) => (
                <Link
                  key={to}
                  to={to}
                  className={`flex h-11 items-center rounded-sm px-3 text-sm ${
                    pathname === to ? "bg-elevated text-fg" : "text-muted"
                  }`}
                >
                  {label}
                </Link>
              ))}
            </div>
          </header>
          <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}

export function Dashboard() {
  const ready = useWare((s) => s.ready);
  const devices = useWare((s) => s.devices);
  const selectedId = useWare((s) => s.selectedId);
  const query = useWare((s) => s.query);
  const samples = useWare((s) => s.samples);
  const code = useWare((s) => s.code);
  const origin = useWare((s) => s.origin);
  const error = useWare((s) => s.error);
  const tab = useWare((s) => s.tab);
  const hydrate = useWare((s) => s.hydrate);
  const refresh = useWare((s) => s.refresh);
  const select = useWare((s) => s.select);
  const setQuery = useWare((s) => s.setQuery);
  const setTab = useWare((s) => s.setTab);
  const rotateCode = useWare((s) => s.rotateCode);
  const stopProcess = useWare((s) => s.stopProcess);
  const sendCommand = useWare((s) => s.sendCommand);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!ready) return;
    const id = window.setInterval(() => {
      void refresh();
    }, 2000);
    return () => window.clearInterval(id);
  }, [ready, refresh]);

  const device = devices.find((d) => d.id === selectedId) ?? devices[0];
  const processes = device?.processes ?? [];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = q
      ? processes.filter((p) => p.name.toLowerCase().includes(q) || String(p.pid).includes(q))
      : processes;
    return [...rows].sort((a, b) => b.cpu - a.cpu || b.memoryKB - a.memoryKB);
  }, [processes, query]);
  const cpuNow = samples.at(-1)?.cpu ?? 0;
  const rss = processes.reduce((s, p) => s + p.memoryKB, 0);

  return (
    <Shell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-medium tracking-tight text-fg md:text-3xl">Console</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            After you grant Shizuku on the phone and connect, this board is the admin surface for
            that handset: screen, apps, files, processes, logs, and shell.
          </p>
        </div>

        <section className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-surface p-5 shadow-[var(--shadow-panel)]">
            <p className="text-xs font-medium text-subtle">Pairing code</p>
            <div className="mt-2 flex items-center gap-3">
              <span className="font-mono text-2xl tracking-[0.2em] text-fg">{code || "······"}</span>
              <Button variant="ghost" size="icon" onClick={() => void copyText(code)} aria-label="Copy code">
                <Copy className="size-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => void rotateCode()} aria-label="Rotate pairing code">
                <RefreshCw className="size-4" />
              </Button>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-surface p-5 shadow-[var(--shadow-panel)]">
            <p className="text-xs font-medium text-subtle">Console address</p>
            <div className="mt-2 flex items-start gap-3">
              <p className="min-w-0 flex-1 break-all font-mono text-sm text-fg">{origin || "…"}</p>
              <Button variant="ghost" size="icon" onClick={() => void copyText(origin)} aria-label="Copy console address">
                <Copy className="size-4" />
              </Button>
            </div>
            <p className="mt-3 text-xs text-muted">Publish first so the phone can reach this address.</p>
          </div>
        </section>

        {error ? (
          <p className="rounded-lg border border-border bg-elevated px-4 py-3 text-sm text-danger">{error}</p>
        ) : null}

        {devices.length === 0 ? (
          <section className="rounded-xl border border-dashed border-border-strong bg-surface px-6 py-16 text-center">
            <p className="font-mono text-xs tracking-[0.2em] text-subtle">WAITING</p>
            <h2 className="mt-3 text-xl font-medium">No phone on this code yet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted">
              Install WARE, tap Grant access, then Connect. Keep the app open while you use this
              console.
            </p>
            <Button className="mt-6" asChild>
              <Link to="/apk">Get the APK</Link>
            </Button>
          </section>
        ) : (
          <>
            <section className="grid gap-3 sm:grid-cols-3">
              {devices.map((d) => {
                const active = d.id === device?.id;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => select(d.id)}
                    className={`rounded-xl border p-4 text-left transition-colors duration-150 ${
                      active ? "border-border-strong bg-surface" : "border-border bg-bg hover:bg-surface"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{d.name}</span>
                      {statusBadge(d.status)}
                    </div>
                    <p className="mt-2 font-mono text-xs text-muted">
                      {d.model} · Android {d.android}
                    </p>
                    <p className="mt-1 text-xs text-subtle">
                      {d.battery}% · {ago(d.lastSeen)}
                    </p>
                  </button>
                );
              })}
            </section>

            {device ? (
              <>
                <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-surface p-1">
                  {TABS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setTab(item.id)}
                      className={`h-10 rounded-md px-3 text-sm ${
                        tab === item.id ? "bg-elevated text-fg" : "text-muted hover:text-fg"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                {tab === "overview" ? (
                  <Overview device={device} cpuNow={cpuNow} rss={rss} samples={samples} />
                ) : null}
                {tab === "screen" ? <ScreenPanel device={device} sendCommand={sendCommand} /> : null}
                {tab === "apps" ? <AppsPanel device={device} sendCommand={sendCommand} /> : null}
                {tab === "files" ? <FilesPanel device={device} sendCommand={sendCommand} /> : null}
                {tab === "processes" ? (
                  <ProcessPanel
                    device={device}
                    filtered={filtered}
                    query={query}
                    setQuery={setQuery}
                    stopProcess={stopProcess}
                  />
                ) : null}
                {tab === "logs" ? <LogsPanel device={device} /> : null}
                {tab === "shell" ? <ShellPanel device={device} sendCommand={sendCommand} /> : null}
              </>
            ) : null}
          </>
        )}
      </div>
    </Shell>
  );
}

function Overview({
  device,
  cpuNow,
  rss,
  samples,
}: {
  device: Device;
  cpuNow: number;
  rss: number;
  samples: { t: number; cpu: number; mem: number }[];
}) {
  return (
    <>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Radio} label="Link" value={device.status === "online" ? "Admin" : "Waiting"} hint={device.model} />
        <Stat icon={Cpu} label="CPU" value={`${cpuNow.toFixed(0)}%`} hint="From this phone" />
        <Stat icon={HardDrive} label="RSS" value={fmtMem(rss)} hint={`${device.processes.length} tasks`} />
        <Stat icon={Activity} label="Seen" value={ago(device.lastSeen)} hint={device.info.ip} />
      </section>
      <section className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs font-medium text-subtle">Network</p>
          <p className="mt-2 font-mono text-sm whitespace-pre-wrap text-fg">{device.info.wifi || "—"}</p>
          <p className="mt-2 font-mono text-xs text-muted">{device.info.ip}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs font-medium text-subtle">Storage / battery</p>
          <p className="mt-2 font-mono text-sm whitespace-pre-wrap">{device.info.storage || "—"}</p>
          <p className="mt-2 font-mono text-xs text-muted">{device.info.battery || `${device.battery}%`}</p>
        </div>
      </section>
      <section className="rounded-xl border border-border bg-surface p-4 md:p-5">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-medium">Load</h2>
          <p className="font-mono text-xs text-subtle">{device.info.uptime}</p>
        </div>
        <div className="h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={samples} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="cpuFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="t" hide />
              <YAxis hide domain={[0, 100]} />
              <ReTooltip
                contentStyle={{
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  fontSize: 12,
                  color: "var(--color-fg)",
                }}
                labelStyle={{ display: "none" }}
                formatter={(v, name) => {
                  const n = typeof v === "number" ? v : Number(v);
                  return [`${n.toFixed(1)}%`, name === "cpu" ? "CPU" : "Mem"];
                }}
              />
              <Area type="monotone" dataKey="mem" stroke="var(--color-subtle)" fill="none" strokeWidth={1.25} isAnimationActive={false} />
              <Area type="monotone" dataKey="cpu" stroke="var(--color-accent)" fill="url(#cpuFill)" strokeWidth={1.5} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>
    </>
  );
}

function ScreenPanel({ device, sendCommand }: { device: Device; sendCommand: (a: string) => Promise<void> }) {
  return (
    <section className="rounded-xl border border-border bg-surface p-4 md:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Monitor className="size-4 text-subtle" />
          <h2 className="text-sm font-medium">Live screen</h2>
        </div>
        <Button variant="secondary" onClick={() => void sendCommand("screenshot")}>
          Capture now
        </Button>
      </div>
      {device.screenshot ? (
        <img
          alt={`Screen of ${device.name}`}
          src={`data:image/jpeg;base64,${device.screenshot}`}
          className="mx-auto max-h-[70vh] w-auto max-w-full rounded-lg border border-border"
        />
      ) : (
        <p className="py-16 text-center text-sm text-muted">
          Waiting for a frame. Keep WARE open on the phone.
        </p>
      )}
    </section>
  );
}

function AppsPanel({
  device,
  sendCommand,
}: {
  device: Device;
  sendCommand: (a: string, arg?: string) => Promise<void>;
}) {
  const [q, setQ] = useState("");
  const rows = device.apps.filter((a) => a.pkg.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <AppWindow className="size-4 text-subtle" />
          <h2 className="text-sm font-medium">{rows.length} packages</h2>
        </div>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter packages" className="md:w-72" />
      </div>
      <Separator />
      <div className="max-h-[480px] overflow-auto">
        <table className="w-full text-left text-sm">
          <tbody>
            {rows.map((app) => (
              <tr key={app.pkg} className="border-b border-border/80">
                <td className="px-5 py-3 font-mono text-xs">{app.pkg}</td>
                <td className="px-3 py-3 text-xs text-subtle">{app.kind}</td>
                <td className="px-4 py-3 text-right">
                  <Button variant="ghost" size="sm" onClick={() => void sendCommand("forcestop", app.pkg)}>
                    Stop
                  </Button>
                  {app.kind !== "system" ? (
                    <Button variant="ghost" size="sm" onClick={() => void sendCommand("uninstall", app.pkg)}>
                      Uninstall
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FilesPanel({
  device,
  sendCommand,
}: {
  device: Device;
  sendCommand: (a: string, arg?: string) => Promise<void>;
}) {
  const [path, setPath] = useState(device.fileCwd || "/sdcard");
  useEffect(() => {
    setPath(device.fileCwd || "/sdcard");
  }, [device.fileCwd]);
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
        <Folder className="size-4 shrink-0 text-subtle" />
        <Input value={path} onChange={(e) => setPath(e.target.value)} aria-label="Path" />
        <Button onClick={() => void sendCommand("files", path)}>Open</Button>
      </div>
      <Separator />
      <div className="max-h-[480px] overflow-auto">
        <table className="w-full text-left text-sm">
          <tbody>
            <tr>
              <td className="px-5 py-3">
                <button
                  type="button"
                  className="font-mono text-xs text-muted"
                  onClick={() => {
                    const parent = path.replace(/\/+$/, "").split("/").slice(0, -1).join("/") || "/";
                    setPath(parent);
                    void sendCommand("files", parent);
                  }}
                >
                  ../
                </button>
              </td>
            </tr>
            {device.files.map((f) => (
              <tr key={f.name} className="border-b border-border/80">
                <td className="px-5 py-3">
                  <button
                    type="button"
                    className="font-mono text-xs"
                    onClick={() => {
                      const next = `${path.replace(/\/+$/, "")}/${f.name}`;
                      if (f.dir) {
                        setPath(next);
                        void sendCommand("files", next);
                      } else {
                        void sendCommand("read", next);
                      }
                    }}
                  >
                    {f.dir ? `${f.name}/` : f.name}
                  </button>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-subtle">
                  {f.dir ? "dir" : fmtMem(f.size / 1024)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ProcessPanel({
  device,
  filtered,
  query,
  setQuery,
  stopProcess,
}: {
  device: Device;
  filtered: Device["processes"];
  query: string;
  setQuery: (q: string) => void;
  stopProcess: (pid: number) => Promise<void>;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between md:p-5">
        <div>
          <h2 className="text-sm font-medium">Processes</h2>
          <p className="text-xs text-subtle">
            {filtered.length} from {device.name}
          </p>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by name or pid"
            className="pl-9"
            aria-label="Filter processes"
          />
        </div>
      </div>
      <Separator />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-xs text-subtle">
            <tr className="border-b border-border">
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-3 py-3 font-medium">PID</th>
              <th className="px-3 py-3 font-medium">User</th>
              <th className="px-3 py-3 font-medium">CPU</th>
              <th className="px-3 py-3 font-medium">RSS</th>
              <th className="px-5 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.pid} className="border-b border-border/80 last:border-0">
                <td className="max-w-[220px] truncate px-5 py-3 font-mono text-xs">{p.name}</td>
                <td className="px-3 py-3 font-mono text-xs tabular-nums text-muted">{p.pid}</td>
                <td className="px-3 py-3 font-mono text-xs text-muted">{p.user}</td>
                <td className="px-3 py-3 font-mono text-xs tabular-nums">{p.cpu.toFixed(1)}%</td>
                <td className="px-3 py-3 font-mono text-xs tabular-nums text-muted">{fmtMem(p.memoryKB)}</td>
                <td className="px-5 py-3 text-right">
                  {p.user.startsWith("u0_") ? (
                    <Button variant="ghost" size="sm" onClick={() => void stopProcess(p.pid)} aria-label={`Stop ${p.name}`}>
                      <Square className="size-3.5" />
                      Stop
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function LogsPanel({ device }: { device: Device }) {
  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-center gap-2">
        <ScrollText className="size-4 text-subtle" />
        <h2 className="text-sm font-medium">logcat</h2>
      </div>
      <pre className="max-h-[540px] overflow-auto whitespace-pre-wrap font-mono text-xs text-muted">
        {device.logs || "Waiting for logcat from the phone."}
      </pre>
    </section>
  );
}

function ShellPanel({
  device,
  sendCommand,
}: {
  device: Device;
  sendCommand: (a: string, arg?: string) => Promise<void>;
}) {
  const [cmd, setCmd] = useState("");
  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-center gap-2">
        <Terminal className="size-4 text-subtle" />
        <h2 className="text-sm font-medium">Shell</h2>
      </div>
      <form
        className="flex flex-col gap-2 md:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (!cmd.trim()) return;
          void sendCommand("shell", cmd.trim());
          setCmd("");
        }}
      >
        <Input
          value={cmd}
          onChange={(e) => setCmd(e.target.value)}
          placeholder="dumpsys activity activities | head"
          aria-label="Shell command"
        />
        <Button type="submit">Run</Button>
      </form>
      <pre className="mt-4 max-h-[480px] overflow-auto whitespace-pre-wrap font-mono text-xs text-muted">
        {device.shellOut || "Output from the phone appears here after the next sample."}
      </pre>
    </section>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Cpu;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center gap-2 text-subtle">
        <Icon className="size-4" strokeWidth={1.75} />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="mt-3 font-mono text-2xl tabular-nums tracking-tight text-fg">{value}</p>
      <p className="mt-1 text-xs text-subtle">{hint}</p>
    </div>
  );
}
