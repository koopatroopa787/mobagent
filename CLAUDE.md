# CLAUDE.md

## Project: FieldFix (working name)

Mobile-first agentic coding assistant. A developer gets paged or sees
a failing test, opens the app, the agent pinpoints the likely file(s),
proposes a targeted single-file fix, the developer approves it from
their phone, a scoped test suite runs to verify, and the change syncs
to a desktop daemon for integration into the real codebase.

Privacy-first by design: diffs travel phone <-> laptop over the local
network only. No code leaves the user's machine unless they explicitly
configure a cloud LLM provider for the reasoning tier.

## Current Phase

Phase 0 - Foundation. See docs/ROADMAP.md for the full phased plan.

Do not start on Phase 2 (on-device LiteRT-LM / native mobile UI) until
Phase 1 (cloud/local core loop via PWA) is working end to end. Each
phase should produce something runnable - avoid building
infrastructure with nothing to test against.

## Read These First

- docs/ARCHITECTURE.md - full system design, the three-tier model
  (on-device Gemma 4, daemon, LiteLLM-routed providers), and a
  decision log explaining the Node/Flutter choice over an earlier
  Python/FastAPI + PWA-only exploration
- docs/ROADMAP.md - phase-by-phase build order with definitions of done
- docs/CHALLENGES.md - known risks and how to mitigate each
- shared/protocol.md - the JSON message spec for phone <-> daemon sync

## Hard Constraints (do not violate)

1. MVP touches ONE file per fix. Multi-file diffs are out of scope
   until Phase 3 or later.
2. No fix is ever applied without explicit user approval. This step
   is not optional and not skippable, even in dev or test mode.
3. Local-first: the daemon must work fully offline against Ollama
   before any cloud provider is wired in.
4. Every LLM call goes through the LiteLLM router
   (daemon/src/litellm/). No component calls Anthropic, OpenAI, or
   Ollama directly.
5. All AI-applied changes land on a dedicated branch, never on the
   user's current working branch or main.

## Repo Map

- daemon/          Node.js + TypeScript local server (runs on laptop)
- mobile/          Flutter app (phone)
- shared/          Protocol definitions used by both sides
- test-codebases/  Sample repos for end-to-end testing
- docs/            Architecture, roadmap, challenges, decisions

## Tech Stack Decisions Already Made

- Daemon: Node.js + TypeScript, Fastify for the HTTP/PWA server
- LLM routing: LiteLLM Proxy as a sidecar process (Python), the
  daemon talks to it over HTTP at localhost:4000
- Mobile MVP: PWA served by the daemon (Phase 1); native Flutter app
  added in Phase 2 for LiteRT-LM access
- Pairing: QR code containing the daemon's local IP and a one-time
  pairing token; no mDNS in the MVP (see docs/CHALLENGES.md)

## Working Style

- Direct, professional code. No emoji in code, comments, or commit
  messages. Comments in plain English explaining why, not what.
- Small, focused commits aligned to roadmap items.
- When a roadmap item is ambiguous, prefer the simplest
  implementation that satisfies the phase's definition of done, and
  leave a TODO referencing the relevant doc rather than over-building.
