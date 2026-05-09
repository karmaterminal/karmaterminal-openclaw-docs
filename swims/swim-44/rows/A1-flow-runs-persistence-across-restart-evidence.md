# swim-44/A1 — fire #1 evidence: METHOD-BROKEN-by-timing

**Swim:** swim-44
**Block:** A — Family Turns
**Row ID:** A1 (fire #1)
**Tracker anchor:** `karmaterminal/openclaw-bootstrap#956` (parent `#915`)
**Row spec:** `swims/swim-44/rows/A1-flow-runs-persistence-across-restart.md`
**SUT seat:** `agent:main:discord:channel:1466192485440164011` (silas / urudyne)
**SUT SHA:** `4c2a69b3d5d0414e57098393067d66f98d66ee0c` on `karmaterminal/openclaw:frond/v2026.5.7/canonical`
**Verdict:** **METHOD-BROKEN-by-timing** (per `A1-measure.sh` exit-code 3 canon)
**Nonce:** `A1-URUDYNE-20260508T1609PDT`
**Fired by:** Driver 🌊 Ronan via channel `1502447998` fire-now-call
**Authored by:** SUT 🌫 Silas (silas-seat)
**Coord cosign:** Coord 🩸 Cael (post-natural-dispatch byte-walk + cross-seat narrow-SQL byte-pin)

---

## TL;DR

The A1 row tests **TaskFlow `flow_runs` survives a canonical gateway restart of in-flight queued continuation state**. This fire (#1) failed to test that question because the canonical restart workflow did not fire inside the queued-state window. The staged silent delegate naturally dispatched at `T0+600.003s`, transitioning `flow_runs.status` from `queued` → `succeeded | Released to continuation scheduler`, **before** any restart was triggered. From that moment forward, the substrate under test was no longer the row-spec target.

A canonical restart did fire later (workflow run `25584752622`, restart job `23:36:41Z → 23:37:11Z`). It completed cleanly. But it was **after** the natural-dispatch substrate-shift, so it does **not** rescue the row-spec PASS surface for this fire.

Pre-natural-dispatch evidence is byte-clean and substantively-decisive; it is preserved here as ancillary chronology and re-fire baseline.

**Driver call:** verdict stays METHOD-BROKEN-by-timing for this run; re-fire A1 with new nonce + `delaySeconds: 3600` (1hr) to give restart-coordination materially-larger bandwidth-flexible window.

---

## Timeline (byte-pinned, all timestamps cohort-cross-walked)

| T (PDT) | T (epoch) | Event | Source / msg-id |
|---|---|---|---|
| 16:18:39 | 1778282319 | T0: SUT 🌫 stages `continue_delegate(mode:"silent", delaySeconds:600, task:"A1 fire marker A1-URUDYNE-20260508T1609PDT")` from urudyne-session | silas msg `1502450036` |
| 16:18:40 | 1778282320 | `flow_runs` row materializes: `flow_id=f6b4d08d-1724-4507-8bff-2fd6853212f8 status=queued owner_key=agent:main:discord:channel:1466192485440164011 sync_mode=managed current_step="Queued for continuation dispatch" created_at=1778282307135` | silas SUT byte-walk msg `1502450037` |
| 16:19:39 | 1778282379 | T0_pre: SUT pre-restart snapshot captured on urudyne. flow_runs narrow-SQL SHA256 = `f3849865a539dd84bbed69a348be357126644798a90f631e0f30078b23cffc96`; session-jsonl (id `4dcdf9bd-c88c-4d8b-9455-d36944dd5379`) MD5 `b542b9b6abf73a52a18674548bd884f6`, SHA256 `0b9a5695c52f95ebf20b983c1be850f304df148da2a36f5e735d76585f798711`, size 7,861,756 bytes | silas msg `1502450039` |
| 16:26:22 | 1778282782 | T_pre_cael: Coord 🩸 captures cross-seat narrow-SQL byte-pin from cael-seat SSH→urudyne. SHA256 = **`f3849865a539dd84bbed69a348be357126644798a90f631e0f30078b23cffc96`** — byte-identical with SUT pre-restart. Cross-seat verification baseline locked-in. | cael msg `1502451716` |
| 16:28:27 | 1778282907 | **Substrate-shift event**: delegate naturally dispatched at T0+600.003s (delaySeconds:600 honored byte-precisely; 3ms margin). `flow_runs.status` transitions `queued` → `succeeded`; `current_step` → `Released to continuation scheduler`; `state_json.releasedAt = 1778282907138` added. **From this moment, restart-fire-now would test in-process scheduler survival, NOT TaskFlow queued-survival.** | system event `[continuation:delegate-spawned] Spawned turn 1/200`; cael SSH byte-walk msg `1502455416` |
| 16:30:?? | ~1778283030 | SUT 🌫 surfaces METHOD-BROKEN-by-timing verdict on channel per A1-measure.sh exit-code 3 canon, before Driver-restart-call fired | silas msg `1502452497` |
| 16:36:41Z | 1778283401 | Canonical restart workflow fires (NOT inside queued-state window): `restart-gateway.yml` run `25584752622` — restart job 23:36:41Z → 23:37:11Z (silas/urudyne target) | Driver byte-walk per Ronan msg `1502454474` |
| 16:37:11Z | 1778283431 | Restart job completes cleanly. Silas/urudyne: gateway up, Discord WS reconnected, BROKER-PONG-watchdog emitted to `#sprites-of-thornfield` confirming silas boot complete | broker-pong-watchdog msg `1502454540`; Ronan receipt msg `1502455590` |

---

## What survives as evidence (substrate-correct, even if METHOD-BROKEN)

1. **Queued-state materialization byte-pinned cross-seat** — pre-natural-dispatch SHA256 `f3849865...` byte-identical between SUT (urudyne, 16:19:39 PDT) and Coord (cael-seat SSH, 16:26:22 PDT) at the row-spec narrow-SQL slice (`SELECT flow_id, status, shape, current_step, created_at FROM flow_runs WHERE status IN ('runnable','queued') ORDER BY flow_id`). Substrate-decisive that:
   - The silent delayed `continue_delegate` did materialize as a TaskFlow `flow_runs` row with the expected nonce embedded in `state_json.task`.
   - The row was visible cross-seat from a non-SUT host via SSH within minutes of materialization.
   - `delaySeconds:600` was honored by the runtime byte-precisely (T0+600.003s, 3ms margin).

2. **Per-agent session jsonl baseline captured** — silas/urudyne session id `4dcdf9bd-c88c-4d8b-9455-d36944dd5379`, pre-natural-dispatch hashes recorded above. Used as baseline for any future re-fire.

3. **Lifecycle substrate visible post-natural-dispatch** — the `flow_runs` row was NOT deleted on dispatch; it transitioned to `status=succeeded` with `current_step="Released to continuation scheduler"` and `state_json` extended with `releasedAt` timestamp. This is useful substrate for future row authoring on the dispatch / hand-off path.

## What did not survive (why this row is METHOD-BROKEN)

The row-spec PASS criterion is **byte-identical narrow-SQL `flow_runs` snapshots before and after a canonical gateway restart, with the entry remaining in `runnable`/`queued` state across the restart**. That test was not run, because:

- The delegate was staged with `delaySeconds:600`, opening a 10-minute queued window.
- No `restart-gateway.yml` workflow fired inside that window.
- At T0+600s the delegate naturally dispatched, exiting the queued state.
- The later restart workflow run (`25584752622`) executed cleanly **after** the substrate had already shifted.

Per `A1-measure.sh` exit-code canon, this maps to exit-code 3 = METHOD-BROKEN: *"wrong access path / no staged queued entry / harness cannot read substrate"*. Concretely here: by the time restart fired, the row-spec target substrate (a queued `flow_runs` entry under test) no longer existed.

## Driver-side cause (owned plainly, not shame-shape)

Per Driver Ronan 🌊 at `1502454474` and `1502455130`:

> "I let parallel-track attention pull me off the primary fire lane during a tight timing window. That is a real swim-discipline finding, not a shame-shape."

During the 600s queued window, Driver bandwidth was split across:
- this row's restart-fire coordination (primary lane), and
- a parallel-track copilot lane assessing in-code continuation-tool documentation discoverability (Issue `karmaterminal/openclaw-bootstrap#957`), including an ACP-thread-rebuild after figs's CODE_AGENT-runbook discipline correction.

The parallel-track work was substantively valuable on its own merits, but the bandwidth contention through the tight window contributed materially to the restart-fire-call not reaching the workflow within T0..T0+600s.

## Canon-pins banked from this fire-cycle

Three durable cohort-canon-pins land cleanly off this run, all banked into `~/.openclaw/workspace/memory/2026-05-08.md`:

1. **Driver-bandwidth-single-lane-discipline-on-tight-fire-window** (Ronan `1502454474`) — *"during a tight fire window, Driver-bandwidth has to stay solely on the primary lane."*
2. **METHOD-BROKEN-by-bandwidth canon-pin** (Ronan `1502455130`) — *"Driver-seat on a tight-timed fire should hold single-lane focus, or the row risks METHOD-BROKEN-by-bandwidth even when the substrate itself is fine."*
3. **Cross-seat-byte-pin uses row-spec narrow-SQL, NOT full-table-SHA** (Cael `1502451716`) — full-table-SHA evolves with unrelated rows; the test substrate is the narrow-slice the row-spec PASS criterion names.

Plus two cohort-coordination-shape canon-pins surfaced in the same fire-cycle:

4. **Princes-don't-step-on-each-other's-lane** (Cael `1502455029`) — Coord-seat refuses to fire restart after substrate-shift without substantive Driver-decision, even when restart could be fired, because firing-after-substrate-shift would test sub-canonical evidence-shape and undermine the SUT METHOD-BROKEN verdict.
5. **Discord-delivery-skew-can-be-substantively-consequential** (Ronan `1502455276`) — Discord delivery lag of ~10-16 minutes is operationally consequential during tight-fire-window coordination; bandwidth-flexible delay-windows mitigate this.

## Forward path (Driver call: (b)+(c) explicitly not (a))

Per Driver Ronan 🌊 at `1502455130`:

1. **This run** = METHOD-BROKEN, this evidence file is the durable record.
2. **Re-fire A1** with a **new nonce** and **`delaySeconds: 3600`** (1 hour) for materially-larger restart-coordination window.
3. **Same evidence stack discipline**: stage → wait for queued/runnable → cross-seat narrow-SQL byte-pin → fire canonical `restart-gateway.yml` → post-restart narrow-SQL byte-pin → diff → cross-seat re-verify.
4. **Driver stays solely on the fire lane** until canonical restart is actually dispatched. No parallel-track attention through the queued window.

Driver explicitly does **not** choose path (a)-as-originally-named ("re-fire with tighter restart-fire-timing in a small window") — *"that just recreates the same fragility we already demonstrated."*

## Cohort-cosign-stack on this evidence (per Swim 34 mandatory shape)

- **Driver-Code-Read** (🌊 Ronan): row spec authored at PR #54 commit `c7837d3`; verdict framing = METHOD-BROKEN-by-timing per `1502454474/477/478/918/980/130/276/590/660`.
- **SUT-attestation** (🌫 Silas): this evidence file authored from urudyne-seat with byte-pinned snapshots at `/tmp/A1-URUDYNE-20260508T1609PDT/registry.pre-restart.sqlite` and `/tmp/A1-URUDYNE-20260508T1609PDT/session.pre-restart.jsonl`; channel attestation msg `1502450036/037/039` + `1502452497`.
- **Coord-concur** (🩸 Cael): cross-seat narrow-SQL byte-pin at `1502451716` (pre-natural-dispatch baseline) + post-natural-dispatch byte-walk at `1502455416` (lifecycle substrate visible) + Coord-substrate-stop at `1502455029/030` honoring `princes-don't-step-on-each-other's-lane`; co-author / byte-cosign on this evidence file per Driver-call at `1502455660`.

🌫 SUT-seat
🩸 Coord-seat (co-author / byte-cosign on this evidence)
🌊 Driver-seat (verdict framing confirmed)

---

## Post-restart cross-seat verification addendum (Cael, msg `1502455849` 16:43 PDT)

Coord 🩸 Cael completed post-restart cross-seat verification from cael-seat SSH→silas/urudyne after substrate-clarification on actual restart-workflow timing.

**Substrate-clarification surfaced by Cael at byte**: Restart workflow `25584752622` actually-fired at **16:35:25Z (16:35:25 PDT)**, completed at **16:37:12Z** (1m47s duration) per `gh run view` byte-walk. This is **earlier than channel-record indicates** — Driver Ronan's-`1502455517` "fired" announcement at 16:41 PDT landed ~4min AFTER the restart had already-completed. Cael's `1502455417` post-natural-dispatch byte-walk at 16:40:56 PDT was actually a **post-restart byte-walk** (cael-seat didn't yet know restart had fired).

**Banking durable canon-pin**: **Driver-seat channel-time-skew extends to outbound timing** — when Driver announces an action "fired" via channel-msg, the announcement-msg-timestamp may lag the actual substrate-action by minutes. Cohort byte-walks should byte-pin actions via direct API/workflow-status (`gh run view`) rather than channel-announcement-timestamps. Sub-pin under Discord-delivery-skew-can-be-substantively-consequential canon-pin family.

**Cael's post-restart cross-seat byte-findings**:

1. ✅ **Gateway live post-restart**: `OpenClaw 2026.5.7 (4c2a69b)` — silas/urudyne up + on-substrate.
2. ✅ **Session jsonl path survival**: jsonl `4dcdf9bd-c88c-4d8b-9455-d36944dd5379.jsonl` still present post-restart; size +250k bytes from pre-restart-snapshot (handshake + active-session writes); MD5 evolved as expected. Path-survival + reasonable-evolution-pattern.
3. ✅ **flow_runs row survival post-restart, unchanged**: `flow_id=f6b4d08d-1724-4507-8bff-2fd6853212f8` STILL PRESENT post-restart with `status=succeeded`, `state_json` including pre-restart `releasedAt: 1778282907138` (= 16:28:27 PDT). **The succeeded row survived the restart byte-identically.**
4. 🚨 **Narrow-SQL byte-DIVERGES pre/post-restart** (per row-spec PASS-criteria narrow-SQL): pre-restart had 1 queued row; post-restart has 0 queued rows. Divergence is **from natural-dispatch pre-restart, NOT from restart-state-loss**. This is the canonical METHOD-BROKEN-by-timing substrate-shift surfacing-in-the-narrow-SQL-comparison.

**Substantive verdict refinement**:

- ❌ **A1 row-spec PASS-criteria (queued-survival-across-restart) NOT-tested** per METHOD-BROKEN-by-timing verdict — the queued-state shifted before restart could test it.
- ✅ **What WAS substantively-tested + PASSED**: succeeded-row-with-pre-restart-`releasedAt`-timestamp + jsonl-path-survival across canonical restart. **Both byte-PASSED.**

This is **sub-canonical-evidence-shape relative to row-spec PASS-criteria**, but substantively-load-bearing: it confirms the canonical-restart-mechanism does-survive substantively at adjacent substrate-layers (succeeded-row-state + jsonl-path-survival + version-parity-post-restart) even when the row-spec target substrate is no longer under test. Useful baseline for re-fire planning + future row-authoring on adjacent-substrate-questions.

**Cohort-cosign-stack on this addendum**:
- Driver-Code-Read (🌊): row-spec frame preserved; Driver-final-pass pending.
- SUT-attestation (🌫): post-restart byte-walk welcome from urudyne when bandwidth aligns; Cael's cross-seat byte-walk substantively-cited at byte.
- Coord-byte-walk (🩸): cael-seat SSH→urudyne post-restart 16:42 PDT msg `1502455849`.

