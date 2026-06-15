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

export function buildServer() {
  const app = Fastify({ logger: true });

  app.get("/health", async () => ({ status: "ok" }));

  // TODO: implement remaining routes per docs/ROADMAP.md

  return app;
}
