// Fastify server setup for the FieldFix daemon.
//
// Phase 0 TODO:
// - POST /test-completion: forward a prompt to LiteLLM Proxy
//   (LITELLM_PROXY_URL from .env) and return the response
//
// Phase 1 TODO:
// - GET /pair: return a QR code for pairing
// - POST /webhook/github: accept GitHub Actions webhook payloads
// - Serve the PWA from a static directory
// - WebSocket endpoint for ALERT_NOTIFY / FIX_PROPOSAL etc,
//   per shared/protocol.md

import Fastify from "fastify";

const LITELLM_URL = process.env.LITELLM_PROXY_URL ?? "http://localhost:4000";

export function buildServer() {
  const app = Fastify({ logger: true });

  app.get("/health", async () => ({ status: "ok" }));

  app.post<{ Body: { prompt: string; model?: string } }>(
    "/test-completion",
    async (req, reply) => {
      const { prompt, model = "local-fast" } = req.body;

      const res = await fetch(`${LITELLM_URL}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (!res.ok) {
        reply.status(502);
        return { error: `LiteLLM proxy returned ${res.status}` };
      }

      const data = await res.json();
      return { response: (data as any).choices[0].message.content };
    }
  );

  // Phase 1 TODO:
  // - GET /pair: return a QR code for pairing
  // - POST /webhook/github: accept GitHub Actions webhook payloads
  // - Serve the PWA from a static directory
  // - WebSocket endpoint for ALERT_NOTIFY / FIX_PROPOSAL etc,
  //   per shared/protocol.md

  return app;
}
