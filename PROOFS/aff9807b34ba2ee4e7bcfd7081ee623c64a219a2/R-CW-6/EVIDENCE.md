# R-CW-6

State: **partial**

The process-local fixture executed directly against source proof SHA
`80311e8aa07fd560cb957475517c5ea18164541c` with its candidate-declared pnpm
`11.22.0`. This packet is transposed to target
`aff9807b34ba2ee4e7bcfd7081ee623c64a219a2`; the fixture was not re-fired
there. Its authoritative envelope says `FAIL-fixture`; this corpus retains that
byte and folds the row as partial because the failure is isolated to a stale
docs-owned generated test rather than the product boundaries.

- Pure identity: `aff9807b34ba2ee4e7bcfd7081ee623c64a219a2`
- Harness identity: `86b39d87e0ae4eef980496d3742e83033ee84a93`
- Execution class: source-pure disposable process-local fixture, transposed by ancestry/materiality
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

## Transposition

This complete row packet preserves historical evidence source `80311e8aa07fd560cb957475517c5ea18164541c` and was full-copied from frozen warm basis corpus `25051f3b77409c45f5ce71c3b3b05aae85b0f8f9` to final target corpus `aff9807b34ba2ee4e7bcfd7081ee623c64a219a2` after the ordinary merge with pinned upstream parent `c841a9958abc8344b37ce5c6c5a06bec4cfa6b91` and three test-only semantic merge-repair commits. Paths and target candidate identity are rebound locally inside this subtree. Historical runtime/fixture evidence was not re-fired at the final target; its source and execution ancestry remain authoritative. Applicability is established only by the final maintenance materiality receipt.
