# R-CW-3: reason-field OTel cross-walk (`reason.preview`)

**Family**: `continue_work()` OTel observability
**Seat**: 🕯 Emeric (`service.name = fifth-prince`, host `emeric`)
**Status**: ✅ PROVEN on `bd4276c813`
**Both-forms mandate**: satisfied — tool form (`continue_work(reason=...)`) AND token/bracket form (`CONTINUE_WORK:N`).

## Scenario

Verify the `reason` parameter passed to `continue_work()` is captured as the
`reason.preview` attribute on the emitted `continuation.work` span (and its
`continuation.work.fire` fire-seam sibling) — and that the reason-less
token/bracket form produces the *same span with `reason.preview` absent*. That
populated-vs-absent contrast is the cross-walk.

## Method (live capture on `bd4276c813`)

Seat confirmed on the candidate bytes: `git rev-parse HEAD` =
`bd4276c813`.

OTel trace export was routed to a local OTLP receiver for capture via a
**systemd drop-in** (`OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://127.0.0.1:4319/v1/traces`),
leaving the base/metrics endpoint and all openclaw config untouched (no
protected-path patch). The `diagnostics-otel` plugin only supports
`http/protobuf`, so the receiver decodes OTLP-protobuf
(`ExportTraceServiceRequest`) and extracts `name` + `reason.preview`. Config
restored after capture (drop-in removed, gateway restarted, traces back to
`otel.dandelion.cult:4318`).

Note: the `continuation.work` schedule-seam span flushes with its parent run's
trace batch (it is parented to the active run), so it appears after the run that
called `continue_work()` ends; `continuation.work.fire` emits at fire time.

## Commands

**Tool form:**
```
continue_work(delaySeconds=8, reason="RCW3-TOOL-V2 reason-field OTel cross-walk bd4276c813 reason.preview capture")
```
(traceparent `00-1a8d9bb0bbae38d053fab58b1fa45511-33ec730cb6a2fec6-01`)

**Token/bracket form:**
```
CONTINUE_WORK:6      # fallback bracket token — no reason parameter exists in this form
```

## Observed (decoded from captured OTLP-protobuf)

**Tool form** — `reason.preview` populated on both the accept and fire spans:
```json
{ "name": "continuation.work",      "reason.preview": "RCW3-TOOL-V2 reason-field OTel cross-walk bd4276c813 reason.preview capture" }
{ "name": "continuation.work.fire", "reason.preview": "RCW3-TOOL-V2 reason-field OTel cross-walk bd4276c813 reason.preview capture" }
```

**Token/bracket form** — same span, `reason.preview` absent (no reason param):
```json
{ "name": "continuation.work", "reason.preview": null }
```

## Verdict

✅ **PROVEN** — the `reason` parameter propagates to the OTel span attribute
`reason.preview` on `continuation.work` (and `continuation.work.fire`) for the
**tool form**; the **token/bracket form** emits the same span with
`reason.preview` absent (it carries no reason). Reason-field → `reason.preview`
cross-walk certified live on `bd4276c813`, both forms.

## Artifacts

- `toolform-spans.json` — decoded continuation spans from the tool-form run (reason.preview populated)
- `spans-raw-toolform.bin` — raw captured OTLP-protobuf, tool-form
- `spans-raw-bracketform.bin` — raw captured OTLP-protobuf, bracket-form (reason.preview absent)
- Capture harness: `~/.openclaw-data/workspace/rcw3/otlp-receiver.js` (proto-decode receiver)
