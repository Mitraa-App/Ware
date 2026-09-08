import { create } from "zustand";
import { fetchFleet, issuePairingCode, requestCommand, requestStop } from "./api";
import type { ConsoleTab, Device, Sample } from "./types";

const CODE_KEY = "ware.pair.code";

type WareState = {
  ready: boolean;
  code: string;
  origin: string;
  devices: Device[];
  selectedId: string;
  query: string;
  tab: ConsoleTab;
  samples: Sample[];
  error: string;
  hydrate: () => Promise<void>;
  rotateCode: () => Promise<void>;
  refresh: () => Promise<void>;
  select: (id: string) => void;
  setQuery: (q: string) => void;
  setTab: (tab: ConsoleTab) => void;
  stopProcess: (pid: number) => Promise<void>;
  sendCommand: (action: string, arg?: string, pid?: number) => Promise<void>;
};

function readStoredCode() {
  try {
    return localStorage.getItem(CODE_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeStoredCode(code: string) {
  try {
    localStorage.setItem(CODE_KEY, code);
  } catch {
    /* ignore */
  }
}

export const useWare = create<WareState>((set, get) => ({
  ready: false,
  code: "",
  origin: "",
  devices: [],
  selectedId: "",
  query: "",
  tab: "overview",
  samples: [],
  error: "",
  select: (id) => set({ selectedId: id }),
  setQuery: (query) => set({ query }),
  setTab: (tab) => set({ tab }),
  hydrate: async () => {
    const origin = window.location.origin;
    let code = readStoredCode();
    try {
      if (!code) {
        const issued = await issuePairingCode();
        code = issued.code;
        writeStoredCode(code);
      }
      set({ origin, code, ready: true, error: "" });
      await get().refresh();
    } catch (err) {
      set({
        origin,
        ready: true,
        error: err instanceof Error ? err.message : "Could not start pairing",
      });
    }
  },
  rotateCode: async () => {
    try {
      const issued = await issuePairingCode();
      writeStoredCode(issued.code);
      set({ code: issued.code, devices: [], selectedId: "", samples: [], error: "" });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Could not rotate code" });
    }
  },
  refresh: async () => {
    const { code } = get();
    if (!code) return;
    try {
      const { devices } = await fetchFleet({ data: { code } });
      const selectedId =
        devices.some((d) => d.id === get().selectedId) ? get().selectedId : (devices[0]?.id ?? "");
      const active = devices.find((d) => d.id === selectedId);
      const cpu =
        active && active.processes.length
          ? Math.min(
              100,
              (active.processes.reduce((s, p) => s + Math.min(p.cpu, 40), 0) /
                Math.max(active.processes.length, 1)) *
                2.2,
            )
          : 0;
      const mem = active
        ? Math.min(96, (active.processes.reduce((s, p) => s + p.memoryKB, 0) / (1024 * 1024)) * 14)
        : 0;
      const samples = [
        ...get().samples.slice(-23),
        { t: (get().samples.at(-1)?.t ?? 0) + 1, cpu, mem },
      ];
      set({ devices, selectedId, samples, error: "" });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Could not read devices" });
    }
  },
  stopProcess: async (pid) => {
    const { code, selectedId } = get();
    if (!code || !selectedId) return;
    try {
      await requestStop({ data: { code, deviceId: selectedId, pid } });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Stop did not reach the phone" });
    }
  },
  sendCommand: async (action, arg, pid) => {
    const { code, selectedId } = get();
    if (!code || !selectedId) return;
    try {
      await requestCommand({ data: { code, deviceId: selectedId, action, arg, pid } });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Command did not reach the phone" });
    }
  },
}));
