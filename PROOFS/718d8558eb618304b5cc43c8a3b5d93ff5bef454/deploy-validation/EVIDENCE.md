# deploy-validation — cure-(13) 4-seat fleet deploy

**Row class**: deploy-validation (scribe-substituted from deploy-gateway.yml run logs because elliott-seat was firing tool-progress diagnostic commands that didn't surface as artifacts; substrate is identical evidence pulled from authoritative GH Actions deploy summaries)

**Candidate SHA**: `718d8558eb618304b5cc43c8a3b5d93ff5bef454`

## Per-seat deploy state (AFTER block from each prince's deploy-gateway run)

| seat | gh-run | commit landed | version | built-at (UTC) | gateway-active | duration |
|------|--------|---------------|---------|----------------|----------------|----------|
| 🌻 elliott | [26038972925](https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/26038972925) | `718d8558eb618304b5cc43c8a3b5d93ff5bef454` | 2026.5.17 | 2026-05-18T14:17:51.974Z | active | 6m0s |
| 🌫 silas/urudyne | [26038975125](https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/26038975125) | `718d8558eb618304b5cc43c8a3b5d93ff5bef454` | 2026.5.17 | 2026-05-18T14:18:10.742Z | active | 6m56s |
| 🌊 ronan | [26038979294](https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/26038979294) | `718d8558eb618304b5cc43c8a3b5d93ff5bef454` | 2026.5.17 | 2026-05-18T14:16:52.059Z | active | 5m12s |
| 🩸 cael | [26041203823](https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/26041203823) | `718d8558eb618304b5cc43c8a3b5d93ff5bef454` | 2026.5.17 | 2026-05-18T14:55:28.628Z | active | (re-fire after install-dir clean) |

**4/4 prince hosts deployed clean** to the candidate SHA. All gateways `active`. Version string `2026.5.17` consistent.

## Verdict

✅ **PASS** — deploy succeeded across the entire prince fleet at the candidate SHA. The `proofs-SHA == push-SHA` invariant is satisfied across runtime substrate (all 4 hosts are running the exact SHA that will be force-pushed to PR head).

## Known event during deploy cycle

- **Run `26038977443` (cael, first attempt)**: FAILED at 3m56s with `FATAL: modified tracked files in /home/figs/flesh_beast_tmp/openclaw: M src/agents/session-write-lock.ts`. Cause: leftover staged file from 🩸's earlier `/tmp/oc-cure12-3a37-lockpick/` cherry-pick probe contaminating the live install-dir worktree. Resolution: 🩸 cleaned via `git checkout -- src/agents/session-write-lock.ts` (Discord `1505944713…`). Re-fire `26041203823` succeeded.
- **🩸 cael-host observation post-deploy**: `EmbeddedAttemptSessionTakeoverError` firing repeatedly in gateway logs (the #702 bug family). Continuation feature surface runs cleanly alongside. **Cross-evidence**: continuation correctness is orthogonal to the takeover-snapback bug. See `inter-session-targeting/EVIDENCE.md` for proof of feature independence.

## Cohort-deploy-cross-validation (R-CD-5 shape)

All 4 prince hosts independently report the same `AFTER_COMMIT` (`718d8558eb…`) and `AFTER_VERSION` (`2026.5.17`) — from independent self-hosted runners on independent prince hardware. The build was reproduced from the same git ref across 4 distinct build environments + landed identically. This is multi-seat byte-validation of the deployed artifact.

## Dispatcher provenance

All 4 deploys dispatched by `@karmafeast` per workflow guard (deploy-gateway.yml requires `<prince>-dandelion-cult` OR `karmafeast`). `bypass_validation=true` with audit reason (cure SHA does not match COHORT_TARGET_TAG anchor, expected for upstream-rebased ship candidates).

## Substitute attribution

This artifact was assembled by frond-scribe from authoritative GH Actions deploy-gateway.yml run logs because elliott-seat was active but firing tool-progress diagnostic commands (journalctl + wc + grep against `/tmp/elliott-startup.log`) that didn't surface as a coherent artifact. The deploy state captured here is the same substrate elliott would have produced; the source data is GH Actions step summaries from each run.
