import Fastify from "fastify";
import websocket from "@fastify/websocket";
import QRCode from "qrcode";
import { PairingRegistry } from "./pairing/index.js";
import { AlertStore, parseWorkflowRunPayload } from "./webhooks/github.js";
import { SyncSession, type Socket } from "./sync/ws.js";
import { applyTestAndPush } from "./diff/index.js";
import { DiffStore } from "./diffs/index.js";
import { runCommand } from "./verify/index.js";

const LITELLM_URL = process.env.LITELLM_PROXY_URL ?? "http://localhost:4000";

// ponytail: dashboard is an inline template — no static-file plugin, no extra dep
const DASHBOARD = `<!doctype html><html lang="en">
<head><meta charset="utf-8"><title>FieldFix</title>
<style>
body{font-family:monospace;padding:1rem;max-width:960px;margin:0 auto}
nav a{margin-right:1rem}
.card{border:1px solid #ccc;border-radius:4px;padding:.75rem;margin:.75rem 0}
.card.passed{border-color:#2a2}.card.failed{border-color:#a22}.card.applying{border-color:#aa2}.card.rejected{opacity:.5}
pre{background:#f5f5f5;padding:.5rem;overflow-x:auto;white-space:pre-wrap;max-height:260px;font-size:.8rem}
button{padding:.25rem .75rem;margin-right:.5rem;cursor:pointer}
summary{cursor:pointer}
</style></head>
<body>
<h2>FieldFix</h2>
<nav><a href="/pair">Pair phone</a><a href="/health">Health</a></nav>
<p id="ts" style="color:#888;font-size:.8rem"></p>
<div id="root"></div>
<script>
const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
async function load(){
  const ds=await fetch('/diffs').then(r=>r.json()).catch(()=>[]);
  document.getElementById('ts').textContent=ds.length+' diff(s) · '+new Date().toLocaleTimeString();
  document.getElementById('root').innerHTML=ds.length===0?'<p>No diffs yet.</p>':ds.map(d=>\`
    <div class="card \${d.status}">
      <b>\${esc(d.file)}</b>
      <span style="float:right;color:#888">\${d.status} · \${d.generated_by} · \${new Date(d.created_at).toLocaleTimeString()}</span>
      <pre>\${esc(d.diff)}</pre>
      \${d.explanation?'<p>'+esc(d.explanation)+'</p>':''}
      \${d.test_output?'<details><summary>Test output</summary><pre>'+esc(d.test_output)+'</pre></details>':''}
      \${d.status==='pending'
        ?'<button onclick="act(\''+d.id+'\',\'approve\')">Approve</button><button onclick="act(\''+d.id+'\',\'reject\')">Reject</button>'
        :d.branch?'<small>Branch: '+esc(d.branch)+'</small>':''}
    </div>\`).join('');
}
async function act(id,a){await fetch('/diffs/'+id+'/'+a,{method:'POST'});load();}
setInterval(load,3000);load();
</script></body></html>`;

export function buildServer() {
  const app = Fastify({ logger: true });
  void app.register(websocket);

  const pairing = new PairingRegistry();
  const alerts  = new AlertStore();
  const sync    = new SyncSession();
  const diffs   = new DiffStore();

  // --- Protocol handlers (see shared/protocol.md) ---

  sync.on("PAIR_REQUEST", (msg, socket) => {
    const device = pairing.confirm(msg.token as string, (msg.device_name as string) ?? "unknown");
    if (!device) { sync.send(socket, { type: "ERROR", detail: "invalid or expired token" }); return; }
    sync.send(socket, { type: "PAIR_CONFIRM", session_id: device.session_id, repo_name: process.env.REPO_NAME ?? "sample-todo-app" });
  });

  sync.on("FIX_APPROVAL", async (msg) => {
    const alert    = alerts.get(msg.alert_id as string);
    const repoPath = process.env.REPO_PATH ?? "";
    const testCmd  = process.env.TEST_COMMAND ?? "npm test";
    if (!alert || !repoPath) return;

    const entry = diffs.add({ alert_id: alert.id, file: (msg.file as string) ?? "", diff: msg.diff as string, explanation: "", generated_by: "on_device" });
    diffs.update(entry.id, { status: "applying" });

    const r = await applyTestAndPush(repoPath, alert.id, msg.diff as string, testCmd);
    diffs.update(entry.id, { status: r.passed ? "passed" : "failed", test_output: r.test_output, branch: r.branch });

    sync.broadcast({ type: "TEST_RESULT", alert_id: alert.id, passed: r.passed, output: r.test_output });
    if (r.pushed) sync.broadcast({ type: "PUSH_CONFIRM", alert_id: alert.id, branch: r.branch, commit_sha: "" });
  });

  sync.on("FIX_REJECTION", (msg) => {
    alerts.remove(msg.alert_id as string);
    diffs.findPending(msg.alert_id as string)?.id && diffs.update(diffs.findPending(msg.alert_id as string)!.id, { status: "rejected" });
  });

  // --- Routes ---

  app.get("/health", async () => ({ status: "ok" }));

  app.get("/", async (_req, reply) => { reply.type("text/html"); return DASHBOARD; });

  // Phase 0: LiteLLM round-trip
  app.post<{ Body: { prompt: string; model?: string } }>("/test-completion", async (req, reply) => {
    const { prompt, model = "local-fast" } = req.body;
    const res = await fetch(`${LITELLM_URL}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }] }),
    });
    if (!res.ok) { reply.status(502); return { error: `LiteLLM proxy returned ${res.status}` }; }
    return { response: ((await res.json()) as any).choices[0].message.content };
  });

  // Phase 1: QR pairing page
  app.get("/pair", async (req, reply) => {
    const token = pairing.generateToken();
    const host  = req.headers.host ?? `localhost:${process.env.PAIRING_PORT ?? 7890}`;
    const qr    = await QRCode.toDataURL(`http://${host}/?token=${token}`);
    reply.type("text/html");
    return `<!doctype html><html><body style="text-align:center;font-family:sans-serif;padding:2rem">
      <h2>FieldFix</h2><p>Scan with your phone to pair</p>
      <img src="${qr}" style="width:280px;height:280px" alt="QR code"/>
      <p style="color:#888;font-size:.85rem">Token expires in 5 minutes</p></body></html>`;
  });

  // Phase 1: receive a diff proposal (phone REST path; WebSocket path above)
  app.post<{ Body: { alert_id?: string; file: string; diff: string; explanation?: string; generated_by?: "daemon" | "on_device" } }>(
    "/diffs", async (req) => {
      const { alert_id = "", file, diff, explanation = "", generated_by = "on_device" } = req.body;
      const e = diffs.add({ alert_id, file, diff, explanation, generated_by });
      return { id: e.id, status: e.status };
    }
  );

  app.get("/diffs", async () => diffs.list());

  // Dashboard approve: apply diff, run tests, push branch on pass
  app.post<{ Params: { id: string } }>("/diffs/:id/approve", async (req, reply) => {
    const entry    = diffs.get(req.params.id);
    const repoPath = process.env.REPO_PATH ?? "";
    const testCmd  = process.env.TEST_COMMAND ?? "npm test";
    if (!entry)     { reply.status(404); return { error: "diff not found" }; }
    if (entry.status !== "pending") { reply.status(409); return { error: `already ${entry.status}` }; }
    if (!repoPath)  { reply.status(500); return { error: "REPO_PATH not configured" }; }

    diffs.update(entry.id, { status: "applying" });
    const r = await applyTestAndPush(repoPath, entry.alert_id || entry.id, entry.diff, testCmd);
    diffs.update(entry.id, { status: r.passed ? "passed" : "failed", test_output: r.test_output, branch: r.branch });

    if (r.pushed) sync.broadcast({ type: "PUSH_CONFIRM", alert_id: entry.alert_id, branch: r.branch, commit_sha: "" });
    return diffs.get(entry.id);
  });

  app.post<{ Params: { id: string } }>("/diffs/:id/reject", async (req, reply) => {
    const entry = diffs.get(req.params.id);
    if (!entry) { reply.status(404); return { error: "diff not found" }; }
    diffs.update(entry.id, { status: "rejected" });
    return { id: entry.id, status: "rejected" };
  });

  // Phase 1: overflow verification — run any command against the real repo
  app.post<{ Body: { command: string } }>("/verify", async (req, reply) => {
    const repoPath = process.env.REPO_PATH ?? "";
    if (!repoPath) { reply.status(500); return { error: "REPO_PATH not configured" }; }
    return runCommand(req.body.command, repoPath);
  });

  // Phase 1: GitHub Actions webhook
  app.post("/webhook/github", async (req, reply) => {
    if (req.headers["x-github-event"] !== "workflow_run") { reply.status(204); return; }
    const alert = parseWorkflowRunPayload(req.body);
    if (!alert) { reply.status(204); return; }
    alerts.add(alert);
    sync.broadcast({ type: "ALERT_NOTIFY", alert_id: alert.id, source: alert.source, summary: `Tests failed: ${alert.workflow} on ${alert.branch}`, raw_log_excerpt: alert.raw_log_excerpt, candidate_files: alert.candidate_files });
    return { received: alert.id };
  });

  // Phase 1: WebSocket (colleague's sync layer hooks in here)
  app.get("/ws", { websocket: true }, (socket: any) => { sync.add(socket as Socket); });

  return app;
}
