# R-CD-TOKEN — continue_delegate BRACKET/token form (both-forms-mandate half) (ronan-dgx, ship-SHA `93ace21341bf13a08f9bf75791f8ac70cf9542a5`)

**Owner:** 🌊 Ronan | **Seat:** ronan-dgx (DGX Spark ARM64) | **SHA:** `93ace21341bf13a08f9bf75791f8ac70cf9542a5` (deployed, gateway pid `600103`) | **Verdict: ✅ PASS — bracket DRIVES (full parse→dispatch chain captured)**

## Fire (TOKEN/bracket-form — the #952 surface, distinct from the tool-form code path)
The bracket-form `[[CONTINUE_DELEGATE:...]]` must fire from a **scanned final-text payload** — NOT a message-tool body (per the source: `signal.ts` walks RESPONSE payloads, not message-tool sends). My MAIN seat is message-tool-only delivery (final-text not auto-delivered), so the bracket cannot ride my main final-text. The authoritative surface is a **lightContext subagent**, whose final-text IS the scanned payload and where the bracket is the ONLY continuation path (tool denied to leaf subagents) — **this is exactly the #952 failure surface.**

- Spawned a lightContext subagent (`sessions_spawn lightContext=true mode=run`, child `agent:main:subagent:d704259b-4528-4e08-9c3a-573284bfc584`, runId `77fe270a`) whose ENTIRE response was the terminal bracket:
  ```
  [[CONTINUE_DELEGATE: R-CD-TOKEN PROOF: bracket-form continue_delegate dispatched a hop-2 child from scanned-final-text at CANDIDATE_SHA 93ace21341bf13a08f9bf75791f8ac70cf9542a5 from ronan-dgx 2026-06-21 | silent]]
  ```
- Bracket at absolute terminal position (no trailing prose/glyphs — the fire-condition per the position-sensitivity byte).

## The bracket-DRIVES dispositive chain (`bracket_parse_hop2_dispatch.log`)
`journalctl --user -u openclaw-gateway`, window 01:02:40–01:02:41 PDT (gateway pid `600103`):
- `[continuation:trace] payload-scan: count=1 **bracketIdx=0** [0]text=false session=…d704259b` at 01:02:40.499 — **`bracketIdx=0`: the bracket WAS found at terminal position** (contrast prior cycles' `bracketIdx=-1` when the bracket rode a message-tool body)
- `[continuation:trace] **bracket-parse: kind=delegate** delayMs=default …` at 01:02:40.500 — parsed as a `continue_delegate` directive
- `[continuation:trace] **effective-signal: origin=bracket kind=delegate** …` at 01:02:40.501 — the effective continuation signal is bracket-origin
- `[subagent-chain-hop] **Spawned chain delegate (1/200)** from agent:main:subagent:d704259b…: R-CD-TOKEN PROOF: bracket-form continue_delegate dispatched a hop-2 child…` at 01:02:41.028 — **THE HOP-2 DELEGATE DISPATCHED FROM THE BRACKET.**

So the bracket-form did not merely strip — it **drove a real hop-2 delegate dispatch** from the scanned final-text, the same continuation surface as the tool-form (R-CD-1/2/3/4). Child stats: runtime 4s, out 125 tokens, response consumed by the bracket-parse (`(no output)` to parent — the bracket was the whole payload).

## Scope-bound at byte
Proves the `continue_delegate` BRACKET/token form `[[CONTINUE_DELEGATE:...]]` DRIVES (not just strips) from a lightContext subagent's scanned final-text — the #952 surface where the bracket is the only continuation route. `bracketIdx=0` → `bracket-parse kind=delegate` → `effective-signal origin=bracket` → `subagent-chain-hop Spawned chain delegate`. Both-forms mandate satisfied: tool-form (R-CD-1/2/3/4) + bracket-form (this row) both fire + drive the continuation surface. Same gateway-pid (`600103`).

## Verdict: ✅ PASS — bracket/token form `[[CONTINUE_DELEGATE:...]]` parsed (`bracketIdx=0`, `kind=delegate`) from a lightContext subagent's scanned final-text AND dispatched a hop-2 chain delegate on `93ace21` — the bracket-form drives the continuation surface, proven on the #952 lightContext path. (Stronger than prior cycles, which could only test the bracket from the main message-tool-only seat where it lands in a non-scanned body.)
