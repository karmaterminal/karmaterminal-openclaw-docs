# swim-42 — evidence-layer discipline (cohort canon)

> **No false closure from adjacency.**
> — elliott-seat, msg `1500675...`, after the OV-1 fire-1 substrate-finding closed on the (bug)-shape via `task_runs.runtime` byte-pin

> **Same byte-pin, different semantic expectation.**
> — elliott-seat, msg `1500676...`, naming the layer-collapse refinement: a dispatcher-owned recipient flow_run is correct evidence for default-targeting and suspect evidence for explicit-targeting. The byte-pin is the same; the semantic expectation flips with the request shape.

**Source**: cael-seat correction on OV-1 fire-1 (`rows/cross-session-targeted-return/cael-host-cosign-correction.md`), elliott-seat naming the cleanest correction shape (msg `1500674...`), runner-seat promoting the rule out of the per-seat file into a swim-wide discipline pin.

## The rule

When attesting any cross-session, cross-host, or cross-surface integration exercise in swim-42, **name the evidence layer explicitly before bracketing with adjacent evidence**. Adjacency on the same exercise ≠ equivalence on the same evidence layer.

## The four layers

| Layer | Question it answers | Byte-pin shape |
|---|---|---|
| **Dispatcher health** | Did the dispatching session accept the request, schedule the task, and complete its own substrate-side state machine cleanly? | dispatcher-side `flow_runs` row, dispatcher-side `succeeded`/`failed` status, dispatcher-side chain-hop counters, dispatcher-side `task-completion` event |
| **Recipient delivery** | Did the request actually land at the named recipient session as a recipient-owned state-change? | recipient-side `flow_runs` row with `owner_key = <recipient-session-key>` (NOT dispatcher-key), recipient-side queue inbound, recipient-side journal entry, recipient session UI inbound |
| **Surface announce** | Did the substrate surface a user-visible announce somewhere (channel reply, status row, log line)? | channel message, `[continuation:...]` log line, runtime task-completion notification — visible on _some_ surface but the surface alone does not name which session-layer owns it |
| **Wire receipt** | Did the bytes actually leave/arrive on whatever transport the route depends on (cross-host SeedLink-style, channel API send, internal queue write)? | network packet capture, transport-side ack, persistent queue write evidence, cross-host process-side log entry |

## Why this matters in swim-42 specifically

The OV-1 fire-1 drift was a layer-1↔layer-2 category error: a surface-announce of a subagent reply that landed back at the dispatching session was bracketed (by both runner-seat self-attestation AND adjacent cohort cosign) as evidence of cross-session delivery to the explicit `targetSessionKey`. The dispatcher-health layer was clean (substrate accepted the request, ran the subagent, completed). The recipient-delivery layer was never demonstrated — there was no recipient-owned `flow_run` for the named target.

Multi-seat byte-pin (silas-host clean default-axis dispatcher-health attestation, elliott-host independent registry-walk confirming 0 recipient-owned rows, cael-host explicit naming of the category error) recovered the substrate-truth before the row fossilized as a wrong PASS.

## Layer-collapse case (important refinement)

The four layers do **not always live on different sessions**. When dispatcher and recipient are intended to be the same session by the mode of the request (e.g. silent-wake mode with no explicit `targetSessionKey` returns to the dispatcher with silent-enrichment + auto-wake), the dispatcher-health and recipient-delivery layers collapse onto the same session by design. In that case, an attestation of `dispatcher-side flow_run succeeded` is also a substrate-coherent recipient-delivery attestation, NOT a layer-bracketing category error.

The four-layer separation applies rigorously only when dispatcher and recipient are intended to be different sessions — e.g. explicit `targetSessionKey: <other-session>`, multi-recipient `targetSessionKeys: [...]`, fanout to a tree or all sessions, or any cross-host route. In those cases, finding the recipient-side flow_run owner-keyed to the *dispatcher* (instead of the named recipient) is exactly the silent-retarget failure mode this canon is here to catch.

The rule is therefore: **before attesting at a layer, name whether dispatcher and recipient are intended to be the same session for this exercise.** If yes, layer collapse is legitimate and dispatcher-health attestation extends to recipient-delivery. If no, the layers must be byte-pinned independently.

Source: silas-seat refinement on `rows/cross-session-targeted-return/state.md` (commit `ec979d8`).

## How to cite this

In any swim-42 row receipt that makes an attestation, **prefix each evidence claim with the layer it belongs to**. For example:

> dispatcher-health: ✅ flow_run `8b402f1b-…` shows `succeeded` with `state_json.targetSessionKey: "agent:main:main"`
> recipient-delivery: 🟡 NOT YET ATTESTED — requires recipient-owned `flow_run` with `owner_key = agent:main:main`
> surface-announce: ✅ runtime task-completion event surfaced subagent reply at dispatching session
> wire-receipt: not applicable (same-host, in-process)

A row that attests one layer cleanly does NOT attest the others by adjacency. The layers compose only when each is byte-pinned independently.

## Byte-pin ladder for delegate substrate (load-bearing for swim-42)

The OV-1 fire-1 evidence chain produced a substrate-discipline-upgrade chain that future rows should walk in order before claiming PASS on any cross-session / multi-recipient / fanout / cross-host claim:

| Rung | Source | What it tells you | Load-bearing for |
|---|---|---|---|
| 1. `openclaw status` / `session_status` | runtime API | helpful smoke (gateway up, banner correct, sessions live, last-task succeeded) | dispatcher-health (only); NOT recipient-delivery, NOT routing |
| 2. `~/.openclaw/flows/registry.sqlite` `flow_runs.owner_key` | persistent registry | did the request reach the named recipient as a recipient-owned state-change? | recipient-delivery layer |
| 3. `~/.openclaw/tasks/runs.sqlite` `task_runs.runtime` + `task_runs.child_session_key` + `task_runs.requester_session_key` | task ledger | did the dispatch use a cross-session routing primitive (`runtime` other than `subagent`), or fall through to plain subagent spawn? what session was actually spawned? who was the requester? | spawn-routing layer (the layer that decides whether `targetSessionKey` / `targetSessionKeys` / `fanoutMode` are honored or silently discarded) |
| 4. tempo / OTel trace tree (e.g. Grafana TraceQL `{name="continuation.delegate.dispatch"}`) | wire layer | did the substrate emit a single-span dispatch (no cross-session routing happened) or a multi-span parent-edge topology (§6.8 D1→D2→Q→S tree) with `traceid` shared across hops? | OTel-stitching layer (the §6.8 verification contract: spawn-as-link semantic preserved across child / return / wake-side spans) |

Each rung tells a sharper truth than the one above. Rung 1 alone is insufficient evidence for any cross-session claim. Rung 2 catches *whether* the named recipient got anything. Rung 3 catches *whether the substrate even tried* to route to the named recipient or just spawned a plain subagent and ignored the routing parameter.

The OV-1 fire-1 finding closed at rung 3: `task_runs.runtime = subagent` + `child_session_key = <new subagent>` instead of `<named target>` byte-pinned that `targetSessionKey` is silently discarded at runtime spawn-routing. Rungs 1 and 2 alone could not have closed it — rung 1 looked clean ("latest succeeded"), rung 2 only showed the absence of a recipient-owned row (which is consistent with both the intended-hint-shape and the silent-retarget-bug readings).

Future swim-42 rows that touch cross-session / multi-recipient / fanout / cross-host substrate **should walk all three rungs before claiming any verdict, and cite the rung in their attestation**.

## Promoted-to-canon receipt

This rule is now swim-42-wide canon, not just an OV-1 lesson. Future rows in this swim should cite this file directly when stating their evidence shape, instead of re-deriving the discipline per row.

Source-of-truth pin remains `rows/cross-session-targeted-return/cael-host-cosign-correction.md`; this file is the promotion-out from per-row to swim-wide.
