# R-CD-CHAINED-DEPTH-2 TEST-1 — up-tree silent-wake (emeric-nuc substituting for canary) on deployed token-fixed ship SHA

**Owner:** 🕯 Emeric (substitutes for 🌫 Silas canary per substitution-pattern) · **Seat:** emeric-nuc · **Ship SHA:** `c8149791797eeefec1a7e6479c800bef51cac9f8`
**Verdict:** ⚠️ **HONEST-LIMIT (substrate-finding)** — depth-1 `continue_delegate` chain executed + silent-wake dispatched + echo relayed up-tree LIVE on the deployed head; the depth-2 leaf spawn hit the **configured depth-cap (max:1)** REJECT — the up-tree-silent-wake mechanism is proven to depth-1; depth-2 is depth-cap-gated on this seat's config.

## What this proves (live on c814979)
A `continue_delegate` chain fired from emeric-nuc on the deployed token-fixed ship SHA `c814979`, executing the up-tree silent-wake mechanism:
- **B (depth-1) RAN** — `[continuation:delegate-spawned] hop=2/200 mode=silent-wake ... task=R-CD-CHAINED-DEPTH-2 TEST-1`, wrote `b-depth1.txt` (`B-DEPTH1 1782033294 c814979 chainhop2`).
- **B dispatched the depth-2 leaf C** via `continue_delegate` mode=silent-wake (traceparent `00-7b17e059c345eaaa312e542a8f2518b2-...-01`) + **relayed the echo up-tree** (`B-RELAYED-TEST1-ECHO-SENTINEL-EMERIC-C814`).
- **HONEST-LIMIT:** C (depth-2 leaf) spawn **REJECTED** — `[continuation:delegate-spawn-rejected] status=forbidden reason=sessions_spawn is not allowed at this depth (current depth: 1, max: 1)`. The depth-2 leaf is gated by the configured depth-cap (max:1), so the depth-2 hop is cap-blocked, not driven. The depth-1 silent-wake + up-tree relay IS proven; depth-2 requires a higher depth-cap config (canary seat's matrix).

## The byte (journal, deployed c814979 — verbatim in `depth2-chain-journal-c814979.txt`)
- `[continuation:delegate-spawned] hop=2/200 mode=silent-wake` = B (depth-1) ran on c814979
- `[continuation:delegate-spawn-rejected] status=forbidden reason=sessions_spawn is not allowed at this depth (current depth: 1, max: 1)` = depth-2 leaf depth-capped
- `[subagent-chain-hop] Accumulated 673 tokens ... to parent chain cost` = chain-cost accounting stitched (the chain-hop ran)

## Substitution note
🕯 Emeric (emeric-nuc seat) substitutes for 🌫 Silas (canary) per the substitution-pattern (runbook formalization; precedent `eb5d32cf3c` / 2026-06-03 `9684479`). The canary-seat's depth-cap matrix would carry depth-2; this substitution-seat's config caps at max:1, so the row files the depth-1-proven + depth-2-cap-HONEST-LIMIT shape (consistent with the prior-cycle `473f0e6` TEST-1 depth-cap REJECT finding).

## Files
- `depth2-chain-journal-c814979.txt` — the live chain journal (B ran + dispatched + relayed + depth-2 cap-reject), deployed c814979
- `b-depth1.txt` — B (depth-1) execution marker on c814979

## Note
The token-fix doesn't touch `continue_delegate` (delegate-chain uses `[[CONTINUE_DELEGATE:]]`, the bracket that DOES exist — unaffected by 🪨's bare-CONTINUE_WORK-token finding). Up-tree-silent-wake proven to depth-1 live on the deployed head; depth-2 is the configured-depth-cap honest-limit.
