# R-TRACE-REDACTION-1121 — PASS

Issue: https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/214

Candidate SHA: `bca2b0b89ab886bf23a10e4983926f6b374b3188`

Expected byte: continuation span reason/task text is never exported as raw preview text; exported attributes are presence/length/hash/redaction fields.

Observed byte:

- Source surface: `src/infra/continuation-tracer.ts`
- `ContinuationSpanAttrs` exposes `reason.present`, `reason.length`, `reason.hash`, `reason.redacted`.
- `continuationReasonAttributes()` hashes the redacted reason text with sha256 and truncates to 16 hex characters.
- No `reason.preview` field exists in the canonical reason attribute surface.
- Test surface: `src/infra/continuation-tracer.test.ts`
- `expectSafeReasonAttributes()` asserts `reason.present`, `reason.length`, `reason.hash`, `reason.redacted`, asserts no `reason.preview`, and asserts no attribute value contains the raw reason.

Validation command:

```text
node scripts/run-vitest.mjs src/infra/continuation-tracer.test.ts
```

Result:

```text
src/infra/continuation-tracer.test.ts (88 tests) passed
```

Tempo trace: not applicable for this row. This is a source/unit proof of the telemetry redaction contract, not a live continuation fire.
