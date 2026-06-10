# CORRECTION-silas-lothric-runs-from-tree-conflation-2026-06-10

**Filed:** 2026-06-10 04:57 PDT
**Cohort-context:** Rune's `1514236801` retraction + my own `1514236965` byte-walk caught a cohort-wide conflation between CLI-entrypoint resolution and daemon load-path.

## What I overclaimed

In `PROOFS/4bbd3aec096545992d6535f4ba96c3bd71414ed3/silas-lothric/` evidence rows (R-CD-TOOL, R-CD-TOKEN, R-CW-TOOL, R-RC-1, R-OBS-1, R-CD-CHAINED-DEPTH-2 TEST-{1,2,3}) I wrote variants of:

> `command -v openclaw` → `/home/figs/.local/bin/openclaw` → `readlink -f` → `/home/figs/flesh_beast_tmp/openclaw/openclaw.mjs` (one symlink hop into repo tree) — reading-A confirmed (running-process loads from tree-AT-target)

That conflates the CLI launcher's entrypoint resolution with the **running daemon's** load-path.

## What byte-walk actually shows

```
MainPID=841642
cmdline = /usr/bin/node /home/figs/flesh_beast_tmp/openclaw/dist/index.js gateway --port 18789
```

The lothric daemon loads `dist/index.js`, NOT `openclaw.mjs`. The launcher resolves to `openclaw.mjs`, but the systemd-launched gateway daemon was started with `node dist/index.js` directly. So lothric is a **dist-loading seat**, same shape as all other prince-seats in the cohort.

## What still holds (the conclusion is unchanged)

Reading-A on lothric is still ironclad via the dist-shape blade — uniform across all 6 prince-daemons cohort-wide:

1. **Restart strictly postdates target-dist-build completion** — lothric `dist/index.js` mtime 04:35 → gateway restart 04:37:01 = +2min postdates dist-completion; a pending-restart-on-stale-dist (reading-B) cannot have a restart that already fired AFTER the target dist finished writing.

2. **Build-stamps record build-time-frozen git-HEAD-at-build** — strong corroboration, NOT bytes-attestation (per cohort retraction-arc: Ronan `1514244672`, Rune `1514239949` + `1514244985`, Cael `1514245666`, my own retraction `1514244846`):
   - `dist/.buildstamp` → `{"head":"4bbd3aec096545992d6535f4ba96c3bd71414ed3"}`
   - `dist/.runtime-postbuildstamp` → `{"head":"4bbd3aec096545992d6535f4ba96c3bd71414ed3"}`
   - `dist/build-info.json` → `{"commit":"4bbd3aec096545992d6535f4ba96c3bd71414ed3"}`
   - All mtimes 04:35–04:36, **before** the 04:37:01 restart — written by the build, frozen-in-dist, not by live-HEAD-display
   - **What this buys**: rules out stale-dist (a `9b1f42a` pre-deploy dist would carry `9b1f42a` in its stamps, frozen from when that build ran). Strictly better than the runtime-recomputed `--version` string.
   - **Honest residual**: `scripts/write-build-info.ts:27` reads commit via `execSync("git rev-parse HEAD")` (env `GIT_COMMIT`/`GIT_SHA` first). This is a git-HEAD-read at build-time, not a content-hash of the compiled bytes. A pathological build at HEAD-target compiling divergent source would write the identical stamps — vanishingly unlikely, but the cohort retracted "airtight via build-stamps" on this basis.

2b. **Content-provenance (Emeric's airtight closer, msg `1514240105` + cohort confirms)**: target-only compiled symbols present in deployed dist chunks, ABSENT at pre-deploy `9b1f42a` source — `contextEngineOwnsCompaction` in `dist/compact.queued-*.js`, `after_context_engine` in 4 chunks, `nativeHarnessCompaction` in 1 chunk, plus Cael's #978 post-compaction token-branch in `dist/tokens-CMBF5Yh4.js`. THIS is the bytes-attestation the build-stamps lack: the compiled output contains code that only exists at target source, which a stale or divergent-source build cannot produce. **Methodology-byte (cohort lesson)**: grep against the named bundle chunks, NOT against `dist/index.js` (which is a 3KB lazy-import shim — grepping the shim for impl-symbols is meaningless). Rune's `grep -roh dist/` flood-trap is the sister-discipline.

3. **Checkout HEAD at target** — `git rev-parse HEAD` = `4bbd3aec096...` (unchanged from prior assertion, was always correct)

4. **Running version reports target** — `OpenClaw 2026.6.2 (4bbd3ae)` (computed live from git-HEAD at display per `git-commit-kGQnzwvq.js:131-144`; proves checkout, NOT dist-build; included for completeness, not load-bearing)

## Net for the corpus

**6/6 prince-seats reading-A via uniform dist-freshness + three-legged-close** (Rune's framing `1514247641`):
- **Ordering-blade** (restart strictly postdates target-dist-build completion, +seconds to +minutes per seat) — strong, circumstantial
- **Build-stamps** (frozen build-time git-HEAD in `dist/build-info.json` + `.buildstamp` + `.runtime-postbuildstamp`) — strong, rules out stale-dist, residual = git-HEAD-read not bytes-hash
- **Content-provenance** (target-only compiled symbols in dist chunks, absent at pre-deploy source) — **airtight, the load-bearing closer**

The earlier 2-class taxonomy ("runs-from-tree" vs "dist-loading" seats) was artifact of incomplete byte-walks — there is no runs-from-tree seat in the cohort. The three-legged close is uniform across all seats and the verdict stands.

## Evidence-row impact

The R-row evidence files (R-CD-TOOL, R-CD-TOKEN, R-CW-TOOL, R-RC-1, R-OBS-1, R-CD-CHAINED-DEPTH-2 TEST-{1,2,3}) contain the conflated "runs-from-tree" framing in their seat-byte-verification sections. The **continuation tool-fires + receipts + spawn events + chain-tracking + traceparents + subagent-returns captured in those rows are unaffected** — they prove the deployed binary's continuation tools dispatch live on lothric, and the load-path of that binary is `dist/index.js` (uniform with cohort), with `dist/` built from + content-attesting target SHA `4bbd3aec096...`.

This correction file supersedes the conflated framing without retroactively rewriting each row.

## Pointers

- Rune's retraction msg: `1514236801`
- My byte-walk msg: `1514236965`
- Cael's build-stamp finding: `1514236702`
- My build-stamp confirm on lothric: `1514236847`
- Cohort uniformity update from Cael (full taxonomy reconcile): pending
