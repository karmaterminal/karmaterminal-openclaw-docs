---
name: causal-bug-proof
description: Use when a bug needs stronger evidence than a normal regression test: build a timestamp-aware code/history/incident graph, freeze desired-contract RED fossils, locate the introducing or first-bad owner boundary, apply the smallest owner-correct intervention, require GREEN, then patch-only revert to RED. Useful for regressions across refactors, disputed ownership, flaky multi-path failures, and proof-bearing fixes.
---

# Causal Bug Proof

Turn debugging into a causal experiment:

```text
incident -> graph path -> fixed RED fossil -> minimal patch -> GREEN
                                              |
                                              +-> revert patch -> RED
```

The final artifact is a temporal multiplex graph plus exact test receipts, not
merely a patch and a green CI run.

Companion references:

- [EVIDENCE-LANGUAGE.md](EVIDENCE-LANGUAGE.md) defines what each receipt may
  honestly claim.
- [GITNEXUS-NETWORKX.md](GITNEXUS-NETWORKX.md) documents the generic
  GitNexus-to-NetworkX export path.

## When to use

- A bug crosses core/plugin/package boundaries.
- A refactor may have moved or exposed the owner.
- Several PRs plausibly overlap but should remain separate.
- The failure is disputed as upstream, fork-owned, environmental, or flaky.
- A live incident needs proof authority.
- A conventional test passes only because its fixture models imaginary bytes.
- You need to know whether one minimal cut fixes several symptoms.

Do not use this for a trivial local typo with an obvious owner.

## Required workflow

### 1. Freeze the incident

Record exact:

- runtime/product SHA;
- upstream SHA absorbed beneath it;
- fork base/assembly SHA;
- event/run/session/tool IDs;
- wall-clock and monotonic/process ordering where available;
- logs, durable rows, and visible outcome;
- known state-changing operations.

Preserve live evidence before mutation. Never infer current intent from stale
replayed messages.

### 2. State hypotheses separately

Create distinct defect nodes. Do not amalgamate similar symptoms.

Examples:

- wrong payload field;
- retry-policy bypass;
- leaked or never-settling ownership;
- serial-capacity design defect;
- missing age policy;
- expected model behavior caused by stale input.

### 3. Build the current code graph

Use GitNexus:

1. `query` for the symptom/flow;
2. `context` on acquisition, timeout, release, cleanup, and policy symbols;
3. `cypher` to export the relevant nodes/edges.

Record index path, indexed commit, and staleness. If exact GitNexus is
unavailable, disclose it and reconstruct the graph from source; never invent a
receipt.

### 4. Write fixed-semantics fossils

Each fossil expresses the desired contract, not current behavior.

- Use real-shaped payloads/inputs.
- Keep assertions stable through the historical walk.
- At older commits, change imports/harness adapters only when symbols moved.
- Never weaken the assertion to make history compile.
- Separate ordinary throw/failure from never-settling work.
- Keep unrelated-session controls.

Run sanctioned wrappers only; for OpenClaw, never raw Vitest and use
`maxWorkers=1`.

### 5. Walk backward in time

Use:

- `git log -S/-G`;
- `git log -L`;
- parent diffs;
- selected commit matrices;
- `git bisect run` when a stable harness exists.

Find:

- symbol birth;
- introducing commit for born-broken behavior;
- first-bad commit only when a fixed behavioral test establishes a good-to-bad
  transition;
- module/LOC splits;
- cleanup ownership moves;
- later side-branch fixes;
- current upstream flux.

`git log -S/-G/-L` is textual or symbol archaeology. It is not behavioral
bisection unless the fixed fossil actually runs across the selected revisions.

The exact historical upstream SHA is authority. Current upstream tip is context
only.

### 6. Build the temporal proof graph

Use `scripts/build-proof-graph.py`.

Required layers:

- `code`;
- `commit`;
- `defect`;
- `test`;
- `incident`;
- `governance`;
- `intervention`.

Useful relations:

- `CALLS`, `IMPORTS`, `ACCESSES`;
- `INTRODUCES`, `MOVES_OR_EXTRACTS`, `PRESERVES`;
- `PROVES`, `CHARACTERIZES`, `EVIDENCES`;
- `TRACKS`, `ATTEMPTS_FIX`, `CURES_ON_SIDE_BRANCH`;
- `CAUSES_TEST_PASS`, `REVERT_RESTORES_RED`;
- `DOES_NOT_REACH`, `BYPASSES`.

Export GraphML, GEXF, node-link JSON, and CSV.

Apply the evidence gates in `EVIDENCE-LANGUAGE.md`. In particular, a RED-only
fossil `CHARACTERIZES` a defect; it does not `PROVE` causality.

### 7. Perform the causal intervention

In a new owner-correct fix lane:

1. Apply the smallest patch that cuts the hypothesized path.
2. Run the unchanged fossil: require GREEN.
3. Revert only the intervention: require RED again.
4. Reapply: require GREEN.
5. Run owner/control suites and exact base/upstream classification.

Add intervention nodes and inversion edges to the graph.

This intervention/revert/reapply sequence demonstrates patch-to-fossil
coupling. Production-incident causality additionally requires authoritative
incident provenance and, when the real executor or transport is the arbiter,
an incident-shaped end-to-end or live receipt.

### 8. Review and disposition

- Use `/code-review`; prefer `gitnexus-pr-review` for cross-cutting fixes.
- Keep separate owner fixes in separate PRs.
- Do not fold unrelated fixes into continuation or another feature branch.
- Do not fix an exact-upstream-baseline failure merely to green the fork lane.
- Live proof remains required when the real executor/transport is the arbiter.

## Network analysis ideas

With NetworkX:

```python
nx.shortest_path(G, incident, defect)
nx.minimum_node_cut(G, incident, failing_test)
nx.dominators.immediate_dominators(G, entry)
nx.ancestors(G, defect)
nx.descendants(G, intervention)
nx.weakly_connected_components(G)
```

Rank candidate fixes by:

- number of RED fossils cut;
- owner correctness;
- production LOC;
- blast radius;
- policy changes introduced;
- live-proof cost.

## Proof package

Return:

- exact SHAs;
- frozen incident ledger;
- fossil source and RED receipts;
- introducing/first-bad/refactor matrix with the localization method named;
- GitNexus/static graph receipt;
- GraphML/GEXF/JSON/CSV;
- intervention GREEN receipt;
- patch-only revert RED receipt;
- control suites;
- independent review;
- live proof, if applicable;
- explicit remaining uncertainty.

No historical proof carries across changed product, harness, or intervention
SHAs.
