# k6 Proof Harness — continue_delegate rows

Deterministic proof-row fire-and-observe harness for the OpenClaw continuation feature corpus.

## Structure

```
k6/
├── lib/
│   └── gateway-ws.js              # Shared WS helpers (frame, connect, nonce, RequestTracker, redaction)
├── manifests/
│   ├── r-cd-1.json                # Row manifest: R-CD-1 typed delegate
│   └── r-cd-token.json            # Row manifest: R-CD-TOKEN bracket delegate
├── scenarios/
│   ├── preflight.js               # Scenario 0: auth + tool inventory check
│   ├── r-cd-1-typed-delegate.js   # R-CD-1: typed continue_delegate()
│   └── r-cd-token-bracket-delegate.js  # R-CD-TOKEN: [[CONTINUE_DELEGATE:...]]
└── post-process/
    └── evidence-writer.js         # Transforms k6 output → PROOFS/<sha>/<row>/ artifacts
```

## Prerequisites

- [Grafana k6](https://grafana.com/docs/k6/latest/get-started/installation/) installed.
- A running OpenClaw gateway on the local seat.
- Environment variables:
  - `OPENCLAW_GATEWAY_WS` — WebSocket URL (default: `ws://127.0.0.1:18789`)
  - `OPENCLAW_GATEWAY_TOKEN` — operator auth token (**required, never in source**)
  - `OPENCLAW_SESSION_KEY` — target session key (default: `main`)
  - `OPENCLAW_SEAT_CLASS` — `raw-final-text` or `message-body` (default: `message-body`; affects R-CD-TOKEN expected outcome)

## Usage

### 1. Preflight check

```bash
OPENCLAW_GATEWAY_TOKEN="$TOKEN" k6 run k6/scenarios/preflight.js
```

Verifies auth, health, and expected tool visibility.

### 2. Run a row scenario

```bash
OPENCLAW_GATEWAY_TOKEN="$TOKEN" k6 run k6/scenarios/r-cd-1-typed-delegate.js 2>&1 | tee /tmp/r-cd-1-output.txt
```

### 3. Post-process into proof artifacts

```bash
node k6/post-process/evidence-writer.js /tmp/r-cd-1-output.txt R-CD-1 ronan-dgx <SHA>
```

This writes structured evidence into `PROOFS/<SHA>/R-CD-1/ronan-dgx/`.

## Design principles

### Data/logic separation

Row-specific configuration lives in **manifests** (`k6/manifests/*.json`), not in scenario code. Scenarios are generic harness logic; manifests describe what to fire, what to expect, and where to write.

Manifests follow the schema defined by #100 (foundation): `openclaw.k6.proof-row-manifest.v1`.

### Redaction boundary

**No secrets in source or public artifacts.** Gateway tokens come from env vars only.

Event payloads are redacted through an allowlist (`redactEvent()` in `lib/gateway-ws.js`) before writing to `gateway-events.ndjson`. Only safe structural fields (type, method, status, IDs, timing) survive into public artifacts.

Review checklist before any artifact lands in the public docs repo:
- [ ] `gateway-events.ndjson` contains only allowlisted fields
- [ ] No token/password/secret in any artifact
- [ ] No user content or prompt bodies beyond the nonce-only test prompt

### Protocol correctness

Gateway WS responses use `{ type: "res", id, payload?, error? }` — NOT `{ result }`.

The `RequestTracker` class in `lib/gateway-ws.js` maps request IDs to method names, since responses don't echo the method. All response classification goes through `tracker.classify(msg)` which returns `{ kind, method, ok, payload, error }`.

### Seat-class awareness (R-CD-TOKEN)

The bracket scanner fires only on scanned-final-text (terminal position). Seats that route final-text through `message(send)` body kill the scanner (`bracketIdx=-1`).

- **raw-final-text seat**: bracket fires → PASS-candidate
- **message-body seat** (ronan-dgx default): bracket killed → HONEST-LIMIT-candidate

This is not a failure — it's a documented substrate limitation. Set `OPENCLAW_SEAT_CLASS=raw-final-text` only on seats that genuinely emit raw terminal text without the message tool.

## Row coverage

| Row | Scenario | Surface | Expected outcome |
|-----|----------|---------|-----------------|
| R-CD-1 | Typed `continue_delegate()` | typed-tool | PASS-candidate |
| R-CD-TOKEN | Bracket `[[CONTINUE_DELEGATE:...]]` | bracket-token | Seat-dependent (see above) |

## Guardrails

- Child tasks use nonce-only prompts: no file mutation, no external writes.
- Scenarios run single-VU, serialized. Do not run against active sessions without coordination.
- Gateway token must never appear in committed artifacts or source.
- All artifacts are CANDIDATE status; human review promotes to PASS.
- No manifest fold without review (per #100 foundation contract).

## Coordination

- Epic: [#106](https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/106)
- Row issue: [#103](https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/103)
- Foundation: [#100](https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/100) (artifact layout by Emeric)
- Coordinator: @silas-dandelion-cult
- Project: [karmaterminal project 81](https://github.com/orgs/karmaterminal/projects/81)
