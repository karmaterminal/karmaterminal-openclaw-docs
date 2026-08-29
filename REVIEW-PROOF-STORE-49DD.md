# Independent review: covenant proof-store authority `49dd1db3`

**Verdict: `REQUEST_CHANGES`.**

Issue binding: `openclaw/openclaw#129388`.

The canonical SQLite layouts, WAL-aware snapshots, runtime bracketing, HTTP
diagnostic demotion, and docs-owned handle ledger are substantially aligned
with the exact product floor. Two blocking omissions remain:

1. an exact-product failed `core/continuation-work` row that still owns
   `state_json.terminalNoticePending` is omitted from retention, and a
   deterministic end-to-end control produced a signed `PASS-candidate`; and
2. a candidate-controlled cleanup-diagnostic symlink raises `ELOOP` outside the
   diagnostic error classification, so the launcher exits without any signed
   receipt.

No exact-head product proof, live proof, corpus fold, product change, dependency
installation, Mode-B run, presentation change, deployment, or PR was performed.

## Named-reference contract

Every applicable ref was resolved before evidence was credited. The unchanged
safe lane was published before the lane identity gate.

| Category | Named reference | Local SHA | Tracking SHA | Server/object SHA | Equality |
|---|---|---|---|---|---|
| Product/base ref | `karmaterminal/openclaw:codeagent/129388-b8a16fd7-independent-review-20260829` | `b8a16fd74f1803e85ff9bb8f7ca7cee4fafe0f25` | `b8a16fd74f1803e85ff9bb8f7ca7cee4fafe0f25` | `b8a16fd74f1803e85ff9bb8f7ca7cee4fafe0f25` | equal |
| Safe lane ref before this report | `codeagent/129388-proof-store-49dd-independent-review-20260829` | `49dd1db3d9772b2c55e3c81ab0824d0e543bd6b8` | `49dd1db3d9772b2c55e3c81ab0824d0e543bd6b8` | `49dd1db3d9772b2c55e3c81ab0824d0e543bd6b8` | equal |
| CI/workflow ref | N/A | N/A | N/A | N/A | Focused-only review; Mode-B and live product proof are out of scope. |
| Presentation ref | N/A | N/A | N/A | N/A | Exact-head live proof and presentation are out of scope. |
| Docs/proof successor | `codeagent/129388-retention-authority-product-store-alignment-20260829` | `49dd1db3d9772b2c55e3c81ab0824d0e543bd6b8` | `49dd1db3d9772b2c55e3c81ab0824d0e543bd6b8` | `49dd1db3d9772b2c55e3c81ab0824d0e543bd6b8` | equal |
| Docs/proof parent report | `codeagent/129388-covenant-proof-retention-authority-fix-20260828` | `094ae88f9c3c3e0b2ad9caf64fbb87246c8c1d49` | `094ae88f9c3c3e0b2ad9caf64fbb87246c8c1d49` | `094ae88f9c3c3e0b2ad9caf64fbb87246c8c1d49` | equal |

The report commit cannot contain its own SHA. Its parent and complete reviewed
implementation byte are the safe-lane value above.

The inspector pins product-store contract byte
`0109521b0c2b8a2c81c9f901789a81c5316074a7`. It is an ancestor of
`b8a16fd74f1803e85ff9bb8f7ca7cee4fafe0f25`. Every owner blob cited below,
including the terminal-notice owners that expose Finding 1, is byte-identical
between those two product commits.

## Protected proof bytes

The parent and successor resolve to identical protected bytes:

| Surface | `094ae88f...` | `49dd1db3...` |
|---|---|---|
| `PROOFS/` tree | `8692ee960b3455d3e7a3d0b638c2d38d75497946` | `8692ee960b3455d3e7a3d0b638c2d38d75497946` |
| `PROOFS/INDEX.json` blob | `3c719b950f8fd01ff4d4a018b9c15feee47df584` | `3c719b950f8fd01ff4d4a018b9c15feee47df584` |
| `PROOFS/INDEX.json` SHA-256 | `802323debfd41a9556239c7b349cb94febdc159fb9b819d9ce2ffb7a0df37b08` | same |
| Current manifest blob | `7f79b035c56df9a8fd813df4cbc95f78ac4dcdd4` | same |
| Current manifest SHA-256 | `d19c4456643cd1ee4baf55db6954fcd29d4faf4be6a472ff6bf5ddf10ba8ff5e` | same |

The current manifest remains
`PROOFS/7c100aede1fd9895c0ae3e3837eafc9d98ad6982/proofs-manifest.json`:

- `R-CD-2`: `partial`;
- `R-CD-4`: `pass`;
- `R-CD-RETURN-COVENANT-AUTHORITY`: absent;
- `exact_target_execution`: `false`; and
- `exact_target_mode_b`: `false`.

## Exact product ownership

The ownership walk used Git-object reads at product
`b8a16fd74f1803e85ff9bb8f7ca7cee4fafe0f25`; it did not check out or modify
the product worktree.

| Product authority | Exact source | Review result |
|---|---|---|
| Global v13 schema | [`src/state/openclaw-state-schema.sql` lines 532-540, 1141-1148, 1452-1471, 1533-1540, 1720-1741](https://github.com/karmaterminal/openclaw/blob/b8a16fd74f1803e85ff9bb8f7ca7cee4fafe0f25/src/state/openclaw-state-schema.sql#L532-L540) | The inspector's ordered layouts for `schema_meta`, `agent_databases`, `delivery_queue_entries`, `subagent_runs`, and `flow_runs` match the product DDL. Extra product tables are permitted because the inspector checks only these named tables. |
| Canonical subagent payload | [`src/agents/subagents/registry/subagent-registry.store.sqlite.ts` lines 44-117 and 199-259](https://github.com/karmaterminal/openclaw/blob/b8a16fd74f1803e85ff9bb8f7ca7cee4fafe0f25/src/agents/subagents/registry/subagent-registry.store.sqlite.ts#L44-L117) | Nested execution/completion/delivery states, indexed identities, `expectsCompletionMessage=false`, and retired handoff markers align. The docs reader intentionally fails closed where product runtime filtering would skip malformed persisted JSON. |
| Generic durable delivery queue | [`src/infra/delivery-queue-sqlite.ts` lines 43-51 and 165-232](https://github.com/karmaterminal/openclaw/blob/b8a16fd74f1803e85ff9bb8f7ca7cee4fafe0f25/src/infra/delivery-queue-sqlite.ts#L43-L51), [`src/infra/delivery-queue-sqlite-bound.ts` lines 109-159](https://github.com/karmaterminal/openclaw/blob/b8a16fd74f1803e85ff9bb8f7ca7cee4fafe0f25/src/infra/delivery-queue-sqlite-bound.ts#L109-L159) | `pending` and failed `settlement_pending` are unfinished. Terminalization deletes or scrubs routing and attempt ownership before retaining failed/completed tombstones. The inspector accepts those terminal diagnostics without counting them as live. |
| Per-agent v19 schema | [`src/state/openclaw-agent-schema.sql` lines 1-46 and 121-150](https://github.com/karmaterminal/openclaw/blob/b8a16fd74f1803e85ff9bb8f7ca7cee4fafe0f25/src/state/openclaw-agent-schema.sql#L1-L46) | The inspector's full `schema_meta`, `session_nodes`, and `session_windows` layouts match the product DDL, including promoted lineage/status columns. |
| Session node/window marker | [`src/config/sessions/session-accessor.sqlite-transcript-state.ts` lines 105-190](https://github.com/karmaterminal/openclaw/blob/b8a16fd74f1803e85ff9bb8f7ca7cee4fafe0f25/src/config/sessions/session-accessor.sqlite-transcript-state.ts#L105-L190) | Product accepts `entry_json={}` only when the current `(session_id, session_key)` window exists; otherwise it requires repair. The inspector applies the same retained-window condition and treats other malformed nodes as unverified. |
| Registry and database locator | [`src/state/openclaw-state-db.paths.ts` lines 21-45](https://github.com/karmaterminal/openclaw/blob/b8a16fd74f1803e85ff9bb8f7ca7cee4fafe0f25/src/state/openclaw-state-db.paths.ts#L21-L45), [`src/state/openclaw-agent-db-registry.ts` lines 610-649](https://github.com/karmaterminal/openclaw/blob/b8a16fd74f1803e85ff9bb8f7ca7cee4fafe0f25/src/state/openclaw-agent-db-registry.ts#L610-L649), [`src/state/openclaw-agent-db.paths.ts` lines 21-43](https://github.com/karmaterminal/openclaw/blob/b8a16fd74f1803e85ff9bb8f7ca7cee4fafe0f25/src/state/openclaw-agent-db.paths.ts#L21-L43) | Under the isolated canonical state root, the product writes `agents/<normalized-id>/agent/openclaw-agent.sqlite` relative to the shared DB owner root. The inspector binds exactly that registry path and each physical database. |
| Continuation-work recovery | [`src/auto-reply/continuation/work-flow-state.ts` lines 53-64 and 121-131](https://github.com/karmaterminal/openclaw/blob/b8a16fd74f1803e85ff9bb8f7ca7cee4fafe0f25/src/auto-reply/continuation/work-flow-state.ts#L53-L64), [`src/auto-reply/continuation/work-store.ts` lines 574-680](https://github.com/karmaterminal/openclaw/blob/b8a16fd74f1803e85ff9bb8f7ca7cee4fafe0f25/src/auto-reply/continuation/work-store.ts#L574-L680), [`src/tasks/task-flow-registry.maintenance.ts` lines 21-40](https://github.com/karmaterminal/openclaw/blob/b8a16fd74f1803e85ff9bb8f7ca7cee4fafe0f25/src/tasks/task-flow-registry.maintenance.ts#L21-L40) | Queued/running work and the durable `succeeded` marker align. The separate failed-row `terminalNoticePending` recovery owner does not; this is Finding 1. |

Product does not expose a canonical durable gateway PID/start/socket ledger for
this proof. The docs launcher correctly owns that boundary through direct
`/proc` process-start and listening-socket observations.

## Findings

### 1. Blocking: an owed terminal notice produces a signed PASS

**Invariant and owner.** A terminally failed continuation wake must not be
considered fully closed while its failed `flow_runs` row carries
`state_json.terminalNoticePending="retry-exhausted"`. Product writes that
marker in the same compare-and-swap transition that changes the flow to
`failed`, then retains it as the last durable pointer until the durable session
delivery queue accepts the notice:

- [`work-dispatch-execution.ts` lines 647-665](https://github.com/karmaterminal/openclaw/blob/b8a16fd74f1803e85ff9bb8f7ca7cee4fafe0f25/src/auto-reply/continuation/work-dispatch-execution.ts#L647-L665);
- [`work-store.ts` lines 574-680](https://github.com/karmaterminal/openclaw/blob/b8a16fd74f1803e85ff9bb8f7ca7cee4fafe0f25/src/auto-reply/continuation/work-store.ts#L574-L680);
- [`work-terminal-notice.ts` lines 1-25 and 73-155](https://github.com/karmaterminal/openclaw/blob/b8a16fd74f1803e85ff9bb8f7ca7cee4fafe0f25/src/auto-reply/continuation/work-terminal-notice.ts#L1-L25); and
- [`task-flow-registry.maintenance.ts` lines 21-40](https://github.com/karmaterminal/openclaw/blob/b8a16fd74f1803e85ff9bb8f7ca7cee4fafe0f25/src/tasks/task-flow-registry.maintenance.ts#L21-L40).

The docs inspector validates the continuation-work state but returns retained
only for `queued` or `running`; every `failed` row is excluded regardless of
`terminalNoticePending`:
[`return-covenant-retention-inspector.mjs` lines 860-923](https://github.com/karmaterminal/karmaterminal-openclaw-docs/blob/49dd1db3d9772b2c55e3c81ab0824d0e543bd6b8/tools/k6-proofs/lib/return-covenant-retention-inspector.mjs#L860-L923).

**Deterministic end-to-end negative control.** A review-only test transformed
the exact committed mock product driver to insert this canonical row immediately
before closing the v13 state database:

```text
controller_id = core/continuation-work
sync_mode = managed
status = failed
ended_at = <finite timestamp>
state_json = {
  kind: continuation_work,
  sessionKey: agent:proof:main,
  hop: 1,
  delayMs: 0,
  electedAt: 1,
  dueAt: 1,
  maxChainLength: 8,
  terminalNoticePending: retry-exhausted
}
```

It then ran the full trusted launcher composition boundary with one Node test
worker. The expected secure result was launcher exit 1, retained queue count 1,
and signed FAIL. The actual result was:

```json
{"launcherExitCode":0,"verdict":"PASS-candidate","retainedQueueItems":0,"liveQueueItems":[]}
```

The negative control failed deterministically with `0 !== 1`. A narrower direct
inspector control independently returned `status="observed"` and
`queueItems=[]` for the same row. Both review-only test edits were removed after
capture, and the tracked test file was verified byte-identical to
`49dd1db3`.

**Sibling and recovery coverage.** Existing tests cover queued/running work, a
durable `succeeded` marker, failed and blocked terminal siblings, delivery-queue
settlement, WAL-only rows, and restart bracketing. They do not create the exact
failed-row pending-notice state. This omission is specifically a partial-failure
and restart-recovery hole: product keeps the marker because durable queue handoff
failed or may have crashed.

**Required change.** Decode the closed product shape of
`terminalNoticePending`, count a failed continuation-work row carrying it as
retained queue work until product clears it, and add both direct-inspector and
end-to-end signed-receipt regressions. Unknown marker values must fail closed.

### 2. Blocking: a cleanup-diagnostic symlink suppresses the signed receipt

**Invariant and owner.** Candidate cleanup self-report is explicitly
`untrusted-diagnostic-only`; no candidate-controlled file shape may grant,
veto, or suppress docs-owned cleanup and receipt generation.

`readBoundedCandidateJson()` correctly opens with `O_NOFOLLOW`, so a symlink
raises `ELOOP`:
[`return-covenant-candidate-io.mjs` lines 12-34](https://github.com/karmaterminal/karmaterminal-openclaw-docs/blob/49dd1db3d9772b2c55e3c81ab0824d0e543bd6b8/tools/k6-proofs/lib/return-covenant-candidate-io.mjs#L12-L34).
The cleanup-diagnostic caller classifies only `ENOENT`, `SyntaxError`, and two
message-pattern failures as diagnostic. It rethrows `ELOOP` before constructing
docs-owned cleanup or the observer receipt:
[`launch-return-covenant-driver.mjs` lines 1423-1448](https://github.com/karmaterminal/karmaterminal-openclaw-docs/blob/49dd1db3d9772b2c55e3c81ab0824d0e543bd6b8/tools/k6-proofs/scripts/launch-return-covenant-driver.mjs#L1423-L1448).

**Deterministic end-to-end negative control.** A review-only driver transform
wrote valid JSON to `cleanup-draft.json.target` and made
`cleanup-draft.json` a symlink to it. The trusted launcher produced:

```text
launcher exit: 1
candidate-cleanup-diagnostic.json: absent
cleanup.json: absent
observer-receipt.json: absent
stderr: ELOOP / too many symbolic links
```

The one-worker control passed all five assertions in `28.656s`. The review-only
test edit was removed and the tracked test file was again verified identical to
`49dd1db3`.

**Sibling and partial-failure coverage.** Missing files, malformed JSON,
oversized regular files, FIFOs, and symlink rejection in the low-level reader
are tested. There is no launcher-level regression requiring all
candidate-controlled cleanup-diagnostic read failures to continue into
docs-owned cleanup and a signed receipt. Other candidate-controlled open errors,
such as an unreadable file, follow the same unhandled branch.

**Required change.** Classify the bounded set of expected candidate-controlled
filesystem/read failures as diagnostic `invalid` or `missing`, while preserving
unexpected launcher failures as errors. Add an end-to-end regression that
requires the docs-owned cleanup and a cryptographically valid receipt to exist;
the candidate diagnostic itself must remain `passEligible=false`.

## Required review matrix

| Required surface | Result |
|---|---|
| `subagent_runs.payload_json` lifecycle/delivery state | Confirmed against exact product nested state, required-final-delivery, suspended delivery, recovery/wake/kill/steer/rollback, and collector markers. Malformed canonical payloads project unverified rather than clean. |
| `delivery_queue_entries` | Confirmed for pending, failed `settlement_pending`, producer/platform attempt ownership, writer-owned metadata, and scrubbed terminal tombstones. |
| Per-agent `session_nodes.entry_json`, windows, tombstones | Confirmed against v19 DDL and product's matching-window `{}` marker. Spawned rows remain temporary even without run/flow/queue correlation, so orphaned spawned sessions are found. |
| Task-flow/controller/run relevance | **Rejected:** failed continuation-work rows with `terminalNoticePending` are product-owned live obligations but are omitted. |
| Canonical registry and agent DB inventory | Confirmed for the isolated canonical state root and relative default product locator; views, owner/version drift, and registry/layout ambiguity fail closed. |
| WAL-aware, no-follow, inode/device/path-bound snapshots | Confirmed. Main DB, present WAL, and present SHM are opened with `O_NOFOLLOW`, copied from open handles, and revalidated by path plus device/inode/mode/size/mtime. The WAL-only row control passes. |
| Stable live/final PID/start/socket bracket | Confirmed. The complete process group is stopped for the live snapshot; driver, gateway, group membership, start identities, endpoint ownership, and listener fingerprint must match before/after. Final observation follows bounded empty-group settlement. |
| Missing tables/columns, views, unknown statuses/layouts, malformed metadata | The generic durable-store path returns `unverified-resource-retention`, and resolver tests preserve signed FAIL. **Exception:** the candidate cleanup-diagnostic symlink exits before signing. |
| Candidate HTTP arrays | Confirmed diagnostic-only. Missing, redirected, malformed, partial, overflowed, relayed, and forged-clean HTTP responses cannot grant or veto PASS. |
| Candidate cleanup self-report | **Rejected:** values are not authoritative, but an unhandled symlink/open error can veto the entire receipt. |
| Handle closure | Confirmed as derived from exact docs-owned issued/closed/open ledger coverage plus cleanup phase HMAC, not candidate cleanup claims. |
| Reference fixture layout | The v13/v19 table DDL and canonical locators match product byte-for-byte. **Behavioral fixture coverage is incomplete** because no fixture models the product's terminal-notice obligation. |
| Existing `PROOFS/**`, index, row states, exact-target flags | Confirmed unchanged by tree/blob/SHA-256 comparison and focused corpus checks. |

## Deterministic validation

Acceptance path: **focused-only**, as required by the workorder. No Mode-B,
Gate 3g, live product proof, or monolithic full suite was used.

### Full owner/closure suite, serial repetition 1

```bash
node --test --test-concurrency=1 \
  tools/k6-proofs/scripts/__tests__/return-covenant-authority.test.mjs \
  tools/k6-proofs/scripts/__tests__/return-covenant-harness-closure-contract.test.mjs
```

Result: `104/104` pass, `0` fail, `242468.609ms`.

### Full owner/closure suite, serial repetition 2

The exact command above was repeated without changes.

Result: `104/104` pass, `0` fail, `242019.558ms`.

There was no intermittent red between the two repetitions. The two missing
review controls above explain why the green committed suite is not sufficient
for confirmation.

### Corpus, manifest, scenario, telemetry, schema, syntax, and diff

```bash
node --test --test-concurrency=1 \
  tools/k6-proofs/scripts/__tests__/current-corpus-active-scope.test.mjs
node tools/k6-proofs/scripts/validate-corpus.mjs --current
node tools/k6-proofs/scripts/check-proof-row-manifests.mjs
node tools/k6-proofs/scripts/check-scenario-alignment.mjs
node tools/k6-proofs/scripts/check-manifest-scenarios.mjs
node tools/k6-proofs/scripts/check-telemetry-contracts.mjs
node --check <each of the eight changed JavaScript/MJS files>
# JSON.parse every return-covenant *.schema.json
git diff --check \
  094ae88f9c3c3e0b2ad9caf64fbb87246c8c1d49..\
49dd1db3d9772b2c55e3c81ab0824d0e543bd6b8
git diff --exit-code --name-only \
  094ae88f9c3c3e0b2ad9caf64fbb87246c8c1d49..\
49dd1db3d9772b2c55e3c81ab0824d0e543bd6b8 -- PROOFS
```

Results:

- current-corpus scope: `2/2` pass;
- corpus validator: 37 rows, rollup
  `pass=32, partial=4, honest_limit=1, fail=0`, all checks pass;
- proof-row manifests: 37 proof rows, 42 manifests, 0 missing;
- scenario alignment: `ok=true`;
- manifest/scenario registry: 42 manifests, 35 scenario files, pass;
- telemetry: 13 contracts, 9 rows requiring telemetry receipts, 0
  telemetry-rebindable PASS claims, pass;
- JavaScript/MJS syntax: 8/8 pass;
- JSON schemas: 6/6 parse;
- candidate diff check: pass; and
- protected `PROOFS/**` diff: empty.

## Final verdict

`REQUEST_CHANGES`

The successor cannot yet claim that the proof-store authority prevents a signed
PASS from omitted canonical product state, nor that all candidate cleanup
self-report failures preserve a signed FAIL receipt. Both defects are at the
docs-owned composition boundary and require deterministic regressions before
the authority can be confirmed.
