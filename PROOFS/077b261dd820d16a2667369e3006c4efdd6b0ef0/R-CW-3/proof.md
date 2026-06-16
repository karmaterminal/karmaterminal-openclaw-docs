# R-CW-3: continue_work() reason-field OTel cross-walk (`reason.preview`)

**Family**: `continue_work()` OTel observability
**Seat**: 🕯 Emeric (`service.name = fifth-prince`, host `emeric`)
**Target SHA**: `077b261dd820d16a2667369e3006c4efdd6b0ef0` (deployed emeric-seat, gateway up 2026-06-16T00:11Z / 2026-06-15 17:11 PDT)
**Status**: ✅ PROVEN
**Both-forms mandate**: satisfied — tool form (`continue_work(reason=...)`) AND token/bracket form (`CONTINUE_WORK:N`).

## Scenario

Verify the `reason` parameter passed to `continue_work()` is captured as the
`reason.preview` attribute on the emitted `continuation.work` span — and that the
reason-less token/bracket form (`CONTINUE_WORK:N`, which has no reason parameter)
produces the **same span with `reason.preview` absent**. That populated-vs-absent
contrast is the cross-walk.

## Method (live capture against the production trace pipeline on `077b261dd8`)

Seat confirmed on the deployed bytes: `openclaw --version` → `OpenClaw 2026.6.2 (077b261)`;
running gateway `node --no-maglev /home/figs/flesh_beast_tmp/openclaw/dist/index.js gateway`.

Unlike the local-OTLP-receiver approach used on earlier SHAs, this capture used the
**production trace pipeline unchanged** — the `diagnostics-otel` plugin exports spans to
`otel.dandelion.cult:4318` → Tempo. No systemd drop-in, no gateway-config patch, nothing
protected touched. Each `continue_work()` tool-form invocation returns a W3C `traceparent`;
the bracket-form's trace was located via Tempo TraceQL search (`{ name="continuation.work" }`,
`service.name=fifth-prince`, time-windowed to the fire). Traces fetched from Tempo and saved
as JSON (the high-quality receipt per the standing Tempo-trace practice).

## Commands

**Tool form** (fired from emeric-main-session):
```
continue_work(delaySeconds=8, reason="R-CW-3 TOOL-FORM continue_work reason-field OTel cross-walk on 077b261dd8 reason.preview capture — RCW3TOOLV3 distinctive marker")
→ { "status": "scheduled", "delaySeconds": 8, "traceparent": "00-96accc7e454bcf853bff802cdf078c90-fe7fbd349221ed13-01" }
```

**Token/bracket form** (fired as the literal end-of-turn bracket token — no reason parameter exists in this form):
```
CONTINUE_WORK:5
→ continuation.work span, trace 40674ffa8f1a17ecb42bb2f0ffd2167 (located via Tempo TraceQL)
```

## Observed (decoded from the fetched Tempo trace JSON)

**Tool form** — trace `96accc7e454bcf853bff802cdf078c90`, span `continuation.work`:
```
reason.preview = "R-CW-3 TOOL-FORM continue_work reason-field OTel cross-walk on 077b261dd8 reason"
chain.id       = 6e8d7588-793b-4ee4-8f55-f285dad8482f
```
(`reason.preview` is a *preview* — truncated ~80 chars, so the trailing "RCW3TOOLV3" marker falls past
the cut; the reason string is captured and matches the fire verbatim up to the truncation point.)

**Bracket form** — trace `40674ffa8f1a17ecb42bb2f0ffd2167`, span `continuation.work`:
```
reason.preview = (ABSENT — attribute not present; grep -c 'reason.preview' = 0)
chain.id       = 216e2a71-f12d-41b2-a488-de496167fa87
```

Both forms emit the same `continuation.work` span carrying `chain.id` (continuation-chain
tracking); only the tool form carries `reason.preview`. That is the exact contrast.

## Verdict

✅ **PROVEN** on `077b261dd8` — the `reason` parameter passed to `continue_work()`
propagates to the OTel span attribute `reason.preview` on `continuation.work` for the
**tool form**; the **token/bracket form** emits the same span with `reason.preview`
**absent** (it carries no reason). Reason-field → `reason.preview` cross-walk certified
live against the production Tempo pipeline, both forms, on the deployed tip.

## Artifacts

- `trace-toolform.json` — full Tempo trace for the tool-form fire (`continuation.work` with `reason.preview` populated)
- `trace-bracketform.json` — full Tempo trace for the bracket-form fire (`continuation.work` with `reason.preview` absent)

Both are real Tempo trace documents fetched HTTP 200 from `tempo.dandelion.cult/api/traces/<id>`
on the deployed seat — the maintainer-readable receipt of the populated-vs-absent contrast.
