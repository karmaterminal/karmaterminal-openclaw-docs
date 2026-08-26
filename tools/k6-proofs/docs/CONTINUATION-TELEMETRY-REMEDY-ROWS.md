# Continuation telemetry remedy rows

Row contracts derived from the continuation telemetry census,
`karmaterminal/openclaw#1254`.

- Census report commit: `39803b297bd4786db3971eb82a3a7fd0b29bc643`
- Exact product basis observed: `6b09b1dbe938ab6b5f56eaf4e58f1ed243f89955`

> **None of the product instrumentation described here exists yet.** Every
> attribute and span marked `emittedByProduct:false` is owed work on
> `karmaterminal/openclaw`. The exception is the harness-side backend
> disposition receipt: `R-OBS-BACKEND-DISPOSITION` is implemented here and does
> not claim that any missing product instrumentation exists.

## What the census established

The census counted the fleet's actual continuation telemetry over a 24h and a 7d
window and reached four findings that a proof catalog has to answer:

1. **Accepted continuation entry activity is rare.** 23 accepted
   `continuation.work` + `continuation.delegate.dispatch` spans in 24h, 366 in
   7d, against 585 / 23,796 model-turn spans. Continuation alone does not
   explain fleet symptom prevalence. It intersects the symptoms; causation is
   unproven.
2. **Accepted entry spans carry no identity.** No `signal.kind`, no origin, no
   session, no turn, no run. `signal.kind` is attached only to
   `continuation.disabled` and to compaction-release spans. Typed-tool spans and
   accepted-entry spans therefore **cannot be causally joined**, and the three
   primitive-attribution streams (typed-tool spans, bracket `effective-signal`
   logs, tool-call `effective-signal` logs) are separate evidence, not addends.
3. **Proof traffic has no durable marker.** Tempo resource tags carried no k6 or
   Project-81 marker in either window. That is *absence of a marker*, not
   absence of proof traffic: the known manual proof window that started around
   `2026-08-15T16:25Z` could not be excluded, so the aggregate records
   `classification: unknown_without_stable_marker` rather than converting the
   missing marker into zero.
4. **Terminal outcomes are log heuristics.** There is no canonical zero-payload
   or finalization-failure span. The 147 / 115 (24h) and 12,722 / 1,664 (7d)
   line counts come from matching `empty payload` and `finalization failed`
   strings, which are not source-owned telemetry enums.

Plus one methodological finding that governs all of them:

5. **A degraded backend answers 200 with zero.** Mid-census, identical
   historical Tempo searches began returning live-store-only responses with no
   `totalBlocks` and zero historical matches while `/ready` stayed 200. Those
   zeros were recorded as degradation, not as evidence of no continuation.
   `journalctl` on five of six nodes was scope-inconsistent and the sixth timed
   out; both were recorded as unavailable, not zero.

The consequence for this repository: **a proof row can execute real behavior and
still be impossible to rebind or correlate later.** A row can be a legitimate
behavioral PASS and simultaneously produce telemetry that no independent
observer could ever re-derive it from.

## The split

Four concerns are cross-cutting: they apply to `continue_work`,
`continue_delegate` and `request_compaction` alike, and no single behavioral row
can honestly own any of them. Three remain construct-only product rows and one
is a runnable harness row. Each concern is owned by **exactly one** row
(enforced by
`scripts/check-telemetry-contracts.mjs`).

| Row | Concern | Product instrumentation prerequisite | Owns |
|---|---|---|---|
| `R-OBS-CONT-PROVENANCE` | `origin-provenance` | yes | Primitive/origin classification plus stable public-safe run/session/turn correlation on accepted entry spans |
| `R-OBS-PROOF-MARKER` | `proof-run-classification` | yes | Durable proof run id, row id, product SHA and immutable harness ref on proof-originated traffic |
| `R-OBS-TERMINAL-OUTCOME` | `terminal-outcome` | yes | Canonical continuation/finalization outcome enum replacing the log-string heuristics |
| `R-OBS-BACKEND-DISPOSITION` | `backend-disposition` | **no** (harness-side) | Explicit unavailable/partial/capped classification plus the rebind key set |

`R-OBS-BACKEND-DISPOSITION` is the one row in the set that is not waiting on
OpenClaw. Its shared classifier, atomic writer, Tempo/Loki adapters, runnable k6
scenario, row-list policy, postprocessor policy, and candidate-envelope checks
now exist. A configured run still needs review; this implementation does not
turn old corpus bytes into PASS evidence.

Everything else stayed in the behavioral row that already owns it. Nine existing
rows gained a `telemetryContract` block rather than a new sibling row:

| Row | Why the contract is intrinsic to this row |
|---|---|
| `R-CD-1` | Its trace-id receipt points at a dispatch span it cannot re-identify. |
| `R-CD-2` | Its topology receipt joins tool → dispatch → fire by shared trace and chain; the census showed that is the only join available. |
| `R-CD-4` | Its entire claim is *which session* received the return, and Tempo drops session identifiers from exported spans. |
| `R-CD-CHAINED-DEPTH-2` | `chain.id` makes the chain visible; nothing records which hop was which. |
| `R-CD-MODEL-TOOL` | Its authority is deliberately gateway metadata, not telemetry, and the census explains why telemetry cannot corroborate it. |
| `R-CD-TOKEN` | It proves bracket origin by the **absence** of a typed-tool span. That is a heuristic until an origin attribute exists. |
| `R-CW-1` | Same-trace join between the tool span and `continuation.work`; 8 accepted entry spans fleet-wide in 24h. |
| `R-CW-3` | The redaction half is genuinely telemetry-backed (`reason.hash`, `reason.length` are exported); the provenance half is not. |
| `R-RC-2` | Accept-versus-refuse has no canonical span; the distinction lives only in the structured tool result. |

## What a `telemetryContract` must define

`tools/k6-proofs/row-manifest.schema.json` describes the block. Every changed or
new row defines all eight:

1. **Expected product attributes/spans** — `expectedTelemetry.spans[]` and
   `expectedTelemetry.attributes[]`, each with `emittedByProduct`. Anything not
   emitted today must name the `productIssue` that will emit it.
2. **Public-safe identity and redaction** — `attributes[].publicSafeForm`
   (`enum`, `salted-fingerprint`, `sha256-16`, `literal-sha`, `integer`,
   `boolean`, `duration-ms`) plus `redaction.rule` and
   `redaction.forbiddenInArtifacts[]`.
3. **Positive/negative controls** — `controls.positive` and `controls.negative`.
   The negative control is what separates "no continuation happened" from "the
   query or the backend hid it".
4. **Backend-unavailable disposition** — `backendUnavailable`, with
   `treatZeroAsAbsence` pinned to `false` by schema, the completeness keys a
   response must carry, and the rebind key set.
5. **Artifact schema** — `artifact.schema` and `artifact.requiredFiles[]`.
6. **PASS/PARTIAL/FAIL authority** — `verdictAuthority`, including
   `passScope`. `honestLimit` stays reserved for `R-RC-2`.
7. **Manual versus deterministic k6 relationship** — `execution`.
8. **Whether product instrumentation is prerequisite** —
   `productInstrumentationPrerequisite` and, when true, `prerequisiteRows[]`.

## What the validator refuses

`node tools/k6-proofs/scripts/check-telemetry-contracts.mjs` runs as part of the
catalog preflight in `scripts/run-proofs.sh`, so a catalog defect fails once as
harness infrastructure (exit 78) and never synthesizes a row verdict.

- A row whose `liveRunSafety.requiredReceipts` include a telemetry receipt
  (`trace-id`, `tempo-trace-json`, `continuation-trace-correlation`,
  `trace-or-session-correlation`, `reason-telemetry-redaction-review`) must
  declare a `telemetryContract`.
- `rebindable: true` requires **all four** identity purposes (`origin`,
  `session`, `turn`, `run`) *and* a `proof-run` marker attribute to be declared
  `emittedByProduct: true`, and forbids `productInstrumentationPrerequisite`.
  **This is the gate: missing origin, session, turn, or proof marker cannot
  become a telemetry-rebindable PASS.**
- `passScope: behavioral-and-telemetry-rebindable` requires `rebindable: true`.
- A telemetry-rebindable claim (`rebindable: true` or the rebindable pass scope)
  additionally requires `enforcement: blocking` and a non-empty
  `rebindReceipts[]`, so the claim is enforceable at run time rather than merely
  declared.
- A telemetry receipt named in `liveRunSafety.requiredReceipts` must also be
  `required: true` in `expectedReceipts`. The two lists disagreeing let a row
  report its required telemetry receipt missing and still be graded as if the
  receipt were optional.
- `productInstrumentationPrerequisite: true` requires `rebindable: false` and a
  non-empty `prerequisiteRows[]` naming rows that exist and are not itself.
- Any span/attribute with `emittedByProduct: false` must name a `productIssue`.
- `backendUnavailable.disposition` may only be `PARTIAL-candidate` or
  `FAIL-candidate`, and `treatZeroAsAbsence` must be `false`.
- Each census remedy concern is owned by exactly one row.

## What the result pipeline refuses

`scripts/postprocess-k6-summary.mjs` and `scripts/run-proofs.sh` write the same
`telemetryRebind` block into telemetry-dependent row results. They withhold
`PASS-candidate` when:

- a receipt required by either manifest receipt list is explicitly missing;
- blocking/rebindable telemetry receipts are not proven;
- `backend-status.json` is absent, invalid, `partial`, `unavailable`, `capped`,
  or `unknown`;
- any file declared in `telemetryContract.artifact.requiredFiles` is absent or
  empty.

Rows with signed authoritative receipts keep those receipts as the sole
positive behavior authority. Backend and artifact policy may withhold that
PASS, but no summary, count, or telemetry helper can replace an explicit signed
non-PASS.

### Backend receipt boundary

Every Tempo search, Tempo trace-by-id fetch, and Loki range query records one
public-safe interaction in `backend-status.json`, including successful
responses. The receipt carries only:

- backend and operation enums;
- HTTP/API disposition;
- `totalBlocks`, `completedJobs`, and `inspectedBytes` when supplied;
- result count/limit and `resultCapped`;
- UTC window bounds, slice strategy, and a query fingerprint;
- manifest-declared public rebind keys.

Raw response bodies, log lines, headers, endpoint URLs, session keys, and
process output are forbidden. An HTTP 200 response with no completeness
metadata is `unknown`, never a healthy zero. A result at the backend limit is
`capped`; its slice strategy is retained and its count has no authority.
Candidate-envelope validation re-reads the receipt and siblings, so a
hand-edited sidecar cannot suppress the raw non-PASS.

## Publishing evidence for a future product PR

When the OpenClaw instrumentation lands, its proof evidence publishes under the
non-continuation proof publication convention:

```
PR-NNNNNN/PROOFS/<FULL_SHA>/
```

`<FULL_SHA>` is the full 40-character product SHA the PR presents, never an
abbreviation. That path is separate from the continuation corpus at
`PROOFS/<CANDIDATE_SHA>/`, and landing it does not repoint `PROOFS/INDEX.json`.

## Commands

```bash
node tools/k6-proofs/scripts/check-telemetry-contracts.mjs
node --test \
  tools/k6-proofs/scripts/__tests__/telemetry-contract.test.mjs \
  tools/k6-proofs/scripts/__tests__/telemetry-backend-status.test.mjs \
  tools/k6-proofs/scripts/__tests__/backend-disposition-pipeline.test.mjs \
  tools/k6-proofs/scripts/__tests__/tempo-fetch.test.mjs \
  tools/k6-proofs/scripts/__tests__/loki-fetch.test.mjs
```

## See also

- `tools/k6-proofs/CONTRIBUTING-ROWS.md` — row authoring checklist.
- `tools/k6-proofs/docs/PROOF-RUN-METHOD.md` — proof-round entrypoint.
- `RUNBOOKS/PROOF-CORPUS-METHOD.md` — canonical corpus procedure and row table.
