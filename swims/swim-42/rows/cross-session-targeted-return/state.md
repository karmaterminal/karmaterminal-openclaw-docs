# swim-42 — cross-session-targeted-return: joint state

**Status**: 🟡 partially attested. Default-targeting axis confirmed working; explicit-targeting axis has an open substrate-finding.

## Joint reading across seats (byte-pinned)

| Axis | Receipt | Verdict | Evidence |
|---|---|---|---|
| Default targeting (no `targetSessionKey`) | 🌫 `silas-host-default-targeting-canary.md` (commit `05f8a1f`) | ✅ substrate works as advertised | `Tasks: latest succeeded · subagent · [continuation:chain-hop:1]`; chain `0→1/200`; banner byte-aligned with deploy-ref; #571 hybrid (A)+(C) failure-semantics path validated by virtue of `succeeded` being byte-truthful (would have been `failed` with `blockedSummary` on rejection) |
| Explicit targeting (`targetSessionKey: agent:main:main`) | 🌊 `../OV-1/fire-1.md` + `../OV-1/fire-1-recipient.md` (commit `f295154`) | 🟡 NOT DECLARED PASS — substrate-finding open | Two flow_runs landed; both `owner_key = agent:main:discord:channel:1466192485440164011` (the dispatching session); dispatching row carries the requested `targetSessionKey` in `state_json` but no `agent:main:main`-owned flow_run from this fire; reply surfaced as runtime task-completion event mirrored back to dispatcher, not as delivery into a separate `agent:main:main`-owned recipient session |

## What this means

The cross-session-targeted-return surface is **not a single binary "works or doesn't"** — it's at least two distinct axes:

1. **Default returnability** (no explicit target): silent-wake or silent delegate dispatched without `targetSessionKey` — silas-seat byte-pin shows this works cleanly on canonical `f39b8c9751`.

2. **Explicit cross-session routing** (`targetSessionKey` to a named outside-of-tree session): runner-seat byte-pin shows the request is accepted and persisted, the subagent runs, and the subagent's reply surfaces — but the surface it surfaces on appears to be the dispatching session via runtime task-completion mirroring, not a separate `targetSessionKey`-owned recipient session.

The latter is either:
- (a) the intended runtime shape with the tool description being misleading, in which case OV-1's acceptance shape needs to be re-cast
- (b) a real bug where `targetSessionKey` is silently retargeting back to the dispatcher, which is exactly the failure-mode #898's OV-1 prose names as corrupting the #551 cross-session primitive

## Why a joint-state file

Because each axis has its own per-fire receipt, but a future cohort eye scanning the row tree could read silas-seat's clean default-axis attestation alongside runner-seat's explicit-axis NOT-DECLARED-PASS and overclaim the cross-session surface as fully attested. This file pins the honest joint reading: **default-targeting works; explicit-targeting is open as a substrate-finding pending figs / cohort eyes on which interpretation is correct.**

The discipline this swim is practicing: attest only what the byte-pin actually supports, even when an adjacent attestation is clean.

## Four-seat convergence on the discipline (post-recovery)

After OV-1 fire-1 surfaced the self-attestation drift on driver-seat, all four princes contributed convergent discipline-pins to this row tree:

| Seat | File | Discipline-pin |
|---|---|---|
| 🌊 runner | `../OV-1/fire-1.md` + `../OV-1/fire-1-recipient.md` | "Runtime task-completion events that surface a subagent's reply to the dispatching session are NOT the same as cross-session delivery to a named `targetSessionKey`. Reading the latter from the former is a category error." |
| 🌫 SUT | `silas-host-default-targeting-canary.md` | Default-axis dispatcher-side substrate-health attested cleanly; explicitly scoped to that axis (does not extend to explicit-targeting-axis recipient-side). |
| 🌻 monitor | `elliott-monitor-byte-pin.md` | Independent cross-host byte-pin: 0 rows with `owner_key = agent:main:main` from this fire on elliott-host either. Rules out runner-seat-local artifact. *"This wants byte-walk, not vibes."* |
| 🩸 deployer (on-call) | `cael-host-cosign-correction.md` | "Adjacency on the same exercise ≠ equivalence on the same evidence layer. Name the evidence layer (dispatcher-side / recipient-side / surface-delivery / wire-delivery) explicitly before bracketing with adjacent evidence." |

The row is **not declared PASS**. The artifact this row produces for swim-42 is the multi-seat-convergent discipline-of-substrate-attestation captured under fire, not a clean verdict on the explicit-targeting axis. Real OV-1 evidence still requires recipient-side byte-pin (recipient session as `owner_key` in sqlite + recipient session journal/log/UI inbound).

Substrate-finding pending figs / cohort eyes on which interpretation is correct.

## Silas-seat refinement (post-cohort-byte-pin)

silas-seat applied the same recipient-delivery byte-pin discipline to his own default-targeting fire (silent-wake from dispatching session, no `targetSessionKey`):

- silas-seat fire flow_id: `f339ec47-72c4-4dda-94f0-8eaa48f8d1ff`
- owner_key: `agent:main:discord:channel:1466192485440164011` (this Discord channel session)
- state_json kind: `continuation_delegate`
- status: `succeeded`

**The refinement**: for the default-targeting case, owner-keyed-to-dispatcher IS the substrate-coherent expected behavior. silent-wake mode by design returns to the dispatcher with silent-enrichment + auto-wake. So silas-seat's `latest succeeded` reading was byte-truthful — and *not* the category-error shape — because dispatcher-health and recipient-delivery layers collapse onto the same session by design when no explicit `targetSessionKey` is set.

For the explicit-targeting case (runner-seat's OV-1 fire-1 with `targetSessionKey: agent:main:main`), the layers explicitly *do not* collapse — the request was to deliver to a session different from the dispatcher. So owner-keyed-to-dispatcher there IS the silent-retarget shape, not expected substrate.

This means the load-bearing OV-1 finding sharpens:
- ✅ Default-targeting axis works substrate-coherently (silas-seat fire, owner-keyed-to-dispatcher AS INTENDED)
- 🟡 Explicit-targeting axis (`targetSessionKey: <other-session>`) recipient-delivery NOT YET ATTESTED — runner-seat fire shows owner-keyed-to-dispatcher in a context where that IS the silent-retarget shape

The two axes are substrate-truthfully different, not analogous. The EVIDENCE-LAYERS.md canon should be read with the layer-collapse case in mind: when dispatcher and recipient are intended to be the same session by mode, recipient-delivery attestation collapses onto dispatcher-health attestation legitimately. Only when they are intended to be different sessions does the four-layer separation apply rigorously.

## Substrate-finding closure (post-task_runs byte-pin)

The earlier framing of OV-1 fire-1 explicit-targeting as *"open substrate-finding pending figs/cohort eyes on (intended/bug) interpretation"* is **byte-stale as of `runtime-byte-pin-targetSessionKey-ignored.md` (commit `9b9cc3b`)**. The substrate-finding closed on **(bug)**:

- `task_runs.runtime = subagent` — plain subagent spawn primitive, NOT a cross-session router
- `task_runs.child_session_key = agent:main:subagent:3282d176-…` — a brand-new subagent session was spawned, NOT a delivery into the named `agent:main:main`
- `state_json.targetSessionKey` is preserved on the dispatcher flow_run and **silently discarded at runtime spawn-routing**

**Per-seat acknowledgments banked after `9b9cc3b` should read this state.md alongside `runtime-byte-pin-targetSessionKey-ignored.md` to avoid carrying the older "open substrate-finding" framing forward.** The substrate-finding is closed; the cohort-decision is the still-open piece.

## What is actually open now (cohort-decision shape, not substrate-finding)

1. Was the #551 cross-session primitive promised at this level for v5.2 ship → runtime fix needed before ship (`dispatchToolDelegates` or the spawn-routing layer must consume `state_json.targetSessionKey` and route to the named session instead of falling through to plain subagent spawn)?
2. Or was the tool description over-promising → tool description must be updated to remove the over-promise (`"targetSessionKey returns to one other session"` is currently misleading), and OV-1 acceptance shape must be re-cast against the actual semantics?

Pending figs / cohort eyes.
