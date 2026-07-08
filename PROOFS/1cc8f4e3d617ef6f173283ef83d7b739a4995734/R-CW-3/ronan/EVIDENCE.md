# R-CW-3 — continue_work reason telemetry redaction (Ronan live k6 review)

Issue: https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/333

Candidate SHA: `1cc8f4e3d617ef6f173283ef83d7b739a4995734`
Seat: Ronan / `ronan`
Verdict: ✅ PASS

## Live run byte

Run artifact source:

```text
/tmp/p81-r-cw-3-live-long-20260708T134357Z/1cc8f4e3d617ef6f173283ef83d7b739a4995734/R-CW-3/ronan/20260708T134400Z-r-cw-3
```

The 10-minute observer live run produced:

- k6 exit code: `0`
- candidate verdict before review: `HONEST-LIMIT-candidate`
- nonce: `R-CW-3-1783518240313-bjur2pje`
- disposable session: `agent:main:r-cw-3-r-cw-3-1783518240313-bjur2pje`
- `dispatch_accepted`: `true`
- `scheduled_sentinel`: `true`
- `wake_observed`: `true`
- `wake_delay_ms`: `94083`
- `public_artifact_raw_reason_absent`: `true`
- scenario-emitted `trace_id`: `null`

The scenario did not receive a trace id from the gateway WebSocket frames. That is why the raw run remains honest-limit shaped until the separate Tempo lookup/review below.

## Tempo obtain / review

TraceQL lookup used the chain breadcrumb from the live run:

```text
{ .chain.id = "d43880c0-1ac5-4068-aa33-69e1dfb6d4a7" }
window: 1783518200..1783518400
```

`tools/k6-proofs/scripts/fetch-tempo-trace.mjs` fetched Tempo trace:

```text
518565900f34f7ba41bcbc3e415d1e1f
```

Saved as:

```text
tempo-trace-518565900f34f7ba41bcbc3e415d1e1f.json
```

`tools/k6-proofs/scripts/review-r-cw-3-reason-telemetry.mjs` then produced:

```json
{
  "verdict": "reason-telemetry-redaction-review-passed",
  "publicSafe": true,
  "safeReasonAttributeKeys": [
    "reason.hash",
    "reason.length",
    "reason.present",
    "reason.redacted"
  ]
}
```

The review checks confirm:

- dispatch accepted
- scheduled sentinel present
- wake observed
- public artifact raw reason absent
- Tempo trace JSON present
- safe reason attributes present: `reason.present`, `reason.length`, `reason.hash`
- raw reason sentinel absent from Tempo (`rawSentinelPrefixHits: 0`, `rawReasonPrefixHits: 0`)

## Supporting receipts

- `run-result.json` — live k6 result and candidate/honest-limit pre-review state.
- `r-cw-3-reason-telemetry-summary.json` — raw run summary explaining the missing emitted trace id.
- `evidence.jsonl` / `evidence-lines.log` — public evidence stream and selected lines.
- `runner-metadata.json` / `row-manifest.json` / `seat-readiness.json` — runner, row, and seat readiness receipts.
- `metrics-export.json`, `openclaw-proofs-k6.prom`, `openclaw-proofs-k6.otlp.json`, `k6.log` — metrics and k6 receipts.
- `tempo-trace-518565900f34f7ba41bcbc3e415d1e1f.json` — fetched Tempo trace JSON.
- `tempo-review-518565900f34f7ba41bcbc3e415d1e1f.json` — redaction review receipt.

## Verdict

✅ PASS — the live k6 row proved `continue_work` dispatch, scheduling, wake delivery, and absence of the raw reason from public artifacts. The follow-up TraceQL fetch recovered the Tempo trace and the reason telemetry review passed: safe reason attributes are present and raw reason text is absent from Tempo.
