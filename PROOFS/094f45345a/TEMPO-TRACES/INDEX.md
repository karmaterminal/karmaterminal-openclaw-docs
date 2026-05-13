# Tempo trace exports — pr-79925 cael-proofs-20260512

Fetched from fleet tempo (Grafana Tempo 2.5.0, k3s `observability/tempo` on elliott, fronted by haproxy on `10.0.0.99`) on 2026-05-13 06:22 PDT.

| File | Trace ID | Service | Span count | What it covers |
|---|---|---|---|---|
| `trace-chain-8470b259.json` | `8470b259365a384997b6264b0667634f` | cael-prince | 86 | R-CD-1 / R-CD-2 / R-CD-3 / R-CD-CHAINED-DEPTH-2 — single turn, 4 sibling delegates + depth-2 chain. Includes `continuation.delegate.dispatch`, `continuation.queue.drain`, `openclaw.harness.run`, `openclaw.tool.execution` spans. |
| `trace-cw-415bf662.json` | `415bf66281a31227b4fdd4e8e81af3ba` | cael-prince | 55 | R-CW-1 — `continue_work` schedule + delayed wake. Includes `continuation.work` span. |

## How to re-verify at byte (canonical fleet route)

```bash
# DNS: tempo.dandelion.cult → 10.0.0.99 (haproxy on elliott) → k3s svc/tempo
curl -s http://tempo.dandelion.cult/api/traces/8470b259365a384997b6264b0667634f \
  | jq -r '.batches[].scopeSpans[].spans[].name' | sort -u

# SHA256 of canonical exports (fetched via tempo.dandelion.cult on 2026-05-13 06:22 PDT)
# trace-chain-8470b259.json: 117b2940b58fe4d84df7f16c7811cbc0fa05aed105d01e222cbc957e7bd2ef1a
# trace-cw-415bf662.json:    0e71cb0f5bf03377dae6e396940772b3e32e52cc07151f58c96d0ff5eadc97c0
```

Expected span-name set for `8470b259...`:
```
continuation.delegate.dispatch
continuation.queue.drain
openclaw.context.assembled
openclaw.harness.run
openclaw.model.call
openclaw.run
openclaw.tool.execution
```

Fallback route (if `tempo.dandelion.cult` haproxy stops responding — figs flagged intermittent issues):
```bash
ssh elliott "sudo k3s kubectl port-forward -n observability svc/tempo 13100:3100 &
  sleep 2 && curl -s http://localhost:13100/api/traces/<TRACE_ID>"
```

## Provenance / chain-of-custody

- Tempo backend: `tempo-0` pod, `observability` namespace, k3s on elliott (10.0.0.10)
- Public fleet route: `tempo.dandelion.cult` (HTTP only — HTTPS not terminating as of 2026-05-13)
- Service name: `cael-prince` (otel resource attribute)
- Host: `cael` (10.0.0.148)
- Process: openclaw-gateway running `094f45345a` per session_status snapshot at proof-fire time
- Files committed unmodified (raw OTLP/HTTP-JSON response from Tempo `/api/traces/<id>`)
- Byte-identical via both routes (haproxy + kubectl port-forward) — sha256 checksums above
