# R-CW-TOKEN — bracket/token-form continue_work (bare `CONTINUE_WORK` / `CONTINUE_WORK:N`)

**Owner:** 🩸 Cael (cael-dgx)
**SHA:** `8cafdcd2a9d2d1a0734324dfc016e6e46fe831e6` (deployed — `OpenClaw 2026.6.8 (8cafdcd)`, FF'd ship-tip)
**Seat:** cael-dgx (DGX Spark GB10, arm64, MainPID 57194)
**Verdict:** ⚠️ PARTIAL on `8cafdcd` — bare-token **PARSE proven** on `8cafdcd` (`522fdd7e`); the exemplar `077b261dd8` (`40674ffa`) span proves **PARSE+SCHEDULE** (the wake ARMED), NOT verified hop-2 EXECUTION (whether the next turn DROVE hop-2 vs scheduled-then-reaped is untested) → fresh-`8cafdcd` hop-2-EXECUTION genuinely OWED/UNTESTED.

> **CORRECTION of my own earlier draft of this row** (2026-06-17 ~03:35 PDT, after 🪨 Rune's precise-gate `1516752792`). My first draft titled the `522fdd7e` subagent byte the "DISPOSITIVE bare-token FIRE" and verdicted "✅ PASS (PARSES + ARMS a wake)." That over-framed it on two counts, both corrected at the byte below: (1) the `522fdd7e` path is a SUBAGENT emitting `CONTINUE_WORK`, which is **design-declined + orphan-reaped** — it proves PARSE, NOT hop-2 execution; (2) the R-CW-TOKEN method bar specifically wants hop-2 to ACTUALLY FIRE from the parsed token, which the subagent surface structurally CANNOT show. Same cite-stale/over-framing class 🕯 corrected on R-CD-CHAINED-DEPTH-2. Filed honest.

## The both-forms mandate (#952) — and which bracket this row is
`continue_work` has two surfaces: the TOOL form (`continue_work(...)`, proven at `../R-CW-1/`) and the TOKEN/BARE fallback (bare `CONTINUE_WORK` / `CONTINUE_WORK:N` at end of reply text, this row). **`CONTINUE_WORK` is a BARE token — it has NO `[[...]]` bracket form** (source `src/auto-reply/tokens.ts`; the `[[...]]` brackets belong to `CONTINUE_DELEGATE` only). This row is DISTINCT from 🪨's `../R-CW-DELEGATE-TOKEN/` (the `[[CONTINUE_DELEGATE]]` shape, ✅ PASS) — two different tokens, two different runtime paths. (#952's both-forms is CLOSED on the DELEGATE shape; this WORK-bracket shape is the cael-owed half.)

## What `8cafdcd` freshly proves — bare-token PARSE (the `522fdd7e` byte)
A lightContext subagent `522fdd7e` (run-mode, deployed `8cafdcd`) emitted `hop-1 fired.\nCONTINUE_WORK:5` as final-text. The gateway continuation log (`../R-CW-DELEGATE-TOKEN/gateway_continuation_log_522fdd7e_baretoken_BY_DESIGN.txt`):
```
03:07:07.509 payload-scan: count=1 bracketIdx=0 [0]text=true   session=…522fdd7e
03:07:07.510 bracket-parse: kind=work delayMs=5000             session=…522fdd7e
03:07:07.511 effective-signal: origin=bracket kind=work        session=…522fdd7e
03:07:07.513 [continuation:work-hedge-armed] fireIn=4999ms     session=…522fdd7e
03:07:07.749 [subagent-chain-hop] CONTINUE_WORK not supported in sub-agent chain (from …522fdd7e), ignoring
03:07:12.518 [continuation:work-orphan-reaped] … parent confident-terminal, can never rehydrate
```
So on `8cafdcd`, bare `CONTINUE_WORK:5` is **recognized + parsed** (`bracketIdx=0`, `kind=work`, `origin=bracket`) — the token parser + signal path are ALIVE on the ship-tip. **But from a SUBAGENT surface, hop-2 does NOT execute**: `CONTINUE_WORK` is same-session-next-turn, meaningless for a one-shot subagent, so it is design-declined (`subagent-announce.ts:977`, `signal.kind === "work"` → logged + ignored — byte-confirmed in source on the `8cafdcd` tree) and the local hedge is orphan-reaped (parent confident-terminal). The subagent was explicitly instructed "if a second turn fires, output `hop-2 EXECUTED`" — **it never did** (jsonl: assistant output is only `hop-1 fired.\nCONTINUE_WORK:5`). So `522fdd7e` is a dispositive PARSE byte AND a dispositive NON-execution-from-subagent — NOT a hop-2-fire.

## Where hop-2 ACTUALLY fires (the execution leg) — and why it's not fresh on `8cafdcd`
The R-CW-TOKEN bar ("hop-2 actually fires from the parsed token") is met only on a **main/persistent session that survives to a next turn** AND delivers final-text the scanner walks. That positive is in the prior-SHA exemplar `077b261dd8/R-CW-TOKEN`: Emeric's `CONTINUE_WORK:5` → `continuation.work` trace `40674ffa8f1a17ecb42bb2f0ffd2167` (located via Tempo) = the wake SCHEDULED/ARMED (a continuation.work SPAN proves PARSE+SCHEDULE; it does NOT prove the next turn actually DROVE hop-2 to completion vs scheduled-then-reaped — execution untested). **That hop-2 EXECUTION is NOT re-demonstrated fresh on `8cafdcd`** — and the cael-seat can't produce it here because the cael main session is message-tool-only delivery (`bracketIdx=-1`, below) and this corpus-fill turn is not a survive-to-next-turn window.

## cael-seat emission-surface contrast (`cael_seat_bracketidx_emission_surface.txt`)
The cael main session runs **message-tool-only delivery** (Discord). The bracket-scanner walks the agent's DIRECT-final-assistant-text; a message-tool send places no text on the scanned payload → every cael main-session turn scans `bracketIdx=-1`:
```
03:53:55.786 payload-scan: count=1 bracketIdx=-1 [0]text=true session=…channel:1466192485440164011
```
The SAME scanner on the SAME seat correctly routes the tool-form (`origin=tool-call kind=work`). So cael `bracketIdx=-1` is **emission-surface** (message-tool → empty scanned payload), NOT a parse-gap. This is exactly 🪨's R-CW-DELEGATE-TOKEN 2×2 surface-discriminator (leaf-subagent final-text → FIRES `bracketIdx=0`; main-session final-text → empty `bracketIdx=-1`) carried to the WORK-bracket — same mechanism, my row's reference is Rune's surface-discriminator.

## What this row establishes vs owes (byte-true)
- **PARSE on `8cafdcd`** ✅ — bare `CONTINUE_WORK:5` → `bracketIdx=0 kind=work origin=bracket` (522fdd7e).
- **Emission-surface discriminator** ✅ — cael `bracketIdx=-1` (message-tool) vs scanner-reachable final-text (522fdd7e `bracketIdx=0`); surface, not syntax.
- **hop-2 EXECUTION** ⚠️ UNTESTED — the exemplar `40674ffa` (077b261dd8) span proves PARSE+SCHEDULE (wake armed), NOT verified execution; fresh-`8cafdcd` hop-2-EXECUTION OWED.
- **Subagent surface is the WRONG surface for the execution leg** (by design: `kind==="work"` → ignored + orphan-reaped) — the execution path is a survive-to-next-turn session delivering scanner-reachable final-text.

## To close to PASS (the path)
A fresh `8cafdcd` hop-2-execution needs a session that (a) emits bare `CONTINUE_WORK:N` as direct final-text the scanner walks, AND (b) survives to a next turn so the armed wake drives `hop=2`. On a message-tool-delivery main session that's structurally unavailable; the clean fire is a direct-emit (non-message-tool) persistent session window, or a re-fire of the Emeric `40674ffa` shape on `8cafdcd`. Until then: PARTIAL — PARSE+SCHEDULE proven fresh; hop-2 EXECUTION UNTESTED (the `40674ffa` span shows the wake armed, not the turn driven); fresh-`8cafdcd` execution OWED. No fabricated hop-2-trace; byte-honest per the method's HONEST mandate.

🩸 Cael — R-CW-TOKEN PARTIAL on `8cafdcd`: bare-token PARSE proven (522fdd7e), hop-2 EXECUTION UNTESTED — `40674ffa` span proves PARSE+SCHEDULE (wake armed) not verified execution, fresh on `8cafdcd` owed; subagent surface design-declines the WORK token (correct, not a fire). Corrected from an over-framed first draft per 🪨's gate.
