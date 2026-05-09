# swim-44/A1 — TaskFlow flow_runs + per-agent sessions persistence across restart

**Swim:** swim-44
**Block:** A — Family Turns
**Row ID:** A1
**Tracker anchor:** `karmaterminal/openclaw-bootstrap#956` (parent `#915`)
**Case file:** `SWIM/cases/A1.md`
**SUT SHA (target):** `4c2a69b3d5d0414e57098393067d66f98d66ee0c` on `karmaterminal/openclaw:frond/v2026.5.7/canonical`
**SUT seat:** `agent:main:discord:channel:1466192485440164011` (silas / urudyne)
**Test file candidates:** N/A (substrate-walk row; live runtime exercise)
**Timing window:** integration
**Evidence class:** live-row + cross-seat
**Gather:** `swims/swim-44/rows/A1-measure.sh <host> <T0_epoch> <session-id>`

## Surface under test

Per `SWIM/cases/A1.md`: TaskFlow `flow_runs` table and per-agent session jsonl files survive gateway restart with no loss of in-flight continuation state.

User-facing guarantee: a prince can stage continuation work (delegates pending in TaskFlow, session-state in jsonl on disk) + survive a canonical restart + resume with all in-flight state intact. A violation looks like `flow_runs` entries lost or session jsonl missing/corrupted post-restart, leaving orphaned delegates or split-brain session-state.

## Coverage expectation

- **Unit tests expected:** N/A
- **Integration tests expected:** 1 (this row, fired against deployed v5.7 urudyne with peer/self-canonical restart workflow)
- **Fleet-scale tests expected:** N/A
- **Evidence artifacts expected:** `flow_runs` sqlite snapshot pre/post-restart + per-agent jsonl byte-diff + cross-seat byte-pin from non-SUT seat verifying same substrate-state

## Measurement protocol

### What we expect — literal substrate bytes for PASS

Before taking the pre-restart snapshot, the SUT stages one delayed silent delegate so `flow_runs` has a real in-flight entry:

```text
continue_delegate(mode: "silent", delaySeconds: 600, task: "A1 fire marker ...")
→ {"status":"scheduled","mode":"silent","delaySeconds":600,...}
```

Then wait for that TaskFlow entry to materialize in `flow_runs` as `queued`/`runnable`, and only then take the pre-restart snapshot. `continue_work(...)` is not the right electing mechanism for this row; swim-43 A1 established it uses the in-process scheduler rather than TaskFlow-backed `flow_runs` persistence.

PASS requires three byte-shaped evidence pieces:

**1. `flow_runs` sqlite snapshot pre-restart and post-restart match** (excluding bookkeeping-only fields not selected):

```bash
sqlite3 ~/.openclaw/flows/registry.sqlite "SELECT flow_id, status, shape, current_step, created_at FROM flow_runs WHERE status IN ('runnable','queued') ORDER BY flow_id"
```

PASS requires byte-identical results pre/post restart.

**2. Per-agent session jsonl hash is preserved** for the SUT session-id:

```bash
md5sum ~/.openclaw/agents/main/sessions/<session-id>.jsonl
```

PASS requires hash-identical or an explained session-write that does not correspond to state loss.

**3. Cross-seat byte-pin from non-SUT seat** verifying same `flow_runs` state via SSH walk:

```bash
ssh silas "sqlite3 ~/.openclaw/flows/registry.sqlite \"SELECT flow_id, status, shape FROM flow_runs WHERE flow_id IN (<sut-flow-ids>)\""
```

or equivalent cross-seat verification from ronan / cael / elliott against the SUT host.

### How to gather

`swims/swim-44/rows/A1-measure.sh <host> <T0_epoch> <session-id>`

Harness shape carried from swim-43 precedent:
1. snapshot pre-restart `flow_runs` + jsonl hashes on SUT host
2. trigger canonical `restart-gateway.yml` workflow for target prince
3. wait for run completion + gateway active
4. snapshot post-restart `flow_runs` + jsonl hash
5. attach cross-seat verification
6. diff snapshots, return verdict

### What FAIL looks like — literal substrate bytes for negative case

```text
FAIL = pre-restart flow_runs snapshot has runnable/queued entries that are missing from post-restart snapshot, OR jsonl hash differs due to state-loss / corruption, OR cross-seat byte-pin disagrees with SUT-side state.

INCONCLUSIVE = restart did not complete cleanly (workflow failure, gateway not active, host instability).

METHOD-BROKEN = wrong access path / no staged queued entry / harness cannot read substrate.
```

## Result

### Three-layer separation per 🌊 Driver-framing-canon

🌊 at msg `1502456018` sharpened the row-evidence framing into three explicit layers:

#### Layer 1 — Intended test

**Queued-flow survival across restart.** Per `SWIM/cases/A1.md` + row-spec evidence-piece-1 (narrow-SQL `WHERE status IN ('runnable','queued') ORDER BY flow_id` byte-identical pre/post restart). This is what A1 row-spec PASS-criteria substantively tests.

#### Layer 2 — Why intended test was NOT executed at byte

**Natural dispatch happened before restart window.** The staged delegate's `delaySeconds:600` window elapsed at T0+600.003s = 16:28:27 PDT, dispatching the delegate naturally before any `restart-gateway.yml` workflow fired. By the time Driver dispatched restart workflow `25584752622` at 16:35:25 PDT (T0+1006s, ~7min after natural-dispatch), the queued-state under test no longer existed. The narrow-SQL slice went from 1 queued row pre-natural-dispatch (SHA256 `f3849865...`) to 0 queued rows post-natural-dispatch (empty SHA256 `e3b0c44...`).

#### Layer 3 — What still passed across the later restart (chronology, not rescue)

These post-restart facts hold but are NOT row-spec PASS-criteria-substrate:
- ✅ Gateway live: `OpenClaw 2026.5.7 (4c2a69b)` post-restart (per cael-seat SSH→silas at 16:42:07 PDT + Silas's broker PONG at `1502454540` 16:37 PDT confirming boot complete + Discord WS reconnected)
- ✅ Session jsonl path persistence: `4dcdf9bd-c88c-4d8b-9455-d36944dd5379.jsonl` still present post-restart
- ✅ flow_runs row for `f6b4d08d` STILL PRESENT post-restart, status=`succeeded` UNCHANGED with `releasedAt: 1778282907138` timestamp PRESERVED (set at 16:28:27 PDT pre-restart, preserved across restart)

Per Driver verdict at `1502454474` + `1502454478` + `1502454918` + `1502454980` + `1502455130` + `1502455882` + `1502455957` + `1502456018`: **chronology, not rescue** of the original row-spec question. *That separation is the whole row.*

### Verdict: METHOD-BROKEN-by-timing

**Fire-attempt date**: 2026-05-08 (PDT)
**Nonce**: `A1-URUDYNE-20260508T1609PDT`
**Driver call**: 🌊 ronan-seat (`1502447349` + `1502447577`)
**SUT**: 🌫 silas-seat (urudyne)
**Coord**: 🩸 cael-seat (cross-seat byte-pin from cael-host SSH→silas/urudyne)

### Timeline

| Time (PDT) | Event | Source |
|---|---|---|
| 16:18:39 | T0: SUT staged `continue_delegate(mode:"silent", delaySeconds:600, task:"A1 fire marker A1-URUDYNE-20260508T1609PDT")` | 🌫 msg `1502450036` |
| 16:18:39 → 16:19:39 | `flow_runs` queued/runnable materialization confirmed (5 polls, all consistent) | 🌫 msg `1502450036/037` |
| 16:19:39 | T0_pre_SUT: SUT pre-restart snapshot captured | 🌫 msg `1502450037` |
| 16:26:22 | T0_pre_Coord: Cross-seat byte-pin from cael-seat SSH→silas matches SUT (narrow-SQL byte-identical) | 🩸 msg `1502451716` |
| 16:28:27 | T0+600.003s: **Delegate dispatched naturally** per `[continuation:delegate-spawned]` system-event; `state_json.releasedAt: 1778282907138` populated | 🌫 msg `1502452496` + 🩸 msg `1502455417` |
| 16:28:27 → 16:35:25 | Restart-fire-window CLOSED before `restart-gateway.yml` workflow dispatched | byte-walked from 🩸 |
| 16:35:25 | Driver fired `restart-gateway.yml` run `25584752622` for `target_prince=silas` (~7min AFTER natural-dispatch) | 🌊 msg `1502455517` + `gh run view 25584752622` |
| 16:37:12 | Restart workflow completed: success (1m47s) | `gh run view 25584752622` |
| 16:42:07 | Post-restart cross-seat byte-pin from cael-seat SSH→silas | 🩸 msg `1502455851` |

### Pre-restart byte-evidence (durable, captured + saved)

**Source**: SUT-seat snapshot at T0_pre_SUT = 1778282379 (16:19:39 PDT), saved to `/tmp/A1-URUDYNE-20260508T1609PDT/` on urudyne.

- `flow_runs` pre-restart sha256: `f3849865a539dd84bbed69a348be357126644798a90f631e0f30078b23cffc96` (full-table SHA)
- Session-jsonl pre-restart MD5: `b542b9b6abf73a52a18674548bd884f6`
- Session-jsonl pre-restart SHA256: `0b9a5695c52f95ebf20b983c1be850f304df148da2a36f5e735d76585f798711`
- Session-id: `4dcdf9bd-c88c-4d8b-9455-d36944dd5379`
- Session-jsonl size: 7,861,756 bytes

**Cross-seat byte-pin (Coord 🩸 cael-host SSH→silas at T0_pre_Coord = 1778282782, narrow-SQL row-spec PASS-criteria)**:

- Narrow-SQL output: `f6b4d08d-1724-4507-8bff-2fd6853212f8|queued||Queued for continuation dispatch|1778282307135`
- Narrow-SQL SHA256: `f3849865a539dd84bbed69a348be357126644798a90f631e0f30078b23cffc96` (byte-identical to SUT-seat pre-restart-snapshot)

✅ **Cross-seat byte-pin substantively-decisive at row-spec narrow-SQL** — same SHA across 7-minute window from non-SUT seat = pre-restart cross-seat verification PASS at byte (per row-spec evidence-piece-3).

### Why METHOD-BROKEN-by-timing

Per A1-measure.sh canonical exit-codes:

> METHOD-BROKEN = wrong access path / no staged queued entry / harness cannot read substrate.

The conditions for METHOD-BROKEN-by-timing were met:

1. **Staged queued entry was DISPATCHED naturally before restart-fire-window completed**: Delegate dispatched at 16:28:27 PDT (T0+600.003s), exiting `flow_runs` queued-state into in-process scheduler. `state_json.releasedAt: 1778282907138` populated. Status changed `queued` → `succeeded|Released to continuation scheduler`.
2. **Canonical `restart-gateway.yml` workflow was NOT dispatched in T0..T0+600s window**: Driver-bandwidth was split across parallel discoverability lane during the tight 600s window; restart workflow was dispatched at 16:35:25 PDT (T0+1006s = ~7 minutes AFTER natural-dispatch).
3. **Restart-survival-of-queued-state was NOT tested at byte**: By the time `restart-gateway.yml` fired, the queued-state under test no longer existed.

### Substantive evidence captured anyway (sub-canonical)

Restart workflow `25584752622` was dispatched at 16:35:25Z and succeeded at 16:37:12Z (1m47s). Post-restart cross-seat byte-pin captured from cael-seat SSH→silas:

- ✅ Gateway live: `OpenClaw 2026.5.7 (4c2a69b)` post-restart
- ✅ Session jsonl path still present (`4dcdf9bd-c88c-4d8b-9455-d36944dd5379.jsonl`); MD5 evolved as expected (handshake + active-session writes)
- ✅ flow_runs row for `f6b4d08d` STILL PRESENT post-restart, status=succeeded with state_json including pre-restart `releasedAt: 1778282907138`. **Row survived restart unchanged.**
- 🚨 Narrow-SQL (`WHERE status IN ('runnable','queued')`) byte-DIVERGES pre/post: pre had 1 queued row (SHA256 `f3849865...`), post has 0 queued rows (empty-file SHA256 `e3b0c44...`). Per A1 row-spec PASS-criteria narrow-SQL → divergence. BUT divergence is from natural-dispatch pre-restart, NOT from restart-state-loss.

This sub-canonical evidence substantively-tests:
- **Succeeded-row-with-pre-restart-`releasedAt`-timestamp survives restart** ✓
- **jsonl-path-survival across restart** ✓
- **Gateway-version-parity post-restart** ✓ (still `4c2a69b`)

These pass at byte but are NOT the row-spec PASS-criteria-substrate. Distinct test-substrate, banked for future row-shapes.

## Substantive cohort-discipline canon-pins banked from this fire

Three substantive sub-pins under swim-execution-discipline canon-pin family, all cohort-cosigned 🌊 + 🌫 + 🩸 today:

### Canon-pin 1 — Tight fire window Driver-discipline

🌊 sharpened at `1502455725` (substantively-load-bearing canonical-shape):

> **Tight fire window = Driver on the primary lane only.**

Source: 🌫 first-named at `1502452497` (*"concurrent-bandwidth-on-Driver-seat-during-tight-time-window can-METHOD-BROKEN-the-row-fire"*) → 🌊 own-shape at `1502454474` (*"during a tight fire window, my bandwidth has to stay solely on the primary lane. I split attention across the parallel discoverability thread and that materially contributed to missing the 600s window. That one is on me."*) → 🩸 Coord-input at `1502454092` → 🌊 sharpened-canonical at `1502455725` + `1502455130` (*"METHOD-BROKEN-by-bandwidth"* sub-naming).

### Canon-pin 2 — Channel-time-skew outbound-timing chronology-confusion

🌊 substantively-banked at `1502456018`:

> **Channel-time-skew on Driver-seat outbound-timing can produce stale-chronology in fire-window directives, materially interfering with the row-fire lane. Belongs in execution-discipline lesson bucket alongside the single-lane Driver finding.**

Source: 🩸 surfaced at `1502453489` (substrate-divergence-finding: 6 Ronan-seat fire-direction-asks in 13 minutes substrate-stale on already-completed-and-already-posted-substrate; outbound-timing lag-pattern) → 🌊 own-shape at `1502455276` (*"yes — confirmed. That anomaly was real on my seat. I was operating on stale inbound state for a stretch, and it materially interfered with the A1 fire lane"*) → 🌊 banking-canon at `1502456018`.

### Canon-pin 3 — Narrow-SQL cross-seat byte-pin

🌊 cosigned-canonical at `1502454615`:

> **Use the row-spec narrow SQL slice (e.g., `SELECT ... WHERE status IN ('runnable','queued') ORDER BY flow_id`) for cross-seat byte-pin. Do not use full-table SHA as the decisive comparator. Full-table drift from unrelated completed/failed rows contaminates evidence story.**

Source: 🩸 substrate-finding at `1502451716` (cael-seat caught full-table-SHA divergence + walked-back to narrow-SQL byte-identical match across SUT-seat + Coord-seat 7-minute-window) → 🌊 canonical-cosign at `1502454615`. Sub-pin: row-spec PASS-criteria defines the test-substrate; cross-seat-byte-pin should mirror that exact substrate-shape, not a broader full-table-shape.

All three canon-pins worth promoting to `SWIM/lessons/` post-merge for cross-swim durability.

## Re-fire plan (round 2)

Per cohort-cosigned path (c)+(b) at 🌊 `1502454474`:

- New nonce: `A1-URUDYNE-{YYYYMMDDTHHMMPDT}-r2`
- **Longer delaySeconds: 1800-3600s** (= 30-60min window) for bandwidth-flexible restart-fire-coordination
- OR tighter Driver-discipline: `restart-gateway.yml` workflow fired IMMEDIATELY upon SUT queued-proof landing (within minutes, not 5-10+ min)
- Driver-bandwidth solely on primary-lane during tight-window per cohort-discipline canon-banked

## Driver-Code-Read attestation (carry-forward from PR #54)

Driver byte-walked swim-43 A1 precedent and carried forward only the substrate truths that still hold on v5.7:
- delayed silent `continue_delegate` is the substantive electing mechanism for TaskFlow-backed persistence rows
- `flow_runs` + session jsonl are the durable surfaces under test
- canonical restart workflow is the restart mechanism

## SUT attestation

SUT-attestation 🌫 (silas/urudyne):
- Pre-restart snapshots captured at byte (`1502450036/037/039`)
- METHOD-BROKEN-by-timing verdict declared at byte (`1502452496/497`)
- Three path-options offered for cohort-decide

## Coord attestation 🩸

- Cross-seat byte-pin captured pre-restart matching SUT narrow-SQL byte-identical (`1502451716`)
- Substrate-shift discovery: delegate dispatched-naturally pre-restart (`1502452477`)
- Coord-input combined-path (c)+(b) recommendation (`1502454092`)
- Post-restart cross-seat verification with detailed byte-walk (`1502455851`)
- Row-evidence-PR authoring per Driver-handoff (`1502454474`)

## Driver verdict-cosign 🌊

`1502454474`: METHOD-BROKEN-by-timing + path (c)+(b) + own-shape lesson on Driver-bandwidth-discipline.

## Notes

- This row is METHOD-BROKEN-by-timing per A1-measure.sh canonical exit-code=3 framing.
- Re-fire required for row-spec PASS-criteria-substrate test to execute properly.
- Substantive cohort-discipline canon-pin banked from this fire informs future swim-row-fire-discipline.
- Swim-execution-discipline sub-pin worth filing to bootstrap-issue for cross-swim durability.

🩸 Coord-authored row-evidence + 🌊 Driver-Code-Read substrate (carry from PR #54) + 🌫 SUT-attestation cited inline + 🌊 Driver-verdict-cosign at `1502454474`.
