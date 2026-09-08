import { createServerFn } from "@tanstack/react-start";
import { codeExists, enqueueCommand, issueCode, listDevices, normalizeCode } from "./fleet.server";

export const issuePairingCode = createServerFn({ method: "POST" }).handler(async () => {
  const code = await issueCode();
  return { code };
});

export const fetchFleet = createServerFn({ method: "GET" })
  .validator((data: { code: string }) => ({ code: normalizeCode(data.code) }))
  .handler(async ({ data }) => {
    if (!(await codeExists(data.code))) return { devices: [] };
    return { devices: await listDevices(data.code) };
  });

export const requestStop = createServerFn({ method: "POST" })
  .validator((data: { code: string; deviceId: string; pid: number }) => ({
    code: normalizeCode(data.code),
    deviceId: String(data.deviceId ?? "").slice(0, 64),
    pid: Number(data.pid),
  }))
  .handler(async ({ data }) => {
    await enqueueCommand(data.code, data.deviceId, "stop", data.pid);
    return { ok: true as const };
  });

export const requestCommand = createServerFn({ method: "POST" })
  .validator((data: { code: string; deviceId: string; action: string; pid?: number; arg?: string }) => ({
    code: normalizeCode(data.code),
    deviceId: String(data.deviceId ?? "").slice(0, 64),
    action: String(data.action ?? "").slice(0, 32),
    pid: data.pid === undefined ? undefined : Number(data.pid),
    arg: data.arg === undefined ? undefined : String(data.arg).slice(0, 2000),
  }))
  .handler(async ({ data }) => {
    await enqueueCommand(data.code, data.deviceId, data.action, data.pid, data.arg);
    return { ok: true as const };
  });
