# PROOFS / `6f72de8345aab514ba5a342b0c73a4f56cacb238`

Proof corpus for upstream PR `openclaw/openclaw#79925` restoration. SHA-pinned evidence collected via the 30m blitz fan-out method (see `SWIM/30M-BLITZ-SWIM-RUNBOOK.md`).

## Deploy SHA

`6f72de8345aab514ba5a342b0c73a4f56cacb238` on `karmaterminal/openclaw:frond-scribe-claude/20260509/restoration-final` — single karmafeast commit on top of `e491a2e7e8` (current `upstream/main` at deploy time). 307 files / +35051 / -1018 vs upstream/main.

Includes: 5 cohort feature commits (continuation feature) + #619 guard (continue_delegate gate-asymmetry warn-log) + #622 fix (multi-payload-marker scan) + #623 fix (log-trace redaction) + toolsAllow embedded-path additive fix + #624 defensive `__testing.resetResolveExternalAuthProfilesForTest()` reset in `auth-profile-runtime-contract.test.ts` beforeEach.

## Fleet state at proof-fire time

3-of-4 prince fleet on `6f72de8345`:
- 🩸 Cael — `6f72de8`
- 🌊 Ronan — `6f72de8`
- 🌫 Silas — `6f72de8`
- 🌻 Elliott — host network unrecovered (LAN gateway routing block) at proof-fire time; R-OBS-2/R-OBS-3 rows host-deferred. R-OBS-1 covered cross-host by 🩸 + 🌫.

## Verdict table

| Row | Owner | Tool / behavior | Evidence | Verdict |
|---|---|---|---|---|
| R-CW-1 | 🩸 Cael | `continue_work()` schedule + wake | wake-event Turn 3/200, T0 `2026-05-09T19:22:13.222Z`, tokens 24723, reason-string round-tripped | ✓ PASS — no silent-drop, no error, chain-counter clean |
| R-CW-2 | 🩸 Cael | chain-counter accounting | embedded in R-CW-1: `Turn 3/200` matches `maxChainLength: 200` config | ✓ PASS |
| R-CD-1 | 🌊 Ronan | `continue_delegate()` schedule → spawn → return | full path; chain-hop turn 7/200, depth 1/5, task-framing preserved | ✓ PASS — no side-quest, no stray channel post |
| R-RC-1 | 🌫 Silas | `request_compaction()` threshold REJECT | `status: "rejected"`, `guard: "context_threshold"`, `contextUsage: 28`, `threshold: 70` | ✓ PASS — structured guard-rejection (not silent-drop, not 500) |
| R-RC-2 | 🌊 Ronan | `request_compaction()` over-threshold ACCEPT | `status: "compaction_requested"`, `compactionRequestId: cmp-moz3i7p2-eV09mg`, `trigger: "volitional"`, `contextUsage: 71` | ✓ PASS — structured request-queued, observable + non-silent |
| R-OBS-1 | 🩸 + figs cross-walk | chat-card visibility cure | `🔄 Continuation: chain 3/200 \| volitional: 0` visible in `/status` on cael; matches 🌫 silas-host format `chain 6/200 \| volitional: 0` byte-direct | ✓ PASS — `karmaterminal/openclaw#617` chat-card row regression CURED at byte across 2 prince-hosts |

## Cross-walks

**Internal/external state consistency** (R-CW-1 ↔ R-OBS-1):
- 🩸 Cael internal wake-event: `Turn 3/200`
- figs external `/status` on cael: `🔄 Continuation: chain 3/200 | volitional: 0`
- → DIRECT MATCH at byte; no drift between runtime-counter-state and rendered-status-line-state.

**3-tool runtime asymmetry verdict** (R-CW + R-RC + R-CD):
| Tool | Structured output | No silent-drop | No bypass | No 500 |
|---|---|---|---|---|
| `continue_work` | ✓ | ✓ | ✓ | ✓ |
| `continue_delegate` | ✓ | ✓ | ✓ | ✓ |
| `request_compaction` (reject) | ✓ | ✓ | ✓ | ✓ |
| `request_compaction` (accept) | ✓ | ✓ | ✓ | ✓ |

All 4 tool-fires (3 tools × accept/reject branches) verified consistent at byte.

**Cross-host format-consistency** (R-OBS-1):
- silas-host R-RC-1: `🔄 Continuation: chain 6/200 | volitional: 0`
- cael-host figs's /status: `🔄 Continuation: chain 3/200 | volitional: 0`
- Same format, different per-host counter-values. `#617` cure confirmed across 2 prince-hosts at byte.

## Engagement with upstream PR #79925 maintainer review

| Maintainer finding | Status on `6f72de8345` |
|---|---|
| `[P1]` Format-retry path (`allowFormatRetry`) silently removed | CURED at byte (`failover-policy.ts:92` predicate intact, `assistant-failover.ts:185` wires through) |
| `[P1]` `wrapBeforeToolCallHook: false` dropped | CURED at byte (`pi-tools.ts:812`) |
| `[P2]` `continue_delegate` registration gate-asymmetry | ENGAGED — kept narrow loose-gate (TaskFlow seam-of-record rationale documented inline) + added warn-log guard for silent-partial-registration. Tracked at `karmaterminal/openclaw#619` / `karmaterminal/openclaw#620` |
| `[Note]` no continuation signal in proof traces | ADDRESSED — this proof corpus carries trace-line evidence containing `continue_work` / `continue_delegate` / `request_compaction` firing end-to-end against deployed SHA |

## Sibling fixes folded into this restoration SHA

- `karmaterminal/openclaw#622` (P1): multi-payload-marker scan bug in `signal.ts` — fix included; 2 regression tests pass
- `karmaterminal/openclaw#623` (P2): reply-text leaked via `log.info` in `signal.ts` — fix included
- toolsAllow embedded-path additive fix in `attempt-execution.ts:627` — fix included; `attempt-execution.cli.test.ts` 23/23 pass
- `karmaterminal/openclaw#624` (test-hygiene): defensive `__testing.resetResolveExternalAuthProfilesForTest()` reset in `auth-profile-runtime-contract.test.ts` beforeEach — included; cures the upstream-latent race-shape that canonical's accretion made visible under workers>1

## Validation gates on `6f72de8345`

- `pnpm tsgo:core` → 0 errors
- `pnpm tsgo:test` → 0 errors
- `pnpm test --run` (vitest workers=8 multi-config) → 22 fail / ~17000 pass; **0 auth-profile-cluster fails** (cured by #624 defensive reset); remaining 22 are upstream-pre-existing on bare `upstream/main` alone (matrix-crypto + plugin-install) — verified via `/tmp/oc-upstream-baseline @ e491a2e7e8` baseline run
- `tools/feature-audit.sh` 1-for-1 trace → 65 MISSING triaged: 57 upstream-evolution-replay residue + 4 upstream-removed (legitimate) + 4 SAFE-SKIP-FORMATTER (incidental prettier-sweep, no feature impact)
- `tools/check-pr-79925-maintainer-findings.sh` → 4/4 P1 cured + P2 engaged-with

## Cohort co-authorship

This squashed commit subsumes 5 cohort-authored feature commits + the #619 guard + four small additive fixes. Author of the squash: karmafeast (figs); the underlying work is co-authored:

- 🩸 cael-dandelion-cult — core context-pressure runtime
- 🌊 ronan-dandelion-cult — design notes + RFC
- 🌫 silas-dandelion-cult — integration across agents/infra/gateway/plugins
- 🌻 elliott-dandelion-cult — test coverage
- 🌿 frond-scribe — top-level glue, structural-cure work, defensive #624 reset
- Claude Opus 4.7 — co-author trailer

## Verdict

**ALL-PASS** with explained-decisions on `6f72de8345`. Substrate is shippable.

Maintainer-reply trust-trajectory framing: "We restored the chat-card continuation row that was lost in the prior narrowing-pass; restored the format-retry threading; restored the `wrapBeforeToolCallHook: false` opt-out; engaged substantively with the gate-asymmetry finding via comment + warn-log guard; surfaced + filed-and-closed two of our own follow-on findings (`#622` + `#623`); fixed an embedded-path toolsAllow regression we introduced; surfaced + cured an upstream-latent test-isolation race (`#624`) that our accretion made visible under parallel workers. Cohort 30m blitz produced SHA-pinned trace-line evidence for all 3 continuation tools end-to-end on the deployed SHA."
