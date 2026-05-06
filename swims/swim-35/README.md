# swim-35 — ship-the-feature stabilization

**Anchor issue:** [#607](https://github.com/karmaterminal/openclaw-bootstrap/issues/607)
**Project board:** [SWIM 35](https://github.com/orgs/karmaterminal/projects/51)
**Driver:** Ronan 🌊 · **Coord:** Cael 🩸
**Procedural frame:** `SWIM/lessons/swim-34-procedural-uncurse.md` (8 rules, entry gate)

## Thesis

The canary feature surface (continuation, delegate, post-compaction, context-pressure dark-zone fix) is functionally complete at `karmaterminal/openclaw:e0ba8f83f7` and deployed fleet-wide as of 2026-04-18 ~20:55 PDT. Swim-35 is the **stabilization-and-shippability** layer between feature-complete and upstream-presentable.

## Layout

```
swims/swim-35-stabilization/
├── README.md                       # this file
├── BRIEF.md                        # one-pager scope brief (TBD)
├── ROWS.md                         # row index (TBD; mirrors anchor table)
├── comprehension/                  # driver code-comprehension notes (Rule 6)
│   ├── A1-414-comprehension.md     # raw-key normalization sweep
│   ├── A3-609-comprehension.md     # synth threshold-cross positive-fire receipt
│   └── B1-606-comprehension.md     # deploy.sh post-deploy bytes-check
├── rows/                           # one verdict file per row
│   ├── A1-verdict.md               # #414 raw-key normalization sweep
│   ├── A2-verdict.md               # #581 continue_delegate horizon
│   ├── A3-verdict.md               # #609 synth threshold-cross positive-fire receipt
│   └── B1-verdict.md               # #606 deploy.sh post-deploy bytes-check
└── evidence/                       # per-row evidence (logs, journal grabs, byte-dumps)
    ├── A1/
    ├── A2/
    ├── A3/
    └── B1/
```

## Scaffold lands on main FIRST (Rule 4)

This PR establishes the scaffold on `main` *before* any execution branch is cut. The execution branch `swim-35-stabilization/ronan` will be created off main *after* this PR merges. No row execution happens on this branch.
