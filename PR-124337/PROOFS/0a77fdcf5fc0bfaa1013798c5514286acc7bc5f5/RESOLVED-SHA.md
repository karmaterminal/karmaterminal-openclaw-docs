# Resolved SHA and provenance

## Product pins

| Identity | Exact value |
| --- | --- |
| Upstream PR | https://github.com/openclaw/openclaw/pull/124337 |
| Exact head | `0a77fdcf5fc0bfaa1013798c5514286acc7bc5f5` |
| Exact base | `5626a79cc836d95d236debd720a34fc2dcdcc685` |
| Implementation commit | `401dc7a1f5c3445b4ff85de6ac0574f91da2fde9` |
| Review / sibling-retarget commit | `a01d78a4b33c155c948eeca283f179ef06fa7e7e` |
| Docs-stamp commits on the same head | `f99182612096737d048f8cf7be28670bcc20b835`, `0a77fdcf5fc0bfaa1013798c5514286acc7bc5f5` |
| Frozen fossil | `c17a5c73a9bf9807d15b33bfa6bfb4aad5116398` (`codeagent/silas-abandonment-red-fossil`) |
| Fossil checkpoint (earlier) | `6f4ef385ea7` on the same branch |
| Bound issue | https://github.com/karmaterminal/openclaw/issues/1255 |
| Parent issue | https://github.com/karmaterminal/openclaw/issues/1254 |
| Future runtime composite | **pending** — no isolated Gateway/state-dir smoke has been executed |

Head `0a77fdcf` is the product PR tip. Behavioral production bytes are in
`401dc7a1`. `a01d78a4` retargets the Microsoft Teams aged-ceiling sibling.
Later commits only stamp handoff metadata.

## Fossil executable-surface identity

Independent re-hash of the public fossil and shipped files (publication lane,
2026-08-16):

| Surface | SHA-256 |
| --- | --- |
| Fossil source `c17a5c73` | `573e0283ccedbeaea01b941c148963a71c97682d3772ccf7bcd31f8fe6d1522c` |
| Shipped source `0a77fdcf` | `ac150d78639dbe32832b84a4976fb14eec849e6c0eff3dd8a99d9139d1f26346` |

These match [receipts/06-fossil-equivalence.txt](receipts/06-fossil-equivalence.txt)
exactly. That receipt further records comment-stripped assertion/input bodies
as identical (`fb2f1bd8bf875baf77b757f3726e68d1d82c9a11112c0fb9e3ddc53454bdc8d7`
on both sides). The raw file-level diff is comment/JSDoc only; the
`INCIDENT_RETRY_POLICY` block (`maxAttempts: DEFAULT_INGRESS_RETRY_MAX_ATTEMPTS`,
`deadLetterMinAgeMs: 0`) and every `it(...)` body are the same executable
contract.

**CHARACTERIZES, not coupling:** the fossil is a characterization instrument.
It was RED on deployed `6b09b1dbe938ab6b5f56eaf4e58f1ed243f89955`, absorbed
upstream `530b33e`, later upstream context `ab5b8b9`, and exact base `5626a79`.
The defect is born-broken at the adoption seam, not a fork regression.
Intervention coupling is proven only by the revert/reapply walk.

## Full-suite classification (implementation head)

Command of record: `node --import tsx scripts/test-projects.mts`

Receipt: [receipts/08-full-suite.txt](receipts/08-full-suite.txt)

Tally: **539 shards / 15 failed**. Every failing file except the three drain
files is byte-identical to exact base `5626a79`. This lane does not own those
surfaces.

| Class | Items |
| --- | --- |
| **M1 sibling (fixed on `a01d78a4`)** | `extensions/msteams/src/monitor-handler/message-handler.ingress-lifecycle.test.ts` — old unbounded-after-age assertion. GREEN on exact-base drain; RED on patch until retargeted; retargeted assertion RED on exact-base drain, GREEN on patch. |
| **Isolation flake** | `message-handler.control-ui-build-admission.test.ts` (suite RED, isolation GREEN); `plugin-lifecycle-measure.test.ts` (suite RED, isolation GREEN). |
| **Deterministic pre-existing / host** | `exec-authorization-render.test.ts` (`/usr/bin/rg` vs `rg`); `src/claws/project.test.ts` golden digest mismatch. Isolation reruns still RED on the implementation host. |
| **Unchanged vs base; not re-run in isolation** | tui-pty timeouts; shell-snapshot HOME/path; Codex configured-MCP 120s timeouts; package-mac-app / install-sh / ensure-playwright / prepack / plugin-npm-package-manifest / npm-install-security-scan; git-backup `refs/heads/master`; backup-create 120s timeouts; full-release-validation-at-sha git refs. Same class as the fossil-lane baseline reds. |
| **Harness artifact** | `[code-mode-matrix] FAIL harness_error ollama-qwen3-5-9b-…` |

No remaining suite red is attributable to the drain patch after the MS Teams
retarget. The 539-shard run was **not** repeated after that test-only change.

## Negative-control shards

From [receipts/07-negative-control-shards.txt](receipts/07-negative-control-shards.txt):

| Shard | Files | Tests |
| --- | ---: | ---: |
| extension-discord | 221 | 2775 |
| extension-line | 33 | 528 |
| plugin-sdk | 77 | 765 (+13 skipped) |
| auto-reply-reply | 169 | 3795 (+1 skipped) |

## Pending before treatment-composite deployment

An isolated Gateway process with a disposable state directory must smoke the
four rows on the exact head before any fleet/treatment composite is treated as
proven. That smoke is **not** part of this publication. Live Discord delivery
is not required.

## Public-safety substitutions

Published receipts replace host-private paths (`<product-worktree>`,
`<tmp>/…`, generic `<host-path>`). Original staged SHA-256 values are in
[SHA256SUMS](SHA256SUMS). Commands, assertion diffs, and exit codes are
otherwise unedited.
