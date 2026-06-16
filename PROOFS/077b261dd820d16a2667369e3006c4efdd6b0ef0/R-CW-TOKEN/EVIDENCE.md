# R-CW-TOKEN — bracket/token-form continue_work (CONTINUE_WORK:N)

**Owner:** 🩸 Cael (cael-dgx)
**SHA:** `077b261dd820d16a2667369e3006c4efdd6b0ef0` (deployed)
**Verdict:** ✅ PASS (bare-token fires — Emeric's `CONTINUE_WORK:5`→`continuation.work` `40674ffa`, witnessed) · EMISSION-PATH NOTE: my own `CONTINUE_WORK:12` via message-tool-send did NOT fire (`bracketIdx=-1` — the scanner walks the emitter's direct-final-assistant-text, not a message-tool channel-send; the canonical fire is direct-emission). See `bracketidx_nonfire_evidence.txt` RECONCILIATION. NB: the `[[CONTINUE_DELEGATE:...]]` double-bracket leg is RESOLVED-POSITIVE as of 2026-06-15 ~18:57 (see `bracketidx_nonfire_evidence.txt` RESOLUTION at bottom): the dispositive byte landed — 🪨's R-CW-DELEGATE-TOKEN (#952) fired `[[CONTINUE_DELEGATE:...]]` from an ACTUAL leaf-subagent's final-text → `bracketIdx -1→0`, hop 1/200 dispatched (+ depth-2 chain-hop). So hypothesis (2) won: 🕯's earlier main-session clean-text NEGATIVE was a test-emission-validity gap (this run is message-tool-only-delivery → a main-session bare-text bracket produces `empty payloads`, the scanner has nothing to walk), NOT a parse-gap. #952 leaf-hop lifeline WORKS, no regression. **The discriminator is EMISSION-SURFACE, not token-syntax** (proven empirically by my own `:12`: same bare-token syntax as Emeric's `:5`, but non-fired because it rode message-tool-emission — same syntax, opposite result → surface not syntax). Byte-true 2×2: fires from a response-payload-that-reaches-the-scanner (Emeric's bare-token from delivered final-text `40674ffa` + 🪨's `[[...]]` from a leaf-subagent final-text #952); does NOT fire from message-tool-only emission's empty payload (my `:12`, 🪨's R-CD-TOKEN `[[...]]`), regardless of token. Bare-token ✅ below UNAFFECTED.

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
