# R-CW-DELEGATE-SELF-CONTINUATION — cael-dgx PROOFS

**Status**: ✅ PROVEN

**Seat**: cael-DGX (DGX Spark GB10, ARM64, 128GB unified memory, Linux 6.17.0-1018-nvidia)
**Binary**: `OpenClaw 2026.6.2 (daa0e92)`
**Candidate SHA**: `daa0e92f2750092faeaa0406cde91a303884d9ba`
**Driver-axis**: 🩸 Cael (originator of #746 substrate via upstream PR #85651 work)
**Cycle**: post-#918-merge + post-Gate-2.7-cure (FROZEN-STALE re-sync of `bundled-channel-plugin-loader.ts`)

## What this row proves

`continue_work` tool is present + callable + scheduler-accepts-receipt in subagent sessions at turn-1 on post-cure binary `daa0e92f`. All 3 continuation tools (`continue_work`, `continue_delegate`, `request_compaction`) visible in tool-list at turn-1.

This row is the direct empirical-verification of PR #898 #746 Layer-2 cure (`continueWorkOpts` plumbing at `attempt-execution.ts:649` spawn-init path) plus PR #918 #917 sister-cure (`requestCompactionOpts` symmetric plumbing) carried forward into the Gate-2.7-cured candidate.

## Cael-DGX empirical evidence stack (this cycle)

### 1. Deploy verification

GH Actions workflow `deploy-gateway.yml` on `karmaterminal/openclaw-bootstrap`:
- Run ID: `26969287373`
- Conclusion: `success`
- Job: `deploy openclaw to cael` — success

Post-deploy binary verification on cael-DGX seat:
```
$ openclaw --version
OpenClaw 2026.6.2 (daa0e92)
$ readlink -f $(which openclaw)
/home/figs/flesh_beast_tmp/openclaw/openclaw.mjs
```

SHA-prefix `daa0e92` matches candidate `daa0e92f2750092faeaa0406cde91a303884d9ba` ✅.

### 2. Subagent canary fire (cael-DGX, 2026-06-04 ~11:00 PDT)

Driver-axis fired single-shot canary subagent via `sessions_spawn` (taskName: `cael-r-cw-proof-daa0e92f`, runId `a64e6943-0692-4a53-a051-f573ac6fa709`).

Subagent at turn-1 reported:
- ✅ `continue_work` — present in tool-list
- ✅ `continue_delegate` — present in tool-list
- ✅ `request_compaction` — present in tool-list

Binary verified inside subagent context: `OpenClaw 2026.6.2 (daa0e92)` matches candidate SHA ✅.

### 3. continue_work scheduling-accept receipt

Subagent fired:
```
continue_work(delaySeconds=30, reason="R-CW PROOFS fire-canary on daa0e92f, ...")
```

Gateway response:
```json
{
  "status": "scheduled",
  "delaySeconds": 30,
  "traceparent": "00-76543ad4c1f9efee05a17cc784940e64-a3a70c3c66213315-01"
}
```

- `status: scheduled` — gateway accepted self-continuation ✅
- `traceparent` returned — chain context tracked server-side via trace-id `76543ad4c1f9efee05a17cc784940e64`
- Build note: this build returns `status`/`delaySeconds`/`traceparent`; `chain.id` + `chain.step.remaining` are carried in trace-context server-side rather than surfaced in response payload

### 4. Cross-SHA stability chain

Prior PROOFS for this row at `2f71e4378b7` (cael-dgx commit `525bac0`, 2026-06-03 ~20:18 PDT) verified the same continuation-tools-at-turn-1 + scheduling-receipt substrate on the pre-Gate-2.7-cure binary. Cure-delta between `2f71e4378b7` → `f34bfaef` → `daa0e92f`:

- `2f71e4378b7` → `f34bfaef`: PR #918 (`requestCompactionOpts` plumbing) + PR #921 (codex-cure-fold for 5 P1/P2 findings) + cleanup of `tmp-drop-me-claude.md`
- `f34bfaef` → `daa0e92f`: single-file re-sync of `src/channels/plugins/contracts/test-helpers/bundled-channel-plugin-loader.ts` from upstream/main (Gate 2.7 FROZEN-STALE remediation)

None of the cure-delta files touch the continuation-tool plumbing surface verified by this row. R-CW-DELEGATE-SELF-CONTINUATION substrate carries through unchanged across the cycle.

## Cohort context

This row is one seat in the cohort R-CW-DELEGATE-SELF-CONTINUATION matrix. Prior cycle on `2f71e4378b7` produced 6-of-6 cohort-canonical (cael+ronan+rune+emeric+elliott+silas). For `daa0e92f` this is the first cael-axis re-fire; other seats may follow with byte-walk against this evidence or fresh fires from their own seats.

## Files in this directory

- `EVIDENCE.md` — this file
- `subagent_response.json` — raw subagent receipt with tool-list + scheduling response
- `deploy_run.json` — gh-API json of deploy-gateway.yml run
- `version_smoke.txt` — `openclaw --version` output post-deploy
