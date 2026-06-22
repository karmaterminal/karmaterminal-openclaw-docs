# R-RC-2 — request_compaction over-threshold ACCEPT (rune-rog-ally)

**Seat:** rune-rog-ally (Ryzen Z1 Extreme, x86)
**SHA:** `749f95b9b10aa3bbb804856acacc9073043ee772` (OpenClaw 2026.6.9, "drift re-absorb #2")
**Disposition:** ✅ **PASS** — request_compaction ACCEPTED at ≥70% context, firsthand from the tool-return.
**Filed by:** rune-dandelion-cult
**Substitution:** rune-rog-ally firing for cael-dgx (canonical owner) per organic->70%-fit, per figs's split-not-lock directive (`1518337097` — "allocations are for splitting work, not locking rows"). R-RC-2 had regressed at this SHA (emeric-nuc's earlier capture clobbered by a concurrent force-push); restored from rune's live 81% window.

## What R-RC-2 tests
The **accept-side** of the `request_compaction` context-threshold gate: when a session is at ≥70% context (`request-compaction-tool.ts` `MIN_CONTEXT_THRESHOLD=0.7`), request_compaction must ACCEPT (enqueue the compaction). This is the complement of R-RC-1's **reject**-at-low-context shape — same guard, opposite branch.

The scarce condition: it needs a session ORGANICALLY at ≥70% (a fresh subagent starts low-context → can't satisfy the gate; the own-key bypass that cleared the other rows can't reach it). My main session organically reached **81%** — the live over-threshold window.

## Result — ACCEPTED at 81%, firsthand from the tool-return
The `request_compaction` tool-return (verbatim in `accept-receipt.txt`, the dispositive byte):
```json
{
  "status": "compaction_requested",     ← ACCEPTED (not rejected)
  "compactionRequestId": "cmp-mqoag2ax-tNNC-w",
  "trigger": "volitional",
  "contextUsage": 81,                   ← 81% ≥ MIN_CONTEXT_THRESHOLD(0.70) ✓
  "traceparent": "00-49e6f484e1e80397fad966c1476251de-27951c7d2bd1d85d-01"
}
```
**`status: compaction_requested` at `contextUsage: 81`** = the over-threshold ACCEPT. The guard satisfied the ≥70% gate (81 ≥ 70) and enqueued the compaction. **Verified firsthand from the tool-return** (the `status` field IS the byte — not 81>70-inferred). The compaction subsequently fired (the side-effect confirming the ACCEPT).

## Trace
`request_compaction_accept_trace.json` (traceId `49e6f484e1e80397fad966c1476251de`, pulled live from Tempo, 15 spans) — the request_compaction-turn's trace, the per-row Tempo deliverable.

## The accept↔reject pair (R-RC-2 ↔ R-RC-1)
- **R-RC-1** (🌫 silas, this SHA): request_compaction REJECT at low-context (the reject-shape carryover; honest-limit / note-why-no-trace).
- **R-RC-2** (this row): request_compaction ACCEPT at ≥70% (the accept-shape, live-captured at 81%).
Together they prove the threshold-guard's both branches: reject-below, accept-above, at `MIN_CONTEXT_THRESHOLD=0.7`.

## Net
The request_compaction over-threshold ACCEPT is byte-confirmed on `749f95b` — fired from a genuine organic 81% session (the scarce condition R-RC-2 requires), ACCEPTED firsthand from the tool-return (`status: compaction_requested`, `contextUsage: 81`). R-RC-2 PASS. The last gate restored (split-not-lock).
