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

User-facing guarantee: a prince can stage continuation work (delegates pending in TaskFlow, session-state in jsonl on disk) + survive a gateway restart (via the canonical `restart-gateway.yml` workflow) + resume with all in-flight state intact. A violation looks like flow_runs entries lost or session jsonl missing/corrupted post-restart, leaving princes with orphaned delegates or split-brain session-state.

## Coverage expectation

- **Unit tests expected:** N/A (durable-substrate test, not unit-test)
- **Integration tests expected:** 1 (this row, fired against deployed v5.5 cael-host with peer-initiated restart)
- **Fleet-scale tests expected:** N/A (single-host substrate persistence sufficient for A1)
- **Evidence artifacts expected:** flow_runs sqlite snapshot pre/post-restart + per-agent jsonl byte-diff + cross-seat byte-pin from non-cael seat verifying same substrate-state

## Measurement protocol

### What we expect — literal substrate bytes for PASS

Three byte-shaped pieces of evidence per fire.

**Electing mechanism for substantive fire-2**

Before taking the pre-restart snapshot, the SUT must stage one delayed delegate so `flow_runs` has a real in-flight entry:

```text
continue_delegate(mode: "silent", delaySeconds: 600, task: "A1 fire-2 marker ...")
→ {"status":"scheduled","mode":"silent","delaySeconds":600,...}
```

Then wait for that TaskFlow entry to materialize in `flow_runs` as `queued`/`runnable`, and only then take the pre-restart snapshot. `continue_work(...)` is not the right electing mechanism for this row; fire-1 established it uses the in-process scheduler rather than TaskFlow-backed `flow_runs` persistence.

Three byte-shaped pieces of evidence per fire:

**1. flow_runs sqlite snapshot pre-restart and post-restart match** (excluding restart-induced bookkeeping fields like `updated_at` if any):

```bash
# pre-restart (byte-walked schema 2026-05-07 cael-host: flow_id PK, status, shape, current_step, created_at)
sqlite3 ~/.openclaw/flows/registry.sqlite "SELECT flow_id, status, shape, current_step, created_at FROM flow_runs WHERE status IN ('runnable','queued') ORDER BY flow_id"

# post-restart (after restart-gateway.yml workflow dispatch from any prince's seat)
sqlite3 ~/.openclaw/flows/registry.sqlite "SELECT flow_id, status, shape, current_step, created_at FROM flow_runs WHERE status IN ('runnable','queued') ORDER BY flow_id"
```

PASS requires byte-identical results (order + count + per-row fields). Schema reference: `flow_id TEXT PRIMARY KEY` + `status TEXT NOT NULL` + `shape TEXT` + `current_step TEXT` + `created_at INTEGER NOT NULL`.

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
ssh silas "sqlite3 ~/.openclaw/flows/registry.sqlite \"SELECT flow_id, status, shape FROM flow_runs WHERE flow_id IN (<sut-flow-ids>)\""
```

PASS requires cross-seat sees same flow_run flow_ids + statuses + shapes.

### How to gather what we expect — path to harness script in row dir

`swims/swim-43-v2026.5.5-full/rows/A1-measure.sh <host> <T0_epoch> <session-id>`

Script behavior:
1. Snapshot pre-restart flow_runs + jsonl hashes on SUT host (cael)
2. Trigger restart via canonical `restart-gateway.yml` workflow dispatch from the target prince's own seat (or `karmafeast`) per the workflow self-target guard in `karmaterminal/openclaw-bootstrap/.github/workflows/RESTART_GATEWAY.md`:
   ```bash
   gh workflow run restart-gateway.yml \
     --repo karmaterminal/openclaw-bootstrap \
     -f target_prince=cael \
     -f reason='swim-43/A1 substrate-fire'
   ```
   Workflow dispatches to self-hosted runner on the prince's box, runs `systemctl --user restart openclaw-gateway`, and produces a durable audit trail in the repo's Actions log.
3. After restart-complete signal + 5s settle (poll `gh run view <run-id>` for completion; the runner's exit confirms `systemctl --user is-active openclaw-gateway` returned active post-restart), snapshot post-restart flow_runs + jsonl hashes on SUT host
4. Run cross-seat verification from silas-host or elliott-host (source-(b) per methodology three-source rule)
5. Diff snapshots, hash compare, cross-seat compare
6. Return verdict via exit code

### What FAIL looks like — literal substrate bytes for negative case

```
FAIL = pre-restart flow_runs snapshot has runnable/queued entries that are MISSING from post-restart snapshot, OR jsonl hash differs without expected restart-induced state-write reason, OR cross-seat byte-pin disagrees with SUT-side state.

INCONCLUSIVE = restart didn't complete cleanly (gateway stuck in start-account phase, OOM during restart, workflow dispatch failed, or workflow run failed). Re-run on stable conditions.

METHOD-BROKEN = sqlite/jsonl access path wrong (file-not-found, permission denied) OR hash command output differs from expected format. Fix harness, re-run.
```

### Result — actual output, byte-pinned

**Fire 1: cael-host, T0=1778175738 (2026-05-07 10:42:18 PDT), session=agent:main:discord:channel:1466192485440164011**

Pre-state byte-walk on cael-host:

```
$ md5sum ~/.openclaw/flows/registry.sqlite
b05f76caeb3c469ff5d1aedd5637925c  /home/figs/.openclaw/flows/registry.sqlite

$ sqlite3 ~/.openclaw/flows/registry.sqlite "SELECT flow_id, status, shape, current_step, created_at FROM flow_runs WHERE status IN ('runnable','queued') ORDER BY flow_id"
(empty — zero runnable+queued entries)

$ sqlite3 ~/.openclaw/flows/registry.sqlite "SELECT status, COUNT(*) FROM flow_runs GROUP BY status"
cancelled|1
failed|9
succeeded|134
```

Dispatch attempt to populate runnable+queued via `continue_work(delaySeconds=600)`:

```
$ continue_work(delaySeconds=600)
{"status": "scheduled", "delaySeconds": 600}     ← source-(a) canonical-evidence per Lesson #8

$ md5sum ~/.openclaw/flows/registry.sqlite (post-dispatch)
b05f76caeb3c469ff5d1aedd5637925c  ← UNCHANGED — no flow_runs entry created
```

Source-walk to disambiguate `continue_*` vs `flow_runs`:

```
$ grep -rn 'flow_runs\|FlowRuns' src/auto-reply/continuation/ --include='*.ts'
(no matches — continuation/* doesn't touch flow_runs)

$ grep -l 'flow_runs' src/tasks/task-flow-registry.store.sqlite.ts
src/tasks/task-flow-registry.store.sqlite.ts   ← TaskFlow registry owns flow_runs
```

Session jsonl storage path byte-walk:

```
$ ls ~/.openclaw/sessions/agent:main:discord:channel:1466192485440164011/*.jsonl
ls: cannot access ... No such file or directory

$ find ~/.openclaw -maxdepth 4 -name '*.jsonl' | grep -iE 'main|discord|agent'
/home/figs/.openclaw/agents/main/sessions/<session-id>.jsonl  ← actual storage
```

### Verdict

**Verdict: METHOD-BROKEN → row-spec substrate-mechanism gap (NOT substrate-broken)**

Three substrate-findings invalidate the row-spec's PASS-criteria assumptions:

1. **`continue_work` does NOT populate `flow_runs`; `continue_delegate` DOES**. Substrate-truth refined per cohort cross-source byte-walk (🌻's msg `1502003477092503552` + 🌿's amendment-suggestion at msg `1502004503539613799` + cael-seat byte-verification of `delegate-store.ts` head-comment): 
   - `continue_work` uses in-process scheduler timer (`registerContinuationTimerHandle` per `scheduler.ts`); volatile across restart by design.
   - `continue_delegate` uses **TaskFlow-backed delegate-store** (`src/auto-reply/continuation/delegate-store.ts:1-7` — *"Continuation delegate store — pure TaskFlow-backed. Every delegate operation goes through TaskFlow (SQLite persistence). Zero volatile Maps. Delegates survive gateway restarts by design."*); imports `createManagedTaskFlow`, `failFlow`, `finishFlow`, etc from `task-flow-runtime-internal`.
   - PR #31 fire-1 Verdict initially generalized this as *"continuation system and TaskFlow registry are separate substrate-mechanisms"* — byte-narrow-true at literal-token layer (continuation source has no `flow_runs` literal; column-name only in sqlite-store impl) but byte-incorrect at substrate-action layer for `continue_delegate`. Refined here per truth-keeping discipline applied to my own prior banked finding.
   - **Operational implication for A1 fire-2**: swap electing mechanism from `continue_work(delaySeconds=600)` to `continue_delegate(mode: silent, delaySeconds=600)` — populates flow_runs runnable+queued entry via TaskFlow-backed delegate-store, then full A1 fire-sequence works substantively against the substrate the row claims to test.
2. **flow_runs schema** uses `flow_id TEXT PRIMARY KEY` + `shape`, `sync_mode`, `owner_key`, `controller_id`, `revision`, `status`, `goal`, `current_step`, etc — NOT the inferred `id, status, kind, created_at` schema the original A1 row spec used. (Already fixed in PR #30.)
3. **Session jsonl storage path** is `~/.openclaw/agents/main/sessions/<session-id>.jsonl` — NOT `~/.openclaw/sessions/<session-id>/*.jsonl` as the row spec assumed.

Restart-workflow dispatch was NOT executed because pre-state byte-walk revealed substrate-mechanism gaps that would produce degenerate-pass at best. Per Truth-floor reach: **fix the row-spec substrate-mechanism alignment + re-fire**, do NOT classify as substrate-FAIL.

## Substrate-finding (substantive output of this fire)

A1 was framed against substrate-mechanism assumptions that don't match deployed v5.5 cael-host. The row's substantive PASS-criterion (*"flow_runs persistence across restart"*) is a real continuation-substrate-question worth testing, **and per the refined finding #1 above, the substrate-mechanism that exercises it is `continue_delegate` (TaskFlow-backed) not `continue_work` (in-process scheduler)**. A1 fire-2 substantive-fix is a small electing-mechanism-swap, not full row-rework:

- Swap `continue_work(delaySeconds=600)` → `continue_delegate(mode: silent, delaySeconds=600)` in row spec + harness
- Session jsonl path corrected to `~/.openclaw/agents/main/sessions/<session-id>.jsonl`
- Wait-for-entry-to-land between dispatch tool-return and pre-restart snapshot (per 🌻's substrate-finding at msg `1502000994932883606`: tool-return is canonical-evidence per Lesson #8 but flow_runs sqlite materialization happens AFTER response-completion asynchronously; need polling loop or wait-window)

Until row-spec-vs-substrate alignment lands, A1 fires can't substantively exercise persistence-across-restart — they fire over an empty runnable+queued substrate that the restart-workflow trivially preserves (empty=empty, byte-identical, but NOT a substantive test of the persistence-across-restart guarantee).

This substrate-finding IS the substantive output of A1 fire-1. Captured for cohort-record + future Driver row-author re-authoring.

**Fire 2 refinement (2026-05-07 ~11:34–11:35 PDT)**: `continue_delegate(mode:"silent", delaySeconds=600)` was fired as the corrected electing mechanism. Cross-seat byte-pin from elliott-seat at ~11:35 showed `flow_runs` status totals moved `succeeded 134 → 136`, confirming `continue_delegate` does land in TaskFlow-backed `flow_runs`. However, by the time of the probe the delayed delegate had already matured to terminal state, so this fire only confirms the substrate mechanism (**delegate → flow_runs**) and does **not** yet test queued/runnable persistence across restart. The substantive persistence test remains a subsequent fire where restart occurs while the entry is still queued/runnable.

### Truth-floor reach (when in doubt)

If snapshot diffs show entries that "look like" they should match but bytes differ, walk raw sqlite + jsonl directly before classifying as FAIL. Possible benign causes: timestamp updates from restart-induced writes (not state-loss), serialization-order differences (semantically equivalent), or transient runnable→queued transitions during restart-startup.

The discriminator: did the runtime LOSE in-flight continuation state, or did the runtime UPDATE bookkeeping fields without losing state? FAIL is the former; both bookkeeping-update + transient-state are not FAIL.

## Status ladder

- [x] **Triaged** — required per A1 case file (live-row + cross-seat evidence class)
- [x] **Authored** — row + harness exist on the swim branch and mainline history
- [x] **METHOD-BROKEN (fire-1)** — row-spec substrate-mechanism gap captured honestly before restart dispatch
- [x] **Fire-2 mechanism confirmed** — `continue_delegate(mode: silent, delaySeconds=600)` lands in `flow_runs`; this banks the electing-mechanism truth but not restart persistence yet
- [ ] **Fire-3 queued-state persistence** — restart during queued/runnable window, then pre/post snapshot + cross-seat cosign
- [ ] **Verified** — substantive persistence verdict landed with byte-pinned pre/post snapshots + cross-seat cosign
- [ ] **Evidence-cleansed** — N/A unless contributing to frozen-branch evidence appendix per Charter Rule 8

## References

- **Case file**: `SWIM/cases/A1.md`
- **Spine issue**: `karmaterminal/openclaw-bootstrap#915`
- **Charter**: `SWIM/FULL-SWIM-CHARTER.md` §3 Family A — Turns
- **Methodology**: `SWIM/SWIM-METHODOLOGY.md` lines 9-19 (fixed roles), lines 46-48 (three-source evidence rule)
- **HEARTBEAT safety** (no self-restart): `~/.openclaw/workspace/AGENTS.md` + `HEARTBEAT.md`

## Notes

This row exercises substrate-truth that the morning's swim-43 disposition discussion did NOT verify — flow_runs + session-jsonl persistence across restart is core Turns infrastructure that v5.5 substrate must demonstrate per A1 case claim.

**Restart canon (per figs at Discord msg `1501992707709468783` 2026-05-07 10:02 PDT)**: princes use the `restart-gateway.yml` workflow in `karmaterminal/openclaw-bootstrap` to trigger gateway restart. Self-target guard (`github.actor == "${target_prince}-dandelion-cult"`) allows a prince to dispatch their own gateway restart from their own session. The earlier *"no SUT self-restart per HEARTBEAT safety, peer-restart-trigger required"* framing was OLD/INCORRECT canon — superseded by the workflow-based pattern that produces a durable Actions audit trail. Cael-seat dispatching with `target_prince=cael` is canon-aligned (self-target, source-(a) Deployer-canon work).

Cross-seat byte-pin requirement (silas/urudyne or elliott/elliott-host verifies same flow_runs state on cael-host via SSH) satisfies the methodology three-source evidence rule (SUT self-report + SSH gateway logs/state + cross-seat verification).
