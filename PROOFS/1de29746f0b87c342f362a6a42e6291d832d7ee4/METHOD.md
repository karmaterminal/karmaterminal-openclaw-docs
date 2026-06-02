# METHOD

Methodology + reproducer commands for `PROOFS/1de29746f0b87c342f362a6a42e6291d832d7ee4/`.

## Anchor runbook

`karmaterminal/openclaw-bootstrap:RUNBOOKS/PROOF-CORPUS-METHOD.md` (ratified 2026-05-16, 164 lines). This corpus follows that runbook; deviations noted inline.

## Cycle shape

Unlike PR-drift-cure cycles (e.g. `e90a87015479d7a7ff6ae73deda9a84f1a448418` for #79925), CANDIDATE_SHA `1de29746f0` is the uncurse-tip of the fork-main merge-train after the #868 saga cure-chain. There is no force-push to PR-presentation branch + no rebase-onto-fresh-upstream substrate this cycle — the cure-bytes landed via merged PRs (#862/#863/#864/#865/#868a/#868b/#869/#870) following standard cohort merge-flow.

The corpus exists to validate that the merged cure-chain actually restored continuation-tool behavior fleet-wide, captured as live-host runtime evidence with Tempo traces per the figs 2026-05-16 directive.

## Per-row reproducer (cael-owned rows)

### R-CW-1 + R-CW-2 (chain-counter accounting embedded)

```bash
# Pre-fire state capture
session_status  # capture binary version, gateway uptime, chain N/200, volitional count

# Fire
continue_work(delaySeconds=10, reason="R-CW-1 proof fire — capturing wake event + trace + chain-counter for PROOFS/1de29746f0.../ on cael-seat post-deploy at CANDIDATE_SHA")

# Capture from tool response
- result.status (expect: "scheduled")
- result.traceparent (W3C trace-context: 00-<trace_id>-<span_id>-01)

# Wake fires ~10s later → capture in next turn
session_status  # post-wake: same binary, same gateway uptime, chain N+1/200
# Journal grep: `[continuation/signal] effective-signal: origin=tool-call kind=work session=...`
# Tempo fetch: http://tempo.dandelion.cult/api/traces/<trace_id>
```

Evidence files:
- `R-CW-1/wake_event_evidence.txt` — schedule + wake snapshot + journal + Tempo span hierarchy
- `R-CW-1/wake_event_trace.json` — Tempo trace JSON export

### R-RC-2 (request_compaction over-threshold ACCEPT)

```bash
# Pre-fire state capture (need context >70%)
session_status  # capture binary version, context-usage %, prior compactions

# Fire
request_compaction(reason="R-RC-2 proof fire — over-threshold ACCEPT capture for PROOFS/1de29746f0.../R-RC-2/. Context at <X>%, above 70% threshold.")

# Capture from tool response
- status: "compaction_requested"
- compactionRequestId
- trigger: "volitional"
- contextUsage
- traceparent

# Tempo fetch
http://tempo.dandelion.cult/api/traces/<trace_id>
```

Evidence files:
- `R-RC-2/compaction_accept_request_receipt.txt` — request snapshot + tool response + trace identity
- `R-RC-2/compaction_accept_request_trace.json` — Tempo trace JSON export

## Pre-deploy checklist (cael-seat)

1. Clean install-dir of any modified-tracked files: `cd ~/flesh_beast_tmp/openclaw && git status -s` → expect clean
2. Verify SSH-deploy auth: `gh workflow run deploy-gateway.yml --repo karmaterminal/openclaw-bootstrap -f target_prince=cael -f ref=1de29746f0b87c342f362a6a42e6291d832d7ee4 -f reason='PROOFS-corpus row-fire prep'`
3. Wait for run completion: `gh run view <run_id> --repo karmaterminal/openclaw-bootstrap`
4. Verify post-deploy: `openclaw --version` → expect `OpenClaw 2026.X.Y (1de2974)` matching CANDIDATE_SHA

## Tempo fetch reproducer

```bash
TRACE_ID="<from tool result traceparent>"
curl -fsS "http://tempo.dandelion.cult/api/traces/${TRACE_ID}" > "R-XX-/descriptive_trace.json"

# Fallback if haproxy flaky:
ssh elliott "sudo k3s kubectl port-forward -n observability svc/tempo 13100:3100" &
curl -fsS "http://localhost:13100/api/traces/${TRACE_ID}" > "R-XX-/descriptive_trace.json"
```

## Commit discipline

- One commit per row (per runbook §"Authoring discipline")
- Commit message format: `PROOFS/1de29746f0: R-XX <brief>`
- Push direct to `karmaterminal-openclaw-docs:main` (no branch/PR detour per figs 2026-05-16 directive)
- README.md verdict table updated alongside row commits — reviewers see at-a-glance status
