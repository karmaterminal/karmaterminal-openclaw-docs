# R-CW-6

State: **partial**

The process-local fixture executed directly against pure SHA
`80311e8aa07fd560cb957475517c5ea18164541c` with the candidate-declared pnpm
`11.22.0`. Its authoritative envelope says `FAIL-fixture`; this corpus retains
that byte and folds the row as partial because the failure is isolated to a
stale docs-owned generated test rather than the product boundaries.

- Pure identity: `80311e8aa07fd560cb957475517c5ea18164541c`
- Harness identity: `86b39d87e0ae4eef980496d3742e83033ee84a93`
- Execution class: exact-pure disposable process-local fixture
- Evidence directory: `fixture/`

Passing product receipts:

- direct below-limit / at-limit / first-over-limit matrix;
- runtime scheduler with structured `chain-capped`;
- rejected runtime hop creates no durable work;
- at-limit state survives store reload and the recovered over-limit election is rejected;
- typed `continue_work` surface;
- candidate-owned delegate chain-depth regression suite;
- cleanup, exact worktree/lockfile identity, and public-artifact safety.

The docs-generated selected delegate test exits before writing its receipt. Its
template still mocks pre-refactor module and system-event ownership, so
`selectedBoundary` is empty and the fixture reports `dispatchPassed=false`.
That harness defect is tracked in
[`karmaterminal-openclaw-docs#516`](https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/516).
The earlier product report remains linked at
[`karmaterminal/openclaw#1203`](https://github.com/karmaterminal/openclaw/issues/1203),
but its runtime/recovery/typed failure shape no longer reproduces here.
