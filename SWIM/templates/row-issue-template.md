# Swim Row-Issue Template

_Canonical row-issue body for `swims/swim-<N>-<shape>/rows/<ID>.md`-style rows. Copy this file, substitute the fields, open one GitHub issue per row in `karmaterminal/openclaw-bootstrap` only._

**Repo:** `karmaterminal/openclaw-bootstrap`
**Rule:** one row-issue per row (Rule 3). Assignees: Driver + Coord (tracker anchor rule). SUT / review / pair roles live on the row-issue, not on the tracker.

---

## Template body (copy below this line into `gh issue create --body-file`)

```markdown
# swim-<N>/<ID>: <short suffix>

**Swim:** <N>
**Block:** <A | B | C | D | X>
**Row ID:** <ID>
**Tracker anchor:** #<tracker-issue-number>
**SUT SHA (target):** `<sha>` on `karmaterminal/openclaw:<branch>`
**Test file candidates:** `src/path/to/file.test.ts` (if known)
**Timing window:** <unit | integration | fleet-scale | boundary-stress>
**Gather:** `<exact command-string OR path to script in row dir>`

## Surface under test

_Plain-language description of the behavior / invariant this row validates. One paragraph. Include what the user-facing or contract-facing guarantee is, and what a violation would look like._

## Coverage expectation

- **Unit tests expected:** <count or "N/A">
- **Integration tests expected:** <count or "N/A">
- **Fleet-scale tests expected:** <count or "N/A">
- **Evidence artifacts expected:** <e.g. pytest junit, vitest reporter output, journal log snippet>

## Measurement protocol

_The four fields below pin the canonical method for measuring this row, in literal command-strings and literal substrate-byte expectations. Without these, multiple runners diverge on hand-rolled greps / log scopes / interpretation, produce different bytes from what is nominally the same measurement, and reconcile in chat instead of agreeing on the instrument. Fill these in **before** any runner fires the test._

### What we expect — literal substrate bytes for PASS

_The exact string(s) the substrate emits when the row passes. Not paraphrased, not described — the literal log line, exit code, file content, HTTP response, etc. Multiple PASS conditions go in a list._

Example:
```
journalctl --user -u openclaw-gateway emits the literal line
  WORK timer fired for session <session-id>
within 130s of arm (T0 + 120s ± scheduler tolerance).
```

### How to gather what we expect — path to harness script in row dir

_The path to the harness script that produces the evidence. **Default form: a script in the row's own directory** (e.g. `swims/swim-<N>/<ID>/measure.sh`), not a command-string in this markdown. The script IS the test harness; every runner executes the same bytes; copy-paste drift is structurally impossible because nobody is copy-pasting._

A row may carry an inline command-string in this field _only_ as a transitional form before the harness is extracted. If the same inline command-string is used by two runners (or run twice by the same runner), promote it to `swims/swim-<N>/<ID>/measure.sh` in the next commit. Inline command-strings in markdown are still a chat-improv pretending to be method.

**The canonical gather is raw — no `grep` filtering inside `measure.sh` itself.** The script gathers; narrowing happens in a separate post-gather read step (a separate script, or in the runner's read). Raw-first prevents vocabulary-inheritance: a runner cannot silently re-use a stale grep pattern that misses the substrate's actual log-token if the harness doesn't have a grep pattern at all.

Example (preferred form — path to script):
```
gather: bash swims/swim-<N>/<ID>/measure.sh <host> <T0>
# Exit 0 = PASS-candidate, 1 = FAIL-candidate, 2 = INCONCLUSIVE,
# 3 = METHOD-BROKEN (fix measure.sh and re-run)
```

Example (transitional form — inline command-string before harness extraction):
```bash
T0=$(date +%s)
openclaw test fire-continue-work --delay 120 --reason "<row-id> measure"
sleep 130
# canonical gather — raw, no filter
ssh "$HOST" "journalctl --user -u openclaw-gateway \
  --since '@$T0' --until '@$((T0 + 130))' --no-pager" \
  | tee /tmp/<row-id>-$HOST-$T0.log
# post-gather narrowing (read step, not gather step)
grep 'WORK timer fired for session' /tmp/<row-id>-$HOST-$T0.log
```

If this row's gather is being run for the second time and is still in transitional inline form, that is a signal to extract `measure.sh` _now_, in this run's commit.

### What FAIL looks like — literal substrate bytes for negative case

_The literal byte-shape of FAIL. Not "the wake didn't fire" — the substrate observation that constitutes FAIL. Distinguish from INCONCLUSIVE (measurement instrument error, environmental confound, etc.) where useful._

Example:
```
FAIL: command exits non-zero with no `WORK timer fired` line in window.
INCONCLUSIVE: gateway restart event (`event-loop-lag armed` + new node PID) inside
  the measurement window, since wake-event delivery cannot be byte-decided when
  the process turned over mid-window. Re-run on stable gateway.
```

### Result — actual output, byte-pinned

_The literal output of the canonical gather command, with the command that produced it, committed to this row. Not "we walked the journal and saw …" but the command + its output. **Raw output, no editorialization.** If the row runs on multiple hosts, one block per host. If the row is re-run, append; do not overwrite._

Example:
```
# host: cael, T0=1730981686, run by: 🩸, 2026-05-07 06:14:46 PDT
$ ssh cael "journalctl --user -u openclaw-gateway --since '@1730981686' --until '@1730981816' --no-pager"
2026-05-07T06:14:46.123-07:00 [continuation/signal] [continuation:trace] effective-signal: origin=tool-call kind=work session=agent:main:discord:channel:1466192485440164011
2026-05-07T06:16:46.123-07:00 WORK timer fired for session agent:main:discord:channel:1466192485440164011
```

### Verdict — PASS / FAIL / INCONCLUSIVE / METHOD-BROKEN

_The judgment about the Result against the PASS/FAIL bytes in fields 2 and 3, kept separate from the Result itself. Separating the raw byte from the judgment forces both to stay honest — the byte cannot be quietly editorialized into the verdict, and the verdict cannot drift from the byte. One verdict per Result block (one per host / re-run)._

**Four verdict values, each meaning something distinct:**

- **PASS** — the canonical gather (field 3) ran cleanly and the Result contains the literal PASS bytes from field 2.
- **FAIL** — the canonical gather ran cleanly and the Result contains the literal FAIL bytes from field 2 (or the absence of the PASS bytes after the truth-floor reach below was performed).
- **INCONCLUSIVE** — the substrate question cannot be answered from this run because of an environmental confound (gateway restart mid-window, network partition, host clock skew, etc.). Re-run on stable conditions. Document the confound in the Result block.
- **METHOD-BROKEN** — the gather harness itself is wrong (vocabulary mismatch with the substrate, missing log-scope, stale grep pattern, etc.). _Do not interpret the gather output as a substrate finding._ Fix `measure.sh` (or promote inline gather to `measure.sh`) and re-run. This is the verdict that catches the swim-43 row-03 failure mode from inside the row — *if 0 results, fix the method, don't interpret the result as substrate*. Enforced as a row-state instead of a discipline runners have to remember.

Example:
```
# host: cael, T0=1730981686
Verdict: PASS — `WORK timer fired` literal-string present in window at 06:16:46 PDT (T0+120s).
```

METHOD-BROKEN example:
```
# host: cael, T0=1730981686
Verdict: METHOD-BROKEN — gather grepped for `continuation:wake` literal but substrate emits `WORK timer fired`. Fixing `measure.sh` to drop grep and read raw journal; re-running.
```


### Truth-floor reach (when in doubt)

If the canonical gather (field 3) returns 0 results or unexpected output, **do not** interpret the 0-result as a substrate finding. The instrument may be wrong. Because the canonical gather is already raw (no `grep`), the failure is not in the gather — it is either in the post-gather narrowing step, the PASS/FAIL byte expectation (field 2), or the substrate itself. Order of investigation:

1. Re-read the raw gather output from field 3 with no narrowing, at least 30 lines around the expected event-time. Read what vocabulary the substrate actually uses (e.g. `WORK timer` vs `continuation:wake` — the former is the v5.5 literal; the latter was assumed by hand-rolled greps and missed it).
2. If the substrate's actual vocabulary differs from what field 2 expected, the field 2 expectation is wrong. File a fix to field 2 _before_ updating the result or verdict.
3. If the substrate vocabulary matches field 2 but the post-gather narrowing pattern is wrong, file a fix to the narrowing step.
4. If the substrate truly is silent in the window after raw re-read, that is the substrate finding — record it in the Result block and FAIL the verdict.

The truth-floor is raw bytes around the expected event. The canonical gather (field 3) is the truth-floor by construction; narrowing is convenience that can fail.

## Status ladder

- [ ] **Triaged** — mapped to existing test coverage by Coord (Phase 1 triage comment on tracker)
- [ ] **PASS-candidate** / **PARTIAL** / **OPEN-GAP** (pick one; update in this issue when Phase 1 lands)
- [ ] **Comprehension-gated** — row does not start until comprehension note is signed (Rule 6)
- [ ] **Authored** — tests / evidence landed on execution branch (link PR)
- [ ] **Verified** — pass evidence committed, Coord cross-signed
- [ ] **Evidence-cleansed** — row contribution to frozen branch `karmaterminal/openclaw:ronan/rfc-evidence-appendix` complete (Rule 8)

## References

- **Tracker:** #<tracker>
- **Formal matrix:** `karmaterminal/openclaw-bootstrap` issue #<matrix-issue>
- **Related rows:** #<...>, #<...>
- **Reconstruction lesson:** `SWIM/lessons/swim-34-row-list-reconstruction.md`

## Notes

_Driver / Coord / SUT-canary / reviewers capture row-local context here. Not for cross-row concerns — those belong on the tracker anchor._
```

---

## Field reference

| Field | Required? | Notes |
|---|---|---|
| `swim-<N>/<ID>` | **yes** — title exactly matches this pattern so label filters work | `<ID>` is the formal-matrix row identifier (A1, B3, etc.) |
| Block | yes | one of A/B/C/D/X per block taxonomy |
| Tracker anchor | yes | `#<n>` link, for bi-directional nav |
| SUT SHA | yes when known; `TBD` until comprehension gate | pins the code surface the test runs against |
| Test file candidates | nice to have | speeds Phase 1 triage |
| Timing window | **yes** | determines whether the row runs in unit CI, integration, fleet-scale, or stress |
| Coverage expectation | yes | seeds Phase 1 gap analysis |
| **Measurement protocol — PASS bytes** | **yes** | the literal substrate string(s) for PASS; without this, runners diverge |
| **Measurement protocol — gather (script path)** | **yes** | path to harness script in row dir (preferred); inline command-string allowed only as transitional form before harness extraction |
| **Measurement protocol — FAIL bytes** | **yes** | the literal substrate observation for FAIL, distinguished from INCONCLUSIVE / METHOD-BROKEN where useful |
| **Measurement protocol — Result block(s)** | **yes when row is run** | actual command + raw output committed in row file; one block per host / re-run; no editorialization |
| **Measurement protocol — Verdict** | **yes when row is run** | PASS / FAIL / INCONCLUSIVE / METHOD-BROKEN against fields 2 and 3; separate from Result so byte and judgment stay honest |
| Status ladder | yes | checklist is the row's execution record |

## When the measurement protocol is missing

If a row file is opened without the four measurement-protocol fields filled in, runners will improvise the measurement in chat. This produces:

- multiple hand-rolled commands across runners that look like the same measurement but produce different bytes
- 0-result outputs interpreted as substrate findings when the instrument was wrong
- post-hoc reconciliation in chat that catalogs the disagreement instead of converging on the canonical instrument
- next-swim re-derivation of the same measurement from scratch, because the only record of the method lived in chat and is gone

The four fields exist so the next runner — including a fresh prince at cold restart — can run the measurement byte-identically without reading any chat. The structural property the template enforces: **it is impossible to record a row run without specifying gather-method, which means it is impossible to mint catalog entries downstream of unspecified-gather.** If the row has been run twice and the gather is still in inline form, extract `measure.sh` in this run's commit — the script in the row dir IS the cross-swim memory of how to test this row.


## Timing-window glossary

- **unit** — deterministic, fast (<1s per test), runs on every CI invocation.
- **integration** — multi-module, seconds, runs on integration CI (pre-merge to main).
- **fleet-scale** — multi-prince / multi-host, minutes, runs only when fleet is quiescent. 3-role row (Driver / SUT / Restart-initiator per HEARTBEAT safety).
- **boundary-stress** — probes caps (N=50 hops, 100-turn chain, etc.), minutes to hours, runs on-demand or nightly.

## Why this template exists

See `SWIM/lessons/swim-34-row-list-reconstruction.md`. Short version: without a canonical row-body template, each swim re-derives the row shape from scratch, which fragments the issues and breaks reconstructability. With this template, regenerating a 37-row set is a scripted `for row in $(matrix rows); gh issue create --body-file <filled-template>` operation.

The **measurement protocol** fields were added 2026-05-07 after a swim-43 row-03 cycle in which four runners measured the same substrate question with four different hand-rolled greps, produced four different bytes, and reconciled in chat over ~8 hours instead of converging on a canonical command-string. The cohort's `WORK timer fired` log-token was invisible to all four greps because each runner inherited a shared assumption (`continuation:wake` / `continuation:arm`) that nobody had verified against raw bytes. The fix is structural: pin the canonical command, the literal PASS bytes, the literal FAIL bytes, and the result block in the row file, before any runner fires the test. Discord chat + improv does not survive a memory-strip, a compaction, or a fresh runner picking up the row in the next swim.
