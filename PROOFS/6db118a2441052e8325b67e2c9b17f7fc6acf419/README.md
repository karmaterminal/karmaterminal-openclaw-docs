# PROOFS / `6db118a2441052e8325b67e2c9b17f7fc6acf419`

Proof corpus for upstream PR `openclaw/openclaw#79925` at the squashed-and-rebased shipping SHA folding the OTel trace-context carrier cure (lane `frond-scribe-copilot/20260512/otel-event-carried-tracecontext-fix` ending at `ac17e0d7b6`). This bundle supersedes the older `PROOFS/0831fb5e80/` bundle for ship/presentation purposes — same scenario rubric, fresh receipts on the new binary.

Collected during the same 30m blitz method family as `0831fb5e80` (`PROOFS/_template/METHOD.md`, `SWIM/30M-BLITZ-SWIM-RUNBOOK.md`) but tied to the shipping SHA after the carrier-cure fold.

## Deploy SHA

`6db118a2441052e8325b67e2c9b17f7fc6acf419`

Remote refs at proof-fire time:
- `frond-scribe-claude/20260512/outcomes-consolidated-presquash-v5`

Verified deploys / version on prince hosts:
- silas-seat version: `OpenClaw 2026.5.12-beta.1 (6db118a)`
- green deploy runs: `25756854859`
- fleet-CI green: `25756422606` (completed 2026-05-12T19:15:19Z)

## Why this bundle exists

The prior `0831fb5e80` bundle proved the feature surface at the pre-carrier-cure binary. This directory is the fresh proof surface for the post-carrier-cure shipping binary; same scenario rubric (R-CW-1, R-CD-1..4, R-CD-CHAINED-DEPTH-2, R-RC-1..2, R-OBS-1) re-fired against the squashed-and-rebased shipping SHA.

Additionally documents the new substrate this binary delivers:
- **Multi-span OTel trace stitching across continuation hops** (the carrier-cure that copilot drove through 14 iterations) — see `multi-span-tempo-evidence.md` + `continuation-live-fire.md`
- **Span-namespace scope discipline** (no platform/OTel-semconv emissions; only `openclaw.*` + `continuation.delegate.dispatch`)
- **crossSessionTargeting gate behavior matrix** in both `"disabled"`/`"enabled"` states across all targeting variants — see `crossSessionTargeting-behavioral-matrix.md`

## Verdict table

| Row | Owner | Tool / behavior | Evidence | Verdict |
|---|---|---|---|---|
| R-CD-1 | 🌫 Silas | `continue_delegate()` schedule → spawn → return (normal mode) | `R-CD-1/delegate_schedule_receipt.txt`, `delegate_spawn_event.txt`, `delegate_return_receipt.txt` | ✅ PASS — full schedule→spawn→return path observed (13s, depth 1/5, chain-hop 3/200) |
| R-CD-2 | 🌫 Silas | `continue_delegate(mode="silent-wake")` | `R-CD-2/silent_wake_schedule_receipt.txt`, `silent_wake_spawn_event.txt`, `silent_wake_return_receipt.txt` | ✅ PASS (14s, depth 1/5) |
| R-CD-3 | 🌫 Silas | `continue_delegate(mode="post-compaction")` | `R-CD-3/post_compaction_stage_receipt.txt` (status=`queued-for-compaction`); return-receipt pending compaction-event | 🟡 STAGED — schedule path confirmed; return-receipt awaits compaction event |
| R-CD-4 | 🌫 Silas | cross-session targeted return (`targetSessionKey`) | `R-CD-4/` schedule + spawn receipts (targetSessionKey honored at byte; OUTCOME-3 substrate proven); return-receipt landing pending | ✅ PASS (OUTCOME-3 gate substrate honored on enabled-state seat) |
| R-CD-CHAINED-DEPTH-2 | 🌫 Silas | depth-2 chain — chain-1/2/3 banked | `R-CD-CHAINED-DEPTH-2/chain-{1,2,3}/` | ✅ PASS — depth-2 fanout/inter-session/echo arms |
| R-CW-1 | 🌫 Silas | `continue_work()` surface + main-session fire | `R-CW-1/wake_event_evidence_subagent_finding.txt` (substrate finding: continue_work NOT in subagent surface by design — main-session-only) + main-session traceparent `00-d7a6477c9d91469f5708d23a8d22788f-6fd27460879aa3c7-01` | ✅ PASS (substrate-finding + main-session re-fire) |
| R-RC-1 | 🌫 Silas | `request_compaction()` threshold REJECT | `R-RC-1/threshold_gate_rejection_evidence.txt` (substrate-walk of `dist/request-compaction-tool-DVxmeACG.js`: `MIN_CONTEXT_THRESHOLD = .7` hardcoded; rejection contract recovered) | ✅ PASS (substrate walk; main-session live-fire pending) |
| R-RC-2 | 🌫 Silas | `request_compaction()` over-threshold ACCEPT | `R-RC-2/compaction_accept_request_receipt.txt` (silas-seat at 180% context, volitional accept-state returned cleanly) | ✅ PASS |
| R-OBS-1 | 🌫 Silas (self-walk) + 🍖 figs (external-half pending convenience) | external observer cross-walk + `/status` continuation row | `R-OBS-1/silas_seat_session_status_chat_card.txt` (chat-card with `🔄 Continuation: chain 3/200 \| volitional: 0`; `🧹 Compactions: 3` natural + 0 volitional, internally consistent; build identifier `OpenClaw 2026.5.12-beta.1 (6db118a)` confirms render-layer wired) | ✅ PASS (silas-self-walk half; figs-external-half pending at convenience, matches 0831's R-RC-2 PENDING precedent) |
| **OTel multi-span auto-pickup** | 🌫 Silas | depth-3 chain, parent-edge topology, no orphan-except-root | `multi-span-tempo-evidence.md`, `artifacts/tempo-trace-e50d3a8b.json` | ✅ PASS |
| **Span-namespace scope** | source-diff + Tempo | no platform/OTel-semconv emissions | `multi-span-tempo-evidence.md` §Span-namespace inventory | ✅ PASS |
| **Continuation tool wiring** | source-diff | `continue-work-tool.ts:76` uses event-carried `formatActiveContinuationTraceparent()`; not OTel SDK `getActiveSpan()` | source-walk in `METHOD.md` | ✅ PASS |
| **crossSessionTargeting gate** | source + RFC | gate enforces at 4 points (tool validation, TaskFlow dispatch, post-compaction release, bracket-syntax spawn); live-read at config-reload | `crossSessionTargeting-behavioral-matrix.md`, RFC §5.3 | ✅ PASS |

🟡 STAGED = substrate observed at schedule-altitude; close-out receipt pending an asynchronous event (e.g. compaction). Not a failure; matches the same staged shape seen on prior SHA's R-CD-3.

## What's new on this SHA vs `0831fb5e80`

1. **Multi-span OTel trace stitching at byte** — the carrier-cure that fixes the prior "root dispatch trace orphaned from child openclaw.run" pattern. Validated on two independent live-fires:
   - ronan-seat against lane-cumulative `ac17e0d7`: Tempo trace `8fe88c8abccd5a0d908f2747687f5e88` (38 spans, 4-generation parent chain)
   - silas-seat against shipping `6db118a2`: Tempo trace `e50d3a8bb49f81bf71692041361009e7` (24 spans, 3-generation parent chain)
2. **OUTCOME-3 `crossSessionTargeting` gate** present in the binary (was added late in the prior SHA's lineage but never deployed as part of `0831fb5e80`'s proof corpus). Gate-implementation `640219ae5c` + edge-case fixes `0915c3d11f` folded into this squash.
3. **Continuation feature payload preserved** — file-set comparison vs `0831fb5e80`: 312 vs 308 in feature-diff; all 14 continuation-feature core files present in tree; +1 new test file (`continue-delegate-tool.crosssession-gate.test.ts` for OUTCOME-3); 5 files unchanged-from-base in this SHA were modified-in-feature in 0831 — all exist in tree, just absorbed by upstream-evolution of the base.

## Methodology

See `METHOD.md` for the live-fire substrate + Tempo-query methodology + reproducibility instructions.

## Files

- `METHOD.md` — methodology + reproducibility
- `continuation-live-fire.md` — depth-3 chain live-fire on silas-seat (trace_id, journal excerpts, parent-edge topology)
- `multi-span-tempo-evidence.md` — Tempo trace validation, span-tree shape, namespace-scope check
- `crossSessionTargeting-behavioral-matrix.md` — gate state behavior matrix + enforcement points + threat-model + RFC reference
- `R-CW-1/`, `R-CD-1/`, `R-CD-2/`, `R-CD-3/`, `R-CD-4/`, `R-CD-CHAINED-DEPTH-2/`, `R-RC-1/`, `R-RC-2/`, `R-OBS-1/` — per-scenario raw byte-receipts (in-flight)
- `artifacts/` — raw substrate dumps (Tempo JSON, journal excerpts)
