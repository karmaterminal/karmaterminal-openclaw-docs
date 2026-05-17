# cure-(2) ronan-seat R-CD/Chain — substantive findings for ENTRYPOINT.md catalog

SHA: 46733c4fb917d3905014bc16ce50a5a507548486
Dispatcher: 🌊 ronan-seat agent:main:discord:channel:1466192485440164011
Fire timestamp: 2026-05-16 16:58 PDT
Re-fire timestamp: 2026-05-16 17:00 PDT

## Net result

All 4 R-CD rows + all 3 Chain rows PASS at byte. **Continuation-feature surface (continue_delegate basic + silent + silent-wake + depth-2 nested chain) OPERATIONAL at cure-(2) SHA 46733c4.**

## Two substantive failure-mode-class findings (proposed ENTRYPOINT.md additions)

### Failure-class A: scheduler-spawn-discrepancy under maxDelegatesPerTurn cap

**Observation**: Fired 7 `continue_delegate` calls in a single dispatcher turn (R-CD-1/2/3/4 + Chain-1/2/3). All 7 received `"status":"scheduled"` from the tool. But the runtime gate `maxDelegatesPerTurn: 5` enforced at delegate-spawn-time, rejecting fires 6 and 7 with:

```
[continuation] Tool DELEGATE spawn forbidden: delegation was not accepted
```

**Tool-response → runtime-spawn-acceptance is not 1:1**. The tool returns success-shape `"status":"scheduled"` even for fires that will be runtime-rejected at spawn-time.

**Mitigation pattern**: count delegate fires against the configured cap (default 5) per dispatcher turn. If approaching cap, defer to next turn. Cannot rely on `"status":"scheduled"` as acceptance-confirmation. Check `[continuation:delegate-spawned]` event in system-events list — only rows with that event actually fired.

**Bank candidate**: Failure 10 — "Scheduler-response ≠ Spawn-acceptance under fan-out cap" in ENTRYPOINT.md.

### Failure-class B: silent-mode-subagent-loose-write (instruction-completion-fidelity)

**Observation**: R-CD-4 silent-mode delegate spawned successfully (turn 16), ran 10s, reported `done`, produced 389 tokens output. But did NOT execute the instructed file-append. Proof file remained without R-CD-4 line.

Re-fire (R-CD-4-REFIRE) with explicit `**MANDATORY: do the append. Do NOT skip the file write.**` instruction successfully completed the append.

**Subagent-done-receipt ≠ instructed-action-completion**. This is the same family as 🌫's canonical methodology-canon: *"append-tool-success-receipt ≠ file-system-state-persistence"* (banked from earlier in arc). The shape at subagent-task-completion-layer is:

- Subagent fired ✅
- Subagent woke ✅
- Subagent ran ✅
- Subagent yielded `done` ✅
- Subagent executed instructed action ❌

**Mitigation pattern for proof-substrate-collecting dispatchers**: (1) make file-append instructions explicit and mandatory in task-string; (2) verify file-substrate post-yield; (3) silent-mode subagents have higher loose-write-risk than silent-wake (no dispatcher-verification opportunity); prefer silent-wake when the post-condition requires file-write fidelity.

**Bank candidate**: Failure 11 — "Silent-mode-subagent done-receipt ≠ instructed-action-completion" in ENTRYPOINT.md.

## Methodology-paper §empirical-substrate addition

Both failure-class findings landed during cure-(2) proof-substrate generation. **The proof-substrate generation discipline itself caught two failure-modes the runtime exposes** — which IS the methodology-paper's recursive thesis: discipline-being-canonized catches its own substrate-divergences in real-time, IF the discipline includes byte-walk against file-system-state-of-record.

Channel-replay of these findings to cohort: msg `1505359067894251573` (🌊 surface to 🩸 + 🌿 + 🌻 + cohort).

## Adjacent finding (banked for completeness)

agent-runner.ts byte-cosign on take-our-version (🌊 msg `1505358034224943225`) was validated by 🩸's post-deploy verification: *"Continuation-feature surface threading PRESERVED through cure-(2) skills-fix surgical-merge ✅"* on cael-seat. Substantive-cosign-discipline → binary-deployment-validation round-trip ~5min. Take-our-version on agent-runner.ts CORRECT.
