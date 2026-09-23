# PROOFS — continuation SHA `e821503d0764`

**Status: `STATIC_GATES_ONLY` + naive-upstream byte-walks. No live behavioural rows in this corpus.**

The presented continuation SHA is **mergeable against current `upstream/main` for the first time in this
cycle** — that is the substantive change here. Live rows remain unavailable because the fleet has not
been cut over to a composite carrying this SHA; see "Honest limits".

| | |
|---|---|
| presented SHA | `e821503d0764d72b0d53a17e329b1efe9446690a` |
| fleet runtime at publication | `1baff536afa549fea75660403c453bbd265352c0` |
| `exact_product_runtime` | **false** |
| mergeable vs `upstream/main` | **true** (`merge-tree` rc=0) |
| upstream ahead | 8 commits |

## Verdict table

| row | verdict | evidence |
|---|---|---|
| typecheck (core) | **PASS** | `gates/gate-tsgo-core.log` |
| typecheck (scripts) | **PASS** | `gates/gate-tsgo-scripts.log` |
| format | **PASS** | `gates/gate-format-check.log` |
| lint | **PASS** — 0 error-level | `gates/gate-lint.log` |
| continuation guard call-sites | **PASS** — 22 sites / 11 guards | `gates/gate-continuation-guard-callsites.log` |
| Gate 2.7 upstream-content preservation | **PASS** — 0 FROZEN-STALE, 0 MIXED-CLOBBER | `gates/gate-2.7-drift-cure.log` |
| mergeability vs current upstream | **PASS** | `mergeability/ancestry-and-mergeability.log` |
| affected surface (116 files) | **15 failures, zero new** | `gates/vitest-affected-surface-116-files.log` |
| byte-walk: isolated gateway shard | **not-us** — upstream 16 failed vs ours 8, ours-only set empty | `gates/bytewalk-gateway-server-isolated-*.log` |
| byte-walk: 7 shared CI-triage files | **mixed** — upstream 12 failed vs ours 5 | `gates/bytewalk-seven-shared-files-*.log` |
| live continuation rows (R-CW-*, R-CD-*) | **NOT RUN** | — |

## Honest limits

1. **No live rows.** Every row above is a static gate or a local test comparison. Nothing here exercises
   a running gateway, so this corpus does **not** evidence continuation behaviour end to end. The
   composite carrying this SHA (`803b29339d`) is built and pushed but not deployed: one seat is blocked
   by an abandoned git index in its runtime checkout, and the remaining five require a dispatching
   identity this corpus's author does not hold.
2. **The fleet is not running this SHA.** `exact_product_runtime` is **false**. Seats serve
   `1baff536af`, a divergent sibling whose merge-base with the presented SHA is `3821eaef7267`. Per
   standing direction the carrier fact belongs here in corpus content, and rows are **not** marked
   PARTIAL for it — the static rows are complete as static rows.
3. **15 affected-surface failures remain**, and they are reported, not suppressed. All 15 were proven
   pre-existing by running the identical selection at the pre-absorb base. Attribution of every one of
   the 17 distinct failing files from the full CI run: 1 absorb-caused (fixed in this SHA), 2 tracked as
   #1350, 1 newly filed as #1361, 2 not-us, 11 ours-and-pre-existing.
4. **Upstream CI has not run on the presented PR.** It is gated on
   `openclaw/security-sensitive-review` + `openclaw/ci-gate`, both of which report "A maintainer must
   approve the current PR revision". That requirement is triggered by the diff touching paths in
   upstream's `.github/security-review-policy.yml` — `src/gateway/server-http.ts` is named explicitly at
   policy line 54 — and it re-arms on every push. No assertion here should be read as an upstream CI
   result.
5. **The 6-skipped asymmetry** in the isolated-shard byte-walk is unexplained; see RESOLVED-SHA.md.
