# k6 PROOFS — Safety Row Manifest (#104)

Safety classification for the compaction / config / observer row families. Every
safety-sensitive row is marked **safe** · **serialized** · or **requires-human-confirmation**,
with the guardrails that gate it. This is the design/manifest deliverable for
[#104](https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/104);
scenario implementation splits by row family after review.

> **Rule of the manifest:** a runner (prince or coding-agent) consults this table
> BEFORE firing any row below. If a row is `serialized` or `requires-human-confirmation`,
> the listed precondition is mandatory, not advisory.

## Safety tiers

| Tier | Meaning | Runner obligation |
|------|---------|-------------------|
| **safe** | Read-only or non-mutating; no live session state changed | Fire freely; still record SHA/session/provider |
| **serialized** | Mutates live session/gateway state; must not overlap other rows on the same session | Acquire the session exclusively; never run in parallel with continuation/delegate rows on that session |
| **requires-human-confirmation** | Triggers irreversible-in-session effects (compaction) or live config mutation | A human (or explicit pre-authorized run) confirms before the accept-path fires |

## Row classification

### request_compaction family — `R-RC-*`

| Row | Owner | Tier | Guardrail |
|-----|-------|------|-----------|
| `R-RC-1` (threshold REJECT) | silas | **serialized** | Requires a low-context main session. REJECT path is non-mutating (compaction does NOT fire) — but it reads/asserts live context %, so serialize against other rows on that session. **Run this BEFORE R-RC-2.** |
| `R-RC-2` (over-threshold ACCEPT) | cael | **requires-human-confirmation** | Compaction FIRES — context is reclaimed and the successor session wakes; the pre-compaction working set is gone from the live window. Confirm before firing. Needs context >70% (real) or a lowered threshold. |

**Why compaction is the sharpest safety surface (byte-walked at HEAD `82827d3cbcb`):**
- The compaction call is bounded by the **config-valued safety timeout**, not the SDK child.
  `compaction-safety-timeout.ts` → `resolveCompactionTimeoutMs(cfg)` (:59) reads
  `agents.defaults.compaction.timeoutSeconds`, default `EMBEDDED_COMPACTION_TIMEOUT_MS = 180_000`
  (180s). The copilot-SDK `rpc.js` `sendRequest` is bare (no timeout) — the ceiling is **our wrapper**.
- **Serialization is load-bearing, not hygiene.** Compaction acquires a session-write-lock for the
  duration of its hold-budget while the LLM summarization call runs. A second acquirer on the same
  session (a continuation/delegate row, a `/new`, a tool-result truncation) waits on a shorter
  acquire-timeout and throws `SessionWriteLockTimeoutError` — the **asymmetric lock-timeout cascade**.
  This is exactly why R-RC-* must never run in parallel with continuation/delegate rows on the same
  session. Run compaction rows alone, on a dedicated session.
- **Caps/threshold note:** to exercise the accept path without waiting for organic 70% fill, lower the
  threshold via config — but config patches do **not** propagate to a running scheduler; restart-to-arm.

### Observer family — `R-OBS-*`

| Row | Owner | Tier | Guardrail |
|-----|-------|------|-----------|
| `R-OBS-1` (external /status + 6-prince cross-walk) | elliott | **safe** | Read-only. Queries `/status` + OTel/Tempo across seats; mutates nothing. Record the SHA each seat is on. |
| `R-OBS-2` (Tempo trace-tree visualization) | rune | **safe** | Read-only. Exports existing span trees from Tempo; no live mutation. |

Observer rows are pure reads — they observe state continuation/delegate rows already produced.
They may run anytime, including concurrently with other reads. They do **not** themselves fire
continuation primitives, so they carry no serialization constraint.

### Config family — `R-CONFIG-*`

| Row | Owner | Tier | Guardrail |
|-----|-------|------|-----------|
| `R-CONFIG-DEFAULTS` (bootstrap defaults) | emeric | **serialized** | Asserts a fresh gateway boots with `continuation.enabled=true` + defaults populated. Best run against a dedicated/fresh gateway, not a live prince mid-work — a bootstrap assertion on an active seat races real traffic. |
| `R-CONFIG-INTERSESSION` (config persists across sessions) | emeric | **serialized** → **requires-human-confirmation** if it mutates live config | Read-only assertion of persistence = serialized. If the row actively **changes** config to test survival, that's a live gateway mutation → requires-human-confirmation, and the mutation must be narrow + reversible (capture prior value, restore after). |

## Cross-cutting mandates (apply to every safety row)

1. **Record exact context** — deployed SHA, session key, provider/model. The proof is only legible
   against the precise runtime it ran on.
2. **Keep live gateway mutation narrow and reversible** — capture the prior value, make the smallest
   change, restore after. No broad config rewrites.
3. **No secrets in source or artifacts** — gateway credentials and provider keys stay in gh-actions
   repo secrets; never commit them, never let them land in an EVIDENCE artifact or trace export.
4. **Serialized rows run alone on their session** — never parallel with continuation/delegate rows on
   the same session (see the lock-cascade note above).
5. **Threshold-reject before threshold-accept** — always exercise the REJECT/preflight path before the
   ACCEPT path, so the guard is proven before the irreversible action.
6. **Candidate status until human-folded** — every run is PASS-candidate / HONEST-LIMIT-candidate /
   FAIL-candidate until a human folds it into canonical `PROOFS/<sha>/`.

## Implementation split (post-review)

This manifest is the design pass. Implementation can proceed per family, in safety order:
1. `R-OBS-1` / `R-OBS-2` (safe, read-only) — lowest risk, can land first.
2. `R-CONFIG-DEFAULTS` / `R-CONFIG-INTERSESSION` (serialized) — against a dedicated gateway.
3. `R-RC-1` (serialized REJECT) — proves the guard.
4. `R-RC-2` (requires-human-confirmation ACCEPT) — last, with confirmation.
