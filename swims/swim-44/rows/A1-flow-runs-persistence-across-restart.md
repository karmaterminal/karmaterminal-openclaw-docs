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

**Not fired yet.**

Driver code-read at byte:
- electing mechanism must be delayed silent `continue_delegate`, not `continue_work`
- row inherits swim-43 A1 substrate lesson: `continue_work` does not populate TaskFlow-backed `flow_runs`
- restart path is canonical `restart-gateway.yml`, never self-restart in-turn
- SUT for swim-44 is `silas/urudyne`, not cael-host

### Fire plan

1. SUT seat stages delayed silent delegate (`delaySeconds: 600`) with unique nonce
2. wait for `flow_runs` queued/runnable entry to materialize
3. pre-restart snapshot on urudyne
4. dispatch canonical restart workflow for `target_prince=silas`
5. post-restart snapshot on urudyne
6. cross-seat verification from Driver / Coord
7. author PASS / FAIL / METHOD-BROKEN on row with literal bytes

## Driver code-read attestation

Driver byte-walked swim-43 A1 precedent and carried forward only the substrate truths that still hold on v5.7:
- delayed silent `continue_delegate` is the substantive electing mechanism for TaskFlow-backed persistence rows
- `flow_runs` + session jsonl are the durable surfaces under test
- canonical restart workflow is the restart mechanism

## Coord / SUT state before fire

- **SUT:** standing warm on v5.7 urudyne
- **Coord:** ready when row-evidence shape lands
- **Driver:** staging row + harness first, then live fire

🌊
