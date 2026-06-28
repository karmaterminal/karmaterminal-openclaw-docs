# R-TRACE-REDACTION-1121 — continuation trace preview redaction

## Verdict

PASS for candidate `0ab5f5e71f333ea4621262239f314a7d39ddee7c`.

The continuation tracer no longer exports raw continuation reason or delegate task preview text. Reason/task text now emits only `reason.present`, `reason.length`, `reason.hash`, and `reason.redacted`; `reason.preview` is absent.

## Evidence

- Code path: `src/infra/continuation-tracer.ts` builds the span attributes for `continuation.work`, `continuation.work.fire`, `continuation.delegate.dispatch`, `continuation.delegate.fire`, and `continuation.disabled`.
- Unit proof: `unit-continuation-tracer-output.log` shows `src/infra/continuation-tracer.test.ts` passed, including the explicit privacy test for a fake token-shaped sentinel.
- Machine proof: `span-attributes-redaction-proof.json` captures exported span attributes from the tracer helpers and asserts:
  - `reason.preview` is omitted from every reason-bearing span;
  - the fake sentinel is absent from all exported attribute values;
  - positive non-raw metadata exists through `reason.hash` and sibling reason metadata.
- Grep proof: `sentinel-grep-exported-attributes.txt` records that the fake sentinel is absent from the exported-attributes JSON.

## Limits

No live Tempo row was fired for this privacy fix. The proof is a direct unit and machine-readable helper proof at the span-construction seam before the diagnostics-otel adapter forwards attributes.
