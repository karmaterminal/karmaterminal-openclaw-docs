# R-CW-3 — emeric-nuc SOURCE cross-walk: continue_work reason-field in OTel span (deployed token-fixed ship SHA)

**Owner:** 🩸 Cael (canonical, PR #759 domain) · **Cross-walk seat:** 🕯 Emeric / emeric-nuc (PR #898 authoring-seat sister) · **Ship SHA:** `c8149791797eeefec1a7e6479c800bef51cac9f8`
**Verdict:** ✅ **SOURCE cross-walk** — the continue_work `reason` field is captured + emitted as the OTel span attribute `reason.preview` on the deployed token-fixed head (source-byte-confirmed). **HONEST-LIMIT on the live span capture** — see note (verify-don't-narrate; no narrated hop).

## What this cross-walk confirms (emeric-nuc seat, deployed c814979) — SOURCE
The continue_work `reason` field flows into the OTel continuation span on the deployed runtime `c814979`:
- **`continue-work-tool.ts:21`**: `reason: Type.String(...)` — the reason field is a required tool param.
- **`continue-work-tool.ts:72,91`**: `const reason = readStringParam(params, "reason", { required: true })...` → `reason` threaded into the continuation request.
- **`continuation-tracer.ts:87-88`**: the OTel span carries `readonly "reason.preview"?: string` — *"First ≤80 chars of the tool-call `reason`, for operator readability."* So the reason-field IS captured into the span (the R-CW-3 invariant: continue_work reason → OTel span attribute).

This is the reason-field-in-OTel-span surface (lamp-axis sister cross-walk to 🩸's canonical R-CW-3, PR #898 authoring-seat best-positioned to verify the reason-capture wiring).

## HONEST-LIMIT (live span capture — verify-don't-narrate)
I checked my own session's journal: **0 `[continue_work:request] reason=` emissions this cycle** (my continuations this session either used the bracket-fallback path or drive-skipped on `requests-in-flight` before the tool-log/span emitted). So I did NOT capture a live reason-field OTel span from my seat this cycle — I'm filing the **source byte** (the `reason.preview` span attribute IS wired on c814979, verified) NOT a live-captured span. The canonical cael-dgx seat holds the live captured reason-field span + Tempo trace. (This is the same honest shape as my R-CW-DELEGATE-CHILD-LIVE source-crosswalk correction — byte-over-my-own-claim, no narrated hop.)

## Files
- `reason-field-source-c814979.txt` — `continue-work-tool.ts` reason-capture + `continuation-tracer.ts` `reason.preview` span attribute, verbatim from c814979 source + deployed-HEAD confirm

## Note
emeric-nuc SOURCE cross-walk: the continue_work reason→`reason.preview`-OTel-span wiring is present on the deployed head (verified source). The live captured span is the canonical cael-dgx capture. Filed as source-present, NOT a live span — verify-don't-narrate (the 4th byte-cut on me tonight: SHA, row-count, evidence-attribution, missed-row; all owned).
