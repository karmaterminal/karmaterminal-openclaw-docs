# Target-candidate GATES receipt

| Field | Value |
|---|---|
| Final clean candidate | `4737afdf7dcc5cca53f8dd1bdaaeaa122ce17bbd` |
| Product-equivalent reviewed code head | `71a324b27b60b38b522d8a54dfc1b935a7122ac9` |
| Ordinary upstream merge | `456ffaa2f90e80cb29f4c3af60ac43a9fd22ed4a` |
| Absorbed upstream | `1ba243c88ed800986909bc50e4ce7b8139891b94` |
| Source proof SHA | `80311e8aa07fd560cb957475517c5ea18164541c` |

The candidate and `71a324b2…` differ only by the later addition and removal of
the temporary GATES journal. Their product trees are identical.

- All 16 textual conflicts were resolved.
- Gate 2: 40/40 primitive-core invariants passed.
- Gate 2.5: 547 upstream-touched tests enumerated; all 37 feature intersections
  passed, with 4,093 assertions and two platform skips.
- Gate 2.7: `FROZEN-STALE=0`; all 354 final MIXED rows were dispositioned.
- Production and test type checks, repository checks, build, generated prompt
  snapshots, native state schema, and the final 40-file focused matrix passed.
- Final diff against absorbed upstream has zero `src/skills/**` paths and the
  current labeler produces zero `r: skill` matches.
- Fresh upstream `9f472253d49ac6992d0eecd528230e2e1543514d`
  is one later realtime-voice commit touching three disjoint files; merge-tree
  is clean and GitNexus finds no continuation execution-flow intersection.
  It does not require another absorb or proof/CI reset.

Current target Mode-B:
[`32859410821`](https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/32859410821).
It completed with 166,719 passing tests, five load flakes greened, and 19
deterministic failures, all classified as upstream-identical or
runner/environment failures in [`MODE-B.md`](MODE-B.md). No candidate-caused
failure remained.
