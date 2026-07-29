# Project 86 regression triage template

Use this when a proof row exposes a defect that is **not** specific to one prince's local
seat state. File it in `karmaterminal/openclaw` for product/integration defects, or in
`karmaterminal/karmaterminal-openclaw-docs` for harness/docs-only defects (the reference
round filed docs issues #438 and #439 that way). Then **continue your unaffected rows** —
filing this issue never stops the round.

Governing contract: [`analysis/project86-proof-round-contract.md`](project86-proof-round-contract.md) §9–§10.

## When to file

File when **any** of these is true:

- reproducible on ≥2 seats, or on 1 seat with a clear code-path explanation;
- a wrong-lane / wrong-gate defect (a gate consulting a lane the actor does not contend for);
- a receipt or trace contract the product cannot satisfy as specified;
- a harness defect that would silently mislabel product behavior as a verdict
  (the `R-CD-TOKEN` surface-gate and `R-OBS-STATUS` stale-source-path classes).

**Do not** file for: your own stale seat config, a missing local binary, an expired token,
or a one-off transient. Fix in place and note it in the row issue.

**Filing does not change the row's verdict.** A row that observed erroneous behavior with
complete receipts is `fail` — a real, valuable result. A row that could not observe
anything is `partial`.

**Never put a credential, session key, nonce, prompt body, or user content in this
issue.** Use fingerprints (`reason_hash`, 16-hex attempt/nonce hashes) and links to
committed, sanitized artifacts.

---

## Template — copy from here

````markdown
## Summary

<One sentence: what is broken, on which surface.>

Title convention: `[P86 regression] <surface/component> — <one-line defect> @ <sha_short>`

## Identity

| Field | Value |
| --- | --- |
| Candidate SHA (exact, 40-char) | `<FULL_SHA>` |
| Runtime build SHA on the seat | `<runtime-sha>` (`openclaw --version` / `git rev-parse HEAD`) |
| Identity match | `<candidate == runtime: yes / no>` |
| Deployed seat | `<cael-dgx \| ronan-dgx \| silas-lothric \| elliott-legion \| emeric-nuc \| rune-rog-ally>` |
| Seat version / build string | `<OpenClaw <ver> (<sha_short>)>` |
| Deploy run id | `<actions-run-id>` |
| Docs authority commit | `<docs-sha>` |
| Row(s) affected | `<ROW-ID>` (+ `<ROW-ID>`, …) |
| Row manifest | `tools/k6-proofs/manifests/<row>.json` |
| Project 86 issue(s) | `#<row-issue>` |
| Umbrella | karmaterminal/karmaterminal-openclaw-docs#451 |
| Round wave | `<0 / 1 / 2 / 3>` |
| Discovered | `<UTC timestamp>` |

> If **identity match = no**, this is a seat-deploy problem, not a product regression.
> Deploy the seat and re-verify before filing.

## Exact reproduction

Sanitized, runnable, and complete. Include the rung of the automation ladder used.

```bash
# environment (values redacted; presence only)
OPENCLAW_CANDIDATE_SHA=<FULL_SHA>
OPENCLAW_SEAT_NAME=<seat>
OPENCLAW_SESSION_KEY=<disposable-session>     # value not disclosed
OPENCLAW_GATEWAY_TOKEN=***                    # from seat env, never on disk

# rung used: <A1 workflow | A2 run-proofs.sh | A3 k6 run + evidence-writer | A4 manual>
<exact command sequence>
```

Reproduction facts:

- Deterministic? `<always / intermittent N of M>`
- Minimal trigger: `<smallest input/sequence that reproduces>`
- Surface exercised: `<typed tool | token/bracket form | both>`
- Token carrier (token rows only): `<raw assistant final text | message-tool body>`
  <!-- a token in a message-tool body is NOT token proof; it is a harness-selection defect -->
- Session class: `<disposable scratch | channel session | process-local fixture>`
- Concurrency at the time: `<row ran alone | co-fired with <ROW-ID> on <same/different> session>`

## Observed behavior

<What actually happened. Quote the exact gate string / error / receipt field, e.g.
`work-drive-skipped reason=requests-in-flight`, `continuation.delegate.dispatch span is
not status OK`, `artifact dir must not be group/world accessible (mode 0700 required)`,
`surface_class: "message-body", dispatched: false`.>

Machine-readable evidence:

```json
{
  "row": "<ROW-ID>",
  "verdict": "<PARTIAL-candidate | FAIL-candidate>",
  "verdictSource": "<...>",
  "missingReceipts": ["<...>"],
  "observedField": "<...>"
}
```

## Expected behavior

<What SHOULD happen, with the authority for that claim. A behavior cannot be called
erroneous until the expected behavior is defined.>

Authority:
- `RUNBOOKS/CONTINUATION-BEHAVIOR-SPEC.md` §<section>, or
- `RUNBOOKS/PROOF-CORPUS-METHOD.md` row table entry for `<ROW-ID>`, or
- `tools/k6-proofs/manifests/<row>.json` → `liveRunSafety.requiredReceipts` / PASS criteria, or
- `<file>:<line>` in `karmaterminal/openclaw` implementing the contract.

Gap statement: `<the precise delta between expected and observed, in one sentence>`

## Sanitized artifact links

All links must point at **committed, sanitized** artifacts. No raw logs, no attachments
containing session bodies.

| Artifact | Path / link |
| --- | --- |
| Row evidence | `PROOFS/<FULL_SHA>/<ROW-ID>/EVIDENCE.md` |
| Run directory | `PROOFS/<FULL_SHA>/<ROW-ID>/<seat>/k6-run-<ts>/` |
| Normalised result | `.../row-result.json` |
| k6 summary | `.../k6-summary.json` |
| Redacted gateway frames | `.../gateway-events.ndjson` |
| Redaction receipt | `.../evidence-redaction.json` |
| Bounded gateway journal | `.../gateway-journal.log` (+ `-capture.json`, `-redaction.json`) |
| Tempo trace JSON | `.../artifacts/<descriptive>_trace.json` |
| Interruption receipt (if any) | `.../interruption-receipt.json` |
| Seat readiness | `.../seat-readiness.json` |
| Workflow run | `<actions-run-url>` |

Redaction confirmation:

- [ ] No tokens, bearer fragments, or authorization material
- [ ] No session keys, run ids, or raw nonces (fingerprints only)
- [ ] No prompt bodies, message payloads, or user content
- [ ] No private paths or seat-local secrets
- [ ] Trace JSON is the public-safe export

## First-bad boundary (if known)

| Field | Value |
| --- | --- |
| Last known-good SHA | `<sha or unknown>` |
| First known-bad SHA | `<sha or unknown>` |
| Suspected commit / PR | `<sha or #PR or unknown>` |
| Suspected code path | `<file>:<line>` |
| How established | `<bisect / byte-identity crosswalk vs upstream / code read / unknown>` |

If unknown, say **unknown** — do not guess. If the same gate source is byte-identical
between candidate and upstream, say so explicitly: that proves the row is **not** a
cure regression and reframes the finding as pre-existing.

## Blast radius across remaining rows

| Scope | Rows | Basis |
| --- | --- | --- |
| Confirmed affected | `<ROW-ID>, …` | reproduced |
| Suspected affected (same family/surface/gate) | `<ROW-ID>, …` | shares `<scenario helper / gate / span contract / fixture>` |
| Confirmed unaffected | `<ROW-ID>, …` | ran clean after discovery |
| Not yet exercised | `<ROW-ID>, …` | — |

Shared dependency that defines the family:
`<scenario helper | span/topology contract | pre-dispatch surface gate | fixture harness | session-write-lock path | config surface>`

Cross-seat status:

| Seat | Reproduced? | Evidence |
| --- | --- | --- |
| `<seat>` | `<yes/no/not tried>` | `<link>` |

Round arithmetic: `<N>` of `<TOTAL>` rows are blocked or at risk; `<M>` rows are
independent and continue.

## Recommendation — continue or halt

Choose exactly one.

- [ ] **CONTINUE (row-local).** Defect is confined to this row/seat/attempt. Classify the
      row honestly (`partial`/`fail`), commit artifacts, keep every other row running.
      No round-level action.

- [ ] **CONTINUE with family swim (family-local).** `<N>` rows sharing
      `<shared dependency>` are blocked. Scribe moves **only that family** to `swim` and
      explicitly re-dispatches the unaffected families. Already-collected artifacts for
      the swum family stay committed as evidence of the defect.
      Rows to swim: `<ROW-ID>, …`
      Rows to keep running: `<ROW-ID>, …`

- [ ] **HALT (round-level).** Continuing would produce known-invalid data. Trigger is one
      of: candidate does not carry the feature under test; INDEX / manifest / README
      allocation authority conflict; the redaction boundary failed; the evidence pipeline
      is emitting falsely-passing artifacts; the candidate is being force-pushed mid-round.
      Halt means **stop opening new fire windows** — it does not delete artifacts, does not
      abandon in-flight fires (let them terminalize and write receipts), and does not close
      row issues.
      Trigger: `<which>`
      Affected rows: `<ROW-ID>, …`
      Resume condition: `<explicit, checkable condition>`

Rationale: `<2–4 sentences tying the blast radius to the recommendation.>`

## One-fire accounting

| Field | Value |
| --- | --- |
| Behavioral fire consumed? | `<yes / no — mechanically proven non-fire>` |
| Non-fire proof (if claimed) | `<exact pre-execution gate error string + evidence that no body ran>` |
| Interrupted attempt? | `<no / yes — interruption-receipt.json at <path>>` |
| Refire requested? | `<no / yes — authorization needed from scribe>` |
| Refire justification | `<why the prior attempt is non-terminal or a proven non-fire, and what changed>` |

Reminder: post-run **collector** retry for a missing trace is allowed
(`behaviorRefired: false`); refiring the behavior to chase a trace is not. A
`verdict-reconciliation.json` disagreement is a harness-classification receipt, never a
refire reason.

## Verdict discipline reminder

`HONEST_LIMIT` is valid for **`R-RC-2` only**, and only with a structured live receipt
proving `request_compaction` was denied because context pressure remained **below**
threshold. On every other row — including any row blocked by generic context pressure or
by a subagent policy gate barring `request_compaction` — the outcome is `PARTIAL`. It is
not `honest_limit`, and it must not be retro-justified.

## Follow-up

- [ ] Linked from the row issue `#<row-issue>` and from `PROOFS/<FULL_SHA>/<ROW-ID>/EVIDENCE.md`
- [ ] Linked from umbrella karmaterminal/karmaterminal-openclaw-docs#451
- [ ] Regression/trap test proposed (so the cure is locked in going forward, and its
      sibling surfaces sharing the same plumbing are covered too)
- [ ] Unaffected rows confirmed still running
````

## Template — copy to here

---

## Filing notes (do not paste into the issue)

- **Two dimensions, kept separate.** A unit-level gate assertion proven by a test is a
  *different* byte from a live end-to-end completion. Do not collapse them: state which
  one you have and which one remains owed.
- **Divergence is not averaged.** If one arm fails a row and another passes it, both are
  reported. A primary required-precondition failure stands against a comparator pass.
- **A shared harness defect is not a product verdict.** If neither seat's assertion ever
  ran, the row is `BAD_PROOF`/`partial` and the product claim is *unmade* — say so
  explicitly rather than implying the product is fine.
- **A later repair does not retroactively change historical receipts.** Note the repair
  commit; leave the receipts as they were.
