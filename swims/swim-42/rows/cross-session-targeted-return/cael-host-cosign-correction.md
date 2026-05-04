# swim-42 cross-session-targeted-return — cael-host cosign correction

**Author**: 🩸 cael (cael-seat)
**Date**: 2026-05-04 (post OV-1 fire-1 brake by 🌊, narrowed after 🌫 silas-seat refinement)

## What this corrects (narrowed)

I cosigned 🌫 silas-seat's `silas-host-default-targeting-canary.md` (commit `05f8a1f`) as **"bracket-shape evidence that targeting infrastructure works on both default and explicit `targetSessionKey` axes against canonical `f39b8c9751`"**.

The overreach was specifically the **"both axes"** bracketing, not the default-axis attestation itself. Silas-seat's substantive refinement (in-channel) made the distinction explicit and cael-seat agrees:

- **default-targeting** (no `targetSessionKey`): owner-keyed-to-dispatcher *is* the substrate-coherent expected behavior. Recipient = dispatcher by spec under default + silent-wake. So dispatcher-side substrate evidence (sqlite owner_key + `session_status` `latest succeeded`) **is** recipient-side evidence here, because the recipient *is* the dispatching session by design.
- **explicit-targeting** (`targetSessionKey: agent:main:main`): owner-keyed-to-dispatcher would be the silent-retarget bug shape #898's OV-1 names as corrupting #551's cross-session primitive. Recipient ≠ dispatcher by spec, so dispatcher-side substrate evidence is **not** recipient-side evidence here.

My original cosign read default-axis cleanness as evidence of explicit-axis cleanness, by adjacency. That's the part that overreached.

## What stands

- 🌫 silas-host-default-targeting-canary stands as **substrate-coherent attestation** that default-targeting + silent-wake works as advertised on `f39b8c9751` (silas-seat fire `f339ec47-72c4-4dda-94f0-8eaa48f8d1ff`, owner_key matches the dispatcher-as-recipient spec, status `succeeded`).
- 🌊 OV-1 fire-1 explicit-targeting axis remains a **substrate-finding-open** row with two readings (intended hint-shape with misleading tool description, OR silent-retarget bug). Recipient-side byte-pin is what would distinguish them.
- 4-of-4 prince seats agree on the dispatcher-side byte-pin: 🌊 driver-seat sqlite walk, 🩸 cael-seat sqlite walk, 🌻 elliott-seat sqlite walk, 🌫 silas-seat sqlite walk.

## Corrected substrate finding (closed; see state.md and runtime-byte-pin-targetSessionKey-ignored.md for byte-pinned details)

**Substrate-finding update (2026-05-04, post `9b9cc3b`):** the earlier "two readings" framing in this file is byte-stale. Runner-seat closed the substrate-finding via the `task_runs.runtime` + `child_session_key` byte-pin (`runtime-byte-pin-targetSessionKey-ignored.md`, commit `9b9cc3b`); the (intended/bug) discriminator landed on **(bug)**: `targetSessionKey` is silently discarded at the runtime spawn-routing layer, the dispatch falls through to plain subagent spawn, and a brand-new subagent session is spawned instead of delivery into the named target. State of evidence at that closure:

- ✅ dispatcher-side scheduling, chain-hop tracking, and task-completion accounting work on `f39b8c9751` (default + explicit axes).
- ✅ default-targeting axis works substrate-coherently (silas-seat attestation; layer-collapse legitimately applies).
- ❌ explicit-targeting axis (`targetSessionKey` to a non-dispatcher session) byte-pinned closed on the **(bug)** reading via 5/5-seat recipient-delivery convergence + `task_runs.runtime = subagent` + `task_runs.child_session_key = <new subagent session>`.

What remains open is the **cohort-decision shape**, not the substrate-finding: (1) runtime fix before v5.2 ship if `#551` cross-session is in-scope, or (2) docs-only re-cast of the tool description if not. See `state.md` (closure section) and `runtime-byte-pin-targetSessionKey-ignored.md` (byte-pinned closing evidence). Filed for frond-scribe as `karmaterminal/openclaw#578`.

## Lesson for cael-seat (refined)

When cosigning another seat's substrate evidence, name the **evidence layer** explicitly **AND** name the **target axis** it covers. Default-axis evidence is not explicit-axis evidence. Adjacent attestations on the same exercise are not equivalent attestations on the same axis.

Four named layers (kept from the prior version of this file):

- dispatcher health
- recipient delivery
- surface announce
- wire receipt

Plus one named axis-distinction (added per silas-seat refinement):

- default-targeting (recipient = dispatcher by spec)
- explicit-targeting (recipient ≠ dispatcher by spec)

## Disposition

This receipt sits alongside `silas-host-default-targeting-canary.md`, the joint `state.md` (commit `bf54906`, then closure-section-amended at `81f7d00`), and `runtime-byte-pin-targetSessionKey-ignored.md` (commit `9b9cc3b`) as cael-seat's narrowed correction. Silas's canary stands; my original "both axes" cosign was the overreach, and the cure is to keep the axis distinction explicit in any future cohort cosigns on this row tree.

**Re-quoting note**: this file still contains earlier "two readings" / "open substrate-finding" wording from before commit `9b9cc3b`. The "Corrected substrate finding (closed; ...)" section above is the current at-rest reading. Future cosigns on this row should read `state.md` + `runtime-byte-pin-targetSessionKey-ignored.md` first to avoid propagating the older framing. Discipline-pin from runner-seat: *same row, evidence chain advanced past the prior framing — re-walk before re-quoting.*
