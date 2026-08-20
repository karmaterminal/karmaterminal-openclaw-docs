# Evidence Language for Causal Bug Work

Use this guide to keep a strong investigation from becoming confidence
theatre. It applies to any repository, incident, test framework, or graph
backend.

## Claim ladder

| Evidence | Honest claim | Not yet justified |
| --- | --- | --- |
| Captured log, row, payload, or visible outcome | `EVIDENCES` an incident or symptom | Root cause |
| Fixed desired-contract test is RED | `CHARACTERIZES` a defect | Causality |
| `git log -S/-G/-L`, blame, or parent diffs locate a change | Textual or symbol archaeology; an `INTRODUCES`, `MOVES_OR_EXTRACTS`, or `PRESERVES` candidate | Behavioral first-bad |
| Fixed test runs good before commit and bad after it | Behavioral first-bad boundary | Unique cause |
| Minimal patch makes the unchanged fossil GREEN | Patch satisfies the fossil | Production incident cured |
| Patch-only revert restores RED and reapply restores GREEN | Patch-to-fossil coupling | Unique/minimal intervention or incident causality |
| Incident-shaped end-to-end or live run changes only with the intervention | Strong counterfactual support for incident causality | Universal proof outside the frozen identities |

Reserve `PROVES` for a narrowly stated proposition whose complete receipt chain
is present. Prefer explicit relations such as `CHARACTERIZES`,
`CAUSES_TEST_PASS`, and `REVERT_RESTORES_RED` over a broad `PROVES` edge.

## Historical vocabulary

- **Introducing commit**: the change that creates a symbol or behavior already
  in the defective state. This is the right term for born-broken code.
- **First-bad commit**: a good-to-bad transition established by executing a
  stable behavioral oracle across revisions, usually with `git bisect run`.
- **Refactor-preserving commit**: moves or extracts the mechanism without
  changing the observed behavior.
- **Archaeology/localization**: conclusions from `git log -S/-G/-L`, blame,
  source inspection, or graph paths without cross-revision behavioral runs.

Do not say that a fossil was "carried backward through history" when only its
symbols or relevant lines were traced.

## Keep mechanisms separate

Create one defect node per mechanism, even when several produce similar visible
symptoms. A useful report includes:

| Symptom | Defect mechanism | Fossil or receipt | Fix status |
| --- | --- | --- | --- |
| What a human or system observed | The narrow owner-correct mechanism | Exact test, payload, log, or durable row | unfixed, candidate, side-branch, shipped |

Do not let one fixed mechanism lend causal authority to neighboring unfixed
mechanisms.

## Intervention closure

For each candidate intervention:

1. Freeze product, harness, incident, and test identities.
2. Capture RED with the sanctioned runner.
3. Apply the smallest owner-correct patch.
4. Capture GREEN with the unchanged fossil.
5. Revert only that patch and capture RED.
6. Reapply and capture GREEN.
7. Run controls and classify baseline failures.
8. Obtain end-to-end or live evidence when transport, scheduling, persistence,
   or a real executor decides the outcome.

Call step 5 a **patch-only counterfactual revert**, not mutation testing.
Mutation testing is a broader technique involving generated mutants and test
sensitivity.

## Minimality and ranking

Revert closure shows that a patch is load-bearing for a fossil. It does not
show that the patch is unique or minimal. Rank alternatives explicitly by:

- owner correctness;
- number of independently RED fossils cut;
- production lines changed;
- graph cut size;
- blast radius and policy change;
- control-suite and live-proof cost.

If claiming a minimal cut, include the candidate set and ranking method.

## Graph relation gates

- `EVIDENCES`: an artifact directly records an event or symptom.
- `CHARACTERIZES`: a test or invariant distinguishes desired from observed
  behavior.
- `INTRODUCES`: a diff creates the defective mechanism; state whether this is
  textual archaeology or behavioral localization.
- `PRESERVES`: a later change retains the mechanism.
- `CAUSES_TEST_PASS`: the intervention produces GREEN at frozen identities.
- `REVERT_RESTORES_RED`: removing only the intervention restores RED.
- `PROVES`: use only with a precise proposition and a complete supporting
  chain; never for a RED-only fossil.

Every inferred or ranked edge should say so in attributes such as
`evidence_class=inferred` or `ranking_method=minimum_node_cut`. Keep observed
facts distinct from graph-derived hypotheses.

## Publication boundary

Before intervention closure, title the work as an investigation, localization,
or RED-fossil report. After closure, name exactly what was established:

- patch-to-fossil coupling;
- owner-boundary localization;
- incident-shaped counterfactual support;
- remaining uncertainty.

No receipt carries across changed product, harness, test, payload, or
intervention identities.
