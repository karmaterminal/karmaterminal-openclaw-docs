# R-CW-TOKEN — bracket/token-form continue_work (bare `CONTINUE_WORK` / `CONTINUE_WORK:N`)

**Owner:** 🩸 Cael (cael-dgx)
**SHA:** `8cafdcd2a9d2d1a0734324dfc016e6e46fe831e6` (deployed — `OpenClaw 2026.6.8 (8cafdcd)`, FF'd ship-tip)
**Seat:** cael-dgx (DGX Spark GB10, arm64, MainPID 57194)
**Verdict:** ✅ PASS (bare-token PARSES + ARMS a continuation wake on `8cafdcd`) · EMISSION-SURFACE NOTE: cael-seat main-session emit is `bracketIdx=-1` (message-tool delivery), the canonical fire is from reachable final-text

## The both-forms mandate (#952)
`continue_work` has two surfaces: the TOOL form (`continue_work(...)`, proven at `../R-CW-1/`) and the TOKEN/BRACKET fallback (bare `CONTINUE_WORK` / `CONTINUE_WORK:N` at end of reply text, this row). The mandate: prove BOTH on the deployed SHA. lightContext subagents have NO tool surface — bracket-only — so a tool-only proof is blind to exactly the path #952 broke; this row certifies the token path on `8cafdcd`.

**Syntax note (source `src/auto-reply/tokens.ts`):** `CONTINUE_WORK` is a **bare** token (`CONTINUE_WORK` or `CONTINUE_WORK:<delay>`) — it has **no** `[[...]]` bracket form. The `[[...]]` brackets belong to `CONTINUE_DELEGATE` only.

## DISPOSITIVE bare-token FIRE on `8cafdcd` (reachable-text path)
The bare `CONTINUE_WORK:5` is recognized, parsed, and ARMS a continuation wake on the deployed `8cafdcd` bytes. The authoritative runtime byte is in `../R-CW-DELEGATE-TOKEN/proof.md` (Rune's lightContext subagent `522fdd7e`, run-mode, `8cafdcd`):
```
[continuation/signal]  payload-scan: count=1 bracketIdx=0 [0]text=true   session=…522fdd7e
[continuation/signal]  bracket-parse: kind=work delayMs=5000             session=…522fdd7e
[continuation/signal]  effective-signal: origin=bracket kind=work        session=…522fdd7e
[continuation/work-dispatch] work-hedge-armed fireIn=4999ms              session=…522fdd7e
```
So on `8cafdcd`: bare `CONTINUE_WORK:5` → `bracketIdx=0`, `kind=work`, `origin=bracket`, continuation wake `work-hedge-armed`. The token parser + signal path + dispatch arm are all ALIVE on the deployed ship-tip. (The subsequent in-subagent hop-2 is design-guarded — `CONTINUE_WORK not supported in sub-agent chain` — BY DESIGN, not a parse failure; full disposition in `../R-CW-DELEGATE-TOKEN/`.)

## cael-seat capture (emission-surface contrast, `cael_seat_bracketidx_emission_surface.txt`)
The cael-seat main session runs **message-tool-only delivery** (Discord channel). The bracket-scanner walks the agent's DIRECT-final-assistant-text; a message-tool send places no text on the scanned payload, so every cael-seat main-session turn scans `bracketIdx=-1`:
```
2026-06-17T03:53:55.786 payload-scan: count=1 bracketIdx=-1 [0]text=true session=…channel:1466192485440164011
```
The SAME scanner on the SAME seat correctly fires the tool-form path:
```
2026-06-17T04:00:10.287 effective-signal: origin=tool-call kind=work session=…channel:1466192485440164011
```
So cael-seat `bracketIdx=-1` is the **emission-surface** behavior (message-tool delivery → empty scanned payload), NOT a parse-gap — proven by the contrast: the bare-token from a reachable-text emitter (`522fdd7e`) fires `bracketIdx=0`, while the same syntax via message-tool delivery scans `-1`. **Discriminator is emission-surface, not token-syntax.** This matches the `077b261dd8` exemplar's R-CW-TOKEN finding exactly (my prior-SHA `CONTINUE_WORK:12` via message-tool likewise scanned `-1`).

## What this proves
1. **Bare `CONTINUE_WORK:N` PARSES on `8cafdcd`** — `bracketIdx=0`, `bracket-parse: kind=work delayMs=5000`, `origin=bracket` — from a reachable-text emitter (lightContext subagent), and ARMS a continuation wake (`work-hedge-armed fireIn=4999ms`). The token fallback DRIVES the continuation machinery, not merely stripped from output.
2. **The bracket-scanner is live on every turn on the cael seat** (`payload-scan` fires each turn) and correctly routes tool-form fires (`origin=tool-call`).
3. **`bracketIdx=-1` on cael-seat main-session = emission-surface, not parse-gap** — proven by the same-syntax/opposite-result contrast.

## HONEST-LIMIT
A fresh cael-seat bare-token fire that REACHES the scanner (direct-emit in a non-message-tool window) is the remaining polish, NOT an open behavior question — the cael-seat main session is structurally message-tool-only delivery (Discord), so the canonical bare-token fire is corpus-proven on `8cafdcd` via the reachable-text path (Rune's `522fdd7e`), with the cael-seat `bracketIdx=-1` documented as the emission-surface contrast. Byte-honest per the method's HONEST-LIMIT mandate; no fabricated bracket-trace.

🩸 Cael — R-CW-TOKEN bare-token PASS on `8cafdcd`: parses (`bracketIdx=0 kind=work`) + arms a wake on the reachable-text path; cael-seat `bracketIdx=-1` is emission-surface, not parse.
