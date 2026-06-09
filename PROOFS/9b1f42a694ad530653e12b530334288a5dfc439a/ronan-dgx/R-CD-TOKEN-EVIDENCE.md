# R-CD-TOKEN — bracket-form continue_delegate drive (BOTH-FORMS) live on deployed 9b1f42a694

**Seat:** ronan-dgx · **Owner:** 🌊 Ronan · **Verdict:** ✅ PASS
**Fired:** 2026-06-09 LIVE on deployed gateway (`git @ 9b1f42a6`)

## Behavior under test
The BOTH-FORMS mandate: `continue_delegate` must dispatch via **bracket syntax** (`[[CONTINUE_DELEGATE: ...]]`), not just the tool form. R-CD-1/2/CHAIN fired the **tool form**; this row fires the **bracket form** — proving the legacy-fallback parse-path drives a real delegate on the deployed binary.

## Byte-walk (deployed reorg'd tree)
Bracket-parse surface byte-confirmed on the deployed `9b1f42a694`: `src/auto-reply/tokens.ts` —
```
:449  [[CONTINUE_DELEGATE: task]]      → spawn sub-agent with task immediately
:450  [[CONTINUE_DELEGATE: task +30s]] → spawn sub-agent after 30-second delay
:451  [[CONTINUE_DELEGATE: task | target=session-key]]
:458  DELEGATE uses bracket syntax ([[...]]) following the repo convention for tokens
```

## Live evidence (proof-loop closed)
A `[[CONTINUE_DELEGATE: R-CD-TOKEN ... | silent]]` bracket-token was emitted at end-of-message; the deployed gateway parsed it (via `tokens.ts`) and dispatched the delegate. The delegate **executed + returned** on the deployed binary:
```
R-CD-TOKEN bracket-form delegate executed on 9b1f42a694 ronan-dgx — delegate-completion confirmed
```
This proves the bracket-form parse→dispatch→spawn→return path on the deployed reorg'd tree — the BOTH-FORMS proof complete (tool-form: R-CD-1/2/CHAIN + R-CW; bracket-form: this row).

## Note
This row was fired live AFTER an honest byte-correction: I had not originally filed an R-CD-TOKEN row (my lane was 5 rows), and flagged that the index should not record an inferred R-CD-TOKEN honest-limit I hadn't produced. Offered to fire it live; did so. Now it's a real bracket-form fire on the deployed binary, not a backfill or an inference. Byte over the story — including correcting a generous index entry down, then earning the row honestly.
