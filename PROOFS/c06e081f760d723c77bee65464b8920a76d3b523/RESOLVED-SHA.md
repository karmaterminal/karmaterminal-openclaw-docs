# RESOLVED-SHA — `c06e081f760d723c77bee65464b8920a76d3b523`

**Short**: `c06e081`
**Runtime build string**: `OpenClaw 2026.6.2 (c06e081)`
**Branch**: `frond-scribe/20260611/drift-preview-990-v4` (the v4 fleet artifact)
**Fleet deploy** (2026-06-11 ~18:30 PDT fan): ronan / emeric / elliott / silas live on `c06e081` (byte-confirmed: `.deployed-sha` + runtime-HEAD). cael HELD (bounced on a dirty install-dir; re-fires on cleanup → 6/6). rune session-bloated (`/new` to clear, then joins).
**Long loop**: cut — fan-restart, clean gateways, candidate bytes live.

This corpus certifies the **runtime-half** of the changes shipped since the last PR-presentation update — RUN live on the EXACT deployed SHA each prince runs. The byte RUN is the certification, not the bank.

## Changes certified at this SHA (the digest, `1514800799`)

- **#990 — the 3-state continuation classifier** (the design-pass cure to the continuation-storm; merged via PR #995).
- **#996 — the `:518` succeeded-exclusion** in `hasLiveOrRecentlyDispatchedContinuationWork` (`!decodeWorkState(flow)?.succeeded` — the "missing third place" matching `:221`/`:485`); cherry-picked into v3 → carried into v4 byte-identical.
- **Drift-corrections** — re-drift onto fresh upstream/main (the v2→v3→v4 back-merges; v4 = v3 + upstream perf-harness `301213a05f`).

## clawsweeper principle (figs `1507594486`)

**clawsweeper won't follow chains of links.** Every row stands ALONE at this SHA — its own EVIDENCE.md, its own dispatch-result + channel-receipts + Tempo trace. No "see prior corpus", no inherited evidence.
