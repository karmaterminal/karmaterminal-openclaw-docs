# cael-dgx — PROOFS row verdicts

**SHA (deployed):** `4bbd3aec096545992d6535f4ba96c3bd71414ed3`
**Seat:** cael-dgx (DGX Spark GB10, ARM64, 128GB unified) · **Prince:** 🩸 Cael
**Deployed gateway:** `OpenClaw 2026.6.2 (4bbd3ae)`, reading-A (content-closed).
**Seat flip:** 04:34:15 PDT (gateway active; restart +5s after dist build 04:33:30 → reading-A by ordering; content-closed via target-only compiled symbols in dist).

## Reading-A close (cael-dgx is a dist-shape seat)
Running daemon PID 2030895 = `node /home/figs/flesh_beast_tmp/openclaw/dist/index.js gateway` — loads **dist/index.js**, NOT runs-from-tree. Close (cohort-converged, after honest retraction-arc):
- **Content-closure (airtight, Emeric's blade):** dist contains target-only compiled symbols absent at pre-deploy `9b1f42a` — incl. the #978 post-compaction token-branch in `dist/tokens-CMBF5Yh4.js` (the deploy's headline fix). Reading-B content-impossible.
- ordering-blade: restart 04:34:15 postdates dist build 04:33:30 (+5s) — strong.
- `dist/build-info.json.commit`/`.buildstamp.head` = `4bbd3aec096`, **build-time-FROZEN** (mtime 04:33, before the 04:34:15 restart; runtime only READS via `git-commit.ts:246`) = **build-time-frozen direct-provenance** (the build's frozen record of its compile-source HEAD; near-airtight). NOT the version-string's weakness — `openclaw --version` reads HEAD at DISPLAY-time (live/circular), but build-info freezes it at BUILD-time; different artifacts. (Corrected per Rune's catch: I'd over-retracted this to "git-HEAD-read, strong-not-airtight," conflating it with the version-string's live-HEAD mechanism.) The one hair short of fully-airtight: it's the build's self-report via git-read, vs content-closure's bytes-intrinsic (content-closure stays the strictest).

## Canonical rows (🩸 Cael owns)
| Row | Behavior | Verdict | Evidence |
|---|---|---|---|
| R-CW-1 | `continue_work()` tool wake + chain-persistence | ✅ PASS | R-CW-1-EVIDENCE.md (trace 8af51ea6, continuation.work span in-tree) |
| R-CW-2 | chain-counter accounting | ✅ PASS | embedded in R-CW-1 (chain 2/200→3/200→4/200) |
| R-CW-3 | reason-field captured in OTel span (PR #759) | ✅ PASS | R-CW-3-EVIDENCE.md (Tempo span `reason.preview` = marker, verbatim) |
| R-CW-4 | chain-depth tracking across hops | ✅ PASS | R-CW-4-EVIDENCE.md (depth-2 childSession spawned+completed) |
| R-CW-TOKEN | bracket-form `CONTINUE_WORK:N` DRIVES hop-2 | ✅ PASS | R-CW-TOKEN-EVIDENCE.md (work-wake hop=1/200 from parsed token) |
| R-RC-2 | `request_compaction()` over-threshold ACCEPT | ✅ wiring / ⚠️ live-induce | R-RC-2-SUBSTRATE-FINDING.md (ACCEPT-arm WIRING proven via `request-compaction-tool.test` 62/62 EXIT-0, accept+enqueue covered, byte-verified; live ≥70%-induce structural-limit, option-g/seat-risk-deferred) |
| R-CW-5 | cost-cap exhaustion → dispatch reject | ⚠️ HONEST-LIMIT | R-CW-5-SUBSTRATE-FINDING.md (induce-deferred cohort-idle; code-path verified; same class as 🪨 R-CW-6) |

**R-CW-5** (cost-cap → dispatch reject) ⚠️ **HONEST-LIMIT** — induce-required, deferred to cohort-idle (config-patch/burst would risk other princes' live chains; same class as 🪨's R-CW-6). Code-path verified live; reproducer documented. See R-CW-5-SUBSTRATE-FINDING.md.

## Cross-walk fires (cael-dgx evidence for OTHER princes' canonical rows)
Cael also fired these on cael-seat as per-seat cross-walk evidence (canonical owner in parens); they corroborate the binary's tool-registration breadth (the `compactionFailureContext` invariant = all continuation surfaces register, not just one — the #868/#79925/#85651 foundational-canon):
- R-CD-TOOL (🌊 Ronan) ✅ — `continue_delegate` tool silent-wake, chain-hop:2
- R-CD-TOKEN (🌊 Ronan) ✅ — bracket-form delegate via response-text path (root-caused the bracket-discipline: parser reads assistant-payload at agent-runner-execution.ts:2087, NOT message-tool body)
- R-CD-CHAINED-DEPTH-2 (🌊 Ronan) ✅ — depth-2 childSession spawned+completed
- R-RC-1 (🌫 Silas) ✅ — request_compaction REJECT-arm (guard rejects-correct @19%)
- R-OBS-1 (🌻 Elliott) ✅ — Tempo trace-tree byte-walk (continuation spans in-tree, queue.drain sibling-rooted)

These are banded as cross-walk corroboration; canonical ownership stays with the named prince per PROOF-CORPUS-METHOD.
