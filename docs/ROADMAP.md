# Roadmap

Each phase should produce something runnable end to end. Do not move
to the next phase until the current one's definition of done is met.

## Phase 0: Daemon Foundation

Goal: a Node/TS server that runs locally and can talk to an LLM.

- Set up daemon/ as a Fastify + TypeScript project
- Stand up LiteLLM Proxy as a sidecar
  (daemon/src/litellm/config.yaml), configured with Ollama only to
  start
- Daemon endpoint: POST /test-completion -> forwards to LiteLLM,
  returns the model's response
- Verify: curl the endpoint, get a real response from local Ollama

Definition of done: daemon can round-trip a prompt to Ollama via
LiteLLM and return a response over HTTP.

## Phase 1: Core Loop, Cloud/Local Only, PWA

Goal: the full approve-and-apply loop works, using a PWA and cloud or
local models only (no on-device AI yet).

- QR pairing: daemon generates a QR code with its local IP and a
  one-time token; PWA reads this on first load
- Webhook ingestion: accept a GitHub Actions workflow_run webhook for
  a single test repo (test-codebases/sample-todo-app)
- Agent loop: on a failed test, send the test output plus a small set
  of candidate files to the LLM router, get back a single-file diff
  proposal
- PWA approval screen: show the diff, approve/reject buttons
- On approval: daemon applies the diff in a git worktree, re-runs the
  specific failing test, reports pass/fail
- On test pass: daemon pushes the change to a new branch

Definition of done: break a test in sample-todo-app, push to GitHub,
get notified on the PWA, approve a fix, see it pass and land on a
branch - without touching the laptop's terminal.

## Phase 2: On-Device Tier (Native Mobile)

Goal: add the LiteRT-LM + Gemma 4 E2B on-device tier via a native
Flutter app, replacing the PWA.

- Spike first: validate the current community Flutter binding for
  LiteRT-LM against the Gemma 4 E2B model before committing the rest
  of the phase to it (see docs/CHALLENGES.md)
- Flutter app shell with the same approval UI as the PWA
- Implement the triage step: on-device Gemma 4 classifies incoming
  alerts as simple or complex
- For "simple" alerts, generate the fix on-device and skip the
  daemon's agent loop entirely
- For "complex" alerts, fall back to the Phase 1 flow

Definition of done: a simple, single-line fix (for example, a wrong
comparison operator) is generated and approved entirely on-device,
with the daemon only receiving the final diff to apply and test.

## Phase 3: Hardening and Expansion

Goal: make it usable beyond the todo-app test case.

- Sentry webhook support (in addition to GitHub Actions)
- Desktop dashboard: history of all changes, diffs, outcomes
- Multi-repo support (pairing token scoped per repo)
- Confidence calibration: tune the on-device triage threshold using
  real usage data from Phase 1/2 testing
- Optional: encrypted relay for the "away from laptop, complex fix
  needed" case (see docs/CHALLENGES.md)

Definition of done: usable daily on at least one real personal
project, with a week of actual on-call-style usage.
