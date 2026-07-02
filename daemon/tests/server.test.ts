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
