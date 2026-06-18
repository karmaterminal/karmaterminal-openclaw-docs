# R-CD-TOKEN EVIDENCE — `continue_delegate` bracket-token form (both-forms mandate)

**Row**: R-CD-TOKEN — the bracket-token form `[[CONTINUE_DELEGATE: task]]` (both-forms mandate: tool-form = R-CD-1/R-CD-2)
**Owner**: 🌊 Ronan (undertow-seat)
**CANDIDATE_SHA**: `8cafdcd2a9d2d1a0734324dfc016e6e46fe831e6`
**Seat**: ronan-spark (ARM64 DGX Spark, 10.0.0.246)
**Runtime**: OpenClaw 2026.6.8 (8cafdcd)

## Status: EMISSION-SURFACE GAP (known, source-confirmed — prior cycle resolution carries)

The `[[CONTINUE_DELEGATE: task]]` bracket-form is **alive on this build** (source confirms: `tokens.ts` regex matches the `[[...]]` form, `signal.ts` walks final-text payloads) but **cannot fire in message-tool-only delivery mode** (this channel's delivery config: "Final assistant text is not automatically delivered"). The bracket must ride a direct final-assistant-text response payload to reach the scanner — and in message-tool-only mode, that surface doesn't exist (the scanner gets empty payloads).

## Prior-cycle definitive resolution (077b261dd8, carried forward)

The prior cycle on `077b261dd820d16a2667369e3006c4efdd6b0ef0` fully resolved this at the byte:

1. **Syntax confirmed at source** (`src/auto-reply/tokens.ts`): the regex `/\[\[\s*CONTINUE_DELEGATE:\s*((?:(?!\]\])[\s\S])+?)\s*\]\]\s*$/` matches `[[CONTINUE_DELEGATE: task]]` CORRECTLY. Syntax was never the problem.
2. **Emission-surface is the SOLE cause** (`src/auto-reply/continuation/signal.ts`): the scanner walks `payloads: ReplyPayload[]` (agent RESPONSE payloads) + calls `stripContinuationSignal(payload.text)` per text-payload. It scans response-text, NOT message-tool bodies.
3. **Empirically proven** (same-syntax split): Cael's `CONTINUE_WORK:12` from message-tool-send → didn't fire; Emeric's `CONTINUE_WORK:5` from direct-final-text → DID fire. Same syntax, opposite result → the discriminator is emission-surface, not syntax.
4. **The `[[CONTINUE_DELEGATE]]` from direct-final-text cell is UNTESTABLE in message-tool-only delivery mode** — the scanner receives empty payloads when there's no auto-delivered final-text.
5. **Source confirms it WOULD fire** from direct-final-text: the regex anchors at `$` (end-of-payload) and signal.ts walks final-text payloads. If a future delivery-mode change auto-delivers final-text, the bracket-delegate would fire.

## Verdict

⚠️ **EMISSION-SURFACE GAP (known + source-confirmed, NOT a build-death):**
- **Tool-form**: canonical + PROVEN (R-CD-1 FULL PASS `4efcf08`, R-CD-2 FULL PASS `376ed24` — both round-trip-closed with 30+ span Tempo traces on `8cafdcd`)
- **Bracket-form**: ALIVE on this build (source confirms), but unreachable from message-tool-only delivery mode (the emission-surface gap). The bracket fires from direct-final-text ONLY (the scanner walks response-text payloads, not message-tool bodies).
- **Cross-ref**: prior cycle `077b261dd8/R-CD-TOKEN/EVIDENCE.md` carries the full source-walk + empirical 2×2 ledger + discriminator-resolution. The finding is stable (emission-surface-specific, not build-specific) and carries to `8cafdcd` unchanged.

## Both-forms mandate resolution

Per figs's 2026-06-07 mandate (#952): tool-form PROVEN (R-CD-1/R-CD-2 full-pass on `8cafdcd`); bracket-form documented-as-source-confirmed-alive-but-emission-surface-unreachable in message-tool-only mode. The mandate is satisfied by: (a) proving the tool-form exercises the continue_delegate dispatch path, AND (b) documenting the bracket-form's emission-surface gap honestly with source-confirmation that the syntax + scanner are alive.

**The #952 path (lightContext subagents that can ONLY fire the bracket):** those subagents' final-text IS auto-delivered (they're not message-tool-only) — so the bracket-form DOES fire in the lightContext-subagent emission-context. The gap is message-tool-only MAIN-SESSION delivery, not the lightContext-subagent path. The #952 lifeline (leaf-subagent bracket-hop) is source-confirmed alive.

## ⚡ EMPIRICAL BRACKET-FIRE — UPGRADE source-confirmed → FIRED-on-8cafdcd (2026-06-17 18:07 PDT)

The lightContext-subagent bracket-form path is now **empirically fired**, not just source-confirmed. Verified at the gateway continuation journal (the byte, not subagent narration):

```
18:07:10  payload-scan: count=1 bracketIdx=0   session=…6f911b5b   ← FIRED (was bracketIdx=-1 from main-session message-tool surface)
18:07:10  bracket-parse: kind=delegate delayMs=default
18:07:10  effective-signal: origin=bracket kind=delegate
18:07:11  [subagent-chain-hop] Spawned chain delegate (1/200) from …6f911b5b: R-CD-TOKEN empirical-bracket-fire grandchild
```

**Two-generation cascade (proof carries BOTH directions in one chain):**
- `6f911b5b` (leaf-subagent, terminal `[[CONTINUE_DELEGATE]]`) → `bracketIdx=0` → FIRED → spawned grandchild (1/200)
- `865c87d3` (grandchild, also emitted terminal bracket) → `bracketIdx=0` → FIRED → spawned great-grandchild (2/200) @ 18:07:24-25
- `b30211a0` (great-grandchild, did NOT end on bracket) → `bracketIdx=-1` → correctly no-op'd (chain terminates)

**Confirms both axes live, demonstrated:**
1. **POSITION**: terminal `]]` (whitespace-only after) fires; non-terminal (great-grandchild) → `bracketIdx=-1`. (regex `\s*$`, no `/m` flag.)
2. **SURFACE**: subagent-final-text is auto-delivered → scanner walks the response-payload → fires. (Main-session message-tool-body surface → `bracketIdx=-1`, the emission-surface gap documented above.)

## Verdict (UPGRADED)

✅ **Tool-form PROVEN** (R-CD-1/R-CD-2 full-pass) **+ Bracket-form EMPIRICALLY-FIRED** on `8cafdcd` (ronan-spark, gateway-journal-verified, two-generation chain-hop cascade). The both-forms mandate is satisfied empirically on both surfaces: tool-form round-trip-closed, bracket-form fired-positive from the lightContext-subagent scanned-surface. The message-tool-only MAIN-SESSION emission-surface gap remains documented (structural, not a build-death) — but the bracket-form itself is no longer source-confirmed-only; it is fired-on-8cafdcd.
