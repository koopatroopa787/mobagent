// Integration tests for the FieldFix daemon.
// Uses Fastify's built-in inject() — no real server starts, no ports needed.
// Run: npm test (from daemon/)

import { test } from "node:test";
import assert from "node:assert/strict";
import { buildServer } from "../src/server.js";

test("GET /health returns ok", async () => {
  const app = buildServer();
  const res = await app.inject({ method: "GET", url: "/health" });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(JSON.parse(res.body), { status: "ok" });
  await app.close();
});

test("GET / serves dashboard HTML", async () => {
  const app = buildServer();
  const res = await app.inject({ method: "GET", url: "/" });
  assert.equal(res.statusCode, 200);
  assert.ok(res.headers["content-type"]?.includes("text/html"));
  assert.ok(res.body.includes("FieldFix"));
  await app.close();
});

test("POST /diffs stores diff and GET /diffs lists it", async () => {
  const app = buildServer();
  const payload = { file: "src/todo.py", diff: "--- a/src/todo.py\n+++ b/src/todo.py\n", generated_by: "on_device" };

  const post = await app.inject({ method: "POST", url: "/diffs", payload });
  assert.equal(post.statusCode, 200);
  const { id, status } = JSON.parse(post.body);
  assert.equal(status, "pending");

  const list = JSON.parse((await app.inject({ method: "GET", url: "/diffs" })).body) as any[];
  assert.ok(list.some(d => d.id === id), "stored diff should appear in list");
  await app.close();
});

test("POST /diffs/:id/reject marks diff rejected", async () => {
  const app = buildServer();
  const { id } = JSON.parse(
    (await app.inject({ method: "POST", url: "/diffs", payload: { file: "x.ts", diff: "d", generated_by: "daemon" } })).body
  );
  const res = await app.inject({ method: "POST", url: `/diffs/${id}/reject` });
  assert.equal(res.statusCode, 200);
  assert.equal(JSON.parse(res.body).status, "rejected");
  await app.close();
});

test("POST /diffs/:id/approve returns 409 when already applied", async () => {
  const app = buildServer();
  const { id } = JSON.parse(
    (await app.inject({ method: "POST", url: "/diffs", payload: { file: "f.py", diff: "d", generated_by: "on_device" } })).body
  );
  // Reject first so status != pending
  await app.inject({ method: "POST", url: `/diffs/${id}/reject` });
  const res = await app.inject({ method: "POST", url: `/diffs/${id}/approve` });
  assert.equal(res.statusCode, 409);
  await app.close();
});

test("POST /verify returns 500 when REPO_PATH not configured", async () => {
  const app = buildServer();
  const saved = process.env.REPO_PATH;
  delete process.env.REPO_PATH;
  const res = await app.inject({ method: "POST", url: "/verify", payload: { command: "echo hi" } });
  assert.equal(res.statusCode, 500);
  process.env.REPO_PATH = saved;
  await app.close();
});

test("POST /diffs/:id/approve returns 404 for unknown id", async () => {
  const app = buildServer();
  const res = await app.inject({ method: "POST", url: "/diffs/does-not-exist/approve" });
  assert.equal(res.statusCode, 404);
  await app.close();
});

// --- Webhook + alert route tests ---

const FAIL_PAYLOAD = {
  action: "completed",
  workflow_run: {
    id: 12345,
    name: "CI",
    head_branch: "main",
    conclusion: "failure",
    jobs_url: "https://api.github.com/repos/test/repo/actions/runs/12345/jobs",
    repository: { full_name: "test/repo" },
    head_commit: { message: "fix: test" },
  },
};

test("GET /alerts returns empty array initially", async () => {
  const app = buildServer();
  const res = await app.inject({ method: "GET", url: "/alerts" });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(JSON.parse(res.body), []);
  await app.close();
});

test("POST /webhook/github ignores non-workflow_run events with 204", async () => {
  const app = buildServer();
  const res = await app.inject({
    method: "POST", url: "/webhook/github",
    headers: { "x-github-event": "push" },
    payload: {},
  });
  assert.equal(res.statusCode, 204);
  await app.close();
});

test("POST /webhook/github stores alert for failed workflow run", async () => {
  const app = buildServer();
  const res = await app.inject({
    method: "POST", url: "/webhook/github",
    headers: { "x-github-event": "workflow_run" },
    payload: FAIL_PAYLOAD,
  });
  assert.equal(res.statusCode, 200);
  const { received } = JSON.parse(res.body);
  assert.ok(received, "should return alert id");

  const alerts = JSON.parse(
    (await app.inject({ method: "GET", url: "/alerts" })).body
  ) as any[];
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].workflow, "CI");
  assert.equal(alerts[0].branch, "main");
  await app.close();
});

test("POST /webhook/github returns 401 when signature is invalid", async () => {
  const app = buildServer();
  const saved = process.env.GITHUB_WEBHOOK_SECRET;
  process.env.GITHUB_WEBHOOK_SECRET = "mysecret";
  const res = await app.inject({
    method: "POST", url: "/webhook/github",
    headers: {
      "x-github-event": "workflow_run",
      "x-hub-signature-256": "sha256=0000000000000000000000000000000000000000000000000000000000000000",
    },
    payload: FAIL_PAYLOAD,
  });
  assert.equal(res.statusCode, 401);
  if (saved !== undefined) process.env.GITHUB_WEBHOOK_SECRET = saved;
  else delete process.env.GITHUB_WEBHOOK_SECRET;
  await app.close();
});
