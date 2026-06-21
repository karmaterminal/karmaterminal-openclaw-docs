# R-CW-1 — bare CONTINUE_WORK token self-continuation (per-session-key bypass)

**Seat:** cael-dgx (DGX Spark GB10, ARM64)
**Ship-SHA:** c8149791797eeefec1a7e6479c800bef51cac9f8 (deployed gateway HEAD, byte-confirmed `git rev-parse HEAD`)
**Row:** R-CW-1 — a single bare `CONTINUE_WORK` token-form self-continuation drives a real hop-2
**Verdict:** ✅ PASS (hop-2 drove — byte-verified via marker file AND gateway journal)

## The #552-cap bypass (why this fires despite a saturated main)
The continuation-work cap is per-session-key (`work-dispatch.ts:555-559`, `queuedPendingWorkCount(params.sessionKey)`).
At fire-time the MAIN channel-session was AT the cap:
- `agent:main:discord:channel:1466192485440164011` queued = **32 / 32** (byte: `flow_runs WHERE status='queued' AND owner_key LIKE '%main:discord:channel:1466192485440164011%'` → 32).
A bare `CONTINUE_WORK` on MAIN would #552-reject (32/32 hard cap).
This row fired from a FRESH lightContext subagent (`agent:main:subagent:8560f83a-2f21-4726-873c-e783b32aa997`) whose own session-key had 0 queued cw-flows → clean per-session cap → the bare token scheduled + drove hop-2. **No #552 main-drain required** (proves Ronan/Rune's per-session-key bypass: `1518202806` / `1518202784`).

## Form (bare, not bracket)
work-token self-continuation form = BARE `CONTINUE_WORK` (`tokens.ts:539` `/\bCONTINUE_WORK(?::(\d+))?\s*$/`, end-anchored).
The `[[...]]` bracket is the DELEGATE token delimiter only (frond `1518204008` + `continue-work-signal-v2.md` §281: "not a separate interface"). Journal confirms `kind=work` from the bare token (a `[[CONTINUE_WORK]]` would parse `kind=none`).

## Journal byte-proof (gateway, subagent session-key 8560f83a)
```
03:46:51 [continuation:trace] payload-scan: count=1 bracketIdx=0 ... session=...8560f83a
03:46:51 [continuation:trace] bracket-parse: kind=work delayMs=default session=...8560f83a
03:46:51 [continuation:trace] effective-signal: origin=bracket kind=work session=...8560f83a
03:46:51 [continuation:work-hedge-armed] fireIn=14999ms session=...8560f83a
03:47:06 [continuation:work-hedge-fired] session=...8560f83a
03:47:06 [continuation:work-wake] hop=1/200 session=...8560f83a    <-- HOP-2 DROVE
03:47:14 [continuation:trace] payload-scan: bracketIdx=-1 kind=none   <-- clean single-hop (no runaway)
```

## Evidence files
- hop1-ran.txt — `R-CW-1 HOP1 ran at 2026-06-21T10:46:49Z` (hop-1 executed in the child session)
- hop2-EXECUTED.txt — `R-CW-1 HOP2 EXECUTED at 2026-06-21T10:47:11Z` (hop-2 DROVE — the proof)
- journald_drove.log — the full work-hedge-armed → work-wake hop=1/200 sequence above

## Discipline note
Captured under verify-before-claim: the subagent completion event reported only "ending turn with the token" — it did NOT prove the hop-2 drove. PASS is asserted ONLY after byte-verifying the `hop2-EXECUTED.txt` marker AND the `work-wake hop=1/200` journal line. The tool-return is not proof; the marker + journal are.
