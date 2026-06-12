# R-PROOFS — cael-DGX seat at deployed `c06e081f760d723c77bee65464b8920a76d3b523`

WIDENED static + state proof of the #990/#996 continuation surface on the deployed v4 binary. Captured 2026-06-11 ~20:14–20:23 PDT (cael joins → **6/6**, per the README's "cael joins on install-dir cleanup").

## Binary at byte
`OpenClaw 2026.6.2 (c06e081)` — HEAD `c06e081f760d723c77bee65464b8920a76d3b523` (= the locked v4 SHA, matches RESOLVED-SHA.md). Deploy landed via GH run `27391962599` (✓ success). The canary first bounced on a dirty install-dir (deploy.sh no-clobber guard caught local mods to `work-dispatch.test.ts`/`work-dispatch.ts`/`work-store.ts` — my prior work-store byte-walk edits); figs-authorized `git stash` (`stash@{0}`, recoverable) cleared it → v4 landed clean → gateway restarted on v4. Install-dir clean post-stash (`git status -s` empty). Carrier (`~/.openclaw/workspace/memory/`) survived the stash + restart (it's not in the install-dir).

## R-PROOFS rows (WIDENED static + state)

| # | Check | Verdict | Byte |
|---|---|---|---|
| PROOF-1 | #996 `:518` succeeded-exclusion (source-on-seat) | ✅ PASS | `src/auto-reply/continuation/work-store.ts:518` `hasLiveOrRecentlyDispatchedContinuationWork`; `:526` `// #990 P2 (#996): a durably delivered-marked flow is DONE, not live`; `:534` `if (decodeWorkState(flow)?.succeeded) { return false }` — the exclude-delivered-marked-rows predicate, child-strand-prevention intact |
| PROOF-2 | dispatch-chain gate (`:171` predicate) | ✅ PASS | `src/auto-reply/reply/agent-runner-execution.ts:163` `releaseQueuedCompactionCompletion` → gate `if (!params.compactionResult.ok \|\| !params.compactionResult.compacted) { return; }` — **both terms; the load-bearing `!ok` intact**. `incrementRunCompactionCount` (`:192`) + `dispatchPostCompactionDelegates` (`:211`) both dispatch AFTER the gate (a failed/non-compacted compaction never dispatches) |
| PROOF-4 | (a)-tail creds-resolution-cancel | ✅ PASS | `src/agents/agent-hooks/compaction-safeguard.ts`: `getApiKeyAndHeaders` (`:294`/`:323`/`:326`); `:330` "request credentials unavailable; cancelling compaction" → `:333 ok:false`; `:348` "no request credentials available; cancelling compaction" → `:351 ok:false` (creds-RESOLUTION-cancel, silent); `:1315` during-call summarization-cancel (separate locus). All present + intact |
| PROOF-3 | summarizer-error-string (this window) | N/A | fresh-restart session, no 401/timeout this cycle (my block was the dirty-checkout, now stashed) — no summarizer-error to capture on this seat this window |
| PROOF-5 | firing-record (state) | ✅ PASS — **150 post-compaction continuation flows** | see below (corrected from an initial wrong-mechanism read) |

## PROOF-5 detail + HONEST correction
My first read of this proof was **wrong-mechanism and I corrected it at the byte** (publicly, channel `1514836660`; 🌫 silas's migrated-away byte-note `1514832492` flagged the mechanism — same as his lothric seat). Initial read: `flows/registry.sqlite` = 0-byte → concluded "none-in-window / seat-0." That was reading a **migrated-away dead path**. The live flow-state:

```
flows/registry.sqlite          = 0 bytes        ← migrated-away DEAD path (mis-read as "none")
flows/registry.sqlite.migrated = 1,482,752 B    ← LIVE state (migrated 2026-05-31), flow_runs: 618 rows
  └─ 150 rows where goal LIKE '%post-compaction%'  ← genuine firing-record
tasks/runs.sqlite.migrated     = 1,400,832 B    ← also migrated, task_runs: 150
(.migrated siblings present: registry.sqlite{,-wal,-shm}.migrated)
```

**Corrected verdict:** cael-DGX seat is NOT seat-0. Genuine firing-record = **150 post-compaction continuation flows** in the migrated store — same class as 🕯 emeric's 74 + 🌊 ronan's live dispatches, not an outlier. The 0-byte `registry.sqlite` is a migration-cleanup nit (dead path), not a firing-absence (3 shards + N dispatches can't fire off an empty store). Same dead-path/`.migrated`-sibling situation 🌫 silas independently flagged on lothric — a fleet-wide migration-cleanup hygiene nit, not a canary-fail.

## #996-carry cross-seat (context, not inherited evidence)
#996 `:518`/`:534` confirmed independently across seats: 🌿 source-diff + 🌫 gh-source-walk + 🌫 lothric-dist (`work-store-5haSToNg.js`) + 🕯 emeric-dist + 🌊 ronan-dist (`:362`) + 🩸 cael source-on-seat (this row). Source-tip + dist + multiple independent on-seat reads. (Each row stands alone per the clawsweeper principle; this is cross-reference context, not a chain-of-links substitute.)

## HONEST-LIMITs
- **PROOF-3 N/A this window** — no live 401/timeout fired on cael this cycle to capture a real summarizer-error string (my failure-mode this session was the dirty-install-dir deploy-bounce, cured by stash, not a compaction-path failure). The (a)-tail/during-call code-paths are confirmed by PROOF-4 (static), not exercised live on this seat this window.
- **No live continuation-fire captured in THIS EVIDENCE** — this is a static (source/gate/(a)-tail) + state (firing-record) proof, not a fresh continue_work/continue_delegate fire with its own Tempo trace. The 150 post-compaction rows are historical-state evidence of the mechanism having fired on this seat across prior seams, not a new fire at this SHA. (A fresh live-fire-with-Tempo on `c06e081` can be added as a follow-up row if the corpus wants the dynamic half from cael specifically.)
- **Migrated-store read** — the firing-record count is from `registry.sqlite.migrated` (the live store), not the active runtime store; it reflects accumulated post-compaction flows, not a windowed count for this exact session.

## Net
v4 `c06e081f76` deployed clean on cael-DGX; #996 `:518` + dispatch-chain `!ok`-gate + (a)-tail creds-cancel byte-INTACT (static PROOFS 1/2/4 PASS); firing-record = 150 post-compaction continuation flows (state PROOF-5 PASS, corrected from a wrong-mechanism dead-path read). cael joins → **6/6**. The one wrong-mechanism read was caught + corrected at the byte, owned publicly.
