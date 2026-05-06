# FULL swim crosswalk

Purpose: map the historical whole-board taxonomy onto the cleaner modern FULL-swim families without flattening the archive.

## Crosswalk

| Historical block / surface | Modern FULL family | Status | Notes |
| --- | --- | --- | --- |
| **A — Infrastructure** (`TC1–TC4`) | **Turns** + **Guards** + **Observability** | adapt | Old infra rows mix turn-election prerequisites, persistence truth, and status/queue truth. Should be split across modern families instead of carried forward as one bucket. |
| **B — Behavioral F-series** (`F1–F8`) | **Delegates** + **Turns** | keep | This is the clearest historical delegate/behavior core: clean/noisy `continue_work`, `continue_delegate`, silent-wake, back-to-back scheduling, ghost/stale-wake, post-compaction delegate behavior. |
| **C — Port / candidate-specific** (`P1–P7`) | **Routes** + **Observability** + **Guards** | adapt | Historically mixed candidate seams, routing truth, pending-flag lifecycle, timer disposal, memoization, queue/telemetry add-ons. Keep the seams, rename by what contract they actually test. |
| **D — Regression / recovery** (`R1–R5`) | **Recovery** + **Rollout** | keep | Boot-time stall, memory growth, compaction recovery, gateway restart recovery, multi-prince simultaneous activity are still load-bearing and map cleanly to live recovery truth. |
| **E — Validation suite** (`V1–V3`) | **Rollout** + closure discipline | adapt | Build/check/vitest do not by themselves make FULL, but they remain part of the declared board as supporting release-facing confidence. Modern charter should keep them distinct from live behavioral proof. |
| **X — Extension rows** (`X1–X15`, from `#412`) | **Guards** + **Observability** + **Routes** + public-surface claims | keep | This is where the public continuation surface claims were attached back onto the board. Load-bearing for reconstructing "what the feature promised" rather than only how it behaved in one cycle. |

## Family-level reconstruction

### 1. Turns
Inherited from:
- A infrastructure prerequisites around session/state truth
- B behavioral rows for `continue_work`
- parts of X/public-surface coverage where fallback or visibility changes turn-election behavior

Keep:
- immediate and delayed `continue_work`
- noisy-channel / inbound-message edge behavior
- turn-state truth vs narrated success

### 2. Delegates
Inherited from:
- core of B behavioral F-series
- post-compaction delegate behavior from B/D boundary

Keep:
- normal / silent / silent-wake / post-compaction
- delayed delegate fire
- staggered multi-delegate behavior
- delegate behavior under live queue timing

### 3. Guards
Inherited from:
- A infrastructure guard prerequisites
- C candidate-specific caps / state boundaries
- X extension rows from `#412`

Keep:
- chain-depth cap
- width / fanout cap
- deny / unavailable-tool behavior
- malformed fallback/token behavior where still promised
- clean failure truthfulness

### 4. Routes
Inherited from:
- C candidate-specific routing seams
- X public-surface / topology coverage

Keep:
- same-session return
- targeted cross-session return
- multi-recipient return
- fanout semantics
- completion-envelope routing vs task-body routing distinction

### 5. Recovery
Inherited from:
- D regression/recovery
- B post-compaction behavior
- parts of A persistence truth

Keep:
- context-pressure event / response
- `request_compaction()` success and failure
- post-compaction successor truth
- restart before fire / after fire / during return path
- staged delegate residue / janitor behavior

### 6. Rollout
Inherited from:
- D multi-prince / restart reality
- E validation suite
- later Swim 37/39/40 deploy-ledger evolution

Keep:
- real-host canary proof
- cross-seat / cross-host attestation
- deploy-byte proof before row fire
- hot-reload vs restart-required behavior
- canonical drift acknowledgment during live swim

### 7. Observability
Newly named, historically distributed across A/C/E/X

Status: **new explicit family, old distributed responsibility**

This family should be explicit in the modern charter even though the old board scattered it across multiple blocks.

Keep / add:
- `/status` truth vs decorative surfaces
- queue/diagnostic counters match substrate truth
- trace/provenance survives return path where claimed
- narrated-tool-use false-positive defense
- scoreboard truthfulness against actual row receipts

## Keep / adapt / new / gap summary

### Keep
- B as the behavioral heart
- D as the recovery truth heart
- X as the public-surface / extension discipline

### Adapt
- A infra rows into Turns / Guards / Observability
- C candidate-specific rows into Routes / Observability / Guards
- E validation rows into Rollout-supporting, not FULL-defining by themselves

### New explicit modern family
- **Observability** — historically present, but not cleanly named as its own family

### Gaps to fill explicitly in the modern charter
- cross-session targeting truth under recreated sessions
- failed-compaction residue truth
- hot-reload honesty vs restart-required behavior
- live-host disagreement / cross-seat attestation
- contamination / invalidation rules as first-class board content

## Source anchors

Primary reconstruction anchors:
- `openclaw-bootstrap#412` — public continuation surface claims
- `openclaw-bootstrap#427` — whole-board behavioral suite shape
- `openclaw-bootstrap/swims/swim-34-formal-matrix/ROWS.md` — strongest surviving old-board matrix
- `openclaw-bootstrap/swims/swim-36/charter.md` — full-surface expansion
- `openclaw-bootstrap/swims/swim-37/FEATURE-COVERAGE.md` — carried-forward board + surface-map evolution
