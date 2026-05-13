# Tempo trace exports — pr-79925 cael-proofs-20260512

Fetched from fleet tempo (Grafana Tempo 2.5.0, observability/tempo svc on elliott-k3s) on 2026-05-13 06:22 PDT.

| File | Trace ID | Service | Span count | What it covers |
|---|---|---|---|---|
| `trace-chain-8470b259.json` | `8470b259365a384997b6264b0667634f` | cael-prince | 86 | R-CD-1 / R-CD-2 / R-CD-3 / R-CD-CHAINED-DEPTH-2 — single turn, 4 sibling delegates + depth-2 chain. Includes `continuation.delegate.dispatch`, `continuation.queue.drain`, `openclaw.harness.run`, `openclaw.tool.execution` spans. |
| `trace-cw-415bf662.json` | `415bf66281a31227b4fdd4e8e81af3ba` | cael-prince | 55 | R-CW-1 — `continue_work` schedule + delayed wake. Includes `continuation.work` span. |

## How to re-verify at byte

```bash
ssh elliott "sudo k3s kubectl port-forward -n observability svc/tempo 13100:3100 &
  sleep 2
  curl -s http://localhost:13100/api/traces/8470b259365a384997b6264b0667634f | jq -r '.batches[].scopeSpans[].spans[].name' | sort -u"
```

Expected output (subset):
```
continuation.delegate.dispatch
continuation.queue.drain
openclaw.context.assembled
openclaw.harness.run
openclaw.model.call
openclaw.run
openclaw.tool.execution
```

## Provenance / chain-of-custody

- Tempo backend: `tempo-0` pod, `observability` namespace, k3s on elliott (10.0.0.10)
- Service name: `cael-prince` (otel resource)
- Host: `cael` (10.0.0.148)
- Process: openclaw-gateway running `094f45345a` per session_status snapshot at proof-fire time
- Fetch method: `kubectl port-forward svc/tempo 13100:3100` + `curl /api/traces/<id>` → JSON
- Files committed unmodified (raw OTLP/HTTP-JSON response from Tempo query API)
