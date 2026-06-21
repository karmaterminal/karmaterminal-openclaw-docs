# R-OBS-1 — External `/status` Continuation Row + 6-Prince Cross-Walk

**SHIP SHA:** `93ace21341bf13a08f9bf75791f8ac70cf9542a5`
**Row:** R-OBS-1 (observability — external observer visibility of the continuation feature)
**Executed by:** Elliott 🌻 (`elliott-dandelion-cult`) on seat elliott (10.0.0.153)
**Captured:** 2026-06-21T08:42Z

## Claim

The continuation feature (`continue_work`, `continue_delegate`, `request_compaction`) is
deployed and observable fleet-wide on the SHIP SHA `93ace21`, both via local `/status` /
`session_status` surfaces and via external OpenTelemetry continuation spans in Tempo.

## Method

1. **Local seat `openclaw status`** — confirms the running gateway, systemd service state,
   and app version on the elliott seat.
2. **6-prince cross-walk** — over SSH, captured each seat's gateway `package.json` version,
   the gateway working-copy git HEAD, and the systemd service state. (The HTTP
   `:18789/api/status` endpoint requires auth and returned empty unauthenticated, so the
   version cross-walk was taken directly from each seat's gateway source + service state,
   per the fallback path.)
3. **Tempo continuation spans** — queried `https://tempo.dandelion.cult` (self-signed,
   `curl -sk`) for `{name=~"continuation.*"}` and `{span.chain.id != ""}`, exported one
   canonical `continuation.work.fire` trace carrying the full continuation attribute set.

## Results

### SHIP SHA provenance
`93ace21341bf13a08f9bf75791f8ac70cf9542a5` is present in the gateway repo
(subject: `chore(plugin-sdk-surface): regen budgets to merged-surface counts (our
feature's added exports)`) and is a **verified ancestor** of the deployed gateway git HEAD
`c8149791797`. The running build therefore contains the SHIP-SHA continuation feature.

### 6-prince cross-walk (all confirmed)

| Prince  | IP          | Gateway version | Gateway git HEAD | systemd service |
|---------|-------------|-----------------|------------------|-----------------|
| elliott | 10.0.0.153  | 2026.6.9        | c8149791797      | active          |
| silas   | 10.0.0.100  | 2026.6.9        | c8149791797      | active          |
| cael    | 10.0.0.148  | 2026.6.9        | c8149791797      | active          |
| ronan   | 10.0.0.246  | 2026.6.9        | c8149791797      | active          |
| emeric  | 10.0.0.10   | 2026.6.9        | c8149791797      | active          |
| rune    | 10.0.0.250  | 2026.6.9        | c8149791797      | active          |

All six seats run identical gateway version `2026.6.9` at git HEAD `c8149791797` (SHIP SHA
or later) from `/home/figs/flesh_beast_tmp/openclaw/dist/index.js`, service `active`.

### Tempo continuation spans (external observer)

- `{name=~"continuation.*"}` returns `continuation.queue.drain` spans for services
  **elliott-prince, silas-prince, cael-prince, ronan-prince, fifth-prince (host emeric),
  rune-prince** — the continuation scheduler queue is draining on every reachable seat.
- `{span.chain.id != ""}` returns `continuation.work.fire` spans carrying the full
  continuation payload: `chain.id`, `chain.step.remaining`, `delay.ms`.
- **Canonical exported trace** (`continuation_trace.json`):
  `9cfac90972fc7321f69b153a8538e40`
  - span `continuation.work.fire`, service `fifth-prince`, host `emeric`
  - resource `process.command_args` = `node --no-opt .../openclaw/dist/index.js gateway --port 18789`
  - attrs: `chain.id=dc0614a5-84be-401c-bcce-dbef64f145be`,
    `chain.step.remaining=199`, `delay.ms=90000`

These spans are emitted by the continuation feature's own instrumentation, so their presence
in an external store (Tempo) is direct evidence that the feature's tools are registered and
firing on the deployed SHIP SHA — visible to an external observer with no access to the
agent session itself.

## Artifacts

- `EVIDENCE.md` — this summary
- `status_crosswalk.txt` — raw per-seat status/version query output
- `continuation_trace.json` — exported Tempo `continuation.work.fire` trace
- `chat_card_visibility_external_observer.md` — external-observer visibility note

## Verdict

**PASS.** The continuation feature is deployed identically across all 6 prince seats on the
SHIP SHA, and its scheduler activity (`continuation.queue.drain`) plus chained dispatch
(`continuation.work.fire` with `chain.id`/`chain.step.remaining`/`delay.ms`) are externally
observable in Tempo fleet-wide.
