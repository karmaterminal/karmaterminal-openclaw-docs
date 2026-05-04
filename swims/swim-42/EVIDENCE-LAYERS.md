# swim-42 — evidence-layer discipline (cohort canon)

> **No false closure from adjacency.**
> — elliott-seat, msg `1500675...`, after the OV-1 fire-1 substrate-finding closed on the (bug)-shape via `task_runs.runtime` byte-pin

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

## Promoted-to-canon receipt

This rule is now swim-42-wide canon, not just an OV-1 lesson. Future rows in this swim should cite this file directly when stating their evidence shape, instead of re-deriving the discipline per row.

Source-of-truth pin remains `rows/cross-session-targeted-return/cael-host-cosign-correction.md`; this file is the promotion-out from per-row to swim-wide.
