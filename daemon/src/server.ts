import Fastify from "fastify";
import websocket from "@fastify/websocket";
import QRCode from "qrcode";
import { PairingRegistry } from "./pairing/index.js";
import { AlertStore, parseWorkflowRunPayload } from "./webhooks/github.js";
import { SyncSession, type Socket } from "./sync/ws.js";
import { applyInWorktree } from "./diff/index.js";

const LITELLM_URL = process.env.LITELLM_PROXY_URL ?? "http://localhost:4000";

export function buildServer() {
  const app = Fastify({ logger: true });
  void app.register(websocket);

  const pairing = new PairingRegistry();
  const alerts = new AlertStore();
  const sync = new SyncSession();

  // --- Protocol message handlers (shared/protocol.md) ---

  sync.on("PAIR_REQUEST", (msg, socket) => {
    const device = pairing.confirm(
      msg.token as string,
      (msg.device_name as string) ?? "unknown"
    );
    if (!device) {
      sync.send(socket, { type: "ERROR", detail: "invalid or expired token" });
      return;
    }
    sync.send(socket, {
      type: "PAIR_CONFIRM",
      session_id: device.session_id,
      repo_name: process.env.REPO_NAME ?? "sample-todo-app",
    });
  });

  sync.on("FIX_APPROVAL", async (msg) => {
    const alert = alerts.get(msg.alert_id as string);
    if (!alert) return;

    const repoPath = process.env.REPO_PATH ?? "";
    if (!repoPath) {
      app.log.warn("REPO_PATH not set - cannot apply fix");
      return;
    }

    const result = await applyInWorktree(repoPath, alert.id, msg.diff as string);
    sync.broadcast({
      type: "TEST_RESULT",
      alert_id: alert.id,
      passed: result.success,
      output: result.output,
    });

    if (result.success) {
      // TODO Phase 1: run targeted test in result.worktreePath, then push
      // branch on pass and send PUSH_CONFIRM.
      app.log.info({ branch: result.branch }, "diff applied - test runner not yet wired");
    }
  });

  sync.on("FIX_REJECTION", (msg) => {
    alerts.remove(msg.alert_id as string);
  });

  // --- Routes ---

  app.get("/health", async () => ({ status: "ok" }));

  // Phase 0: round-trip a prompt through LiteLLM
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

  // Phase 1: QR code for phone pairing
  app.get("/pair", async (req, reply) => {
    const token = pairing.generateToken();
    const host = req.headers.host ?? `localhost:${process.env.PAIRING_PORT ?? 7890}`;
    const pairUrl = `http://${host}/?token=${token}`;
    const qr = await QRCode.toDataURL(pairUrl);
    reply.type("text/html");
    return `<!doctype html><html><body style="text-align:center;font-family:sans-serif;padding:2rem">
      <h2>FieldFix</h2>
      <p>Scan with your phone to pair</p>
      <img src="${qr}" style="width:280px;height:280px" alt="QR code"/>
      <p style="color:#888;font-size:.85rem">Token expires in 5 minutes</p>
    </body></html>`;
  });

  // Phase 1: GitHub Actions workflow_run webhook
  app.post("/webhook/github", async (req, reply) => {
    if (req.headers["x-github-event"] !== "workflow_run") {
      reply.status(204);
      return;
    }
    const alert = parseWorkflowRunPayload(req.body);
    if (!alert) {
      reply.status(204);
      return;
    }
    alerts.add(alert);
    sync.broadcast({
      type: "ALERT_NOTIFY",
      alert_id: alert.id,
      source: alert.source,
      summary: `Tests failed: ${alert.workflow} on ${alert.branch}`,
      raw_log_excerpt: alert.raw_log_excerpt,
      candidate_files: alert.candidate_files,
    });
    return { received: alert.id };
  });

  // Phase 1: WebSocket channel for phone <-> daemon protocol messages
  app.get("/ws", { websocket: true }, (socket: any) => {
    sync.add(socket as Socket);
  });

  return app;
}
