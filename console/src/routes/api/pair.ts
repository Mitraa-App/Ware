import { createFileRoute } from "@tanstack/react-router";
import { issueCode } from "@/lib/ware/fleet.server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const Route = createFileRoute("/api/pair")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async () => {
        try {
          const code = await issueCode();
          return Response.json({ code }, { headers: CORS });
        } catch (err) {
          return Response.json(
            { error: err instanceof Error ? err.message : "Could not issue code" },
            { status: 500, headers: CORS },
          );
        }
      },
    },
  },
});
