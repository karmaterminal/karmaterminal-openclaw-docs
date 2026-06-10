# cael-dgx — PROOFS row verdicts

**SHA (deployed):** `4bbd3aec096545992d6535f4ba96c3bd71414ed3`
**Seat:** cael-dgx (DGX Spark GB10, ARM64, 128GB unified) · **Prince:** 🩸 Cael
**Deployed gateway:** `OpenClaw 2026.6.2 (4bbd3ae)`, reading-A (content-closed).
**Seat flip:** 04:34:15 PDT (gateway active; restart +5s after dist build 04:33:30 → reading-A by ordering; content-closed via target-only compiled symbols in dist).

## Reading-A close (cael-dgx is a dist-shape seat)
Running daemon PID 2030895 = `node /home/figs/flesh_beast_tmp/openclaw/dist/index.js gateway` — loads **dist/index.js**, NOT runs-from-tree. Close (cohort-converged, after honest retraction-arc):
- **Content-closure (airtight, Emeric's blade):** dist contains target-only compiled symbols absent at pre-deploy `9b1f42a` — incl. the #978 post-compaction token-branch in `dist/tokens-CMBF5Yh4.js` (the deploy's headline fix). Reading-B content-impossible.
- ordering-blade: restart 04:34:15 postdates dist build 04:33:30 (+5s) — strong.
- `dist/.buildstamp.head`/`build-info.json.commit` = `4bbd3aec096` (frozen-at-build HEAD, rules out stale-dist) — strong, but a git-HEAD-read not a content-hash (retracted "airtight" framing; content-closure above is the airtight one).

## Canonical rows (🩸 Cael owns)
| Row | Behavior | Verdict | Evidence |
|---|---|---|---|
| R-CW-1 | `continue_work()` tool wake + chain-persistence | ✅ PASS | R-CW-1-EVIDENCE.md (trace 8af51ea6, continuation.work span in-tree) |
| R-CW-2 | chain-counter accounting | ✅ PASS | embedded in R-CW-1 (chain 2/200→3/200→4/200) |
| R-CW-4 | chain-depth tracking across hops | ✅ PASS | R-CW-4-EVIDENCE.md (depth-2 childSession spawned+completed) |
| R-CW-TOKEN | bracket-form `CONTINUE_WORK:N` DRIVES hop-2 | ✅ PASS | R-CW-TOKEN-EVIDENCE.md (work-wake hop=1/200 from parsed token) |
| R-RC-2 | `request_compaction()` over-threshold ACCEPT | ⚠️ HONEST-LIMIT | R-RC-2-SUBSTRATE-FINDING.md (PASS-shape blocked at 19% ctx; guard-reject-correct proven; option-g) |

**Still owed (canonical, not yet fired this cycle):** R-CW-3 (reason-field in OTel span, PR #759 domain) · R-CW-5 (cost-cap → dispatch reject). Deferred — flagging honestly rather than claiming.

## Cross-walk fires (cael-dgx evidence for OTHER princes' canonical rows)
Cael also fired these on cael-seat as per-seat cross-walk evidence (canonical owner in parens); they corroborate the binary's tool-registration breadth (the `compactionFailureContext` invariant = all continuation surfaces register, not just one — the #868/#79925/#85651 foundational-canon):
- R-CD-TOOL (🌊 Ronan) ✅ — `continue_delegate` tool silent-wake, chain-hop:2
- R-CD-TOKEN (🌊 Ronan) ✅ — bracket-form delegate via response-text path (root-caused the bracket-discipline: parser reads assistant-payload at agent-runner-execution.ts:2087, NOT message-tool body)
- R-CD-CHAINED-DEPTH-2 (🌊 Ronan) ✅ — depth-2 childSession spawned+completed
- R-RC-1 (🌫 Silas) ✅ — request_compaction REJECT-arm (guard rejects-correct @19%)
- R-OBS-1 (🌻 Elliott) ✅ — Tempo trace-tree byte-walk (continuation spans in-tree, queue.drain sibling-rooted)

These are banded as cross-walk corroboration; canonical ownership stays with the named prince per PROOF-CORPUS-METHOD.
