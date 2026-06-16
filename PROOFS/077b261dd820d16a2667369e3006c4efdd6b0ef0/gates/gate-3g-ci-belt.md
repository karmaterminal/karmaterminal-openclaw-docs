# Gate-3g — CI belt on the deployed SHA `077b261dd8`

The authoritative full-suite gate for this SHA is the **openclaw-ci Gate-3g** (both arches, ~24k tests), dispatched on `karmaterminal/openclaw-bootstrap` via `repository_dispatch` with `client_payload[ref]=077b261dd820d16a2667369e3006c4efdd6b0ef0`.

## Deploy-candidate belt: run `27579901505` (both arches)

**Checkout byte-confirmed** (defeats the `repository_dispatch` head_sha artifact — the API shows `head_sha=8e3c9cf77/main`, the bootstrap default; the *tested* ref is the payload, logged explicitly):
```
REF: 077b261dd820d16a2667369e3006c4efdd6b0ef0
ref '077b261dd8...' not a branch/tag — falling back to SHA fetch
HEAD is now at 077b261dd8  Merge pull request #1029 from karmaterminal/cael/20260615/am-1028-recall-isolation
SHA: 077b261dd820d16a2667369e3006c4efdd6b0ef0
```

**Result — the two genuine ours-reds are GREEN, both arches:**
```
✓  extension-active-memory  ../../extensions/active-memory/index.test.ts  (148 tests)   [amd64 + aarch64]
✓  extension-active-memory  config.test.ts (9)  ✓  doctor-contract-api.test.ts (1)
```
- active-memory `index.test.ts` **148/148 GREEN** both arches (#1029 cure)
- telegram `:1403` store-isolation GREEN (#1027 cure)
- codex-supervisor flake cleared

## Remaining reds = receipts (NOT ours)

Each remaining red shard is accounted for — none is a product regression:

| Shard | Class | Receipt |
|---|---|---|
| install-sh / compaction-planning-worker / shell-snapshot | provably-upstream | origin/main `93b7e3d7` reds them too — belt `27558857124` (BOTH arches FAILURE on pristine upstream) |
| browser/server.agent-contract-core | byte-identical-upstream → isolation/flake | test + source both 0-diff vs upstream; passes on origin/main full-suite |
| slack/monitor/message-handler/prepare | drift-divergent | `077b261dd8` is 131 commits behind upstream on slack; classifies clean after the drift-correct follow-up |

## Upstream-red receipt (the no-ship-red exception basis)

Belt `27558857124` on **origin/main `93b7e3d7`** (pristine upstream sync) = **completed/FAILURE both arches** on the Gate-3g step. So the Gate-3g is *upstream-red*, not fully-greenable from pristine — the remaining reds on `077b261dd8` are the inherited-upstream/env set, ride under figs's no-ship-red **exception** (provably-broken-in-upstream).

**Net: zero ours-reds on the deployed SHA.** The only two genuine ours-reds (active-memory, telegram) are fixed source-clean + GREEN both arches; everything else is a receipt.

_Verified by 🌿 frond-scribe from the run `27579901505` job logs (amd64 job `81537393245`) + the upstream-repro `27558857124`._
