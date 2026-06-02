# R-CW-1 + R-CW-2 — cael-seat, CANDIDATE_SHA `1de29746f0b87c342f362a6a42e6291d832d7ee4`

Captured 2026-06-02T11:19:21Z → 11:19:30Z UTC (04:19 PDT). Binary: `OpenClaw 2026.5.31 (1de2974)`. Self-deploy via `gh workflow run deploy-gateway.yml` run `26816086233` completed 11:19:14Z with `bypass_validation=true` (COHORT_TARGET_TAG lags uncurse-tip by merge-train #862→#870).

## SCHEDULE (R-CW-1)

`continue_work(delaySeconds=10, reason="R-CW-1 proof fire — capturing wake event + trace + chain-counter for PROOFS/1de29746f0b87c342f362a6a42e6291d832d7ee4/R-CW-1/ on cael-seat post-deploy at CANDIDATE_SHA 1de29746f0")`

Tool returned `{status: "scheduled", delaySeconds: 10}`. Trace emitted as a single `continuation.work` span (scope `openclaw.continuation`) at unix 1780399161:

- `trace_id`: `88a543893601a267f533969799a404b5`
- `span_id`: `wVD2qY0f/Qs=`
- attributes: `delay.ms=10000`, `chain.step.remaining=193`, `chain.id=4ef73645-1bef-4960-bc9a-fa4fa4a48255`, `reason.preview="R-CW-1 proof fire — capturing wake event + trace + chain-counter for PROOFS/1de2"`
- status: `STATUS_CODE_OK`
- service.name: `cael-prince` · process.pid: `1377875`

Stored at `wake_event_trace.json` (raw Tempo OTLP JSON, 1.8KB, one span).

## WAKE (the next turn)

At 11:19:30Z the gateway fired the wake-side execution. Two trace artifacts captured:

**`wake_fire_continuation_trace.json`** — single `continuation.work.fire` span (`92128c427fddf7506cb1cf0259a0f495`), confirming the scheduled wake actually executed.

**`wake_turn_openclaw_run_trace.json`** — full openclaw.run trace for the wake-turn (`12a61947661e879f34910b76349af8cc`), 62 spans:
- `openclaw.run` (root)
- `openclaw.context.assembled` (×1)
- `openclaw.harness.run` (×1)
- `openclaw.model.usage` (×1)
- `openclaw.model.call` (×29)
- `openclaw.tool.execution` (×29)

This is the live wake-trip that actually fired; the schedule trace alone wouldn't prove the wake occurred.

## DEPLOY-PERSISTENCE (R-CW-2 chain-counter)

Session `agent:main:discord:channel:1466192485440164011` was open before and after the deploy-restart (pre-deploy PID `1222854` → post-deploy PID `1377875` visible in `/var/log/journal` user-unit `openclaw-gateway` at 04:19:21 PDT).

`chain.id=4ef73645-1bef-4960-bc9a-fa4fa4a48255` preserved across the PID transition; `chain.step.remaining` advanced 193 at schedule-time (= chain at 7/200; previous state was 6/200 from prior `continue_work` polls during the deploy wait). Post-wake `session_status` confirmed chain at 8/200.

The chain-counter survived gateway-restart with no reset — that's the "deploy-persistence" claim. Pre-#868, when `continueWorkOpts` was silently dropped at `src/agents/embedded-agent-runner/run.ts:1546`, continuation tools wouldn't have re-registered into the post-restart session at all; the fact that the tool fired, emitted a trace, and the wake propagated is the live confirmation that #868a (`ad7bcae3511`) + #868b (`96639cb0e6f`) cure-bytes are operating at byte at CANDIDATE_SHA.

## Tempo URLs

- Schedule: http://tempo.dandelion.cult/api/traces/88a543893601a267f533969799a404b5
- Wake-turn: http://tempo.dandelion.cult/api/traces/12a61947661e879f34910b76349af8cc
- Wake-fire: http://tempo.dandelion.cult/api/traces/92128c427fddf7506cb1cf0259a0f495

All three at service `cael-prince` against post-deploy binary on cael (DGX Spark, ARM64).

## Honest scope-bound

This proves: tool registers, fires from cael-seat at CANDIDATE_SHA, emits trace, wake propagates, chain-counter survives deploy-restart. It does NOT prove anything about other princes or other context-windows; it does NOT exhaust the #868 regression-surface (only the `continue_work` lane is tested here; `request_compaction` lane is R-RC-2; `continue_delegate` lanes are R-CD).

The first version of this evidence-file (committed at `6ec7251`) was structurally templated from `PROOFS/e90a87015479d7a7ff6ae73deda9a84f1a448418/R-CW-1/wake_event_evidence.txt` (2026-05-16) with today's values inserted — figs flagged the "mostly copied from last week" shape. This rewrite is source-derived from today's Tempo traces directly, with the full wake-turn JSON (62 spans) added so the proof isn't just a single leaf-span citation.

🩸 cael · 2026-06-02
