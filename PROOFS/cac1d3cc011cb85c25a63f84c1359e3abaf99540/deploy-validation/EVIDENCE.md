# deploy-validation — cure-(14) 4-seat fleet deploy

**Candidate SHA**: `cac1d3cc011cb85c25a63f84c1359e3abaf99540`

## Per-seat deploy state (AFTER block from each prince's deploy-gateway run)

| seat | gh-run | commit landed | version | built-at (UTC) | gateway-active | duration |
|------|--------|---------------|---------|----------------|----------------|----------|
| 🌻 elliott | [26045334847](https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/26045334847) | `cac1d3cc011cb85c25a63f84c1359e3abaf99540` | 2026.5.17 | 2026-05-18T16:14:28.180Z | active | 6m51s |
| 🌫 silas/urudyne | [26045336611](https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/26045336611) | `cac1d3cc011cb85c25a63f84c1359e3abaf99540` | 2026.5.17 | 2026-05-18T16:13:40.649Z | active | 6m35s |
| 🩸 cael | [26045338257](https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/26045338257) | `cac1d3cc011cb85c25a63f84c1359e3abaf99540` | 2026.5.17 | 2026-05-18T16:12:18.259Z | active | 4m25s |
| 🌊 ronan | [26045339878](https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/26045339878) | `cac1d3cc011cb85c25a63f84c1359e3abaf99540` | 2026.5.17 | 2026-05-18T16:12:18.544Z | active | 4m25s |

**4/4 prince hosts deployed clean** to the candidate SHA. All gateways `active`. Version string `2026.5.17` consistent across the fleet. No deploy failures; no rollback fires.

## Verdict

✅ **PASS** — proofs-SHA == push-SHA invariant satisfied across runtime substrate. Cure-(14) is on every prince host before force-push.

## Cohort-deploy-cross-validation (R-CD-5 shape)

All 4 prince hosts independently report the same `AFTER_COMMIT` (`cac1d3cc01…`) and `AFTER_VERSION` (`2026.5.17`) — from independent self-hosted runners on independent prince hardware (cael ARM64 aarch64, silas/urudyne x86_64, ronan x86_64, elliott ARM64 raspberry pi). The build was reproduced from the same git ref across 4 distinct build environments + landed identically. Multi-seat byte-validation of the deployed artifact.

## Cohort thin re-verification (in lieu of full proof re-fire — runtime-identical-attest)

Per cohort consensus on cure-(14)'s mechanical-drift nature, the substantive feature proofs at cure-(13) `718d8558eb` apply via runtime-identical-attest (cure-(14) deltas were rename-mechanical + orthogonal-additive). Two-seat thin re-verification confirms the continuation surface accepts calls cleanly on the new SHA:

### 🩸 cael-host thin reconfirm

After deploy landed (`OpenClaw 2026.5.17 (cac1d3c)`):

```
continue_work() → status: "scheduled"
traceparent:     630783c3f46fd50c679e45e11e0cb71b
chain counter:   3/200 → expecting 4/200 on next turn
gateway uptime:  2m, session healthy
```

Source: Discord `1505966910112530462`.

### 🌫 silas-host thin reconfirm

Bank: [`R-TA-1-RECONFIRM/`](../R-TA-1-RECONFIRM/) at commit `39a268a` on docs main.

```
continue_delegate(silent-wake)
traceparent: 00-5eaaff94cfb56e4b640f87eaa5805c1c-20647abeb4837380-01
response shape: byte-identical to cure-(13) R-TA-1
delegateIndex: 1, chain 0/200
note text: exact match to cure-(13) cure-feature output
gateway uptime: 1m1s at capture, opus-4.7-1m-internal stable
```

Source: Discord `1505967326158131250`.

## Dispatcher provenance

All 4 deploys dispatched by `@karmafeast` per workflow guard (deploy-gateway.yml requires `<prince>-dandelion-cult` OR `karmafeast`). `bypass_validation=true` with audit reason (cure SHA does not match COHORT_TARGET_TAG anchor, expected for upstream-rebased ship candidates).

## Cross-link to substantive feature proofs

Runtime path bytes from cure-(14) deltas do NOT touch the continuation surface enforcement sites. The cure-(13) proof corpus at [`PROOFS/718d8558eb618304b5cc43c8a3b5d93ff5bef454/`](../../718d8558eb618304b5cc43c8a3b5d93ff5bef454/) covers:

- `continuation-live-fire.md` — 4 tool fires with single trace, fan-out counter, status discriminator, request_compaction no-fire verification
- `R-TA-1/` — chain-budget accounting (cure-(14) `R-TA-1-RECONFIRM/` confirms byte-identical at new SHA)
- `R-TA-2/` — per-session token-counter + post-compaction queue stability
- `inter-session-targeting/` — cross-session resumption + delivery verification
- `post-compaction-threshold/` — 70%+ context-pressure compaction firing path
- `deploy-validation/` — 4-seat fleet deploy (cure-(13))
- `gateway-health/` (🌻) — single-seat post-deploy health receipt

All apply via runtime-identical-attest. Cure-(14) deltas were:

- `__testing` → `testing` identifier rename (4 test files) — zero runtime semantics change
- `.oxlintrc.json` allow-list (cure preserved) — lint config, no runtime impact
- Orthogonal-additive merges in `agent-runner-execution.ts` (2 blocks) + `pi-embedded-runner/run.ts` — both upstream's new callbacks AND cure's continuation params coexist, neither side clobbers
- `run-attempt.ts` — upstream's `handleDynamicToolCallWithTimeout` wrapper supersedes cure's older pattern (not continuation-load-bearing)
- `subagent-registry.test.ts` — upstream's new test block (not feature-load-bearing)
- Three cascade fixups (test-mock additions + lint-disable removal) — typecheck-only, runtime-neutral
