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
>
> **Live-verification landed (🩸 Cael, 2026-06-21 —
> [`VERIFIED-GATEWAY-SURFACE.md`](./VERIFIED-GATEWAY-SURFACE.md)):** the method/
> tool names + `tools.invoke` schema are confirmed against the live gateway. Two
> corrections are now wired in: (1) the connect flow is **challenge-first** — the
> gateway pushes a `connect.challenge` event before accepting `connect` and
> rejects a raw connect-on-open; and (2) the wake-matcher / subscribe scenarios
> key on **`session.message`** (the live event) — `turn.start`/`run.start` are NOT
> in the live 25-event surface and would never fire. See the doc for details.

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
│   ├── 04-r-cd-token.js            ← R-CD-TOKEN: [[CONTINUE_DELEGATE | silent-wake]] [BOTH-FORMS: bracket]
│   └── _combined-suite.js          ← OPTIONAL single-invocation runner (preflight + fire rows SERIALIZED via startTime)
├── post-process/
│   ├── summary-to-evidence.mjs     ← k6 summary.json (+ NDJSON) → PROOFS/<SHA>/<ROW>/k6-run-<ts>/ artifacts
│   └── tempo-fetch.mjs             ← fetch the Tempo trace JSON → wake_event_trace.json (closes the trace TODO)
└── .github-workflow-example/
    └── proofs-k6.yml               ← EXAMPLE CI workflow (per-seat repo-secret token; NOT wired — review first)
```

### Companion tooling + optional runners (the open-Q follow-ups)

Three additions sit alongside the core scaffold; each is a deliberate follow-up
to a flagged open question, and each is honest about assumed-vs-verified:

- **`post-process/tempo-fetch.mjs`** (open-Q #3) — companion to
  `summary-to-evidence.mjs`. Given a trace id (explicit `--trace`, or pulled from
  a scenario's `summary.json`) and a Tempo base URL (`--base` / `$TEMPO_BASE_URL`,
  **per-seat** — `https://tempo.dandelion.cult` on elliott), it fetches the full
  trace export (`GET <base>/api/traces/<id>`) and writes `wake_event_trace.json`
  (+ a small span-name index) into the row's `k6-run-<ts>/` dir, satisfying the
  EVIDENCE.md trace TODO. A missing trace id / network failure is an HONEST
  breadcrumb file, never a crash. Any Tempo bearer is env-only + scrubbed — same
  discipline as the post-processor. Use `--insecure` for a self-signed ingress
  (`curl -k` parity); per-deployment assumptions are flagged in its header.
- **`scenarios/_combined-suite.js`** (open-Q #4) — the OPTIONAL combined runner.
  Runs preflight then the four fire rows in ONE `k6 run` via a k6 `scenarios{}`
  config with `startTime` staggering. Fire rows are **SERIALIZED, never parallel**
  (the guardrail) and still require `SAFE_TO_FIRE=1`. Its header documents the
  honest k6-model constraint: per-row files each own module-scope state +
  `options` + `handleSummary`, so they cannot simply be imported and multiplexed
  — the combined runner re-uses the shared **libs** instead. **The per-file
  scenarios remain the source of truth + the recommended evidence-grade path.**
  `request_compaction` / future compaction rows must NOT be added to it.
- **`.github-workflow-example/proofs-k6.yml`** — the concrete CI pattern (see
  "CI / repo-secrets pattern" below). In `.github-workflow-example/` (NOT the
  real `.github/workflows/`) so it does not register as a live Action — a
  documented pattern pending method-verify + figs review.

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

## CI / repo-secrets pattern (concrete example added; not wired)

figs's direction: in production the gateway token lives as a **repo secret**.
A concrete, heavily-commented workflow now exists at
**`.github-workflow-example/proofs-k6.yml`** (placed there, NOT in the real
`.github/workflows/`, so it does not register as a live Action pending
method-verify + figs review). It uses **per-seat repo-secrets**
(`secrets.<SEAT>_GATEWAY_TOKEN`, e.g. `ELLIOTT_GATEWAY_TOKEN`) selected by a
`target_seat` input, runs on a **self-hosted runner on that seat** (loopback
only), runs preflight always, fires only when `safe_to_fire=true`, serializes
the fire rows, and post-processes + Tempo-fetches + uploads artifacts (never
auto-commits to `PROOFS/`). The condensed shape:

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
public gateway is forbidden); the token is **only** ever `${{ secrets.* }}`
(per-seat: `secrets.<SEAT>_GATEWAY_TOKEN`); fire jobs are explicitly opt-in via
the `safe_to_fire` input; artifacts are uploaded for human review, **not**
auto-committed into `PROOFS/`. See `.github-workflow-example/proofs-k6.yml` for
the full version (per-seat token selection, serialized fire steps, Tempo fetch).

## Open questions / assumptions flagged for review

1. **Gateway method/tool names — VERIFIED LIVE (🩸 Cael,
   [`VERIFIED-GATEWAY-SURFACE.md`](./VERIFIED-GATEWAY-SURFACE.md)).** The
   `health` / `sessions.list` / `tools.effective` / `tools.invoke` /
   `sessions.send` / `tasks.list` / `*.subscribe` names + the `tools.invoke`
   schema + the continuation tool names are confirmed present in the live
   inventory. The one real connect fix is wired: the handshake is
   **challenge-first** — the gateway emits a `connect.challenge` event before
   accepting `connect` and rejects a raw connect-on-open, so every scenario now
   gates its `connect` send on that challenge (`isConnectChallenge` /
   `onConnectChallenge` in `lib/gateway.js`) instead of sending on `open`.
   `mode:'operator'` is kept (probe-mode loses scopes). Still confirm the live
   SHA with `openclaw --version` at proof-run time.
2. **Inbound event envelope — event-names VERIFIED LIVE (25-event surface).**
   Successor-turn / child-spawn / task-ledger / return detection uses tolerant
   field-name + needle matching (the unique nonce is the strong signal). Per
   Cael's verification, the **wake-matcher** (R-CD-TOKEN silent-wake, scenario 04
   + `_combined-suite`) keys on **`session.message`** — the live event a parent
   wake surfaces as — NOT `turn.start`/`run.start` (those are source-internal and
   never pushed to subscribers, so a matcher on them would never fire). The
   subscribe path is `sessions.messages.subscribe` (pushes arrive as
   `session.message`); verify the exact subscribe method name vs the deployed SHA.
3. **Trace capture — companion ADDED (`post-process/tempo-fetch.mjs`).**
   Scenarios capture a trace id when one appears in a frame; fetching the Tempo
   trace JSON (`wake_event_trace.json`, the runbook's Tempo requirement) is now
   done by `tempo-fetch.mjs` (given a trace id + per-seat Tempo base). Remaining
   per-deployment assumptions are flagged in its header: the **per-seat** Tempo
   base URL, the OTLP/JSON envelope shape (parsed tolerantly), and self-signed
   ingress TLS (`--insecure` for `curl -k` parity).
4. **One file per scenario vs a single k6 `scenarios` config — OPTIONAL combined
   runner ADDED (`scenarios/_combined-suite.js`).** Default remains one file per
   scenario (independent runnability + a clean `--summary-export` per row). The
   combined runner (k6 `scenarios{}` + `startTime` staggering, fire rows
   **serialized**) is the single-invocation option. Honest caveat in its header:
   k6 cannot multiplex the per-row files' module-scope state, so it re-uses the
   shared libs and the per-file scenarios stay the evidence-grade source of truth;
   a combined run emits one nested summary (per-row `PROOFS/` authoring from it is
   a further follow-up).
5. **Human-verdict boundary is hard-coded.** The harness deliberately cannot emit
   a final verdict — only candidates. If we ever want auto-PASS for the most
   deterministic rows, that is a policy decision for figs, not a harness default.

## Source / spec anchors

- `openclaw-bootstrap/.specify/notes/k6-for-proofs-deterministic-elements.md` — the design (this scaffold follows its first-milestone + skeleton).
- `openclaw-bootstrap/RUNBOOKS/PROOF-CORPUS-METHOD.md` — corpus shape, EVIDENCE.md shape, BOTH-FORMS MANDATE, Tempo requirement, HONEST-LIMIT semantics.
- `openclaw-bootstrap/RUNBOOKS/CONTINUATION-BEHAVIOR-SPEC.md` — the desired-behavior definitions the PASS-candidate logic traces to.
