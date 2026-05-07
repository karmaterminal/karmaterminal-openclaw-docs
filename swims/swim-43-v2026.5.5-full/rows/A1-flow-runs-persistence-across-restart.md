# swim-43/A1 — TaskFlow flow_runs + per-agent sessions persistence across restart

**Swim:** swim-43-v2026.5.5-full
**Block:** A — Family Turns
**Row ID:** A1
**Tracker anchor:** karmaterminal/openclaw-bootstrap#915 (parent #907)
**Case file:** `SWIM/cases/A1.md`
**SUT SHA (target):** `24b76bf` on `karmaterminal/openclaw:frond/v2026.5.5/canonical` (deployed cael-host, byte-confirmed `openclaw --version` returns `OpenClaw 2026.5.5 (24b76bf)`)
**SUT seat:** `agent:main:discord:channel:1466192485440164011` (cael-seat)
**Test file candidates:** N/A (substrate-walk row, lifecycle-truth requires live runtime exercise)
**Timing window:** integration
**Evidence class:** live-row + cross-seat (per case file)
**Gather:** `swims/swim-43-v2026.5.5-full/rows/A1-measure.sh <host> <T0_epoch> <session-id>`

## Surface under test

Per `SWIM/cases/A1.md`: TaskFlow `flow_runs` table and per-agent session jsonl files survive gateway restart with no loss of in-flight continuation state.

User-facing guarantee: a prince can stage continuation work (delegates pending in TaskFlow, session-state in jsonl on disk) + survive a gateway restart (peer-restart per HEARTBEAT safety) + resume with all in-flight state intact. A violation looks like flow_runs entries lost or session jsonl missing/corrupted post-restart, leaving princes with orphaned delegates or split-brain session-state.

## Coverage expectation

- **Unit tests expected:** N/A (durable-substrate test, not unit-test)
- **Integration tests expected:** 1 (this row, fired against deployed v5.5 cael-host with peer-initiated restart)
- **Fleet-scale tests expected:** N/A (single-host substrate persistence sufficient for A1)
- **Evidence artifacts expected:** flow_runs sqlite snapshot pre/post-restart + per-agent jsonl byte-diff + cross-seat byte-pin from non-cael seat verifying same substrate-state

## Measurement protocol

### What we expect — literal substrate bytes for PASS

Three byte-shaped pieces of evidence per fire:

**1. flow_runs sqlite snapshot pre-restart and post-restart match** (excluding restart-induced fields like restart_count if any):

```bash
# pre-restart
sqlite3 ~/.openclaw/flows/registry.sqlite "SELECT id, status, kind, created_at FROM flow_runs WHERE status IN ('runnable','queued') ORDER BY id"

# post-restart (after `systemctl --user restart openclaw-gateway` from peer-seat)
sqlite3 ~/.openclaw/flows/registry.sqlite "SELECT id, status, kind, created_at FROM flow_runs WHERE status IN ('runnable','queued') ORDER BY id"
```

PASS requires byte-identical results (order + count + per-row fields).

**2. Per-agent session jsonl byte-diff is empty** for the SUT session-id:

```bash
# pre-restart hash
md5sum ~/.openclaw/sessions/agent:main:discord:channel:1466192485440164011/*.jsonl

# post-restart hash (after restart + 5s settle)
md5sum ~/.openclaw/sessions/agent:main:discord:channel:1466192485440164011/*.jsonl
```

PASS requires hash-identical for all jsonl files in the SUT session dir.

**3. Cross-seat byte-pin from non-cael seat** (silas/urudyne or elliott/elliott-host) verifying same flow_runs state via SSH walk:

```bash
ssh silas "sqlite3 ~/.openclaw/flows/registry.sqlite \"SELECT id, status, kind FROM flow_runs WHERE id IN (<sut-flow-ids>)\""
```

PASS requires cross-seat sees same flow_run IDs + statuses + kinds.

### How to gather what we expect — path to harness script in row dir

`swims/swim-43-v2026.5.5-full/rows/A1-measure.sh <host> <T0_epoch> <session-id>`

Script behavior:
1. Snapshot pre-restart flow_runs + jsonl hashes on SUT host (cael)
2. Wait for peer-restart trigger (cael NOT self-restarting per HEARTBEAT safety; elliott or silas runs `ssh cael 'systemctl --user restart openclaw-gateway'`)
3. After restart-complete signal + 5s settle, snapshot post-restart flow_runs + jsonl hashes on SUT host
4. Run cross-seat verification from silas-host or elliott-host
5. Diff snapshots, hash compare, cross-seat compare
6. Return verdict via exit code

### What FAIL looks like — literal substrate bytes for negative case

```
FAIL = pre-restart flow_runs snapshot has runnable/queued entries that are MISSING from post-restart snapshot, OR jsonl hash differs without expected restart-induced state-write reason, OR cross-seat byte-pin disagrees with SUT-side state.

INCONCLUSIVE = restart didn't complete cleanly (gateway stuck in start-account phase, OOM during restart, peer-restart-trigger failed). Re-run on stable conditions.

METHOD-BROKEN = sqlite/jsonl access path wrong (file-not-found, permission denied) OR hash command output differs from expected format. Fix harness, re-run.
```

### Result — actual output, byte-pinned

To be filled at fire-time. One block per fire (pre-restart snapshot + post-restart snapshot + cross-seat verification).

### Verdict

To be filled at fire-time per script exit code:
- exit 0 → PASS (all three evidence pieces match)
- exit 1 → FAIL (substrate state lost across restart)
- exit 2 → INCONCLUSIVE (restart didn't complete cleanly)
- exit 3 → METHOD-BROKEN (fix harness + re-run)

### Truth-floor reach (when in doubt)

If snapshot diffs show entries that "look like" they should match but bytes differ, walk raw sqlite + jsonl directly before classifying as FAIL. Possible benign causes: timestamp updates from restart-induced writes (not state-loss), serialization-order differences (semantically equivalent), or transient runnable→queued transitions during restart-startup.

The discriminator: did the runtime LOSE in-flight continuation state, or did the runtime UPDATE bookkeeping fields without losing state? FAIL is the former; both bookkeeping-update + transient-state are not FAIL.

## Status ladder

- [x] **Triaged** — required per A1 case file (live-row + cross-seat evidence class)
- [x] **Authored** — script + row file committed to branch `ronan/20260507/swim-43-v5-5-full-declaration`
- [ ] **PASS-candidate** / **PARTIAL** / **OPEN-GAP** / **METHOD-BROKEN** (pick one when fired)
- [ ] **Comprehension-gated** — driver code-read of TaskFlow flow_runs + per-agent jsonl substrate signed off
- [ ] **Verified** — Verdict landed on byte-pinned Result block; cross-seat cosigned
- [ ] **Evidence-cleansed** — N/A unless contributing to frozen-branch evidence appendix per Charter Rule 8

## References

- **Case file**: `SWIM/cases/A1.md`
- **Spine issue**: `karmaterminal/openclaw-bootstrap#915`
- **Charter**: `SWIM/FULL-SWIM-CHARTER.md` §3 Family A — Turns
- **Methodology**: `SWIM/SWIM-METHODOLOGY.md` lines 9-19 (fixed roles), lines 46-48 (three-source evidence rule)
- **HEARTBEAT safety** (no self-restart): `~/.openclaw/workspace/AGENTS.md` + `HEARTBEAT.md`

## Notes

This row exercises substrate-truth that the morning's swim-43 disposition discussion did NOT verify — flow_runs + session-jsonl persistence across restart is core Turns infrastructure that v5.5 substrate must demonstrate per A1 case claim.

Per HEARTBEAT.md safety canon: SUT (cael-host) does NOT self-restart its own gateway. Peer-restart by elliott-seat (Monitor canonical role) or silas-seat per cohort-safety. SUT just snapshots pre/post.

Cross-seat byte-pin requirement (silas/urudyne or elliott/elliott-host verifies same flow_runs state) satisfies the methodology three-source evidence rule (SUT self-report + SSH gateway logs/state + cross-seat verification).
