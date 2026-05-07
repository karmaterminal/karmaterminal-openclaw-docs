# Lesson — v5.5 deployed substrate journal-vocabulary divergence from source-code

**Lesson ID:** L-v5.5-journal-vocabulary
**Date surfaced:** 2026-05-07
**Surfaced by:** cohort byte-walks during swim-43 row-03 spiral + swim-44 row-01 first-fire
**Type:** substrate-discipline (applies to any continuation-substrate row author)

---

## Summary

On deployed v5.5 of openclaw, the user-systemd journal (`journalctl --user -u openclaw-gateway`) surfaces a **subset** of the log lines emitted by source code. Source-code-inferred expectations of what should appear in the journal will systematically miss bytes that don't surface and over-expect bytes that do.

**Concrete pattern observed across multiple code paths**:
- Lines emitted via `defaultRuntime.log(...)` from `agent-runner.ts` **DO** reach the user-systemd journal.
- Lines emitted via `log.info(...)` from `scheduler.ts`, `delegate-dispatch.ts`, etc. **DO NOT** reach the user-systemd journal at the deploy-default verbosity/destination.

This is a deploy-config divergence, not a substrate bug. The lines exist in code; they route somewhere other than user-systemd, OR are filtered at info-level on deployed hosts.

## Why this matters for row authors

If you write a row spec by reading source code and listing every `log.info(...)` and `log.debug(...)` and `defaultRuntime.log(...)` literal as "expected PASS bytes," your gather will fire and your narrowed grep will return a partial-or-empty match against a substrate that genuinely DID work. You will then either:

- Interpret the missing literals as substrate-broken (file an issue against substrate that isn't broken)
- Trip the row's METHOD-BROKEN verdict-state (correct outcome if the row template has it) and fix the spec
- Spend cohort cycles in chat reconciling what your code-walk said against what the journal showed

This is the failure mode that produced ~6 hours of cohort-channel reconciliation on swim-43 row-03 (2026-05-07 morning, 04:00–10:00 PDT).

## Concrete observed cases

### Case 1 — delayed `continue_work(N)`

Source code has three emit points around the fire:
- `scheduler.ts:108` — `log.info('[continuation] WORK timer set: delayMs=...')` at arm-time
- `scheduler.ts:114` — `log.info('[continuation] WORK timer fired ...')` inside setTimeout callback
- `agent-runner.ts:2561` — `defaultRuntime.log('WORK timer fired for session ...')` (no `[continuation]` prefix)

Byte-walked on cael-host + elliott-host + silas-urudyne (three hosts independent):
- ZERO `[continuation] WORK timer set` lines in journal under any conditions
- ZERO `[continuation] WORK timer fired` lines in journal
- ONE `WORK timer fired for session ...` (unprefixed) line in journal at T0+N±30s

**Substrate truth**: only `defaultRuntime.log` line surfaces. The two `[continuation]`-prefixed `log.info` lines do not.

**Implication for row spec**: do NOT search for `[continuation] WORK timer set` or `[continuation] WORK timer fired`. Search for the unprefixed `WORK timer fired for session <session-id>` literal only.

**Diagnostic implication**: because `WORK timer set` doesn't appear, "did the tool-call reach the scheduler" is NOT byte-decidable from journal alone. The only way to disambiguate "tool-call didn't reach scheduler" vs "scheduler armed but setTimeout didn't run" is the session-side `{status: "scheduled"}` return value from the `continue_work()` tool-call.

### Case 2 — `continue_delegate(silent)` mode

Source code has emit points in `agent-runner.ts` (dispatch path) + `continuation/delegate-dispatch.ts` (delegate-spawned path).

Expected from source-code reading: two literals — `Consuming N tool delegate(s)` AND `[continuation:delegate-spawned] hop=N/MAX mode=...`.

**Initial single-host byte-walk (cael-host, swim-44 row-01, 2026-05-07 08:50:22 PDT, extended window 4x)**:
- ONE `[continue_delegate] Consuming N tool delegate(s) for session ...` line
- ZERO `delegate-spawned hop=` lines

**Cross-host byte-walk (elliott-host, swim-44/row-02-elliott-host-cross-walk-probe, 2026-05-07 09:27:50 PDT)** — same v5.5 SHA `24b76bf`, different host, same fire-shape (silent-mode `continue_delegate`):
```
May 07 09:27:50 elliott node[1664094]: [continuation/delegate-dispatch] [continuation:delegate-spawned] hop=1/200 mode=silent session=agent:main:subagent:321049b4-d615-4e7f-889c-d4eced6f704b task=swim-44/row-02-elliott-host-cross-walk-probe ...
```

Elliott-host DID emit the `delegate-spawned hop= ... mode=silent` literal. Same code path, same v5.5 binary, different host — different result.

**Substrate truth (cross-host-corrected)**: silent-mode `continue_delegate` MAY emit both `Consuming N tool delegate(s)` AND `[continuation:delegate-spawned] hop=N/MAX mode=silent` literals; the second literal is observed firing on at least one host (elliott-host) under at least some fire-conditions. The cael-host swim-44 row-01 fire that produced ZERO `delegate-spawned hop=` lines is host-divergent OR fire-condition-divergent from the elliott-host emission, NOT silent-mode-design-intent.

Do NOT write a row's silent-mode PASS-bytes assuming the second literal won't fire. Both literals are valid PASS-bytes for silent-mode under at least some conditions. The cael-host single-host pattern of expected-literal-not-firing may be related to issue #21 (cael-host swim-43 row-03 first-fire anomaly: tool-call-didnt-reach-scheduler vs setTimeout-didnt-run vs journal-lost-line) and issue #24 (this disambiguation, reopened with cross-host evidence).

**Comparison with normal mode**: row-04 from swim-43 morning (normal-mode delegate, cael-host 2026-05-06 23:31:35 PDT) emitted `Consuming` + `[continuation:delegate-spawned] hop=6/200 mode=normal` per swim-43/B3 PASS evidence. Both modes emit both literals at least sometimes; the cael-host pattern of silent-mode-fires-without-delegate-spawned-literal is the substantive open question, not a clean silent-vs-normal-mode divergence.

## Cure for row authors

**Code-walk informs the *what should appear* hypothesis. Byte-walk verifies the *what does appear* truth. Never cite source-code-emissions as journal-bytes without byte-walking the deployed journal first.**

In practice for a continuation-substrate row:

1. Read source code to identify candidate emission points.
2. Fire the test once on the SUT in a quiet window.
3. `journalctl --user -u openclaw-gateway --since '<T0>' --until '<T0+window>' --no-pager` — RAW, no grep.
4. Read raw output. See what the substrate actually emits in your window.
5. Build the row's PASS-bytes literal from observed-in-journal vocabulary, not from code-source-inference.
6. Build the harness script's narrow grep from observed vocabulary.
7. If a future fire returns zero matches under the narrow grep but raw shows substrate activity, the row's METHOD-BROKEN verdict-state catches it — fix the spec, do not interpret as substrate-broken.

The post-PR-13 + PR-15 row-issue-template structurally enforces this: `Gather` field as path-to-script-in-row-dir, PASS-bytes / FAIL-bytes / Result / Verdict / METHOD-BROKEN structure, truth-floor-reach as ordered investigation procedure when narrowed gather returns 0. Use it.

## Related substrate-knowledge

- `SWIM-METHODOLOGY.md:90` — *"grep before claiming. SSH before asserting. Read before speaking."* This lesson is the v5.5-specific instantiation of that principle: read RAW journal before constraining grep.
- `SWIM/templates/row-issue-template.md` — post-PR-13 + PR-15 template with measurement-protocol fields. This lesson is the substrate-knowledge that makes the template's PASS-bytes field fillable correctly.
- swim-44/row-01 (`cael/swim-44-row-01-continue-delegate-silent-wake`) — first canonical-template-shape row demonstrating METHOD-BROKEN catching the source-code-inference vs byte-walked divergence in real fire.

## Why this lesson lives here

The substrate-knowledge is durable across swims. Any future continuation-substrate row author will hit this divergence if they author from source-code-reading without byte-walking. Documenting the divergence + the cure here means the next author finds it before re-deriving the byte-walk through a cohort-cycle.

If the underlying log-routing divergence between `log.info` and `defaultRuntime.log` ever gets resolved on deployed v5.5+N (e.g. via deploy-config change that surfaces `log.info` to user-systemd), update or supersede this lesson. Until then, the divergence stands as a real property of the deployed substrate that row specs must accommodate.
