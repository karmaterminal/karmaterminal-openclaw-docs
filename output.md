# R-CD-4 harness-vs-product report

Issue binding: openclaw/openclaw#85651

## 1. Pre-rerun verdict

**HARNESS DEFECT (not a product defect on the available bytes).**

The exact PARTIAL run used candidate runtime `6b09b1dbe938ab6b5f56eaf4e58f1ed243f89955` and harness/docs ref `7ab525923833cbddffa5c75c22481fcbe9d12fe9`. Its public evidence records accepted dispatch, an observed agent turn, one unambiguous nonce-bound child, child completion, and no target/parent receipt. The captured gateway journal independently records the product's `[continuation:targeted-return] Delivered to <target> from <child>` path and the child-produced marker. The old harness nevertheless required a `TARGET-RECEIVED <nonce>` transcript `session.message`/`sessions.get` observation as the return authority. That transcript event is not the product's targeted-return delivery receipt, and its absence cannot establish a product delivery failure.

The deployed composite was inspected directly at `6b09b1d...` in `openclaw-85651-121204-deploy-composite`. `routeSubagentContinuationReturn` resolves `continuationTargetSessionKey`, calls `enqueueContinuationReturnDeliveries` for that target, and emits the targeted-return delivery log. `continue-delegate-tool.ts` accepts and persists `targetSessionKey`; `delegate-dispatch.ts` forwards it into the child run. This is consistent with the PARTIAL journal and does not show a product defect.

The authoritative corrected rule is: structural gates must pass (accepted dispatch plus exactly one nonce-bound, unambiguous child session that is neither parent nor target), then the raw in-window gateway journal must contain exactly one target-directed delivery receipt bound to that child and zero matching parent-directed receipts. The receipt must be HMAC-sealed with the gateway token and self-validated. Transcript markers, generic assistant nonces, unsigned or forged receipts, `structuralOk=false`, fixed sleeps, duplicate/wrong-target/wrong-child/out-of-window records, and wrong-session history scans do not count.

## 2. Harness lineage

The PARTIAL artifact hashes its copied manifest and scenario to the pre-PR-510 ref `7ab525923833cbddffa5c75c22481fcbe9d12fe9`. The current docs main is `ead47a618c539c535e6845c52207f7a16b23d677`; it still contains the pre-PR-510 transcript-marker authority. The accepted but unmerged docs PR #510 lane is `10f98e60cd48eba4d598a0e8805ec42d632a1326` (`origin/pr-510` tip `f7e307d7...` is its parent). It adds `targeted-return-receipt.mjs`, the collector, HMAC validation, exact target/parent/child/window matching, and fail-closed tests. The focused accepted-lane authority suite passed 32/32, including structural-false, unsigned/forged/tampered, wrong-session, duplicate, wrong-target, wrong-child, and out-of-window negatives. The old exact-ref focused suite passed 27/27 but encoded the defective transcript authority.

GitNexus was used for symbol/path discovery. The indexed docs worktrees were stale (`78243d8` indexed 2026-07-31 and `b445b9` indexed 2026-08-01 versus the current refs); the indexed OpenClaw worktree was `530b33e` rather than the deployed `6b09b1d`. Those indexes were context only. Product conclusions were verified against the exact deployed composite source.

## 3. Project 81 dry-run

Invocation:

```text
gh workflow run project81-k6-proof.yml
  --repo karmaterminal/openclaw-bootstrap
  --ref scribe/20260815/project81-docs-ref-env
  -f target_prince=cael
  -f candidate_sha=6b09b1dbe938ab6b5f56eaf4e58f1ed243f89955
  -f rows=R-CD-4
  -f session_selector=r-cd-4-scratch-20260815
  -f docs_ref=10f98e60cd48eba4d598a0e8805ec42d632a1326
  -f use_docs_catalog=true
  -f dry_run=true
  -f create_disposable_sessions=true
  -f metrics_push=false
```

Workflow run: `31898169901`; job: `95044599517`; result: completed successfully. Downloaded artifact: `/tmp/rcd4-dry-31898169901/`.

The downloaded `run-summary.json` is `dry-run`, candidate `6b09b1d...`, docs ref `10f98e60...`, `rows: "R-CD-4"`, scratch selector `r-cd-4-scratch-20260815`, disposable sessions enabled. The catalog preflight reports `r-cd-4.json` and `r-cd-4-target-session-key.js` as runnable and the runner says it would execute exactly one row. The immutable harness provenance records the intended docs ref and row selection; dry-run intentionally leaves `harnessIdentityVerified=false` and executes zero rows.

## 4. Seat preflight

Only passive SSH process, memory, SQLite, queue-count, and journal-count evidence was used:

| Seat | Passive result | Decision |
|---|---|---|
| Cael | SQLite `quick_check` reports overflow/unused-page corruption; queue 161/443/1040 | Exclude |
| Ronan | SQLite freelist inconsistency; swap nearly full; queue 106/77/267 | Exclude |
| Silas | SQLite OK, low load and ample memory, but queue 112/100/781 | Eligible but more queued |
| Elliott | SQLite OK, but 26 GB swap used, load about 1.65, 157 journal lines | Exclude as stressed |
| Emeric | SQLite OK, low load, 58 GB available, but 44 continuation journal lines and 2.36 GB gateway RSS | Eligible, active |
| Rune | SQLite OK, about 12 GB available, about 0.6 load, gateway RSS about 610 MB, queue 59/27/80, one journal line | **Least-stressed eligible** |

The live run therefore uses Rune, not Cael and not a channel session, with disposable sessions and the scratch selector.

## 5. Live rerun

The single authorized live dispatch was executed exactly once:

```text
gh workflow run project81-k6-proof.yml
  --repo karmaterminal/openclaw-bootstrap
  --ref scribe/20260815/project81-docs-ref-env
  -f target_prince=rune
  -f candidate_sha=6b09b1dbe938ab6b5f56eaf4e58f1ed243f89955
  -f rows=R-CD-4
  -f session_selector=r-cd-4-scratch-20260815
  -f docs_ref=10f98e60cd48eba4d598a0e8805ec42d632a1326
  -f use_docs_catalog=true
  -f dry_run=false
  -f create_disposable_sessions=true
  -f metrics_push=false
```

Workflow run `31898368482`, job `95045082431`; downloaded artifact: `/tmp/rcd4-live-31898368482/`. The immutable harness gate passed (`harnessIdentityVerified=true`) and seat-readiness passed: k6 v2.0.0, gateway health/status reachable, continuation enabled, and the configured candidate was observed. The provenance receipt still records `candidateMatchesRuntime=false` because the runtime identity is only `OpenClaw 2026.8.1 (6b09b1d)`, not the full 40-character candidate; this is an additional receipt gap, not a product failure. The row then failed before any WebSocket scenario action: k6 exited `107` while importing the scenario because `r-cd-4-authority.mjs` imports `targeted-return-receipt.mjs`, which imports Node-only `node:crypto`. k6 v2.0.0 reports that `node:crypto` is unsupported. The gateway capture retained no proof-relevant lines, and no `sessions.create`, `sessions.send`, delegate, or product mutation occurred.

This is a harness-origin failure, not a product result. No live retry is authorized.

## 6. Disposition and receipt gaps

The prior `99ce` row remains a PARTIAL-candidate and review-pending. Its trace collector failed on a malformed 31-hex trace id, both trace JSON outputs are empty, and no authoritative HMAC targeted-return receipt exists. Its redacted journal is corroborative only because the exact target/parent/child identity binding is unavailable after redaction.

The live `6b09` row is also a harness PARTIAL: `run-result.json` reports `k6ExitCode=107`, no evidence/summary, no targeted-return receipt, no trace, and no candidate envelope. The report correctly keeps it review-pending rather than synthesizing a product FAIL. The accepted authority tests passed `56/56`; the complete accepted proof-harness test invocation produced `378/379` with one pre-existing corpus-validator failure. That same failure reproduces on docs main (`28/29` in `candidate-run-result.test.mjs`): `PROOFS/a7ef0317.../proofs-manifest.json` has the old `openclaw.k6.proofs-manifest.v1` shape instead of the validator's expected `openclaw.proofs.manifest.v1`, and lacks `capture_sha`/`rows[]`. It is unrelated to this lane and was not repaired.

## 7. Recommendation for other PARTIAL rows

Re-audit every continuation row whose PASS predicate is based on assistant-authored text, transcript nonce scans, generic wake timing, or a static sleep. Separate structural dispatch/child identity from behavior-specific authority, make the runtime-owned receipt the sole PASS authority, bind target and child identities exactly, authenticate public receipts, and preserve raw evidence only transiently. Also add a k6 import smoke to every live row: Node-only HMAC/collector modules must not be imported by k6 scenario dependency graphs. Treat missing observability or an un-runnable scenario as receipt debt/PARTIAL; never upgrade it to a product defect or excuse a valid target-return absence as harness noise.

## 8. Validation and uncertainties

The docs repository has no `package.json` test script and no OpenClaw `scripts/test-projects.mts`; its sanctioned proof-harness surface is `node --test`. The accepted lane command was:

```text
cd /home/figs/flesh_beast_best_beast/source/WORKTREES/karmaterminal-openclaw-docs-wo1217-observation-repair
node --test tools/k6-proofs/scripts/__tests__/*.test.mjs tools/k6-proofs/tests/*.test.mjs
```

Result: `378 pass / 1 fail`; the single failure is the pre-existing corpus-schema mismatch reproduced on docs main. The accepted R-CD-4/targeted-return row-authority tests independently pass `56/56`. The pre-PR-510 exact-ref R-CD-4 and child-correlation focus passes `27/27`.

The live attempt proves only that the approved harness identity and Rune readiness gates ran; it cannot classify 6b09 product behavior because k6 never loaded the scenario. A future rerun must first make the k6 import graph k6-compatible while keeping HMAC sealing in the post-run Node collector, then repeat the same dry-run/live controls. No product fix, deployment, restart, database/config mutation, GitHub issue/comment write, corpus fold, or ref movement was performed here.
