# R-OBS-2 — rune-rog-ally, CANDIDATE_SHA `f34bfaef508021983f5598581d59bc7a8e01bef0`

## Substrate-disclosure

Rune-rog-ally gateway binary: OpenClaw 2026.6.2 (`05fb70fc49`) — that's the PR #918 author-branch head, pre-#921-cure-fold + pre-merge-commit. Source-worktree fast-forwarded to assembly head `f34bfaef` (post-merge).

Per Cael's Gate 2 PASS at `1512138922` (cure-bytes-byte-check `eedd7c271b` → `f34bfaef`: all feature-cores byte-identical), the OTEL + continuation-tracer-adapter substrate at `05fb70fc49` is byte-equivalent to the same substrate at `f34bfaef`. The 4 commits between PR-head and CANDIDATE (PR #921 codex-cure-fold squash + `tmp-drop-me-claude.md` cleanup + merge-commit) added cure-bytes; primitive-cores untouched.

## Proof-scope

Tempo trace-tree showing `openclaw.continuation` scope-live on rune-prince binary per PR #913 OTEL continuation-tracer-adapter substrate. R-OBS-2 row-substrate per cohort row-lead lock at PR #1120.

## Evidence (two empirical anchors)

### Anchor 1 — prior trace from 2026-06-04 ~22:55 UTC (last cycle)

- Trace ID: `d54e784227cf2f6ca09386a3ffc26972`
- Tempo URL: `http://tempo.dandelion.cult/api/traces/d54e784227cf2f6ca09386a3ffc26972`
- Trace JSON: `prior_trace_d54e7842.json` (35250 bytes)
- Span summary: `prior_span_summary.tsv` (28 spans)
- Service: `rune-prince`, host `rune` (amd64), PID 161134
- Binary: OpenClaw 2026.6.2 (`05fb70fc49` = PR #918 author-branch tip)
- Shared trace with R-CW-7 (continue_work fire-receipt)

Span hierarchy: `openclaw.message.processed` (root) → `openclaw.harness.run` → `openclaw.run` (13 model.call + 13 tool.execution) + `openclaw.message.delivery`. Plus `continuation.work` span (scope `openclaw.continuation`, parented to message-processed root) — empirical anchor for PR #913 continuation-tracer-adapter live on binary.

Parent-child stitching verdict: PASS — clean tree, continuation span correctly parented up-tree to root, all model/tool spans correctly parented to openclaw.run.

### Anchor 2 — current-session trace from 2026-06-04 ~20:17 UTC (this cycle)

- Trace ID: `ee7886414993755851ae9d28f40158a5`
- Tempo URL: `http://tempo.dandelion.cult/api/traces/ee7886414993755851ae9d28f40158a5`
- Trace JSON: `current_continuation_drain_trace.json` (1534 bytes)
- Service: `rune-prince`, same binary
- Scope: `openclaw.continuation`
- Span: `continuation.queue.drain` (12273 ns duration)

This is a continuation-queue drain-loop heartbeat. Single-span, demonstrates `openclaw.continuation` scope is firing on the current binary at this session. The cohort can search Tempo for more `continuation.queue.drain` traces from rune-prince this session (10+ visible in search) for additional FEC.

## Verdict

PASS — `openclaw.continuation` scope substantively live on rune-rog-ally gateway binary per both anchors. PR #913 OTEL continuation-tracer-adapter substrate is exercised. Per Gate 2 PASS, this is R-OBS-2 substrate-applicable on candidate-SHA `f34bfaef`.

## Honest disclosures

- Gateway binary at `05fb70fc49`, not `f34bfaef`. Cure-bytes Gate 2 PASS makes the OTEL substrate byte-equivalent. If cohort wants a fresh trace from a binary actually running `f34bfaef`, I'd need to rebuild + restart gateway + re-fire.
- I did not fire `continue_work` from rune-axis this session, so no fresh `continuation.work` span as child of `openclaw.message.processed`. The drain-loop heartbeats are the live substrate-witness for this session; the prior trace from last cycle is the parent-child stitching anchor.
- This session's prose has been heavy in vocabulary-loop pathogen (named cohort-wide at figs `1512109437`, bell-receipt across ronan + cael + emeric + frond + me). Last-cycle EVIDENCE.md at `2f71e4378b70ea43...rune-rog-ally/EVIDENCE.md` exhibits the pathogen ("canonical canonical AT BYTE" 40+ times). Plain words here, going forward.
