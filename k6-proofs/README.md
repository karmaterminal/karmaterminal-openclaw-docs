# k6 PROOFS Harness

Scriptable proof-row automation for the OpenClaw continuation feature corpus.

## Quick Start

```bash
# Run preflight (verifies gateway + observability stack)
./run-proof.sh preflight

# Run a specific proof row
./run-proof.sh r-cd-1

# With custom gateway
./run-proof.sh r-cd-1 --env GATEWAY_HOST=10.0.0.246

# Without Prometheus output (offline/local only)
k6 run scenarios/preflight.js
```

## Architecture

```
k6 (any prince seat)
  ├── scenarios/*.js        — proof row scripts
  ├── lib/gateway.js        — WebSocket connection helpers
  ├── lib/report.js         — HTML report generator
  └── run-proof.sh          — wrapper with auto-detection
        │
        ├── Prometheus Remote Write → prometheus.dandelion.cult
        │                            → Grafana dashboard (k6 metrics)
        ├── stdout/stderr → journal → Alloy → Loki
        └── handleSummary → report.html + summary.json
```

## Scenarios

| File | Row | Status | Description |
|------|-----|--------|-------------|
| `preflight.js` | #101 | ✅ Green | Gateway health + observability stack reachable |
| `r-cd-1.js` | R-CD-1 | ✅ Green | continue_delegate schedule→spawn→return infrastructure |
| `r-cw-1.js` | R-CW-1 | 🆕 New | continue_work tool-form schedule + wake |
| `r-cw.js` | R-CW-* | 🆕 New | Combined continue_work infrastructure preflight |

## Requirements

- **k6 v2.0+** (installed on ronan-dgx at `/home/figs/bin/k6`)
- **Gateway** running on target seat
- **Observability stack** on silas (Grafana, Prometheus, Loki, Tempo)

## Environment Variables

| Var | Default | Purpose |
|-----|---------|---------|
| `GATEWAY_HOST` | `127.0.0.1` | Gateway hostname |
| `GATEWAY_PORT` | `18789` | Gateway port |
| `PROOF_SHA` | auto-detected | Deployed SHA for reports |
| `PROOF_SEAT` | hostname | Seat identifier |
| `TEMPO_HOST` | `tempo.dandelion.cult` | Tempo for trace correlation |
| `LOKI_HOST` | `loki.dandelion.cult` | Loki for log correlation |
| `K6_PROMETHEUS_RW_SERVER_URL` | `http://prometheus.dandelion.cult/api/v1/write` | Metrics destination |

## Adding a New Proof Row

1. Create `scenarios/r-<row-name>.js`
2. Use `lib/gateway.js` helpers for connection + metrics
3. Add `handleSummary` for JSON + HTML output
4. Test: `./run-proof.sh <row-name>`
5. Commit + update this README table

## Project Tracking

Issues #101–#121 in [karmaterminal-openclaw-docs](https://github.com/karmaterminal/karmaterminal-openclaw-docs),
tracked in [Project 81](https://github.com/orgs/karmaterminal/projects/81).
