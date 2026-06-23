# k6 Proof Harness

Deterministic proof-row fire-and-observe harness for the OpenClaw continuation feature corpus.

## Structure

```
k6/
├── lib/
│   └── gateway-ws.js        # Shared WS helpers (frame, connect, nonce)
├── scenarios/
│   ├── preflight.js          # Scenario 0: auth + tool inventory check
│   ├── r-cd-1-typed-delegate.js   # R-CD-1: typed continue_delegate()
│   └── r-cd-token-bracket-delegate.js  # R-CD-TOKEN: bracket [[CONTINUE_DELEGATE:...]]
└── post-process/
    └── evidence-writer.js    # Transforms k6 output → PROOFS/<sha>/<row>/ artifacts
```

## Prerequisites

- [Grafana k6](https://grafana.com/docs/k6/latest/get-started/installation/) installed.
- A running OpenClaw gateway on the local seat.
- Environment variables:
  - `OPENCLAW_GATEWAY_WS` — WebSocket URL (default: `ws://127.0.0.1:18789`)
  - `OPENCLAW_GATEWAY_TOKEN` — operator auth token (required)
  - `OPENCLAW_SESSION_KEY` — target session key (default: `main`)

## Usage

### 1. Preflight check

```bash
k6 run k6/scenarios/preflight.js
```

Verifies auth, health, and expected tool visibility.

### 2. Run a row scenario

```bash
k6 run k6/scenarios/r-cd-1-typed-delegate.js 2>&1 | tee /tmp/r-cd-1-output.txt
```

### 3. Post-process into proof artifacts

```bash
node k6/post-process/evidence-writer.js /tmp/r-cd-1-output.txt R-CD-1 ronan-dgx <SHA>
```

This writes structured evidence into `PROOFS/<SHA>/R-CD-1/ronan-dgx/`.

## Row coverage (this PR)

| Row | Scenario | Path |
|-----|----------|------|
| R-CD-1 | Typed `continue_delegate()` | `r-cd-1-typed-delegate.js` |
| R-CD-TOKEN | Bracket `[[CONTINUE_DELEGATE:...]]` | `r-cd-token-bracket-delegate.js` |

## Guardrails

- Child tasks use nonce-only prompts: no file mutation, no external writes.
- Token path (R-CD-TOKEN) may produce honest-limit on seats where final-text routes through message-body (bracket scanner killed). This is expected behavior, not a test failure.
- Scenarios run single-VU, serialized. Do not run against active sessions without coordination.
- Gateway token must never appear in committed artifacts.

## Coordination

- Epic: [#106](https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/106)
- This PR: [#103](https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/103)
- Coordinator: @silas-dandelion-cult
