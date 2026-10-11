# Live-gateway dist fence: proven-absent service manager

| | |
|---|---|
| Product head | `5376ab7d34f5a1684a1bb00e8d29be92a3a7f94a` (`karmaterminal/openclaw` `scribe/20261011/upstream-fence-proven-absent`) |
| Control | upstream `openclaw/openclaw` main `00be4531663bd717033c54ef38d6f999f840a147` (the head's parent's parent) |
| Diff vs control | `scripts/lib/live-gateway-dist-fence.mts`, `test/scripts/live-gateway-dist-fence.test.ts` only |
| Fork issue | karmaterminal/openclaw#1421 (fork-side fix #1452) |
| Run | 2026-10-11, `node:24.17.0-bookworm`, aarch64, uid 1000, PID 1 not a service manager |

The product tree is `git archive` of the exact head (`inputs.sha256`). "Fix reverted" swaps in the
control's fence source byte-for-byte while keeping the head's tests. `proof.sh` is the exact script.

## Containers

- **A — no `systemctl` at all** (`A-no-systemctl.log`). The control does **not** refuse here
  (`FENCE_RESULT {"refuse":false}`, test preparation builds). The defect is not this shape.
- **B — `systemd` package installed, no running manager** (`systemctl --user is-system-running`
  → `offline`). This matches CI/container runner images. `B-systemctl-offline.log`,
  `B-systemctl-offline-full-prep.log`.

## Results (container B, full preparation)

| Step | Fence source | Tests | Result |
|---|---|---|---|
| 1 control | main | main | 41/41 + absence 3/3 pass |
| 2 head | head | head | 50/50 + absence 3/3 pass |
| 3 fix reverted | main | head | **4 failed** / 46 passed, on "Cannot verify" |
| 4 fix reapplied | head | head | 50/50 pass |
| 5 real fence call, control | main | — | `{"refuse":true,"message":"[openclaw] Cannot verify …"}` |
| 6 real fence call, head | head | — | `{"refuse":false}` |
| 7 `prepare-vitest-runtime`, control | main | — | refuses, exit 1, no `dist` |
| 8 `prepare-vitest-runtime`, head | head | — | full build, exit 0, 8559 `dist` entries |
| 9 Vitest after real preparation | head | head | 50/50 pass |

The four step-3 failures are the new cases (a) proceed-when-proven-absent and (d) inactive /
failed / live unresolvable-wrapper (the live one fails on the missing unit name). Cases (b) and (c)
pin refusals main already makes and pass on both sides.

Units 1–4 behave identically in container A; steps 5–9 are what distinguish A from B.
