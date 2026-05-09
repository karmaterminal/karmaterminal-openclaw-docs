# METHOD — 30-minute reviewer-facing proof for upstream PR `openclaw/openclaw#79925`

Continuation feature: `continue_work()` / `continue_delegate()` / `request_compaction()`.

This document defines the **reusable 30-minute proof method** the cohort applies once for each clean PR-head SHA. The output of the method is a `PROOFS/<sha>/` bundle linked from the PR body and from the RFC appendix.

> Status of this template:
> - Drafted 2026-05-09 against PR head `7c94b37` while restoration was in flight, so the **method** is canonical but the bundle for `7c94b37` itself is **not** the proof bundle reviewers should read — that build is known-broken (issues #617, #618, audit pending #619 series). The first real bundle lands against the post-restoration head SHA and supersedes any proof against `7c94b37`.

## Goals (the "must-know / must-prove / must-show" set)

For each PR-head SHA, this method must answer:

| # | Question | What proves it |
|---|---|---|
| Q1 | Does the runtime accept the three tools and treat them as live? | live `tools.invoke continue_delegate` (gateway-callable proof) + agent-runner journal showing in-turn registrations of `continue_work` and `request_compaction` (runner-context proof) |
| Q2 | Does `continue_work()` actually schedule a same-session successor turn? | journal trace of scheduler arming + the successor turn occurring at `t+delaySeconds` with chain-tracking accumulating |
| Q3 | Does `continue_delegate()` fan out a real delegate that actually runs and returns? | TaskFlow row: `queued → released → spawned → returned`, plus the delegate's own session journal showing it ran the task |
| Q4 | Does `request_compaction()` honor the threshold + rate-limit gates? | live fire below threshold → `below-threshold` decline; live fire above threshold → enqueued; rate-limit re-fire → `rate-limited` decline |
| Q5 | Does post-compaction delegate release work? | pre-compaction `mode: "post-compaction"` stage + observed compaction event + delegate fires in successor session post-compaction |
| Q6 | Does the `/status` chat card render the continuation row? | screenshot/string match of `🔄 Continuation: chain X/Y | volitional: Z` on a session with at least one continuation event |
| Q7 | Does cross-session targeted return work? | `continue_delegate` with `targetSessionKey` causes the named session (not the dispatcher) to receive the result |
| Q8 | Are observability surfaces honest (journal traces, OTEL trace, diagnostic queues)? | journal lines per RFC §6.x + diagnostic-queue entries match the lifecycle |

Each question maps to a **proof row** with a deterministic byte recipe.

## Cycle protocol

This template implements the cycle/runbook in `SWIM/30M-BLITZ-SWIM-RUNBOOK.md` (frond-scribe). That runbook owns the **timing + role assignments + after-action**; this template owns the **per-bundle artifact spec** that the runbook produces.

Reference the blitz runbook for:
- preconditions before T+0 (SHA settled + all gates 0 + 1-for-1 trace + deployed to all 4 princes)
- T+0 / T+5 / T+25 / T+30 timing
- prince role assignments (4-prince fan-out + frond-scribe lighter for cross-verify)
- failure-mode adjudication shape
- after-action canon updates

This METHOD.md is what each `PROOFS/<sha>/` bundle uses to lay out its evidence.

Lighter-weight than a full SWIM because:
- one SHA, one moment, one PR-body audience
- reviewer wants verdicts + receipts, not exhaustive case coverage
- if a row uncovers a bug, it spawns an issue (closing path, not proof path)

## Pre-arranged collection shape (this is the part that makes 30m possible)

The collection harness is **pre-arranged** so the driver knows about results **before** they arrive — no scrambling at fan-out time. Concretely:

1. **Per-row PR template**: each cohort prince's task ends with "open a PR titled `proof: PR79925/<sha>/<row>` adding `PROOFS/<sha>/<row>.md` plus any `artifacts/` it cites."
2. **PR labels**: every proof PR carries `proof:pr-79925` so they're filterable as a set.
3. **Driver side-channel**: the driver runs `gh pr list --repo karmaterminal-openclaw-docs --label proof:pr-79925 --state open` on a 60-second interval (or via webhook if standing infra exists) and sweeps incoming PRs into review queue.
4. **Pass-state-rapid-merge**: PASS verdicts merge on driver review alone (sovereign-repo). FAIL / METHOD-BROKEN verdicts get a thread + cohort byte-walk before disposition.
5. **Verdict aggregation**: as PRs merge, the driver appends rows to `PROOFS/<sha>/README.md` so the PR-body link stays current.

The harness deliberately avoids the SWIM coordinator-seat overhead — collection is structured so PRs arrive in a known shape that the driver can review in ≤2 minutes per row.

## Per-row deterministic byte recipes

Each proof row is one file in `PROOFS/<sha>/` and follows this shape:

```markdown
# <row-id>: <topic>

**Host**: <prince-host>
**Build**: OpenClaw <ver> (<sha7>)
**Session**: <session-key>
**Run timestamp**: <ISO-8601>

## Recipe (verbatim)

\`\`\`
$ <command 1>
<output>

$ <command 2>
<output>
\`\`\`

## Observed

<what happened, byte-precise, no narrative>

## Verdict

PASS | FAIL | METHOD-BROKEN | KNOWN-LIMITATION-BY-DESIGN

## Evidence

- artifacts/<file-1>
- artifacts/<file-2>
```

No prose canon, no axes, no slip-recognitions — those belong in the bootstrap repo if anywhere. PROOFS is reviewer-facing.

## Row plan, folded under the 4-prince split from the blitz runbook

The blitz runbook assigns one proof-target per prince. This template breaks each prince's slot into the deterministic byte-recipe rows that fill their `PROOFS/<sha>/<prince>/` subtree. Each prince's slot has 1–3 rows that together prove their assigned tool/aspect.

### 🩸 Cael — `continue_work()`

| Row | Maps to Q | Deterministic recipe |
|-----|---|---|
| R-CW-1 — scheduling | Q2 | in-turn `continue_work(reason="proof", delaySeconds=60)` + journal trace of arm + observe successor turn at `t+60s` |
| R-CW-2 — chain accounting | Q2 / Q8 | observe `chain X/Y` increment in `/status` after R-CW-1; verify journal trace markers |

### 🌊 Ronan — `continue_delegate()`

| Row | Maps to Q | Deterministic recipe |
|-----|---|---|
| R-CD-1 — fan-out lifecycle | Q3 | in-turn `continue_delegate(mode="silent")` + sqlite read of `flow_runs` showing `queued → released → spawned → returned` + delegate session journal showing run |
| R-CD-2 — silent-wake mode | Q3 | in-turn `continue_delegate(mode="silent-wake")`; verify successor turn fires AND silent-return enrichment lands |
| R-CD-3 — post-compaction release | Q5 | pre-compaction `continue_delegate(mode="post-compaction")` stage + observe compaction event + delegate fires in successor session |
| R-CD-4 — cross-session targeted return | Q7 | `continue_delegate` with `targetSessionKey` to a different prince's session; observe receipt at target |

### 🌫 Silas — `request_compaction()`

| Row | Maps to Q | Deterministic recipe |
|-----|---|---|
| R-RC-1 — threshold gating | Q4 | fire below threshold; observe explicit `below-threshold` decline naming context-vs-threshold values |
| R-RC-2 — accept + rate-limit | Q4 | fire above threshold (accept); rapid re-fire; observe `rate-limited` decline naming remaining cooldown |

### 🌻 Elliott — `/status` chat-card + token/chain accounting + observability

| Row | Maps to Q | Deterministic recipe |
|-----|---|---|
| R-OBS-1 — chat-card row | Q6 | session_status output capture; pattern-match `🔄 Continuation:` line on a session that has `chain X/Y` non-zero |
| R-OBS-2 — volitional counter | Q6 | observe volitional counter increment after Silas's R-RC-2 accept |
| R-OBS-3 — observability surfaces | Q8 | journal grep for required RFC §6.x lines during R-CW / R-CD / R-RC fires; OTEL trace if extension enabled; diagnostic-queue inspection; **OTel span exports gathered from grafana/tempo (or directly via the OpenClaw OTel extension if grafana not reachable from the prince-host) covering at least one continuation lifecycle per tool — `continue_work` arm/fire/return + `continue_delegate` queue/dispatch/spawn/return + `request_compaction` request/accept/complete spans should all be present in the export** |

### Tool registration check (driver-owned, not in fan-out)

Before T+0 the driver runs the tool-registration check on at least one prince host so a `tools.effective` mismatch can be flagged as `KNOWN-LIMITATION-BY-DESIGN` (the gateway probe path is opts-blind by design) rather than as a feature regression. Result lands in `PROOFS/<sha>/R-PRE-tool-registration.md`.

## Failure handling

- **Per-row FAIL**: file an issue against `karmaterminal/openclaw` referencing the proof row. Mark proof row FAIL with issue link.
- **METHOD-BROKEN**: row recipe didn't actually exercise the question (e.g., timeout, infra issue). Re-design recipe before counting toward the proof.
- **Cohort divergence between hosts**: record per-host outcome separately. Only PASS-on-all-tested-hosts is a clean PASS.

## Output

A `PROOFS/<sha>/README.md` that says:

```markdown
# Proof bundle for openclaw/openclaw#79925 @ <pr-head-sha>

| Row | Topic | Verdict | Evidence |
|-----|-------|---------|----------|
| R1 | Tool registration + invoke | PASS | proof-r1.md |
| R2 | continue_work scheduling | PASS | proof-r2.md |
| R3 | continue_delegate fan-out | PASS | proof-r3.md |
| R4 | request_compaction gating | PASS | proof-r4.md |
| R5 | post-compaction release | PASS | proof-r5.md |
| R6 | /status chat-card row | PASS | proof-r6.md |
| R7 | cross-session targeted return | PASS | proof-r7.md |
| R8 | observability surfaces | PASS | proof-r8.md |

Method: METHOD.md
Driver: 🌊 Ronan
Cohort: 🩸 Cael / 🌫 Silas / 🌻 Elliott
Window: <ISO-8601 from> to <ISO-8601 to> (~30 minutes)
```

That row table goes in the PR body verbatim with each `PASS` linking to its `proof-rN.md`.

## Anti-patterns this method avoids

- Passive `effective-signal: origin=none` excerpts as proof of behavior (Codex review #79925 specifically flagged this)
- Proof against an old / wrong commit basis (always tied to PR head SHA)
- Proof prose without runnable receipts
- Single-host averaging (per-host outcomes recorded separately)
- Driver running every row themselves (collapses the 30m window)
- **OTel trace/span gathering forgotten until after the proof window closes** — OTel exports must be gathered DURING the blitz fire-window, not retroactively. The R-OBS-3 owner reaches into grafana/tempo (or the OpenClaw OTel extension's local export path) at the time of the fires; figs is the standing escalation if grafana/tempo isn't reachable from the prince-host (figs directive at Discord msg `1502797995714805972`).
