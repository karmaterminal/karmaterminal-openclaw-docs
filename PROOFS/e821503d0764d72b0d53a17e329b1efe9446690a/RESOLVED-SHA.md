# RESOLVED-SHA — e821503d0764d72b0d53a17e329b1efe9446690a

| identity | value |
|---|---|
| presented / published SHA | `e821503d0764d72b0d53a17e329b1efe9446690a` |
| prior presented SHA | `ebcc116058f4a2ff87398a47ca2794bf7d408e40` |
| prior-prior presented SHA | `139e3657b1fd5e53166789b8676f18578e209393` |
| upstream base actually absorbed | `6d65c8b7f229641bf9b32e16da2c0fec1b64079f` |
| upstream `main` at publication | `13370789ba48545cb3a1a91a8fba55441e8870f3` — **8 commits ahead** |
| fleet runtime at publication | `1baff536afa549fea75660403c453bbd265352c0` |
| `exact_product_runtime` | **false** |
| presented ↔ runtime | divergent siblings, merge-base `3821eaef7267` |
| mergeable against current `upstream/main` | **TRUE** (`merge-tree --write-tree` rc=0) |

Receipts: `mergeability/ancestry-and-mergeability.log`.

## What changed versus the previous corpus

The corpus at `139e3657b1` recorded **`mergeable: false`** (`merge-tree` rc=1). This one records
**`true`**. Two absorbs closed it:

| step | upstream absorbed | commits | conflicts |
|---|---|---|---|
| sixth absorb, part 1 | `ddcd52d5bf` | 112 | 12 paths / 13 hunks |
| sixth absorb, part 2 | `6d65c8b7f2` | +35 | 2 paths |

Upstream is now only **8** commits ahead, against **175** at the previous corpus.

## The fast-forward that produced this SHA

| check | value |
|---|---|
| `ebcc116058f4` is an ancestor | **yes** |
| commits lost by the ff | **0** |
| commits added | 2 |
| `git push` output | `ebcc116058..e821503d07` — no leading `+`, genuine ff |
| composite `0b26a6a92d` | **intact** |

## Diff size — no explosion

**844 files changed, 141,340 insertions, 4,286 deletions** against the merge-base with `upstream/main`.
The previous corpus measured 839 files. Five files of growth across 147 absorbed upstream commits.

## Gate verdicts, all at this exact tree

The presented commit is a merge; its tree is **byte-identical** to the gated branch head `eb2c61743e`
(`c9a3793d0a84bce990caf76e69be41f25bf8b782` both), so these logs are valid for the presented SHA.

| gate | verdict | log |
|---|---|---|
| `pnpm tsgo:core` | **rc=0** | `gates/gate-tsgo-core.log` |
| `pnpm tsgo:scripts` | **rc=0** | `gates/gate-tsgo-scripts.log` |
| `pnpm format:check` | **rc=0** (43,281 files) | `gates/gate-format-check.log` |
| `pnpm lint` | **rc=0**, 0 error-level findings | `gates/gate-lint.log` |
| `lint:continuation:guard-callsites` | **rc=0** — 22 sites / 11 guards | `gates/gate-continuation-guard-callsites.log` |
| Gate 2.7 drift-cure | **rc=0 CLEAN** — 843 files: 468 GENUINE, 375 SAFE-NEW, **0 FROZEN-STALE, 0 MIXED-CLOBBER** | `gates/gate-2.7-drift-cure.log` |
| affected surface, 116 files | 15 failures, **zero new**, all proven pre-existing | `gates/vitest-affected-surface-116-files.log` |
| `merge-tree` vs `upstream/main` | **rc=0 conflict-free** | `mergeability/ancestry-and-mergeability.log` |

## Naive-upstream byte-walks

Run with identical linked `node_modules` — `pnpm-lock.yaml` is **byte-identical** between this SHA and
`upstream/main`, so there is no dependency confound — same host, `MAX_WORKERS=1`, `taskset -c 0-7`.

| surface | naive `upstream/main` | this SHA |
|---|---|---|
| `agentic-gateway-server-isolated` (16 files) | **16 failed** / 41 passed / 6 skipped | **8 failed** / 55 passed |
| 7 shared files from CI triage | **12 failed** / 87 passed | **5 failed** / 97 passed |

On the isolated shard the ours-only failure set is **empty**: every failure we have also fails on
pristine upstream, and upstream additionally fails 8 that we pass. Logs: `gates/bytewalk-*`.

Stated caveat: upstream reported 6 skipped where this SHA reported 0 on the isolated shard (both total
63). Those 6 are unexplained; the empty ours-only set does not depend on them.
