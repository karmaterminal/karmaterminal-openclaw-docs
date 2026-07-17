# k6 PROOFS Skill

## Purpose
Build, run, and maintain k6 proof-row scenarios for the OpenClaw continuation feature behavioral corpus. This skill enables any prince or coding agent to create new proof scripts, run them against the fleet, and capture evidence for the PROOFS corpus.

## Components

### Infrastructure (resolve per seat before proof-standard runs)
- **k6** — proof-standard expectation is `v2.0.0`; run `node tools/k6-proofs/scripts/seat-readiness-preflight.mjs --json` on the target seat before folding evidence.
- **Prometheus** — metrics store for candidate rows; set `OPENCLAW_PROOFS_PROMETHEUS_BASE_URL` / `OPENCLAW_PROOFS_PROMETHEUS_RW_URL` for non-fleet runs (fleet default: `prometheus.dandelion.cult`).
- **Grafana** — dashboards (contract in `tools/k6-proofs/METRICS.md`; JSON in `tools/k6-proofs/dashboards/k6-proofs.json`).
- **Loki** — log aggregation for nonce-correlated journal receipts; set `OPENCLAW_PROOFS_LOKI_BASE_URL` for non-fleet runs.
- **Tempo** — distributed tracing; a public-safe trace projection is the proof surface for continuation spans; set `OPENCLAW_PROOFS_TEMPO_BASE_URL` for non-fleet runs.
- **Alloy / OTel Collector** — forwards logs and traces from seats into Loki/Tempo.

### Repo Structure
```
tools/k6-proofs/
├── README.md                       — canonical operator docs + runnable scenario list
├── run-proof.sh                    — runner for workflow-runnable scenario basenames
├── lib/
│   ├── gateway-ws.js               — WS helpers, request tracking, nonce/redaction boundary
│   └── manifest-loader.js          — row-manifest loading + env placeholder resolution
├── manifests/                      — row manifests (broader than runnable scenario coverage)
├── scenarios/                      — k6 scenarios currently promoted to runnable
├── scripts/                        — seat preflight, evidence writer, postprocessor, corpus validator
├── dashboards/                     — Grafana dashboard JSON
├── docs/                           — golden path / safety / regression-trap notes
└── skill/
    └── SKILL.md                    — this detailed how-to

.agents/skills/k6-proofs/SKILL.md   — discoverable wrapper that points agents here
tools/k6-proofs/k6-proofs-pipeline.xml — structured one-shot decision tree
```

## How to Build a New Proof Scenario

### 1. Identify the Row
Check `tools/k6-proofs/k6-proofs-pipeline.xml`, `tools/k6-proofs/CONTRIBUTING-ROWS.md`, and the Project-81 issue for the row definition:
- Row name (e.g., `R-CD-2`)
- Expected behavior
- Owner assignment
- Required evidence shape

### 2. Create the Scenario File
```bash
# Name convention: scenarios/r-<row-name>.js (lowercase, hyphens)
touch tools/k6-proofs/scenarios/r-cd-2.js
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
# Local test from repo root (no Prometheus output)
k6 run tools/k6-proofs/scenarios/r-cd-2.js

# Full runner path from repo root; use a promoted scenario basename
./tools/k6-proofs/run-proof.sh r-cd-2-silent-wake

# Custom target/env is passed through k6 as environment
OPENCLAW_GATEWAY_WS=ws://10.0.0.246:18789 ./tools/k6-proofs/run-proof.sh r-cd-2-silent-wake
```

### 5. Commit Evidence
After a successful run on the target SHA:
```bash
node tools/k6-proofs/scripts/evidence-writer.mjs \
  --input /tmp/r-cd-2-output.txt \
  --row R-CD-2 \
  --seat <seat> \
  --sha <40-char-sha>
# Review the candidate run directory, add public-safe trace/log receipts, then fold intentionally.
```

## Key Patterns

### Evidence Correlation
The gateway doesn't expose a REST API for delegate dispatch — delegates fire via the agent's tool surface. The k6 harness verifies infrastructure readiness and captures evidence post-run:
1. **Journal/Loki grep** — query the gateway journal or Loki for the nonce window; do not commit secrets.
2. **Tempo trace pull** — export the public-safe trace projection for the trace id; summarize span tree separately.
3. **Session/event receipt** — use redacted `sessions.messages.subscribe` / response receipts where the row depends on session delivery.

### Both-Forms Mandate
Every continuation row must prove BOTH the typed tool path AND the bracket/token path:
- Tool: `continue_work()` / `continue_delegate()` / `request_compaction()`
- Token: `CONTINUE_WORK` / `CONTINUE_WORK:N` / `[[CONTINUE_DELEGATE: ...]]`

(`request_compaction` is tool-only — no token form.)

### Caps-Test Procedure
For rows that test cap exhaustion (R-CW-5, R-CW-6):
1. Lower caps in `openclaw.json` (record originals)
2. Restart/reload as required by the config lever; record the exact arm step
3. Fire the row — verify reject
4. Restore originals + restart/reload back to baseline

### Custom Metrics Naming
Prefix all custom metrics with the row name (underscores, lowercase):
- `r_cd_1_pass` / `r_cd_1_fail` / `r_cd_1_duration_ms` / `r_cd_1_pass_rate`

This ensures Grafana queries can filter by row.

## Project Tracking
- **EPIC**: #106
- **Issues**: Project 81 issues in `karmaterminal/karmaterminal-openclaw-docs` (currently #100–#146+)
- **Project Board**: [P81](https://github.com/orgs/karmaterminal/projects/81)
- **Row registry**: `tools/k6-proofs/k6-proofs-pipeline.xml`, row manifests, and per-SHA `PROOFS/<sha>/proofs-manifest.json`

## Dependencies
- k6 binary present on the target seat at the expected version
- Gateway running on target seat
- Observability stack reachable for the evidence surfaces the row claims
