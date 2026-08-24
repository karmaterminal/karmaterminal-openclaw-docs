# Direct proof digest

- Presentation/corpus: `30e9051e2a79b4f70e9e7429561ccd395ed9f4ab`
- Runtime composite: `6e6da7bba079b0fc50d134b96657cda683985837`
- Seed state: `41 missing`
- Live-suite denominator: 34 runnable entries (`PREFLIGHT` + 33 behavior rows)
- Live workflow: not dispatched
- Acceptance: Gate 2 is 40/40, Gate 2.7 has 345 `KEEP`, zero `RESTORE`, and
  zero `FROZEN-STALE`. Mode-B run
  [32674562617](https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/32674562617)
  has valid 163/163 routing receipts; its red set is fully classified against
  frozen-upstream run 32657627746 and matched isolated executions as inherited
  artifact/host/order failures.
- Canonical manifest: [`proofs-manifest.json`](proofs-manifest.json)
- Human rollup: [`README.md`](README.md)
- Non-interference: [`NON-INTERFERENCE-MAP.md`](NON-INTERFERENCE-MAP.md)

The protected fork presentation is exact. The closed historical upstream pull
ref remains pinned to its prior head and is not reopened.
