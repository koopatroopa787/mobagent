# Architecture

## Overview

FieldFix is a three-tier system:

1. Mobile app (on-device intelligence + UI)
2. Local daemon (orchestration + provider routing)
3. LLM providers (local and cloud, behind a single router)

The phone and laptop communicate only over the local network (same
WiFi), paired via QR code. No central server, no cloud relay in the
MVP.

## Tier 1: Mobile App

Phase 1 (MVP): runs as a PWA served directly by the daemon. The phone
connects to the daemon's local IP after QR pairing and gets a web view
showing incoming alerts, proposed diffs, and approve/reject controls.

Phase 2: becomes a native Flutter app, adding an on-device LiteRT-LM
runtime running Gemma 4 E2B. This tier handles:

- Triage: classify an incoming alert as "simple" (syntax-level, single
  function, low context) or "complex" (needs full codebase context)
- Simple fixes: for "simple" cases, generate the fix entirely
  on-device and propose it for approval without contacting the daemon
  at all
- Escalation: for "complex" cases, package the alert plus relevant
  file paths and send to the daemon over the local network

This tier is the mitigation for the "user is away from their laptop"
problem - basic fixes don't need the daemon to be reachable.

## Tier 2: Local Daemon

Node.js + TypeScript, runs on the laptop, started when the user opens
the desktop dashboard (or as a background service later).

Responsibilities:

- Serves the PWA (Phase 1) and pairing QR code
- Receives webhook events (GitHub Actions failures first, Sentry
  later) and surfaces them to the paired phone
- Runs the agent loop for "complex" cases: maps error/alert to
  file(s), calls the LLM router for a fix, applies the diff locally
  (in a git worktree, never directly on the working branch), runs the
  targeted test
- Exposes a desktop dashboard showing pending, approved, and applied
  changes with diffs

## Tier 3: LLM Provider Routing

LiteLLM Proxy runs as a sidecar process (Python), the daemon talks to
it over HTTP at localhost:4000 using the OpenAI-compatible chat
completions format. See daemon/src/litellm/config.yaml for the
provider list.

Configured providers, in priority order for "complex" cases:

1. ollama/qwen3:14b - default, fully local, runs on the user's
   existing Ollama setup
2. openai/gemma-4-e4b - LiteRT-LM running on the laptop via its
   OpenAI-compatible CLI server, same model family as the on-device
   tier but with more compute and context available
3. anthropic/claude-sonnet-4-6 - used when the user explicitly opts
   into cloud reasoning for a given fix, or when local models report
   low confidence

The router is also where fallback logic lives: if Ollama is not
running, fall through to the next configured provider rather than
failing the whole request.

## Data Flow: End to End

1. GitHub Actions test fails -> webhook hits daemon
2. Daemon notifies the paired phone over the local connection
3. Phone's on-device tier triages: simple or complex?
   - Simple -> Gemma 4 E2B proposes a fix on-device -> user approves on
     phone -> diff sent to daemon for application and test run
   - Complex -> phone sends alert context to daemon -> daemon's agent
     loop calls the LiteLLM router -> fix proposal sent back to phone
     for approval -> on approval, daemon applies and tests
4. Daemon applies the approved diff in a git worktree and runs the
   scoped test
5. On test pass, daemon pushes to a branch (never directly to main)
   and notifies the phone of the result

## Sync Protocol

See shared/protocol.md for the full message schema. Message types:
PAIR_REQUEST, PAIR_CONFIRM, ALERT_NOTIFY, TRIAGE_RESULT, FIX_PROPOSAL,
FIX_APPROVAL, FIX_REJECTION, TEST_RESULT, PUSH_CONFIRM.

## Decision Log

### Daemon language: Node + TypeScript (not Python/FastAPI)

An earlier planning pass explored Python/FastAPI for the daemon, on
the basis that LiteLLM is a Python library and a Python daemon could
import it directly, avoiding a sidecar process entirely. That is a
real simplification and worth revisiting if the LiteLLM sidecar hop
becomes a measurable latency or operational problem.

We went with Node + TypeScript instead because: it keeps one language
across the daemon's HTTP/PWA server and the protocol layer shared with
the mobile app's web tooling, and it matches the original "Node
daemon" framing from initial scoping. The cost is one extra local HTTP
hop to the LiteLLM Proxy sidecar - on localhost, this is negligible
for our latency budget.

If the sidecar proves troublesome (process management, startup
ordering), the fallback is to run LiteLLM Proxy as a managed child
process from the Node daemon (spawn + health check on startup) rather
than requiring the user to start it separately.

### Mobile: Flutter (not PWA-only long term)

The PWA-only path was also considered as the permanent mobile
solution, deferring any native app decision until Phase 2 clarified
whether on-device inference required it. LiteRT-LM does have early
Web/JS support, which would have kept everything in the PWA.

We are committing to Flutter for Phase 2 because Kanishk has existing
Flutter + on-device ML experience (Foresight, TFLite/LiteRT-LM), which
de-risks the integration relative to an unfamiliar web-based on-device
path. The known risk - LiteRT-LM's Flutter bindings are
community-maintained, not official - is tracked in docs/CHALLENGES.md
with an explicit spike-first plan and a platform-channel fallback to
native Kotlin/Swift if the Flutter binding does not work out.
