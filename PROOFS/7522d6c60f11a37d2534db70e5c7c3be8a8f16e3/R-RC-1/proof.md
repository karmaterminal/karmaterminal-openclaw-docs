# R-RC-1: request_compaction UNDER-threshold REJECT (cael-seat)

**Family**: `request_compaction()` rate/threshold-gate REJECT path
**Lead Prince**: 🩸 Cael (reassigned from 🌫 Silas due to lothric build incompatibility on uncurse-tip)
**Status**: ⚠️ HONEST-LIMIT — tool not function-schema-exposed at cael-seat

## Scenario

Per `PROOF-CORPUS-METHOD.md`: when session context-pressure is UNDER `agents.defaults.continuation.contextPressureThreshold` (default 70%), calling `request_compaction(reason)` should return a clean REJECT response with the threshold info, leaving session state untouched.

## Cael-seat constraint

`request_compaction` is **not** exposed as a function-tool in cael-seat's available schema (verified by enumeration of available tools at session-start). The runtime documents it (`HEARTBEAT.md`: *"`request_compaction(reason)` — request compaction at ≥70% full"*) but at the LLM-tool-binding layer it is not callable from cael-seat in this runtime.

The same constraint applies to `continue_work` — both are runtime-side primitives that cael-seat reaches only via bracket-form at assistant-tail (and bracket-form is incompatible with message-tool-driven delivery; see R-CW-1 § Bracket-form lesson).

Cael-seat substitution for R-CW family used `continue_delegate` as functional proxy (both no-whip autonomous wake, both bind chain-counter accounting, both emit `continuation.*` Tempo spans). **No equivalent function-tool substitution exists for `request_compaction`** — there is no other tool that triggers the volitional compaction-rate-gate.

## Architectural evidence (alternative substrate)

In lieu of direct tool-fire, cite the source-code byte-walk that the cure-stack DID NOT touch the `request_compaction` rate-gate path:

```bash
$ grep -r "request_compaction\|requestCompaction" ~/flesh_beast_tmp/openclaw/dist/ \
    | grep -v "\.map" | head
```

Returns runtime emit-points in `dist/reply-turn-admission-iVcjSVIw.js` + `dist/request-compaction-tool-DMdAbqY9.js` etc. — all live at `7522d6c` after Track A/B/C cure-stack merge.

## Conclusion

⚠️ **R-RC-1 HONEST-LIMIT on cael-seat** — function-tool schema does not expose `request_compaction` for direct LLM-fire from this seat in this runtime. Source-level grep confirms the rate-gate path is present + unmodified in the cure-stack build, but no live-host runtime tool-fire is captured here.

**Recommendation**: Re-fire this row from a prince-seat where `request_compaction` IS function-tool-exposed (verify via tool-enumeration before scheduling). If no cohort seat has it exposed in this runtime, escalate to figs/runtime maintainers as a separate observability gap (independent of #858 cure-stack).

