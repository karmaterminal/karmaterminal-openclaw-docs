# k6 proof-harness (first milestone scaffold)

A [Grafana k6](https://grafana.com/docs/k6/latest/) harness that automates the
**deterministic** parts of the continuation proof rows against a **local**
OpenClaw gateway: it connects, fires a row, observes the gateway/session/task/
trace receipts, and labels a **candidate** verdict. A **human verdicts**.

> **Status: SCAFFOLD / design request.** This is a clean, runnable-shaped first
> milestone on a branch for figs + cohort review — **not yet a production proof
> runner.** The gateway method/tool names are transcribed from the design notes
> and OpenClaw protocol docs; they must be **verified against the deployed SHA**
> before a real proof run (every scenario says so in its header). k6 is not
> installed on the authoring seat, so the k6 scripts here are written + syntax-
> reviewed but **not yet executed against a gateway**.

## What this is (and is NOT)

This harness exists because the `PROOFS/<SHA>/` continuation rows
(`openclaw-bootstrap/RUNBOOKS/PROOF-CORPUS-METHOD.md`) are manually intensive,
and their **deterministic** parts — connect, fire, wait for receipts, save
artifacts — are exactly what k6 is good at: repeatable scripts, WebSocket
support, thresholds, checks, scenario orchestration, CI-friendly output.

**It is the automation that PRODUCES proof rows. It is NOT a proof row itself.**
That is why it lives under `proof-harness/k6/`, not under `PROOFS/<SHA>/`
(proofs rows are *evidence*; this is the tooling).

**The harness does:** fire + observe + correlate receipts (trace ids, task
ledger entries, child run ids, hop-2 turns) + label each row a
**PASS-CANDIDATE / HONEST-LIMIT / FAIL-CANDIDATE / INCONCLUSIVE** *candidate*.

**The harness does NOT:** decide a final corpus verdict. A green gateway
response is **insufficient** — receipts and traces are the product. Humans
confirm transcript meaning + the Tempo trace, then set ✅ / ⚠️ / 🔴 per the
runbook. **Every artifact says `HUMAN_VERDICT_REQUIRED`.**

## Layout

```
proof-harness/k6/
├── README.md                       ← you are here
├── row-manifest.example.json       ← the row manifest shape (id, transport, session, receipts, safe-to-fire)
├── lib/
│   ├── gateway.js                  ← WS connect/frame/correlation + token-from-env + inbound recorder
│   └── verdict.js                  ← PASS/HONEST-LIMIT/FAIL labelling, traced to CONTINUATION-BEHAVIOR-SPEC
├── scenarios/                      ← the 5 first-milestone smokes (one file each)
│   ├── 00-preflight.js             ← connect + health + sessions.list + tools.effective (READ-ONLY, always safe)
│   ├── 01-r-cw-1-tool.js           ← R-CW-1: typed continue_work()              [BOTH-FORMS: tool]
│   ├── 02-r-cw-token.js            ← R-CW-TOKEN: bare CONTINUE_WORK:1 + nonce    [BOTH-FORMS: token, the #952 path]
│   ├── 03-r-cd-1-tool.js           ← R-CD-1: typed continue_delegate()          [BOTH-FORMS: tool]
│   └── 04-r-cd-token.js            ← R-CD-TOKEN: [[CONTINUE_DELEGATE | silent-wake]] [BOTH-FORMS: bracket]
└── post-process/
    └── summary-to-evidence.mjs     ← k6 summary.json (+ NDJSON) → PROOFS/<SHA>/<ROW>/k6-run-<ts>/ artifacts
```

## The five first-milestone scenarios

Per the notes' *Recommended first milestone* — smokes only; compaction +
chained-depth rows come later, one at a time, serialized.

| # | Row | Form | Fires? | What it proves (candidate) |
|---|---|---|---|---|
| 0 | `preflight` | — | read-only | auth works; continue_work/continue_delegate/request_compaction visible in the session surface. Absent tool → **HONEST-LIMIT**, not blind-fire. |
| 1 | `R-CW-1` | **tool** | yes¹ | typed `continue_work()` → successor turn + chain correlation + trace. |
| 2 | `R-CW-TOKEN` | **token** | yes¹ | bare `CONTINUE_WORK:1` at end of reply **drives** hop-2 carrying a nonce (not just stripped). **The path #952 broke on.** |
| 3 | `R-CD-1` | **tool** | yes¹ | typed `continue_delegate()` → task-ledger + child run + parent return. |
| 4 | `R-CD-TOKEN` | **token** | yes¹ | `[[CONTINUE_DELEGATE: … \| silent-wake]]` bracket → child + return (parser path). |

¹ **only when `SAFE_TO_FIRE=1`** (see Safety gates). A bare `k6 run` of a fire
scenario preflights, records a safety note, and exits **without firing**.

### Why both forms (the BOTH-FORMS MANDATE)

`continue_work` and `continue_delegate` each have **two independent entry
surfaces**: the typed **tool** *and* the **token/bracket** fallback. They take
partially independent code paths — the tool surfaces as
`runOutcome.continueWorkRequest`; the bracket/bare-token is parsed from
finalized reply text (`tokens.ts`). **A tool-only proof is blind to exactly the
path #952 broke on** (lightContext subagents have *no* tool — the token is their
only path). So `R-CW-1`/`R-CW-TOKEN` and `R-CD-1`/`R-CD-TOKEN` are **separate,
mandatory** rows, not a mix. `request_compaction` is **tool-only** (no token
form) and is intentionally **not** in the first milestone (opt-in + serialized;
see below).

### PASS-candidate logic traces to the spec

`lib/verdict.js` maps observed receipts to a label **and the
`CONTINUATION-BEHAVIOR-SPEC` cell it traces to** — never "green exit code". E.g.
R-CW-1 is a PASS-candidate only if *accepted AND a successor turn AND chain
correlation*; the ERRONEOUS shapes (0 turns / >1) come straight from spec
§test-1. R-CW-TOKEN requires the **nonce to surface in hop-2** to prove the token
*drove* the continuation, not merely got stripped.

## How to run

### Prerequisites

- **k6** installed (`command -v k6`). Install: <https://grafana.com/docs/k6/latest/set-up/install-k6/>.
- **Node** (for the post-processor) — already standard on the fleet.
- A **local** OpenClaw gateway reachable at `ws://127.0.0.1:18789` (verified on
  this seat: `/health` → 200; `POST /tools/invoke` → 401 without auth, i.e. the
  endpoint exists and requires bearer auth).
- The operator **token in `OPENCLAW_GATEWAY_TOKEN`** (see Security model — env or
  CI secret, **never** in a script/artifact).
- For fire scenarios: the seat **deployed at the CANDIDATE_SHA** under test, and
  ideally **quiet** (a busy main seat can busy-skip continuations — that is the
  #1057 surface, not a harness bug).

### Preflight (read-only — always safe)

```bash
export OPENCLAW_GATEWAY_TOKEN=***          # from your secret store, not echoed
export OPENCLAW_SESSION_KEY=main
k6 run --summary-export=summary.json proof-harness/k6/scenarios/00-preflight.js
```

### A fire scenario (only on a quiet seat at CANDIDATE_SHA, intentionally)

```bash
export OPENCLAW_GATEWAY_TOKEN=***
export OPENCLAW_SESSION_KEY=main
export CANDIDATE_SHA=<full-40-char-sha>
export SEAT_NAME=elliott-legion
export PROOF_NONCE=cw1-$(date +%s)
export SAFE_TO_FIRE=1                        # ← the explicit fire gate

# tee stdout so the post-processor can author gateway-events.ndjson:
k6 run --summary-export=summary.json \
  proof-harness/k6/scenarios/01-r-cw-1-tool.js | tee k6-stdout.ndjson
```

### Post-process into proof artifacts

```bash
node proof-harness/k6/post-process/summary-to-evidence.mjs \
  --summary summary.json \
  --ndjson  k6-stdout.ndjson \
  --out     PROOFS \
  --sha     "$CANDIDATE_SHA" --seat "$SEAT_NAME"
# → PROOFS/<SHA>/R-CW-1/k6-run-<timestamp>/{EVIDENCE.md, k6-summary.json,
#    gateway-events.ndjson, tool-invoke-response.json, task-ledger.json}
```

The `EVIDENCE.md` is a **DRAFT** with the candidate label + a human-verdict
checklist + a `wake_event_trace.json` TODO (fetch the Tempo trace for the
captured trace id: `https://tempo.dandelion.cult/api/traces/<trace-id>`).

## Safety gates (defense in depth)

1. **`SAFE_TO_FIRE=1` env gate.** Every fire scenario refuses to invoke a
   continuation tool unless this is set. Default OFF → a bare `k6 run` cannot
   accidentally drive a live continuation. preflight is read-only and ignores it.
2. **`safeToFire` per-row manifest flag.** A row should be marked safe in the
   manifest *and* the env gate set. Belt and suspenders.
3. **`request_compaction` excluded from the first milestone.** It is tool-only,
   opt-in, and must be **serialized** — never run in parallel with cw/cd against
   the same session. Added later, one row at a time.
4. **Non-mutating nonce tasks.** Delegate scenarios task the child to reply with
   `DONE <nonce>` and nothing else — no file mutation, no external tools.
5. **Dedicated test session for token rows.** R-CW-TOKEN / R-CD-TOKEN inject a
   *driving prompt*; point them at a throwaway test session, not a live one.

## Security model

- **Loopback / tailnet only.** The gateway WebSocket operator endpoint and
  `POST /tools/invoke` grant **broad operator access**. Never expose them to an
  untrusted network. This harness defaults to `ws://127.0.0.1:18789`.
- **Token via env / CI secret, NEVER in scripts or artifacts.** `lib/gateway.js`
  reads `OPENCLAW_GATEWAY_TOKEN` from the environment. The token is never logged
  at info level, never written to `summary.json`, and the post-processor
  additionally scrubs any value matching the token env var from every artifact.
  The token also does not appear in inbound gateway frames, so
  `gateway-events.ndjson` is safe to commit.
- **`tools.effective` before each row** records whether the deployed SHA exposes
  the expected tool surface (policy-drift guard).
- **Receipts/traces are the product, not a green exit** — the harness will not
  call anything a PASS without the corroborating receipts.

## CI / repo-secrets pattern (note, not wired)

figs's direction: in production the gateway token lives as a **repo secret**.
A GitHub Actions workflow would run this harness against a gateway reachable
from the runner (a self-hosted runner *on* a fleet seat, or a tailnet-joined
runner — **never** a public gateway), injecting the token from the secret:

```yaml
# .github/workflows/proof-harness.yml  (SKETCH — not committed; wire when ready)
name: continuation-proof-harness
on: { workflow_dispatch: { inputs: { candidate_sha: { required: true }, safe_to_fire: { default: "0" } } } }
jobs:
  preflight:
    runs-on: [self-hosted, fleet-seat]          # MUST reach the local gateway over loopback/tailnet
    steps:
      - uses: actions/checkout@v4
      - run: curl -fsSL https://...k6... | tar xz && sudo mv k6 /usr/local/bin/   # or preinstalled
      - name: preflight (read-only)
        env:
          OPENCLAW_GATEWAY_TOKEN: ${{ secrets.OPENCLAW_GATEWAY_TOKEN }}   # ← repo secret, never inline
          OPENCLAW_SESSION_KEY: main
        run: k6 run --summary-export=summary.json proof-harness/k6/scenarios/00-preflight.js
      # fire jobs gated on inputs.safe_to_fire == '1' AND a quiet, CANDIDATE_SHA-deployed seat;
      # serialize request_compaction; post-process + upload artifacts (NOT auto-commit to PROOFS).
```

Key constraints: the runner must reach the gateway on loopback/tailnet (a
public gateway is forbidden); the token is **only** ever `${{ secrets.* }}`;
fire jobs are explicitly opt-in via a `safe_to_fire` input; artifacts are
uploaded for human review, **not** auto-committed into `PROOFS/`.

## Open questions / assumptions flagged for review

1. **Gateway method/tool names are documented, not byte-verified live.** The
   `connect` envelope and `health` / `sessions.list` / `tools.effective` /
   `tools.invoke` / `sessions.send` / `tasks.list` / `*.subscribe` names come
   from the design notes + protocol docs. Before a real run, confirm each against
   the deployed SHA (a `tools.catalog` probe + a manual `connect`).
2. **Inbound event envelope is matched heuristically.** Successor-turn / child-
   spawn / task-ledger / return detection uses tolerant field-name + needle
   matching (the unique nonce is the strong signal), because the exact event
   frame shape per SHA is not pinned here. Once verified, tighten to exact paths.
3. **Trace capture is a post-process TODO.** Scenarios capture a trace id when
   one appears in a frame; fetching the Tempo trace JSON
   (`wake_event_trace.json`) is left to a companion step (the runbook's Tempo
   requirement). A `tempo-fetch.mjs` companion is the obvious next addition.
4. **One file per scenario vs a single k6 `scenarios` config.** Chosen: one file
   per scenario, for independent runnability + clear `--summary-export` per row.
   A combined runner with k6 `scenarios{}` + `startTime` staggering (as the notes
   sketch) is a straightforward follow-up if a single-invocation suite is wanted.
5. **Human-verdict boundary is hard-coded.** The harness deliberately cannot emit
   a final verdict — only candidates. If we ever want auto-PASS for the most
   deterministic rows, that is a policy decision for figs, not a harness default.

## Source / spec anchors

- `openclaw-bootstrap/.specify/notes/k6-for-proofs-deterministic-elements.md` — the design (this scaffold follows its first-milestone + skeleton).
- `openclaw-bootstrap/RUNBOOKS/PROOF-CORPUS-METHOD.md` — corpus shape, EVIDENCE.md shape, BOTH-FORMS MANDATE, Tempo requirement, HONEST-LIMIT semantics.
- `openclaw-bootstrap/RUNBOOKS/CONTINUATION-BEHAVIOR-SPEC.md` — the desired-behavior definitions the PASS-candidate logic traces to.
