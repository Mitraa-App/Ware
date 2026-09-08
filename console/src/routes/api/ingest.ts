import { createFileRoute } from "@tanstack/react-router";
import {
  codeExists,
  normalizeCode,
  parseApps,
  parseFiles,
  parseInfo,
  parseProcesses,
  upsertDevice,
} from "@/lib/ware/fleet.server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: CORS });
}

export const Route = createFileRoute("/api/ingest")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        let payload: Record<string, unknown>;
        try {
          payload = (await request.json()) as Record<string, unknown>;
        } catch {
          return json({ error: "Expected JSON" }, 400);
        }
        let code: string;
        try {
          code = normalizeCode(payload.code);
        } catch (err) {
          return json({ error: err instanceof Error ? err.message : "Bad code" }, 400);
        }
        if (!(await codeExists(code))) {
          return json({ error: "Unknown pairing code. Rotate or copy it from the console." }, 403);
        }
        const device = (payload.device ?? payload) as Record<string, unknown>;
        try {
          const result = await upsertDevice({
            code,
            id: String(device.id ?? payload.id ?? ""),
            name: String(device.name ?? "Phone"),
            model: String(device.model ?? "Android"),
            android: String(device.android ?? "?"),
            battery: Number(device.battery ?? 0),
            processes: parseProcesses(payload.processes),
            apps: parseApps(payload.apps),
            files: parseFiles(payload.files),
            fileCwd: typeof payload.fileCwd === "string" ? payload.fileCwd : undefined,
            logs: typeof payload.logs === "string" ? payload.logs : undefined,
            shellOut: typeof payload.shellOut === "string" ? payload.shellOut : undefined,
            screenshot: typeof payload.screenshot === "string" ? payload.screenshot : undefined,
            info: payload.info ? parseInfo(payload.info) : undefined,
          });
          return json({ ok: true, commands: result.commands });
        } catch (err) {
          return json({ error: err instanceof Error ? err.message : "Ingest failed" }, 400);
        }
      },
    },
  },
});
