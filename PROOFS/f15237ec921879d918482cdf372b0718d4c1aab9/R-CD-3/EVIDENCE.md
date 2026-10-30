# R-CD-3 at `f15237ec92`: **missing** (corrected 2026-10-30; previously folded partial)

Stage continue_delegate(mode=post-compaction), then call request_compaction.

- Candidate verdict: PASS-candidate (trace correlation failed; envelope withheld)
- Review: reviewed: frond-scribe (single seat), 2026-10-30
- Summary: Behavior observed, but continuation trace correlation failed, so the candidate envelope was withheld. Same class as at 08c37a1562 and 293c977f62: product span gap openclaw#1497 (a lifeboat release emits no delegate span). Last-known: 08c37a1562 partial for the same reason.
- owner: product: openclaw#1497
- Canonical run (matrix-012943Z): `20261030T013104Z-r-cd-3-44aa4c89` under `emeric-isolated-composite/`

Runtime and candidate `f15237ec921879d918482cdf372b0718d4c1aab9` on emeric's isolated gateway `:18800` (state `~/proof-gw/comp-f15237ec`, sign-in moved by adopt-auth from comp-08c37a15), docs harness `215235ed73a6926a0610d91814b02f25a4836ed1`. Nothing is transposed from F, P' or the live composite.

## Correction (2026-10-30, frond-scribe; 🌊 go 20:02Z)

The earlier fold said "Behavior observed". **That was false.** The lifeboat never fired.

**What the proof session shows.** This is the disposable session's own transcript on the isolated proof gateway `comp-f15237ec`, read-only, metadata and tool results only:
1. seq 2–3: `continue_delegate(mode="post-compaction")` → `queued-for-compaction`.
2. seq 6–7: `request_compaction` → `rejected`, `guard: context_threshold`, *"Context usage is unknown for this session"*. The session was fresh and on its first turn, so it had no measured usage: `computeRequestCompactionContextUsage` returns null (`src/auto-reply/reply/agent-runner-post-compaction-release.ts:155-157` at F′).
3. seq 10: the agent's `RCD3-THRESHOLD-LIMIT … CONTEXT unknown` sentinel.
4. The session ends there, at 11 events. No compaction, no release, no fire.

**Why the harness recorded a return.** The lifeboat task text contains *"reply exactly RCD3-LIFEBOAT-RECEIVED <nonce>"*, and the scenario matches that sentinel in any event without the harness marker. The agent's own `continue_delegate` call carried it, so "lifeboat return observed" was set at 5.1 s, and the socket closed before the rejection arrived.

**State.** There is no authoritative receipt of the row's behavior, so this row is now **missing**. The earlier partial assumed the behavior had been proven. No verdict is raised.

**Owners:**
- **harness:** the sentinel is inside the task text, and a fresh first-turn session can't reach compaction;
- **product, openclaw#1497:** the lifeboat release emits no `continuation.delegate.dispatch`/`.fire` span;
- **product, the rejection text:** a live runner's unknown usage is reported as "inventory-only paths".

Findings: karmaterminal/openclaw-bootstrap#1727 comment 6532342767. The same scenario and fold made the same false claim at `08c37a1562` (F) and `293c977f62` (j9). Those corpora are superseded and are not edited here.
