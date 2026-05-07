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

## Gather method

_Exact, copy-pasteable command-string OR path to a script committed alongside this row (e.g. `swims/swim-<N>-<shape>/rows/<ID>/measure.sh`). All princes / coords / SUTs run **this** to produce field 4 (Result), so the command itself is the canon, not chat-context. Pin **before** firing the row, not after._

**Raw-walk-as-default discipline (per `SWIM-METHODOLOGY.md:90` *“grep before claiming”*):** when the gather is a journal/log/jsonl walk, the canonical first-pass is the raw read (`journalctl --since X --until Y --no-pager`, `jq '.' file.jsonl`, etc.) **without a substantive grep filter**, so the prince running it sees the substrate's actual vocabulary before constraining the pattern. Narrowing greps are added as a *second* pipeline stage (e.g. `tee raw.log | grep ...`) so the raw bytes are always retained for re-walk if the grep returns 0. *If you cannot describe the expected literal-string the substrate emits, you are not ready to write the gather — raw-walk an existing fire first.*

## Status ladder

- [ ] **Triaged** — mapped to existing test coverage by Coord (Phase 1 triage comment on tracker)
- [ ] **PASS-candidate** / **PARTIAL** / **OPEN-GAP** / **METHOD-BROKEN** (pick one; update in this issue when Phase 1 lands)
- [ ] **Comprehension-gated** — row does not start until comprehension note is signed (Rule 6)
- [ ] **Authored** — tests / evidence landed on execution branch (link PR)
- [ ] **Verified** — pass evidence committed, Coord cross-signed
- [ ] **Evidence-cleansed** — row contribution to frozen branch `karmaterminal/openclaw:ronan/rfc-evidence-appendix` complete (Rule 8)

**Verdict semantics:**
- **PASS-candidate / PARTIAL / OPEN-GAP** — substrate-findings; the gather ran correctly and produced these results.
- **METHOD-BROKEN** — the gather itself was wrong (vocabulary-gap, scope-too-narrow, wrong host, wrong window, wrong tool). **Fix the gather and re-run; do not interpret the broken-method output as a substrate-finding.** When upgraded to METHOD-BROKEN, the row blocks on a gather-patch (commit to row dir) before further verdict-progression. Rationale: this is the verdict-state for the swim-43-shape failure where divergent grep patterns produced divergent "results from the same measure" — the result was method-output, not substrate.

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
| Gather | **yes before fire** | exact command-string or `./measure.sh` path; canon for all runners (princes/coords/SUTs); pinned before fire, not after. Raw-walk default for log/journal/jsonl gathers. |
| Coverage expectation | yes | seeds Phase 1 gap analysis |
| Status ladder | yes | checklist is the row's execution record; includes METHOD-BROKEN verdict-state |

## Timing-window glossary

- **unit** — deterministic, fast (<1s per test), runs on every CI invocation.
- **integration** — multi-module, seconds, runs on integration CI (pre-merge to main).
- **fleet-scale** — multi-prince / multi-host, minutes, runs only when fleet is quiescent. 3-role row (Driver / SUT / Restart-initiator per HEARTBEAT safety).
- **boundary-stress** — probes caps (N=50 hops, 100-turn chain, etc.), minutes to hours, runs on-demand or nightly.

## Why this template exists

See `SWIM/lessons/swim-34-row-list-reconstruction.md`. Short version: without a canonical row-body template, each swim re-derives the row shape from scratch, which fragments the issues and breaks reconstructability. With this template, regenerating a 37-row set is a scripted `for row in $(matrix rows); gh issue create --body-file <filled-template>` operation.

## Why Gather + METHOD-BROKEN are required fields (added 2026-05-07)

**Failure mode this prevents:** swim-43-shape — a substrate-test runs in chat-improv, each runner hand-rolls their own gather (different grep patterns, different log scopes, different filters), and divergent results from "the same measure" get treated as substrate-findings instead of method-divergence. The PR that comes out of that is dozens of micro-variant items each documenting a position in an argument that should never have been an argument, because the upstream miss was that no one pinned the gather as canon.

**What `Gather` enforces structurally:** the row file carries the exact command-string (or path to `./measure.sh` in the row dir) that produces field 4 (Result). Princes / coords / SUTs run **the same gather**, byte-identical. Divergence then falls back onto the substrate (real finding) or onto the script (METHOD-BROKEN), never onto re-derivation-from-chat. If a runner needs to vary the gather, the variation is a row-edit (with reason commit) that all subsequent runners inherit — not an improv at runtime.

**What METHOD-BROKEN enforces structurally:** when the gather is wrong, the right next move is *fix the script and re-run*, not *interpret the broken-method output as a substrate-finding*. Without a verdict-state for this, a method-broken row falls into OPEN-GAP / PARTIAL, both of which read as "the substrate has a problem" — and the problem is the gather. METHOD-BROKEN also blocks downstream verdict-progression until a gather-patch lands, so the row cannot be cleared by re-running broken method.

**What this does NOT do:** does not invent new methodology. The principle (`SWIM-METHODOLOGY.md:90` — *grep before claiming, SSH before asserting, read before speaking*) was already there. This patch enforces the principle as a row-template requirement so it cannot be silently skipped under cohort-improv pressure.
