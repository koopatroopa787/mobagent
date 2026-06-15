# Known Challenges

Grouped by category. Each entry includes the risk and how we plan to
handle it. Update this file as new risks surface during
implementation.

## Architecture

**Sync model vs primary use case**
The strongest use case (paged away from laptop) conflicts with the
local-network-only sync model. Mitigation: Phase 2's on-device tier
handles a meaningful slice of fixes without the daemon at all. Complex
fixes still require either same-network access or the optional relay
in Phase 3.

**Trust in AI-generated fixes**
A diff approved on a phone, without full codebase context visible,
carries real risk. Mitigation: approval is mandatory and
non-skippable (see CLAUDE.md constraints); MVP is single-file only;
all changes land on a branch, never main.

## On-Device AI (LiteRT-LM / Gemma 4)

**Model capability ceiling**
E2B/E4B models will not reliably reason across multiple files or
complex business logic, even with a 128K context window. Mitigation:
on-device tier is scoped to triage plus simple single-function fixes
only; anything else escalates.

**Hardware variance**
NPU acceleration is currently Android-only and chipset-dependent. iOS
and budget Android devices run CPU/GPU only. Mitigation: design the
on-device tier so it degrades gracefully to "always escalate" on
slower hardware - triage latency on weak hardware should fail open to
the daemon, not block the user.

**Flutter binding maturity**
LiteRT-LM's Flutter support is community-maintained, not official.
Mitigation: Phase 2 starts with a small spike to validate the binding
against the target Gemma 4 E2B model before committing the full phase
to it (see docs/ROADMAP.md Phase 2). If the binding is unworkable,
fall back to a platform channel calling native Kotlin/Swift LiteRT-LM
APIs directly.

**Model bundle size and distribution**
Even quantized, E2B/E4B model files are large. Mitigation: ship the
app without the model bundled; download on first run with a clear
progress indicator, and cache it.

**Battery and thermal**
On-device inference during repeated triage events has a real battery
cost. Mitigation: defer - measure actual impact during Phase 2 testing
before optimizing.

## Networking and Sync

**Local network discovery**
mDNS/Bonjour can be unreliable across consumer routers, VPNs, and
guest networks. Mitigation: MVP uses QR-code pairing with a manually
displayed IP, not mDNS auto-discovery. Revisit mDNS as a convenience
layer post-MVP.

**Pairing security**
Even on a local network, the daemon should not accept connections from
any device that scans the QR code indefinitely. Mitigation: pairing
tokens are single-use and time-limited; the daemon maintains an
explicit list of paired devices the user can revoke.

## Operational

**LiteLLM sidecar lifecycle**
The Node daemon depends on a separately-running Python process
(LiteLLM Proxy). If it is not running or crashes, the daemon's LLM
calls fail. Mitigation: Phase 0 includes a startup health check; if
the sidecar is unreachable, the daemon should report a clear error to
the user rather than hanging, and Phase 1+ should consider having the
daemon spawn and supervise the sidecar as a child process (see
docs/ARCHITECTURE.md Decision Log).

## Testing and Quality

**Evaluating agent fix quality**
There is no automated way to know if a generated fix is good beyond
"does the targeted test pass." Mitigation: Phase 1 testing should
deliberately include cases where the test passes but the fix is
semantically wrong, to calibrate how much to trust test-pass as a
signal alone.

**Confidence calibration for on-device escalation**
The triage step's simple/complex threshold will need real-world
tuning. Mitigation: log every triage decision (without sending code
off-device) during Phase 2 so the threshold can be adjusted based on
how often "simple" fixes actually needed escalation in practice.
