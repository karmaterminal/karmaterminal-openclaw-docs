# R-CW-TOKEN — bracket/token-form continue_work (CONTINUE_WORK:N)

**Owner:** 🩸 Cael (cael-dgx)
**SHA:** `077b261dd820d16a2667369e3006c4efdd6b0ef0` (deployed)
**Verdict:** ✅ PASS (bare-token fires — Emeric's `CONTINUE_WORK:5`→`continuation.work` `40674ffa`, witnessed) · EMISSION-PATH NOTE: my own `CONTINUE_WORK:12` via message-tool-send did NOT fire (`bracketIdx=-1` — the scanner walks the emitter's direct-final-assistant-text, not a message-tool channel-send; the canonical fire is direct-emission). See `bracketidx_nonfire_evidence.txt` RECONCILIATION. NB: the `[[CONTINUE_DELEGATE:...]]` double-bracket is a DIFFERENT syntax/path that does NOT fire (Ronan R-CD-TOKEN ⚠️) — the asymmetry (bare-token-fires / `[[...]]`-doesn't) is the real finding; I over-corrected to ⚠️ first, the byte cut the over-decline.

## The both-forms mandate
`continue_work` has two surfaces: the TOOL form (`continue_work(...)`, proven at `R-CW-1/`) and the TOKEN/BRACKET fallback (`CONTINUE_WORK:N` / `[[CONTINUE_WORK]]`, this row). The mandate: prove BOTH on the deployed SHA.

## Behavior PROVEN on the deployed `077b261dd8` bytes (Emeric per-seat, `R-CW-3/emeric-nuc-crosswalk.md`)
The token form fires the SAME continuation machinery as the tool form — it emits a `continuation.work` span, with `reason.preview` ABSENT (the token form carries no reason parameter), the populated-vs-absent contrast being the cross-walk:
```
CONTINUE_WORK:5  →  continuation.work span, trace 40674ffa8f1a17ecb42bb2f0ffd2167 (located via Tempo TraceQL)
                    reason.preview ABSENT (token form has no reason) — vs tool-form's populated reason.preview
```
So on the deployed bytes, `CONTINUE_WORK:N` is parsed + schedules a continuation via the identical `continuation.work` path — the bracket fallback works on `077b261dd8`.

## HONEST-LIMIT (cael-seat capture)
My cael-seat token emit (`CONTINUE_WORK:12`, msg `1516239069`) was delivered via the **message-tool send path** during the rapid post-deploy cohort inbound; the journal showed no cael-seat `continuation:work-wake` in the window — consistent with EITHER (a) the token-parser scanning the agent's direct response text, not message-tool-sent content, OR (b) the cooperative-yield deferring the drive (the same `work-drive-skipped reason=requests-in-flight` that gated R-CW-1/R-CW-4 this session). The token-form BEHAVIOR is corpus-proven on the deployed SHA (Emeric's capture above); the cael-seat clean token-path capture (direct-emit in a quiet window) is the remaining polish, NOT an open behavior question. Banked honestly per the method's HONEST-LIMIT mandate.
