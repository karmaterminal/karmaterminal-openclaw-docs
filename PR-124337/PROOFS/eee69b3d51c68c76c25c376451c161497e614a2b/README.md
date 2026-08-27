# PR #124337 proof transpose for `eee69b3d`

This self-contained corpus presents protected PR head
`eee69b3d51c68c76c25c376451c161497e614a2b`. It is a full local copy of the
reviewed 25-file corpus proved from ancestor
`4ff99f7e5c149d90214a3df932f9d5adb438b835`, plus target-local ancestry,
materiality, Mode-B, and ClawSweeper navigation records.

## Verdict and execution boundary

**PASS by reviewed ancestor evidence plus bounded materiality.** All three
required rows remain `pass`. The immutable behavioral execution is bootstrap
run [32652334564](https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/32652334564)
on deployment-only composite `6e6da7bba079b0fc50d134b96657cda683985837`.

`target_exact_execution` is **false**. Neither that source execution nor
current-head Mode-B is represented as exact behavioral execution of
`eee69b3d51c68c76c25c376451c161497e614a2b`.

| Row | Preserved contract | State |
| --- | --- | --- |
| `A-GENUINE-ABANDONMENT` | Genuine pre-adoption abandonment consumes bounded retries, observes the dead-letter age floor, terminalizes as `retry-limit-exceeded` / `turn-abandoned`, retains payload, and releases the follower. | pass |
| `B-BUDGET-FREE-CANCELLATION` | Explicit cancellation preserves retry facts and releases with `recordAttempt: false`. | pass |
| `C-MIXED-FANIN-SEPARATION` | Capable and legacy fan-in cancellation remain attempts-neutral while a separate genuine abandonment terminalizes. | pass |

## Target qualification

- `eee69b3d` is a two-parent merge: first parent `d81272c1`, second parent the
  exact pinned floor `6ae89b5a`.
- Source `4ff99f7e` is an ancestor of `d81272c1`, which is the first parent of
  the target.
- The only source-to-previous production intersection extracts settlement
  ownership and adds ancillary timeout/root-admission handling. The exact
  abandonment/cancellation predicates remain. Every inspected feature
  production blob is byte-identical from `d81272c1` to `eee69b3d`.
- Candidate Mode-B
  [33032456154](https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/33032456154)
  has green affected channel/plugin owners and green hosted lane 54.
- Exact-floor control
  [33033875064](https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/33033875064)
  reproduces the candidate's failures outside the feature owners. At review
  time it remained in progress on the same long-tail extensions shard that
  the candidate cancelled after about 90 minutes, so it is control evidence,
  not a terminal green suite.
- The PR adds no feature, schema, config, protocol, or dependency surface.

See [`MATERIALITY.md`](MATERIALITY.md) and
[`TARGET-QUALIFICATION.json`](TARGET-QUALIFICATION.json) for the byte walk and
honest limits.

## ClawSweeper route

1. [`../INDEX.json`](../INDEX.json)
2. [`proofs-manifest.json`](proofs-manifest.json)
3. [`CLAW-SWEEPER-DIRECT-DIGEST.md`](CLAW-SWEEPER-DIRECT-DIGEST.md)
4. The target-local row `EVIDENCE.md` and artifacts

No target-local evidence link redirects to the source subtree.
