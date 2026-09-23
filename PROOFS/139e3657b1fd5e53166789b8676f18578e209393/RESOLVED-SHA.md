# RESOLVED-SHA — 139e3657b1fd5e53166789b8676f18578e209393

| identity | value |
|---|---|
| presented / published SHA | `139e3657b1fd5e53166789b8676f18578e209393` |
| prior presented SHA | `a319b1aaa29ab50b67a3305b3d9431a899cee36e` |
| upstream base actually absorbed | `715077a3befb5bb1239a8b0ebb52980e957ad316` |
| upstream `main` at publication | `c5cddb2da3…` — **175 commits ahead** |
| fleet runtime at publication | `1baff536afa549fea75660403c453bbd265352c0` |
| `exact_product_runtime` | **false** |
| presented ↔ runtime | divergent siblings, merge-base `3821eaef72` |
| mergeable against current `upstream/main` | **false** (`merge-tree` rc=1) |

Receipts: `mergeability/ancestry-and-mergeability.log`.

## The fast-forward that produced this SHA

Four checks, all green before the push, and git reported `a319b1aaa2..139e3657b1`
**without** a leading `+`, confirming a genuine fast-forward rather than a forced
update:

| check | value |
|---|---|
| `a319b1aaa2` is an ancestor | **yes** |
| commits lost by the ff | **0** |
| commits added | 36 |
| composite `0b26a6a92d` | intact |

## Diff size — no growth across four absorbs

| measure | value |
|---|---|
| **what upstream sees** (absorbed base → HEAD) | **839 files, +140,919 / −4,301** |
| what the PR presented before this cycle | 841 files, +140,951 / −4,277 |
| `git diff upstream/main HEAD` | 2,358 files — **not** what a PR shows |

That last row is a trap worth naming: it is the *symmetric* difference and
includes upstream's 175 newer commits appearing as reversions. The merge-base
diff is the correct measure, and by it the presented surface has not grown.

No stray files. Every non-TypeScript addition is on-topic — three
continuation-tools SVGs, two design docs, one fixture driver, three tsgo shard
configs — and only `package.json` and `tsdown.config.ts` sit outside the standard
trees, both modified rather than added.

## Gate status at this SHA

The tree at this SHA is byte-identical to `43371a0fd4` (verified: both resolve to
tree `eabea1f74119a777c9ff92b5b0f4d394d514f4fa`), so receipts measured there
apply verbatim.

| gate | verdict | receipt |
|---|---|---|
| `pnpm tsgo:core` | **PASS** rc=0 | `gates/gate-tsgo-core.log` |
| Gate 2.7 vs the **absorbed base** `715077a3be` | **PASS** — 839 files: 466 GENUINE / 373 SAFE-NEW / **0 FROZEN-STALE** / **0 MIXED-CLOBBER** | `gates/gate-2.7-vs-absorbed-base.tsv` |
| Gate 2.7 vs **current** `upstream/main` | 422 GENUINE / 373 SAFE-NEW / 0 FROZEN-STALE / **44 MIXED-CLOBBER** | `gates/gate-2.7-vs-current-upstream.tsv` |
| mergeable against current `upstream/main` | **FAIL** — rc=1, 175 commits behind | `mergeability/…` |
| `vitest` rollback-custody regressions | **PASS** 10/10 | `gates/vitest-rollback-custody-regressions.log` |
| `vitest` delivery-queue + session-delivery | **PASS** 124/124 | `gates/vitest-delivery-queue.log` |
| `vitest` gateway maintenance + close + delegate-artifacts | **PASS** 123/123 | `gates/vitest-gateway-maintenance-close.log` |
| `vitest` production-boundary + spawn-cleanup | **28/30** — 2 known | `gates/vitest-production-boundary-and-cleanup.log` |

### Reading the two Gate 2.7 runs honestly

Against the base we actually absorbed, the gate is **clean**: nothing upstream
gave us was reverted. Against *current* upstream — 175 commits newer — 44 files
rank as MIXED-CLOBBER simply because they now lack upstream lines written after
our merge base. **FROZEN-STALE is 0 in both runs**, which is the number that
detects a pure stale-copy clobber. The 44 are drift to absorb, not damage done.

### The two known reds

- **`karmaterminal/openclaw#1356`** — the `operator-revoked` queued-collector
  arm fails **only when `operator-completed` ran first**. In isolation it passes
  with all four `cleanupComplete` operands true and the child session genuinely
  deleted. Upstream's own test and test-support are byte-identical to ours, so
  the divergence is product-side. Order-dependent, fully characterised.
- **`karmaterminal/openclaw#1350`** — streamed-text offset/fencing contract,
  pre-existing, unchanged by this cycle.

`execution_status = STATIC_GATES_ONLY_NO_LIVE_ROWS_AT_THIS_SHA`.
