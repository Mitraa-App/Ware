import { createFileRoute } from "@tanstack/react-router";
import { codeExists, listDevices, normalizeCode } from "@/lib/ware/fleet.server";

const CORS = { "Access-Control-Allow-Origin": "*" };

export const Route = createFileRoute("/api/fleet")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        let code: string;
        try {
          code = normalizeCode(url.searchParams.get("code") ?? "");
        } catch (err) {
          return Response.json(
            { error: err instanceof Error ? err.message : "Bad code" },
            { status: 400, headers: CORS },
          );
        }
        if (!(await codeExists(code))) {
          return Response.json({ devices: [] }, { headers: CORS });
        }
        return Response.json({ devices: await listDevices(code) }, { headers: CORS });
      },
    },
  },
});
