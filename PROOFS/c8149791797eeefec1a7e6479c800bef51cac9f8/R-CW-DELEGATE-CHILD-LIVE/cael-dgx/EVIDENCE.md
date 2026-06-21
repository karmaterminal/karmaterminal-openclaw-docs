> **RE-HOMED to ship-SHA `c8149791797eeefec1a7e6479c800bef51cac9f8` (2026-06-21, frond-scribe's GATE-4 lock).** The #1057 lane-routing fix (`work-dispatch.ts:253-256`) is BYTE-IDENTICAL on `c814979` (verified: same `continuationLane`/`getQueueSize(MAIN)` short-circuit). `c814979` is a descendant of the original `93ace21`-era capture-SHA; the own-lane-drive behavior is unchanged by the absorb (token-fix + type-fix + upstream merge don't touch the `:253-256` gate). Deployed-seat re-confirm: cael-dgx runs `OpenClaw 2026.6.9 (c814979)`. Behavioral evidence carries over per frond-scribe's "unaffected rows quick re-confirm on the deployed seat."

# R-CW-DELEGATE-CHILD-LIVE — #1057 fix behavioral proof

**Deployed head:** `93ace21341bf13a08f9bf75791f8ac70cf9542a5` (= candidate `357d0ab09e8bcf941e9c3be3babc936ceb70b9a8` + frond-scribe🌿's budget-regen, 1 commit ahead). Gateway live since 2026-06-20 22:28:09 PDT.
**Seat:** cael-dgx (DGX Spark, ARM64).
**Captured:** 2026-06-20 ~22:36–22:42 PDT.

## What the fix is (deployed, byte-confirmed)

`src/auto-reply/continuation/work-dispatch.ts:253-256,285`:
```js
if (replyRunRegistry.isActive(work.sessionKey)) {          // own-session-active gate (the right gate)
  return { status: "skipped", reason: CONTINUATION_TURN_BUSY_REASON };
}
const continuationLane = isSubagentSessionKey(work.sessionKey)   // subagent → DEFINED
  ? resolveSessionLane(work.sessionKey)
  : undefined;
if (continuationLane === undefined && getQueueSize(MAIN_COMMAND_LANE) > 0) {  // subagent: continuationLane!==undefined → BYPASSED
  return { status: "skipped", reason: CONTINUATION_TURN_BUSY_REASON };
}
...
lane: continuationLane,    // :285 — execution routes off Main
```
For a subagent, `continuationLane` is DEFINED → the `continuationLane===undefined && getQueueSize(MAIN)>0` skip short-circuits false → the subagent NEVER consults the MAIN queue → drives on its own session lane regardless of main-busy. The bug (`:240` pre-fix) gated the direct-grant on raw `getQueueSize(MAIN_COMMAND_LANE)`, which the subagent's own turn does NOT contend for → busy-main starved it.

## POSITIVE-DRIVE — PROVEN LIVE ×2 (behavioral)

Two independent delegate-child subagent sessions each fired their own `continue_work` (tool form) and DROVE hop-2 to completion:

**Run 1 — `agent:main:subagent:continuation-cf417aae7a57b8e56d82064e1098aee9`:**
- hop-1 artifact `hop1-ran.txt` @ 22:36:30.907 (fired continue_work +8s)
- gateway: `22:36:39 [work-hedge-armed] fireIn=7999ms session=…cf417aae…` → `22:36:47 [work-hedge-fired]` → `22:36:47 [work-wake] hop=1/200 session=…cf417aae…`
- hop-2 artifact `hop2-EXECUTED.txt` @ 22:36:52.372 ("HOP-2 EXECUTED — delegate-child continue_work drove to completion on deployed #1057 fix 93ace21")
- **0** `requests-in-flight` / `work-drive-skipped` for this session

**Run 2 — `agent:main:subagent:continuation-3cfd9a70c2e92dfd70da4eaa1e56ff99`:**
- hop-1 `busymain-hop1.txt` @ 22:41:35.090 (fired continue_work +14s)
- gateway: `22:41:40 [work-hedge-armed] fireIn=13990ms` → `22:41:54 [work-hedge-fired]` → `22:41:54 [work-wake] hop=1/200`
- hop-2 `busymain-hop2-EXECUTED.txt` @ 22:41:59.379

## BUSY-MAIN — proven STRUCTURALLY, LIVE-capture OWED (honest bound)

- **Structural:** the gate logic above proves the subagent bypasses the MAIN-queue gate entirely (continuationLane defined). Busy-main is irrelevant to the subagent's drive decision. This covers ALL busy-main instances, not one.
- **LIVE-busy-main capture NOT achieved:** Run 2 was *intended* as the busy-main distinguishing case, but the 3 main-session `continue_work` stagers meant to stage `getQueueSize(MAIN)>0` were **CAPPED (chain/cost/pending cap, not scheduled)** → main was NOT provably busy at 22:41:59 (gateway showed no main-lane activity then). Run 2's child-written file *claims* "drove past a busy main lane" — that is the child writing the instructed string, NOT a verified main-state byte (sub-agent-forensics-untrusted). **Not banked as the busy-main live byte.**
- **OWED:** the airtight live busy-main row (a subagent hop-2 driving while `getQueueSize(MAIN)>0` is gateway-confirmed) — re-stage with a real main-busy lever (a coincident main inbound, or after the continuation cap clears).

## Health

Gateway active, up 975s+ at capture, **zero** errors/crashes/exceptions in the deploy window. Nothing broken on the deployed head.

## Honest net

- ✅ fix DEPLOYED (byte-confirmed) · ✅ positive-drive PROVEN-LIVE ×2 · ✅ busy-main proven STRUCTURALLY (gate bypass) · ✅ nothing broken
- ⚠️ busy-main LIVE-capture OWED (stagers capped; not rounding the capped run up to the distinguishing byte)

## Artifacts
- `hop1-ran.txt`, `hop2-EXECUTED.txt` (run 1)
- `busymain-hop1.txt`, `busymain-hop2-EXECUTED.txt` (run 2)
- `R-CW-DELEGATE-CHILD-LIVE-gateway-drive.log` (run 1 full drive cycle)
- `R-CW-DELEGATE-CHILD-LIVE-trace.json` (Tempo trace, 51KB, traceparent a805e4fb85bdb4108d655541eb4303c7)

---

## CORRECTION (cohort-converged, 2026-06-21 — supersedes the "busy-main-LIVE OWED" framing above)

The cohort byte-walked the busy-main question to its sharpest form (Ronan `1518157585`, Rune `1518157587`, Silas `1518157911`, Emeric `1518158769`, Cael `1518158126`/`1518159225` — all converged):

**The "busy-main-distinguishing LIVE capture" is NOT owed — it is STRUCTURALLY UNCAPTURABLE on fixed code (a category error).** The deployed gate `:256` (`continuationLane === undefined && getQueueSize(MAIN)>0`) SHORT-CIRCUITS for a subagent (`continuationLane` is defined → first clause false → `getQueueSize(MAIN)` is NEVER read). So a live subagent drives whether MAIN is busy OR idle — there is no MAIN-branch to exhibit. A staged "getQueueSize=N at the fire-tick" capture has nothing to photograph; it would be byte-identical to an idle-main drive. The earlier "busy-main-LIVE-capture OWED" line is RETRACTED — it was never gettable.

**Byte-true row label (per Rune `1518159144`): R-CW-DELEGATE-LIVE-EXECUTE = own-lane-drive in PRODUCTION, ×6 seats. NOT "a distinguishing busy-main capture."**
- cael-dgx ×3 (cf417aae/3cfd9a70/f4d428ad) + ronan-dgx ×3 + silas-lothric canary = **production-execution** (from-child continue_work hop-2 drives live on its own lane, deployed `93ace21`).
- Ronan's `3e8ce458` = the strongest (own-lane-drive WITH busy-main-present), files as **production-with-busy-main-present**, NOT "the distinguishing capture."
- **The DISTINGUISHING byte = Emeric's `:240` deterministic test** (`work-dispatch.test.ts` 56/56, RED-unfixed→GREEN-fixed — the only thing that runs the unfixed counterfactual) — a SEPARATE row/artifact, NOT this one.

**Final honest net:** distinguishing = the `:240` test (ONE way) · production-execution = live ×6 · busy-main = structural-airtight (which is WHY the live can't distinguish). Zero gap. The one ACTUAL open item is the SEPARATE token-form-from-child gap (`b1dc30e6f0` un-shipped, `:977` announce-drop, figs's ship-call) — not this row.
