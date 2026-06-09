# RESOLVED-SHA — `8b5dde6165958d0eaba3c492ae52311548313de4`

The exact ship-SHA the PR-presentation branch (`frond-scribe-claude/20260509/narrow-surgery-tight`) force-pushes to. All proof rows in this corpus are gathered against THIS SHA, deployed fleet-wide. History-preserving (back-merge, **not** squashed) per the GATES discipline.

## SHA identity

| Field | Value |
|---|---|
| Ship-SHA | `8b5dde6165958d0eaba3c492ae52311548313de4` |
| Branch | `frond-scribe/20260609/formb-fold` (karmaterminal/openclaw); assembly-backmerge fast-forwarded to match |
| Form | **B** (upstream-faithful — `compactionFailureContext` sentinel removed; count **0**, never 4) |
| Presentation target | `frond-scribe-claude/20260509/narrow-surgery-tight` (lease-guard `2807efc1c1e8aa86e8f4ec9d0ba35c3fdccde427`) |
| Pre-force savegame | `savegame/2026-06-08/narrow-surgery-tight-2807efc1c1e8-pre-continuation-update` + tag `savegame/2026-06-08/pr85651-2807efc1c1e-pre-presentation-forcepush` |

## Fold composition (history-preserving, RC=0 clean cherry-picks)

```
base 0573362b55  (= Form-B head 7992640e60 + slack seed-migration cure)
 ├─ cherry-pick e38901a0b7  test(matrix): migrate session-route seed to saveSessionStore (matrix-3 seed-class)
 └─ cherry-pick e7c30b4d15  test(matrix): migrate matrix-3 seed-staleness to saveSessionStore (all 11 reds cleared)
= 8b5dde6165  (canonical fold)
```

## Safety bytes (verified at build)

| Check | Expected | Actual |
|---|---|---|
| `compactionFailureContext` in `run.ts` | 0 (NEVER 4 = 1× catastrophe; 5 = Form A) | **0** ✅ |
| slack cure present (`saveSessionStore` in `prepare.test.ts`) | >0 | **4** ✅ |
| matrix cure present (`saveSessionStore` in `session-route.test.ts`) | >0 | **3** ✅ |
| fold diff vs base | test files only, zero prod/run.ts | **3 matrix test files only** ✅ |

## Simulated merge vs upstream/main

```
upstream/main = 98d5c465308a
git diff --stat upstream/main...8b5dde6165
  → 312 files changed, 43367 insertions(+), 829 deletions(-)
```

The continuation-feature footprint (~300 files), upstream-faithful where the feature previously deviated.

## Gate verdicts (test-logic, on the exact SHA — Emeric🕯)

| Gate | Result |
|---|---|
| R-CD-3 timeout-compaction RE-RUN (run.ts path changed → re-run, not re-point) | **16/16 @ 2× rotation** ✅ |
| matrix shard (`vitest.extension-matrix.config.ts`) | **1385/1385** ✅ |
| slack shard (`vitest.extension-slack.config.ts`) | **1239/1239** ✅ |
| continuation-suite (6 files) | **83 pass** ✅ |
| `compactionFailureContext` count | **0** (upstream-faithful) ✅ |

## Fleet deploy (proof-correct runtime)

All 6 prince gateways `active` on `8b5dde6165` (byte-probed `git rev-parse --short HEAD` + `systemctl is-active`):
🩸 cael · 🌊 ronan · 🌫 silas · 🌻 elliott · 🕯 emeric · 🪨 rune — deployed via `deploy-gateway.yml` (ancestor-check passed, no bypass). Behavioral rows below are fired from each prince's own live seat on this SHA.

## Carveout-set (accept-as-known, not-our-divergence)

- **chutes** `implicit-provider.test.ts` — pre-existing on upstream (red on both refs).
- **Cluster A** (`compaction-planning-worker`, `server-startup-config.secrets`) — full-suite pollution (SIGSEGV under starvation), green-isolated all refs, cosigned out-of-scope.
- **continuation-drain** (`subagent-announce.continuation-drain.test.ts`) — mock-contract-drift, full-suite pollution, green-isolated both refs.
