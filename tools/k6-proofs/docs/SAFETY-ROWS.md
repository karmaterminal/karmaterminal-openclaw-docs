# Safety and Observer Rows (k6 PROOFS)

This document defines the scenario groups for safety-sensitive operations and observer receipts under the k6 PROOFS harness (tracking issue #104). These rows validate OpenClaw's boundary conditions, context management, and observability guarantees without executing arbitrary or unbounded workflows.

## Row Families

### 1. `R-RC-*` (Request Compaction)
Validates the `request_compaction` tool's gating and execution semantics.
- **R-RC-1 (Threshold Reject)**: Ensures `request_compaction()` is rejected when context usage is below the 70% threshold or rate-limited. This is a non-mutating, boundary-enforcement row.
- **R-RC-2 (Threshold Accept)**: Ensures `request_compaction()` is accepted and triggers the compaction cycle when context usage is $\ge70\%$. This is a **state-mutating** row.

### 2. `R-OBS-*` (Observer / Telemetry)
Validates that telemetry and observer receipts are correctly generated and reachable.
- **R-OBS-STATUS**: Validates `status`/Tempo traces and observer receipts. This is a read-only row.

### 3. `R-CONFIG-*` (Configuration & Defaults)
Validates configuration integrity and intersession defaults.
- **R-CONFIG-DEFAULTS**: Verifies config, defaults, and intersession checks. This is a read-only row.

*Note: `R-REGRESSION-TRAP-TESTS` (repo test trap rows) are managed via CI/test-runner suites, not as live-session k6 scenarios.*

## Guardrails & Execution Semantics

To ensure cluster safety and deterministic execution, these rows enforce strict execution semantics:

1. **Serialized Execution**: Compaction rows (`R-RC-*`) are opt-in and MUST be serialized. They must **never** be run in parallel with continuation or delegate rows (`R-CW-*`, `R-CD-*`) on the same session, as compaction destructively rewrites the active session context.
   - **Mechanism (why serialization is load-bearing, not hygiene):** the compaction cycle holds a **session-write-lock** for the duration of the summarization call, bounded by `agents.defaults.compaction.timeoutSeconds` (default 180s, the config-resolved wrapper — *not* the bare SDK rpc child). A parallel continuation/delegate row firing on the same session becomes a second lock-acquirer and hits the asymmetric lock-cascade (the in-flight row stalls against the held write-lock, up to the timeout). So the prohibition is enforced by an actual lock contention window, not a soft preference — co-firing a compaction row with any same-session row is a real fault, which is why `R-RC-*` are `serialized: true` + `requiresHumanConfirmation: true`. (Lock-mechanism rationale contributed by 🌻 Elliott; cf. #125.)
2. **Order of Operations**: Threshold-reject (`R-RC-1`) must always execute and pass before threshold-accept (`R-RC-2`) is attempted on a session.
3. **Context Binding**: Every run must record the exact deployed SHA, session key, and provider context to ensure forensic traceablity.
4. **Reversible Mutation**: Live gateway mutations must be kept narrow and reversible.
5. **Safety Markers**: The k6 row manifest must explicitly mark the row's safety profile. Because the current schema (`openclaw.k6.proof-row-manifest.v1`) enforces `additionalProperties: false`, safety semantics are encoded in the `mutates` boolean and explicitly detailed in the `review.notes` field (e.g., specifying `serialized: true` and `requiresHumanConfirmation: true` for mutating rows).

## Metrics Contract

These rows integrate with the metrics contract defined in #110. The resulting `k6-summary.json` artifacts emit the standard `metrics.proofFailures` and `candidateOnly`/`foldRequiresReview` markers for dashboard ingestion.