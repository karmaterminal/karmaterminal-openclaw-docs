# R-CW-7 — rune-rog-ally native proof — SHA `749f95b9b10`

**Seat:** rune-rog-ally (host.name=`rune`, host.arch=`amd64`, service.name=`rune-prince`)
**Date:** 2026-06-21 15:55–16:00 PDT / 22:55–23:00 UTC
**Result:** ✅ **PASS** — traceparent / trace-context propagates end-to-end across the continuation delegate dispatch into the spawned child, and remains byte-identical when that child schedules its own continuation.

## The live byte
This proof was produced by an actual `continue_delegate` child:

- delegate session: `agent:main:subagent:0e248108-1b2b-4308-ae3f-76f517346c43`
- sessionId: `9e2164d3-be2e-4c18-b68f-a9e34c530ef4`
- runId: `85272307-95fd-4950-8fdf-8770b6bcdcf3`
- spawn timestamp from parent registry: `startedAt=1782082504494` (`2026-06-21T22:55:04.494Z`)
- marker: `R-CW-7-TRACEPARENT-rune-rog-ally-749f95b 2026-06-21T22:59:01Z` (`traceparent.txt`)

The continuation dispatch trace is `4b4c9049e12483bcc4d34f9db906b0a9`. Its root span is:

```text
continuation.delegate.dispatch
traceID=4b4c9049e12483bcc4d34f9db906b0a9
spanID=9cc8fa47044f432b
start=2026-06-21T22:55:04.385Z
resource: host.name=rune, host.arch=amd64, service.name=rune-prince
```

The full trace is saved as `trace-4b4c9049-after-hop2.json`. It contains **75 spans** after hop2 export completed, and every span decodes to the same single traceID:

```text
base64 traceId S0yQSeEkg7zE00+duQawqQ== -> hex 4b4c9049e12483bcc4d34f9db906b0a9
```

Key span chain from `trace-summary.txt`:

```text
continuation.delegate.dispatch span=9cc8fa47044f432b parent=(root)                 2026-06-21T22:55:04.385Z
openclaw.harness.run             span=f0e072e716a54952 parent=9cc8fa47044f432b     2026-06-21T22:55:05.118Z
openclaw.run                     span=b1b7c3130f85b8d9 parent=f0e072e716a54952     2026-06-21T22:55:05.119Z
continuation.work                span=86dca96c2378931d parent=9cc8fa47044f432b     2026-06-21T22:59:30.096Z
continuation.queue.drain         span=2b0f53da814654ae parent=9cc8fa47044f432b     2026-06-21T22:59:33.536Z
```

That is the E2E propagation proof: the root `continuation.delegate.dispatch` span, the child harness/run/model/tool spans, and the child's own continuation scheduling spans all share the **same** traceID (`4b4c9049...`) on the native rune seat.

## Tool-return traceparent confirmation
When the child fired its own `continue_work`, the tool returned the exact traceparent under the same dispatch trace:

```json
{
  "status": "scheduled",
  "delaySeconds": 25,
  "traceparent": "00-4b4c9049e12483bcc4d34f9db906b0a9-9cc8fa47044f432b-01"
}
```

This is byte-identical to the dispatch root traceID/spanID (`4b4c9049...` / `9cc8fa47044f432b`) and is recorded in `transcript-self-continuation-summary.txt`.

## Source of truth / artifacts
- `traceparent.txt` — marker (`R-CW-7-TRACEPARENT-rune-rog-ally-749f95b ...`)
- `session-identity.txt` — delegate session/run/trace identity
- `tempo-search-spawn.json` — Tempo search around the spawn window showing `continuation.delegate.dispatch` at `1782082504385000000`
- `trace-4b4c9049-after-hop2.json` — full live Tempo trace (host.name=`rune`, service.name=`rune-prince`, 75 spans, single traceID)
- `trace-summary.txt` — decoded trace summary / key spans
- `journal-spawn-dispatch.log` — journal lines showing bracket delegate signal parsed at `15:55:04` on the parent session
- `transcript-self-continuation-summary.txt` — transcript summary including the `continue_work` tool-return traceparent

## Net
Native rune-seat trace context propagation is live and byte-proven: `continuation.delegate.dispatch` produced traceID `4b4c9049e12483bcc4d34f9db906b0a9`; the spawned child ran under that same trace; the child's own `continue_work` returned `00-4b4c9049...-9cc8fa47044f432b-01`; and the post-hop2 Tempo trace still contains exactly one traceID across all spans. R-CW-7 PASS.
