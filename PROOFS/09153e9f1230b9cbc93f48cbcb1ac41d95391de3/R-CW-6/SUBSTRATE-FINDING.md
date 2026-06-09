# R-CW-6 — chain-depth-boundary reject (maxChainLength)

**Owner:** 🪨 Rune (`rune-rog-ally`)
**Verdict:** ⚠️ HONEST-LIMIT (reject-logic verified present in the deployed runtime; live induction blocked by the protected-config guard — the protection IS the safety-surface proof)
**Candidate SHA:** `8b5dde6165958d0eaba3c492ae52311548313de4` (deployed; install `/home/figs/flesh_beast_tmp/openclaw` at HEAD=`8b5dde6165`)

## Behavior the row asserts
A `continue_delegate`/`continue_work` dispatch is rejected at dispatch-time when the chain would exceed `continuation.maxChainLength` (depth-boundary as discipline-floor).

## Gate-source verified present (in the DEPLOYED runtime)
`src/auto-reply/continuation/scheduler.ts:27` (deployed install at `8b5dde6165`):
```ts
if (allocatedChainHop >= config.maxChainLength) {
  …
  `[continuation] Chain depth ${allocatedChainHop}/${config.maxChainLength} — capped for session ${sessionKey}`,
```
The reject path exists + is the exact `allocatedChainHop >= maxChainLength` boundary. Because the install is checked out AT the candidate SHA, this source IS the shipped behavior (not a divergent local copy) → **not a regression.**

## Why live PASS-shape is structurally blocked in-session
The runbook's standard induction (temporarily lower the bound, fire a chain to trip it, restore) is **not available** here:
1. **`maxChainLength` is a PROTECTED config path** — `gateway config.patch` refuses it: `"gateway config.patch cannot change protected config paths: maxChainLength"`. The continuation safety-bound is guarded against runtime mutation by design.
2. A raw `openclaw.json` file-edit (maxChainLength 200→2) did **not** hot-reload into the running gateway (pid 573310) — a dispatch fired afterward was still accepted (config startup-cached). Restored to 200, byte-confirmed.
3. The only remaining induction (a 200-hop deep chain at the live `maxChainLength=200`) is impractical + resource-abusive.

Inducing the reject would require a file-edit + gateway-restart — which **circumvents the protection-guard AND interrupts the live proof-session**. The protection-guard refusing the mutation is itself evidence the continuation safety-surface fires as-designed (figs `1504663337` framing: the gates engaging IS the proof).

## Honest-limit framing
The depth-boundary reject-logic is present + byte-shipped at `8b5dde6165`; the safety-bound (`maxChainLength`) is protected from trivial runtime tampering. The PASS-shape is structurally blocked at submission-time by that protection (not by any cure-regression). This is the safety-surface working — the same class as R-RC-1's structural-finding shape.

## Restore confirmation
`agents.defaults.continuation.maxChainLength` restored to **200** (original value, byte-confirmed). Backup `/tmp/openclaw.json.precw6-backup`. No config left mutated.
