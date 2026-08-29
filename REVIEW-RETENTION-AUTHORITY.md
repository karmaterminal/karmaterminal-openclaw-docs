# Independent review: retention authority

Issue: `openclaw/openclaw#129388`

## Exact refs

The following named refs were resolved before evidence was credited. The safe
review branch was published unchanged before its identity check.

| Surface | Named ref | Local SHA | Tracking SHA | Server SHA | Equality |
|---|---|---|---|---|---|
| Product/base ref | `karmaterminal/openclaw:scribe/129388-covenant-upstream-absorb-20260828` | `0109521b0c2b8a2c81c9f901789a81c5316074a7` | `0109521b0c2b8a2c81c9f901789a81c5316074a7` | `0109521b0c2b8a2c81c9f901789a81c5316074a7` | equal |
| Safe lane ref | `codeagent/129388-retention-authority-independent-review-20260829` before this report-only commit | `094ae88f9c3c3e0b2ad9caf64fbb87246c8c1d49` | `094ae88f9c3c3e0b2ad9caf64fbb87246c8c1d49` | `094ae88f9c3c3e0b2ad9caf64fbb87246c8c1d49` | equal |
| CI/workflow ref | N/A - focused docs validation only | N/A | N/A | N/A | N/A |
| Presentation ref | N/A - out of scope | N/A | N/A | N/A | N/A |
| Docs/proof ref | `codeagent/129388-covenant-proof-retention-authority-fix-20260828` | `094ae88f9c3c3e0b2ad9caf64fbb87246c8c1d49` | `094ae88f9c3c3e0b2ad9caf64fbb87246c8c1d49` | `094ae88f9c3c3e0b2ad9caf64fbb87246c8c1d49` | equal |
| Parent harness ref | `codeagent/129388-covenant-authority-proof-harness-20260828` | `78927a643e8b5894a389691e695c1eb6bd7d2b4b` | `78927a643e8b5894a389691e695c1eb6bd7d2b4b` | `78927a643e8b5894a389691e695c1eb6bd7d2b4b` | equal |

Reviewed bytes:

- rejected parent: `78927a643e8b5894a389691e695c1eb6bd7d2b4b`
- implementation: `281552c039dcf45f7fdc3a7960448f0e989ea801`
- supplied report head: `094ae88f9c3c3e0b2ad9caf64fbb87246c8c1d49`
- current product assembly cross-check:
  `0109521b0c2b8a2c81c9f901789a81c5316074a7`

## Findings

| Severity | Path | Finding |
|---|---|---|
| **HIGH** | `tools/k6-proofs/lib/return-covenant-retention-inspector.mjs:102-151,216-325` | The purported canonical reader does not match the current product's canonical stores. It requires flat `subagent_runs.ended_at`, `cleanup_handled`, and `pending_final_delivery` columns, but product `src/state/openclaw-state-schema.sql:1533-1540` stores lifecycle and delivery in `payload_json`, decoded by `src/agents/subagents/registry/subagent-registry.store.sqlite.ts:77-117`. It reads `agents/*/sessions/sessions.json`, while product `src/state/openclaw-agent-schema.sql:1-46` explicitly makes per-agent SQLite `session_nodes.entry_json` canonical. It counts `flow_runs` but never inspects the product-owned `delivery_queue_entries` queue used for session delivery (`src/state/openclaw-state-schema.sql:1452-1471`; `src/infra/session-delivery-queue-storage.ts:56-65,314-343,619-630`). The product assembly also has no `/v1/return-covenant/resource-inspection` seam. The current product therefore fails closed on missing columns, but the docs-only mock cannot establish canonical PASS authority or prove every retained queue/session resource is counted. |
| **HIGH** | `tools/k6-proofs/lib/return-covenant-retention-inspector.mjs:41-57,216-278` | The SQLite read is not a no-follow read at the owning open boundary. `lstat`/`realpath` preflight the path, then `new DatabaseSync(databasePath)` reopens it by pathname without `O_NOFOLLOW` or an opened-inode binding. The later pathname `lstat` does not close the swap window. This does not meet the workorder's docs-owned no-follow requirement for candidate-writable live state. |
| **MEDIUM** | `tools/k6-proofs/scripts/launch-return-covenant-driver.mjs:946-979,1254-1295`; `tools/k6-proofs/lib/return-covenant-retention-inspector.mjs:189-203` | The live store leg samples the driver PID/start only before reading. The scenario supplies a one-second hold, but the launcher neither awaits the read before teardown nor re-samples PID/start after it. A read that begins live and finishes after shutdown is still labeled `runtimeAlive: true`; the final leg can begin before the live promise is awaited. Live/final authority is therefore not deterministically bracketed. |
| **MEDIUM** | `tools/k6-proofs/scripts/__tests__/return-covenant-authority.test.mjs:1591-1631,1863-1976` | Required negative coverage remains incomplete at the real composition boundary. The ledger control covers missing and duplicated chains, but not an explicitly open handle. The durable-store control builds the same noncanonical flat-column/JSON layout as the docs mock; it does not exercise current product `payload_json`, `delivery_queue_entries`, or `session_nodes`, nor a missing canonical column/table. |
| **LOW** | `tools/k6-proofs/scripts/__tests__/return-covenant-authority.test.mjs:2787-2849` | The owner suite was not deterministic in this review. Its first serial run was 69/70: the trusted-launcher PASS control lost `forbidden-explicit-revocation:bracket-token` with `observe returned an invalid driver receipt`. The isolated rerun and a second full serial run passed. That transient red must not be represented as an unqualified 70/70 receipt. |

## Confirmed boundaries

- The rejected parent copied `cleanupDraft.retained` and
  `cleanupDraft.allCaseHandlesClosed` into launcher-signed cleanup. The
  successor writes candidate cleanup only to
  `candidate-cleanup-diagnostic.json` with `passEligible: false`; signed counts
  and handle closure are built from separate resolver outputs.
- Missing/duplicated phase chains cannot be overridden by the candidate cleanup
  boolean. Signed closure is recomputed from the docs-owned issued/closed/open
  ledger, exact case/form coverage, unique handles, and phase proofs.
- Gateway and fixture-process retention is derived from launcher `/proc`
  PID/start, socket, process-tree, and process-group observations. Direct
  cleanup independently checks path removal and process disappearance.
- Redirect, relay, forged-clean gateway arrays, retained mock resources,
  unknown flow status, SQLite-view substitution, identity drift, nonzero k6
  exit, signal termination, and teardown mismatch fail closed in the exercised
  harness.
- The complete `PROOFS/**` tree is byte-identical at parent, implementation,
  and report head: Git tree
  `8692ee960b3455d3e7a3d0b638c2d38d75497946`. `PROOFS/INDEX.json` remains blob
  `3c719b950f8fd01ff4d4a018b9c15feee47df584`; the current manifest remains 37
  rows (32 pass, 4 partial, 1 honest-limit) with both exact-target flags false.

## Verification

| Command | Result |
|---|---|
| `node --test --test-concurrency=1 tools/k6-proofs/scripts/__tests__/return-covenant-authority.test.mjs tools/k6-proofs/scripts/__tests__/return-covenant-harness-closure-contract.test.mjs` | First run 69/70, with the transient trusted-launcher failure described above; second full run 70/70. |
| Same runner with `--test-name-pattern='trusted launcher owns snapshot, isolation, process start, and final cleanup'` | 1/1 pass between the two full runs. |
| `node --test --test-concurrency=1 tools/k6-proofs/scripts/__tests__/current-corpus-active-scope.test.mjs` | 2/2 pass. |
| `node tools/k6-proofs/scripts/validate-corpus.mjs --current` and `check-proof-row-manifests.mjs` | Pass; 37 current rows and 42 manifest entries. |
| `check-scenario-alignment.mjs`, `check-manifest-scenarios.mjs`, and `check-telemetry-contracts.mjs` | Pass; 42 manifests, 35 scenario files, 13 telemetry contracts. |
| `node --check` over all 10 changed JavaScript/MJS files; `JSON.parse` over all six return-covenant schemas | Pass. |
| `git diff --check 78927a643e8b5894a389691e695c1eb6bd7d2b4b..281552c039dcf45f7fdc3a7960448f0e989ea801` | Pass. |
| Product source walk at `0109521b0c2b8a2c81c9f901789a81c5316074a7` | Confirms the three canonical-store mismatches and absence of the inspection endpoint. |

No live product proof, Mode-B run, Gate 3g fallback, product mutation, corpus
fold, or presentation mutation was performed.

## Verdict

**REQUEST_CHANGES**

The successor removes the rejected candidate cleanup fields as direct PASS
inputs, but it does not yet establish the required independent retention
authority. The durable-store reader must be aligned with the current product
owners, include the actual delivery queue and canonical per-agent session
database, use a no-follow/opened-inode SQLite boundary, and synchronously
bracket the live read. Exact product execution remains blocked on the missing
product fixture/inspection seam and requires independent re-review after those
changes.
