# PR #129388 proof-harness closure

Status: **harness implementation complete; corpus refire still required**.
This lane changed docs/k6 harness and evidence-contract code only. It did not
modify OpenClaw product code, fire live proof traffic, rewrite the frozen aff
corpus, or claim that the 41-row corpus is acceptance-complete.

- Harness implementation SHA:
  `7c5bb23c7695acd341aabc3479451797a7f0f473`
- Branch: `codeagent/129388-proof-harness-closure`
- Implementation scope: 63 files, 4,123 insertions, 320 deletions from the
  rejected base
- CI path: `focused-only` (broad Mode-B N/A for this docs harness lane)

## Named-ref contract

The safe lane was first published unchanged at the product/base SHA. Applicable
refs were resolved before evidence review and refreshed after implementation.

| Category | Named ref | Full SHA | Identity receipt |
|---|---|---|---|
| Product/base | `karmaterminal/karmaterminal-openclaw-docs@0e75318a68d7145c0c5b99e8b11bda304f4f9fd2` | `0e75318a68d7145c0c5b99e8b11bda304f4f9fd2` | local object = GitHub server commit |
| Safe lane | `karmaterminal/karmaterminal-openclaw-docs:codeagent/129388-proof-harness-closure` | `7c5bb23c7695acd341aabc3479451797a7f0f473` implementation checkpoint | local = tracking = server before this report-only commit |
| CI/workflow | focused docs harness/unit/contract validation; broad Mode-B N/A | N/A | N/A |
| Presentation | `openclaw/openclaw#129388`, head `codeagent/85651-upstream-1ba243c8-gates` | `4737afdf7dcc5cca53f8dd1bdaaeaa122ce17bbd` | GitHub PR head |
| Docs/proof | `karmaterminal/karmaterminal-openclaw-docs:codeagent/129388-proof-transpose-aff980` | `c083eae1cb6b52c5e50f75d785a039c332172aca` | local object = tracking = server |

## Closure results

### `R-CD-2`

**Invariant and owner:** the row-scoped signed resolver is the sole positive
behavior authority. A gateway `replayInvalid` bit describes future replay
safety; it cannot override the same accepted run after that run proves the
exact post-tool sentinel, successful typed delegate, silent-wake dispatch/fire,
distinct wake lifecycle, and quiet/no-channel boundary.

- Rejected-base control:
  `r-cd-2-replay-diagnostic.test.mjs` exits 1 on
  `0e75318a68d7145c0c5b99e8b11bda304f4f9fd2`; actual verdict is
  `FAIL-candidate`, expected `PASS-candidate`.
- Successor: the same control passes. A genuinely incomplete replay lifecycle,
  provider/turn failure, missing terminal sentinel, mismatched topology, or
  explicit channel delivery remains signed non-PASS.
- Alternate path: normal typed delegate behavior remains owned by `R-CD-1`.
  The shared lifecycle helper now separates terminal status from the replay
  diagnostic instead of weakening terminal failure checks.

### `R-CD-TOKEN`

**Invariant and owner:** `observeTokenTaskLedger` correlates the unlabeled
token-created delegate by the unique new disposable origin child's requester
session, subagent type, and `parentTaskId` when present. Title prose is not
identity. Exactly one owned delegate is required.

- Rejected-base control: the successor
  `r-cd-token-contract.test.mjs` exits 1 on `0e75318a...`; the unlabeled task
  produces `delegate_task_unique_count=0`.
- Successor: the unlabeled public `TaskSummary` path passes and completes the
  return binding.
- Fail-closed siblings: two owned delegates, a wrong parent, an unrelated
  requester, incomplete pagination, rejected task-list reads, interruption,
  unstable snapshots, non-terminal tasks, or mismatched return source/target
  remain `PARTIAL-candidate`.

### `R-CW-6` / #516

**Invariant and owner:** the generated selected-boundary test must use the
candidate's current subagent spawn module, raw system-event export, and
revision-fenced delegate TaskFlow test harness. It must emit the selected
receipt before the fixture can PASS. Early exit retains only a sanitized
classification, booleans, byte count, exit code, and output fingerprint.

- Rejected evidence: exact product
  `80311e8aa07fd560cb957475517c5ea18164541c` with the old docs template
  returned `FAIL-fixture`; the selected receipt was absent while the product
  regression suite and other runtime surfaces passed.
- Rejected-base static control:
  `proof-harness-closure-contract.test.mjs` exits 1 on `0e75318a...` because
  the generated template still imports the pre-refactor owner.
- Final successor fixture:
  - harness `7c5bb23c7695acd341aabc3479451797a7f0f473`
  - product `80311e8aa07fd560cb957475517c5ea18164541c`
  - candidate-declared and executing pnpm `11.22.0`
  - verdict `PASS-candidate`
  - `fixture-result.json` SHA-256
    `f52a1d4ab97b8f508a93ba7169414a587c126eaccf4e2280137239f88a012ba9`
  - `dispatch-boundary-suite.json` SHA-256
    `0e7eb2dfcb326823abe25cc2a6b838bab85f525d9c3d827cb1f1dbe4c04e28ca`
  - all matrix, dispatch, structured-cap, no-rejected-spawn, durable recovery,
    typed-tool, dependency identity, worktree integrity, cleanup, and
    public-artifact checks are true.

The nearest candidate-owned
`delegate-dispatch.chain-depth-exhaustion.test.ts` also passed. The disposable
worktree was removed and the exact source anchor remained tracked-clean.

### `R-OBS-BACKEND-DISPOSITION` / #517

**Invariant and owner:** every Tempo search, Tempo trace-by-id fetch, and Loki
range query writes one public-safe interaction to `backend-status.json`.
Only `status=complete` with all manifest completeness keys has count and PASS
authority.

Implemented:

- shared `complete | partial | unavailable | capped | unknown` classifier;
- atomic append/recovery store with run-identity, completeness-key, and
  rebind-key equality;
- Tempo and Loki adapters, including capped-window slice strategy;
- runnable `r-obs-backend-disposition.js`;
- row-list, summary postprocessor, evidence writer, and candidate-envelope
  wiring;
- declared artifact and nested sidecar validation;
- PASS withholding for missing/invalid/non-complete backend status and missing
  telemetry artifacts.

The HTTP-200/zero/no-metadata control is `unknown`, with
`zeroResultAuthoritative=false`. Explicit non-PASS verdicts are never promoted.
Corrupt persistence, cross-run reuse, changed key sets, raw response fields,
private rebind values, and hand-edited envelope fields fail closed.

### `R-CD-CHAINED-DEPTH-2`

The committed aff bytes ended at exactly 150,401 ms with child and grandchild
sentinels true and depth 2 observed, but with:

```json
{
  "chain_return_received": false,
  "root_return_candidate": null,
  "root_return_receipt": null
}
```

Those bytes alone could not distinguish a late return from missing propagation,
so the lane reported TROUBLE before changing anything. Historical committed
PASS evidence at docs commit `736ad116` then resolved ownership: the earlier
partial was caused by depth 1 returning immediately. The successful method
required `fanoutMode=tree`, a depth-1 `continue_work` wake after the leaf, and a
depth-1 final response after observing the grandchild.

The manifest now restores that proven composition. The scenario records the
depth-1 recovery wake and gives root return a fresh post-grandchild observation
window instead of inheriting the nearly expired dispatch timer. The rejected
base contract test fails on the immediate-return prompt; the successor
contract and observation-window tests pass. The row remains corpus `partial`
until a live refire produces the root acknowledgement.

## Rejected-base negative controls

The exact base was archived without checking it out over the lane:

```bash
BASE_DIR=<private-empty-dir>
git archive 0e75318a68d7145c0c5b99e8b11bda304f4f9fd2 tools/k6-proofs |
  tar -x -C "$BASE_DIR"

# Overlay only the successor regression test being exercised, then run:
cp <successor-checkout>/tools/k6-proofs/scripts/__tests__/r-cd-2-replay-diagnostic.test.mjs \
  "$BASE_DIR/tools/k6-proofs/scripts/__tests__/"
cp <successor-checkout>/tools/k6-proofs/scripts/__tests__/r-cd-token-contract.test.mjs \
  "$BASE_DIR/tools/k6-proofs/scripts/__tests__/"
cp <successor-checkout>/tools/k6-proofs/scripts/__tests__/proof-harness-closure-contract.test.mjs \
  "$BASE_DIR/tools/k6-proofs/scripts/__tests__/"
cp <successor-checkout>/tools/k6-proofs/scripts/__tests__/telemetry-backend-status.test.mjs \
  "$BASE_DIR/tools/k6-proofs/scripts/__tests__/"

(cd "$BASE_DIR" &&
  node --test tools/k6-proofs/scripts/__tests__/r-cd-2-replay-diagnostic.test.mjs)
(cd "$BASE_DIR" &&
  node --test tools/k6-proofs/scripts/__tests__/r-cd-token-contract.test.mjs)
(cd "$BASE_DIR" &&
  node --test tools/k6-proofs/scripts/__tests__/proof-harness-closure-contract.test.mjs)
(cd "$BASE_DIR" &&
  node --test tools/k6-proofs/scripts/__tests__/telemetry-backend-status.test.mjs)
```

All four commands exit 1 on the base for the expected reason:

| Control | Rejected-base reason |
|---|---|
| R-CD-2 replay diagnostic | actual `FAIL-candidate`, expected `PASS-candidate` |
| R-CD-TOKEN unlabeled task | structural delegate count remains zero; unlabeled tests fail |
| R-CW-6 + chained-depth closure contract | old spawn owner/export and immediate-return chain prompt fail |
| Backend disposition | shared backend-status module is absent (`ERR_MODULE_NOT_FOUND`) |

The same overlaid controls pass on
`7c5bb23c7695acd341aabc3479451797a7f0f473`.

## Validation

Focused owner and complete docs harness proof:

```bash
node --test \
  tools/k6-proofs/scripts/__tests__/*.test.mjs \
  tools/k6-proofs/tests/*.test.mjs
# 416 tests, 416 pass, 0 fail
```

Catalog and format gates:

```bash
node tools/k6-proofs/scripts/check-manifest-scenarios.mjs
node tools/k6-proofs/scripts/check-scenario-alignment.mjs
node tools/k6-proofs/scripts/check-proof-row-manifests.mjs
node tools/k6-proofs/scripts/check-telemetry-contracts.mjs
node tools/k6-proofs/scripts/list-runnable-rows.mjs --all
bash -n tools/k6-proofs/run-proof.sh tools/k6-proofs/scripts/run-proofs.sh
k6 inspect tools/k6-proofs/scenarios/r-obs-backend-disposition.js
jq empty tools/k6-proofs/manifests/*.json tools/k6-proofs/row-manifest.schema.json
python3 -c 'import xml.etree.ElementTree as ET; ET.parse("tools/k6-proofs/k6-proofs-pipeline.xml")'
```

No-traffic affected-row selection:

```bash
cd tools/k6-proofs
K6_PROOF_OUT_DIR=<private-output-dir> \
OPENCLAW_CANDIDATE_SHA=4737afdf7dcc5cca53f8dd1bdaaeaa122ce17bbd \
  ./scripts/run-proofs.sh --dry-run \
  R-CD-2,R-CD-TOKEN,R-CW-6,R-OBS-BACKEND-DISPOSITION,R-CD-CHAINED-DEPTH-2,\
R-OBS-CONT-PROVENANCE,R-OBS-PROOF-MARKER,R-OBS-TERMINAL-OUTCOME \
  4737afdf7dcc5cca53f8dd1bdaaeaa122ce17bbd
```

The three repaired live rows and backend row resolve runnable, `R-CW-6`
resolves to its process-local fixture, and the three product-owned rows remain
construct-only. No gateway dispatch or corpus write occurred.

Broad Mode-B is N/A for this docs-only lane. No Gate 3g fallback was used.

## Exact affected-row refire plan

Use a clean detached checkout of harness
`7c5bb23c7695acd341aabc3479451797a7f0f473`. For live rows, deploy exact product
`4737afdf7dcc5cca53f8dd1bdaaeaa122ce17bbd`, require
`OPENCLAW_RUNTIME_BUILD_SHA` to equal it, and run rows serially:

```bash
cd tools/k6-proofs
export OPENCLAW_PROOFS_DOCS_REF=7c5bb23c7695acd341aabc3479451797a7f0f473
export OPENCLAW_CANDIDATE_SHA=4737afdf7dcc5cca53f8dd1bdaaeaa122ce17bbd
export OPENCLAW_RUNTIME_BUILD_SHA=4737afdf7dcc5cca53f8dd1bdaaeaa122ce17bbd
export K6_PROOF_OUT_DIR=<private-candidate-output>

./scripts/run-proofs.sh --live \
  --docs-ref "$OPENCLAW_PROOFS_DOCS_REF" \
  R-CD-2,R-CD-TOKEN,R-CD-CHAINED-DEPTH-2 \
  "$OPENCLAW_CANDIDATE_SHA"
```

Run backend disposition separately with bounded public-safe queries:

```bash
OPENCLAW_PROOFS_TEMPO_TRACEQL='<bounded public-safe TraceQL>' \
OPENCLAW_PROOFS_LOKI_LOGQL='<bounded public-safe LogQL>' \
./scripts/run-proofs.sh --live \
  --docs-ref "$OPENCLAW_PROOFS_DOCS_REF" \
  R-OBS-BACKEND-DISPOSITION \
  "$OPENCLAW_CANDIDATE_SHA"
```

Run the current-candidate R-CW-6 component fixture without gateway traffic:

```bash
PATH=<lane-local-pnpm-11.22.0>/node_modules/.bin:$PATH \
node tools/k6-proofs/scripts/run-max-chain-fixture.mjs \
  --source-dir <clean-exact-4737afdf-worktree> \
  --candidate-sha 4737afdf7dcc5cca53f8dd1bdaaeaa122ce17bbd \
  --artifact-dir <private-empty-artifact-dir> \
  --max-chain-length 3 \
  --json
```

| Row | Required artifacts | PASS predicates |
|---|---|---|
| `R-CD-2` | signed authoritative receipt, `backend-status.json`, seat readiness, row/candidate result | complete bound typed silent-wake lifecycle, exact sentinel, one dispatch/fire, distinct wake, no channel delivery, backend complete |
| `R-CD-TOKEN` | attempt/build identity, signed receipt, correlation, backend status, candidate result | raw-final-text seat, one origin task, one structurally owned unlabeled delegate, completion and bound return, no typed origin, backend complete |
| `R-CD-CHAINED-DEPTH-2` | both hop identities/sentinels, recovery-wake receipt, exact root acknowledgement, trace/backend status | tree fanout, depth-1 post-leaf wake, `CHILD-SAW-GRANDCHILD`, distinct child/grandchild, root `ROOT-CHAIN-ACK` inside its fresh window |
| `R-OBS-BACKEND-DISPOSITION` | `backend-status.json`, row/candidate result | both configured interactions complete, all five classification controls exact, rebind keys complete, no capped/partial/unknown interaction |
| `R-CW-6` | eight fixture receipts | every `fixture-result.checks` value true; selected boundary emits receipt; cleanup and public-safety true |

Any absent metadata remains PARTIAL/MISSING. Any explicit contradictory behavior
remains FAIL. A 200 backend response without completeness metadata remains
`unknown`; no count or summary can promote it.

## Remaining product-owned rows

These rows are intentionally unchanged, construct-only, and missing until a
product descendant supplies instrumentation:

- `R-OBS-CONT-PROVENANCE`
- `R-OBS-PROOF-MARKER`
- `R-OBS-TERMINAL-OUTCOME`

The aff corpus remains `41 total / 32 pass / 4 partial / 1 honest_limit /
4 missing / 0 fail` until reviewed refires are folded. This lane does not claim
acceptance completion.

## Tooling gap

No AI subagent, task agent, autoreview, stock GitNexus, PR creation, or merge
was used. The installed prebuilt `karmaterminal/GitNexus` fork at
`source/GitNexus` is
`3c1e686edfc1acaac882927cada121ddd7c47bcc`
(`rc/4bc8622642a9da163bae8fc38a4d6af0a1d2085f-1-g3c1e686e`), but its index has
the disclosed LadybugDB 42/40 mismatch. Review therefore used direct source,
caller, sibling, artifact, and test inspection only.
