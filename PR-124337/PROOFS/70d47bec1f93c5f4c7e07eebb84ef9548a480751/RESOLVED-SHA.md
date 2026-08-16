# Resolved SHA and provenance

## Product pins

| Identity | Exact value |
| --- | --- |
| Upstream PR | https://github.com/openclaw/openclaw/pull/124337 |
| Exact head (corrected) | `70d47bec1f93c5f4c7e07eebb84ef9548a480751` |
| Exact base | `5626a79cc836d95d236debd720a34fc2dcdcc685` |
| M1 implementation | `401dc7a1f5c3445b4ff85de6ac0574f91da2fde9` |
| MS Teams sibling retarget | `a01d78a4b33c155c948eeca283f179ef06fa7e7e` |
| P1 mixed fan-in cancel | `70d47bec1f93c5f4c7e07eebb84ef9548a480751` |
| Obsolete published head | `0a77fdcf5fc0bfaa1013798c5514286acc7bc5f5` |
| Frozen fossil | `c17a5c73a9bf9807d15b33bfa6bfb4aad5116398` |
| Bound issue | https://github.com/karmaterminal/openclaw/issues/1255 |
| Future runtime composite | **pending** — pure continuation assembly tip + `70d47bec` |

`git ls-tree` on `70d47bec` root: no `output.md`, no `proof-handoff.json`.
Those lane receipts left the product PR in the P1 commit.

## Fossil executable-surface identity

| Surface | SHA-256 |
| --- | --- |
| Fossil source `c17a5c73` | `573e0283ccedbeaea01b941c148963a71c97682d3772ccf7bcd31f8fe6d1522c` |
| Shipped fossil test on `70d47bec` | `ac150d78639dbe32832b84a4976fb14eec849e6c0eff3dd8a99d9139d1f26346` |

Assertion/input bodies remain comment/JSDoc-only vs `c17a5c73` (same as the
pre-P1 shipped file). P1 did not edit fossil assertions.

**CHARACTERIZES, not coupling.** RED on exact base `5626a79` with the
unchanged fossil. Coupling is reverse/reapply of the three production files.

## Corrected M1+P1 production bytes

`git diff 5626a79 70d47bec` on production only
([production-hunk.patch](receipts/production-hunk.patch)):

| File | SHA-256 at `5626a79` | SHA-256 at `70d47bec` |
| --- | --- | --- |
| `src/channels/message/ingress-drain.ts` | `fa738354f0f7bbbfd3d60b491ba4a2fdbc8f874ee50d1f59f5b6f39da4d71a6a` | `5855efc2245f5aa75b1cb30c58ab4186857163c13387c3297dc79a4f9db32c63` |
| `src/channels/message/ingress-drain-lifecycle.ts` | `5e7bafdb499701fcf9bf31cf3b116f50a25313b7827680f40ded66893f6eee3c` | `74e39bc13283b68217f266b2e3f193b0ebba1fbef841875149464325e75dbfe9` |
| `src/plugin-sdk/channel-ingress-runtime.ts` | `b659c1fb5ef18ed81df3082d514c1da9f0cca9ae02f073a02d0c51557e237fcf` | `ad86da4c52093cb374b193536267d906389695b3d73002e7e4bb8d39d3a47870` |

Reverse: copy base hashes onto the `70d47bec` worktree (tests unchanged) →
fossil RED + mixed-cancel RED. Reapply head hashes → 34 drain/cancel tests
GREEN. See receipts `08` / `09` / `10`.

## Targeted suites on `70d47bec` (not a 539-shard rerun)

| Suite | Files | Tests | Exit |
| --- | ---: | ---: | ---: |
| channels owner | 103 | 1130 | 0 |
| plugin-sdk | 77 | 765 (+13 skipped) | 0 |
| plugin-sdk runtime (fan-in) | 1 | 7 | 0 |
| MS Teams ingress-lifecycle | 1 | 4 | 0 |

The obsolete `0a77fdcf` 539-shard / 15-failed log is **historical only**.
It predates P1 and is not evidence for this head.

## Pending before treatment-composite deployment

Isolated Gateway + disposable state directory on:

1. current **pure** continuation assembly tip (`PROOFS/INDEX.json`
   `current_sha` `a7ef03177e0f42831a087521e6eb7720102d6be1`, continuation
   parent `c868194997d0a61de2e648580afdf40e0d0b34b9`);
2. plus exact product head `70d47bec1f93c5f4c7e07eebb84ef9548a480751`.

Do not treat mixed #121204 composite `2e72b665` as that smoke. Discord
delivery is not required.
