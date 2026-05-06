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

## Surface under test

_Plain-language description of the behavior / invariant this row validates. One paragraph. Include what the user-facing or contract-facing guarantee is, and what a violation would look like._

## Coverage expectation

- **Unit tests expected:** <count or "N/A">
- **Integration tests expected:** <count or "N/A">
- **Fleet-scale tests expected:** <count or "N/A">
- **Evidence artifacts expected:** <e.g. pytest junit, vitest reporter output, journal log snippet>

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
| Status ladder | yes | checklist is the row's execution record |

## Timing-window glossary

- **unit** — deterministic, fast (<1s per test), runs on every CI invocation.
- **integration** — multi-module, seconds, runs on integration CI (pre-merge to main).
- **fleet-scale** — multi-prince / multi-host, minutes, runs only when fleet is quiescent. 3-role row (Driver / SUT / Restart-initiator per HEARTBEAT safety).
- **boundary-stress** — probes caps (N=50 hops, 100-turn chain, etc.), minutes to hours, runs on-demand or nightly.

## Why this template exists

See `SWIM/lessons/swim-34-row-list-reconstruction.md`. Short version: without a canonical row-body template, each swim re-derives the row shape from scratch, which fragments the issues and breaks reconstructability. With this template, regenerating a 37-row set is a scripted `for row in $(matrix rows); gh issue create --body-file <filled-template>` operation.
