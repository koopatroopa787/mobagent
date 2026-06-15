# FieldFix

Mobile-first agentic coding assistant. Get paged, open the app, approve
a targeted fix, see it tested and pushed - without opening a laptop for
the simple cases.

Privacy-first by design: diffs travel phone <-> laptop over the local
network only. No code leaves the user's machine unless they explicitly
configure a cloud LLM provider.

This repo is built out incrementally by Claude Code. Start with
CLAUDE.md, then docs/ROADMAP.md for the current phase.

## Quick Links

- [CLAUDE.md](CLAUDE.md) - entry point, hard constraints, and tech stack decisions
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - full system design and decision log
- [docs/ROADMAP.md](docs/ROADMAP.md) - phased build plan with definitions of done
- [docs/CHALLENGES.md](docs/CHALLENGES.md) - known risks and mitigations
- [shared/protocol.md](shared/protocol.md) - phone <-> daemon JSON message spec

## Repository Structure

```
daemon/          Node.js + TypeScript local server (Fastify), runs on laptop
  src/
    agent/       Agent loop: maps alerts to candidate files, calls LLM router
    diff/        Git worktree management and diff apply/revert helpers
    litellm/     LiteLLM Proxy sidecar config and client wrapper
    pairing/     QR code generation and paired-device registry
    sync/        WebSocket session management for phone <-> daemon messages
    webhooks/    GitHub Actions (Phase 1) and Sentry (Phase 3) ingestion
  tests/         Integration and unit tests for the daemon

mobile/          Flutter app (phone)
  lib/
    litert/      On-device LiteRT-LM runtime and Gemma 4 E2B inference (Phase 2)
    pairing/     QR scan and initial handshake flow
    sync/        WebSocket client, message dispatcher
    ui/          Approval screens, diff viewer, alert list

shared/          Protocol definitions used by both sides
test-codebases/  Sample repos used as end-to-end fix targets (not production code)
docs/            Architecture, roadmap, challenges, and decision log
  decisions/     ADRs for significant choices made during development
```

## Prerequisites

All tooling needed before working through the roadmap phases:

### Phase 0 and 1 (daemon + PWA)

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 20+ | Daemon runtime |
| npm | bundled with Node | Dependency management |
| Python | 3.10+ | LiteLLM Proxy sidecar |
| pip | bundled with Python | `pip install 'litellm[proxy]'` |
| Ollama | latest | Local LLM host |
| Git | 2.28+ | Branch management by daemon |

Pull the default local model after installing Ollama:

```
ollama pull qwen3:14b
```

Copy the daemon env file and fill in as needed:

```
cp daemon/.env.example daemon/.env
```

Cloud provider keys are optional. `ANTHROPIC_API_KEY` is used only when
the user explicitly opts into `deep-reasoning` routing or when the local
model is unavailable. See [daemon/src/litellm/config.yaml](daemon/src/litellm/config.yaml)
for the full provider list and fallback chain.

### Phase 2 (native Flutter app, on-device AI)

| Tool | Version | Purpose |
|------|---------|---------|
| Flutter SDK | 3.4+ | Mobile app build |
| Android SDK or Xcode | latest stable | Target platform tooling |

Phase 2 also requires the Gemma 4 E2B model bundle, which the app
downloads on first run (not bundled in the repo - see
[docs/CHALLENGES.md](docs/CHALLENGES.md) for bundle size notes).

## Status

Phase 0 - Foundation. Nothing runnable yet. See
[docs/ROADMAP.md](docs/ROADMAP.md) for the current phase's definition
of done and what to build next.
