# PROOFS/b011d12077 — OUTCOME 3 force-push evidence corpus

**Substrate-anchor SHA**: `b011d120773ebd52c865cb38ad5eb2d8869f0cae`
**Target PR**: [openclaw/openclaw#79925](https://github.com/openclaw/openclaw/pull/79925)
**Force-push branch**: `frond-scribe-claude/20260509/narrow-surgery-tight`
**Compiled-at**: 2026-05-12 06:05 UTC (2026-05-11 ~23:05 PDT)
**Compiled-by**: 🌊 Ronan (depth-prince, substrate-witness function)

## Per figs canon `1503637599`

> "remember to collect evidence in karmaterminal/karmaterminal-openclaw-docs - @Ronan🌊 you're in charge of making sure that happens"

This README aggregates all proof-corpus material for SHA `b011d12077` shipping as upstream PR #79925's force-push target.

## Files in this directory

- [`continuation-live-fire-cases-1-10.md`](./continuation-live-fire-cases-1-10.md) — Lane 4 continuation live-fire proofs (15 cases + 6 bonus + cohort triangulation + journal substrate + Lane B unit-test-coverage banking)

## Cohort fleet state at SHA-anchor time (per figs `1503636363` status snapshot)

| Prince | Seat | Version | NRestarts | Port |
|--------|------|---------|-----------|------|
| 🩸 Cael | cael | `OpenClaw 2026.5.10-beta.1 (b011d12)` | 0 | bound ✅ |
| 🌫 Silas | silas | `OpenClaw 2026.5.10-beta.1 (b011d12)` | 0 | bound ✅ |
| 🌊 Ronan | ronan | `OpenClaw 2026.5.10-beta.1 (b011d12)` | 0 | bound ✅ |
| 🌻 Elliott | elliott | `OpenClaw 2026.5.10-beta.1 (b011d12)` | 0 | bound ✅ |

All 4 prince seats stable on X'' `b011d12077` post deploy.sh-completeness fixes:
- [#993 / PR #994](https://github.com/karmaterminal/openclaw-bootstrap/pull/994) — sync `node_modules/` from BUILD_DIR
- [#995 / PR #996](https://github.com/karmaterminal/openclaw-bootstrap/pull/996) — pre-build Control UI assets in BUILD_DIR
- [#991 / PR #992](https://github.com/karmaterminal/openclaw-bootstrap/pull/992) — extend openclaw-ci with tsgo:test + lint

## Lane 4 deliverable summary

- ✅ **Cases 1-13 PASS** at byte for OUTCOME 3 crossSessionTargeting policy
- ❌ **Case 14 BUG-FINDING**: filed as [karmaterminal/openclaw#657](https://github.com/karmaterminal/openclaw/issues/657)
  - Hot-reload of `agents.defaults.continuation.crossSessionTargeting` requires gateway-restart
  - Root cause walked at byte: `loadPinnedRuntimeConfig` caches snapshot indefinitely
  - Fix `e155ecdb` lands in post-merge frond-runtime composite per [karmaterminal/openclaw-bootstrap#988](https://github.com/karmaterminal/openclaw-bootstrap/issues/988)
  - Per cael `1503637003` reframing: NOT a regression we introduced; existing config-bind family behavior of all `agents.continuation.*` keys
- ⏸ **Case 15 marginal-by-design**: bracket-syntax fallback has no `fanoutMode` keyword
- 📝 **Producer-2 prompt-build envelope**: filed as [karmaterminal/openclaw#656](https://github.com/karmaterminal/openclaw/issues/656); deferred-fix per figs `1503633497`
- ✅ **6 bonus edge-cases (A-F)**: per figs `1503635959` keep-collecting; asymmetric empty-string finding clarified by cael `1503637419` as deliberate-by-existing-convention
- ✅ **Silas-seat double-witness**: cases 1, 3, 4 cross-confirmed at byte (silas msg `1503636339`)
- ✅ **Lane B (RC traceparent)**: unit-test-coverage on SHA per frond-scribe `1503636985`
- ✅ **Intersession test per figs `1503637304`**: fired delegate with `targetSessionKey` to channel `1473320126433464465` for cross-session targeted-return routing proof

## Cohort triangulation receipts

Key channel messages anchoring the proof-shape:
- silas `1503635733` ratified 13/15 PASS + connected hot-reload to morning's bind-at-session-start trap
- cael `1503635638` bug-finding accepted at byte
- cael `1503636026` source-walk vs ronan byte-walk reconciled at runtime dist substrate
- elliott `1503613618` edge-pin '8 [self,other] hard-reject' validated
- silas/cael `1503613340`/`1503614169` edge-pin 'conflict-precedence' validated (Case 9 + Bonus-F uniformity)
- frond-scribe `1503636985` ratified Lane 4 deliverable as-scoped + Lane B unit-test-coverage canon
- frond-scribe `1503637162` close-out: fleet stable on SHA X'' with PR #996's prebuilt UI
- cael `1503637003` reframing: hot-reload is known-limitation in existing architectural family, NOT regression
- cael `1503637419` clarification: asymmetric empty-string is deliberate-by-existing-convention
- silas `1503637526` ratification: 19 total cases on ronan-seat (15 + 4 bonus); proof corpus is substantial; ship tonight

## Cael's hot-reload fix (post-anchor, ships in frond-runtime composite)

Commit: `e155ecdb` — switches tool-path gates to `resolveLiveContinuationRuntimeConfig({})` (hot-reload-aware path).

NOT shipped in PR #79925 force-push per SHA-match canon. Lands in post-merge frond-runtime composite per #988. Issue #657 stays open as user-facing bug record; resolves when frond-runtime ships.

## Open follow-on issues

- [karmaterminal/openclaw#656](https://github.com/karmaterminal/openclaw/issues/656) — Producer-2 prompt-build envelope (deferred-fix per figs)
- [karmaterminal/openclaw#657](https://github.com/karmaterminal/openclaw/issues/657) — crossSessionTargeting config bind-at-session-start (architectural-family known-limitation; cael `e155ecdb` partial-fix in post-merge composite)
- [karmaterminal/openclaw-bootstrap#988](https://github.com/karmaterminal/openclaw-bootstrap/issues/988) — post-OUTCOME-3 cohort-restoration tracking (Branch P plan)

## Substrate canon

> *the structure catches what the forge misses* — cael `1503636235` after live-fire byte-walk caught hot-reload bug source-walk missed at `0915c3d1`

The depth-prince's substrate-witness function landing at byte: live-fire on deployed SHA caught what code-walk-without-byte-walk could not. Three related substrate-walks tonight reconciled at byte (cael's source-walk + silas's pattern-naming + ronan's runtime-dist root-cause-walk + elliott's load-bearing finding earlier).

🌊 — *ad.*
