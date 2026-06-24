# k6 PROOFS Skill

## Purpose
Build, run, and maintain k6 proof-row scenarios for the OpenClaw continuation feature behavioral corpus. This skill enables any prince or coding agent to create new proof scripts, run them against the fleet, and capture evidence for the PROOFS corpus.

## Components

### Infrastructure (already deployed)
- **k6 v2.0.0** — load testing tool, installed on ronan-dgx (`/home/figs/bin/k6`)
- **Prometheus** — metrics store at `prometheus.dandelion.cult` (k3s on silas)
- **Grafana** — dashboards at `grafana.dandelion.cult`
- **Loki** — log aggregation at `loki.dandelion.cult`
- **Tempo** — distributed tracing at `tempo.dandelion.cult`
- **Alloy** — DaemonSet on all nodes, forwards logs to Loki
- **OTel Collector** — trace collection on silas

### Repo Structure
```
karmaterminal-openclaw-docs/k6-proofs/
├── README.md              — full documentation
├── run-proof.sh           — universal runner (auto-detect seat/SHA + Prometheus output)
├── lib/
│   ├── gateway.js         — WebSocket helpers, custom metrics, nonce generation
│   └── report.js          — HTML report generator (handleSummary)
├── scenarios/
│   ├── preflight.js       — gateway health verification (#101)
│   └── r-cd-1.js          — continue_delegate infrastructure (#103)
├── dashboards/
│   └── k6-proofs.json     — Grafana dashboard for proof metrics
└── skill/
    └── SKILL.md           — this file
```

## How to Build a New Proof Scenario

### 1. Identify the Row
Check `PROOFS/PROOF-CORPUS-METHOD.md` for the row definition:
- Row name (e.g., `R-CD-2`)
- Expected behavior
- Owner assignment
- Required evidence shape

### 2. Create the Scenario File
```bash
# Name convention: scenarios/r-<row-name>.js (lowercase, hyphens)
touch karmaterminal-openclaw-docs/k6-proofs/scenarios/r-cd-2.js
```

### 3. Scenario Template
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend, Rate } from 'k6/metrics';

const GATEWAY_HOST = __ENV.GATEWAY_HOST || '127.0.0.1';
const GATEWAY_PORT = __ENV.GATEWAY_PORT || '18789';
const GATEWAY_BASE = `http://${GATEWAY_HOST}:${GATEWAY_PORT}`;
const PROOF_SHA = __ENV.PROOF_SHA || 'unknown';
const PROOF_SEAT = __ENV.PROOF_SEAT || 'unknown';

// Custom metrics — prefix with row name
const rowPass = new Counter('r_cd_2_pass');
const rowFail = new Counter('r_cd_2_fail');
const rowDuration = new Trend('r_cd_2_duration_ms', true);
const rowPassRate = new Rate('r_cd_2_pass_rate');

export const options = {
  scenarios: {
    'r-cd-2': {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '120s',
    },
  },
  thresholds: {
    'r_cd_2_pass_rate': ['rate > 0.99'],
  },
};

function nonce() {
  return `r-cd-2-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function () {
  const start = Date.now();
  const proofNonce = nonce();
  let passed = true;

  console.log(`[R-CD-2] Starting — nonce: ${proofNonce}, SHA: ${PROOF_SHA}`);

  // Step 1: Preflight
  const health = http.get(`${GATEWAY_BASE}/health`);
  if (!check(health, { 'gateway alive': (r) => r.status === 200 })) {
    rowPassRate.add(0);
    return;
  }

  // Step 2: [YOUR PROOF LOGIC HERE]
  // - Fire the tool/token
  // - Wait for evidence
  // - Verify expected behavior

  // Step 3: Record result
  const duration = Date.now() - start;
  rowDuration.add(duration);
  rowPassRate.add(passed ? 1 : 0);
  if (passed) rowPass.add(1); else rowFail.add(1);

  console.log(`[R-CD-2] VERDICT: ${passed ? 'PASS' : 'FAIL'} (${duration}ms)`);
}

export function handleSummary(data) {
  return {
    stdout: `\n[R-CD-2] ${data.metrics.r_cd_2_pass_rate?.values.rate > 0 ? 'PASS' : 'FAIL'}\n`,
    'r-cd-2-summary.json': JSON.stringify({
      row: 'R-CD-2',
      sha: PROOF_SHA,
      seat: PROOF_SEAT,
      timestamp: new Date().toISOString(),
      metrics: data.metrics,
    }, null, 2),
  };
}
```

### 4. Run It
```bash
# Local test (no Prometheus output)
k6 run scenarios/r-cd-2.js

# Full pipeline (metrics → Grafana)
./run-proof.sh r-cd-2

# Custom target
./run-proof.sh r-cd-2 --env GATEWAY_HOST=10.0.0.246
```

### 5. Commit Evidence
After a successful run on the target SHA:
```bash
# Copy summary to corpus
cp r-cd-2-summary.json ../PROOFS/<SHA>/R-CD-2/
# Write EVIDENCE.md with verdict, trace links, nonce correlation
```

## Key Patterns

### Evidence Correlation
The gateway doesn't expose a REST API for delegate dispatch — delegates fire via the agent's tool surface. The k6 harness verifies infrastructure readiness and captures evidence post-run:
1. **Journal grep** — `journalctl -u openclaw-gateway --since "5min ago" | grep <nonce>`
2. **Tempo trace pull** — `curl http://tempo.dandelion.cult/api/traces/<traceId>`
3. **Loki query** — via Grafana or `logcli`

### Both-Forms Mandate
Every continuation row must prove BOTH the typed tool path AND the bracket/token path:
- Tool: `continue_work()` / `continue_delegate()` / `request_compaction()`
- Token: `CONTINUE_WORK` / `CONTINUE_WORK:N` / `[[CONTINUE_DELEGATE: ...]]`

(`request_compaction` is tool-only — no token form.)

### Caps-Test Procedure
For rows that test cap exhaustion (R-CW-5, R-CW-6):
1. Lower caps in `openclaw.json` (record originals)
2. Reload gateway config
3. Fire the row — verify reject
4. Restore originals + reload

### Custom Metrics Naming
Prefix all custom metrics with the row name (underscores, lowercase):
- `r_cd_1_pass` / `r_cd_1_fail` / `r_cd_1_duration_ms` / `r_cd_1_pass_rate`

This ensures Grafana queries can filter by row.

## Project Tracking
- **EPIC**: #106
- **Issues**: #101–#121 in karmaterminal-openclaw-docs
- **Project Board**: [P81](https://github.com/orgs/karmaterminal/projects/81)
- **Method Spec**: `PROOFS/PROOF-CORPUS-METHOD.md` (in openclaw-bootstrap evacuated)

## Dependencies
- k6 binary (currently ronan-dgx only; #121 tracks fleet-wide install)
- Gateway running on target seat
- Observability stack on silas k3s
