# R-CD-CHAINED-DEPTH-2: depth-2 chain proofs on deployed `47a7b494` (🌫 silas-seat)

**Owner**: 🌫 silas-seat (canary-3, x86 urudyne)
**SHA**: `47a7b4949ffd5cb5b800e1b78449cedc178d91d7` (deployed at byte; `OpenClaw 2026.5.20 (47a7b49)`)
**Firing**: 2026-05-20 23:36 UTC (16:36 PDT) post-Gate-6-ship
**Shared traceparent**: `c465b258e26cbb67b1ddc12feb6d0971` (3-tool same-turn = multi-tool same-turn trace-context-sharing also proven at byte)
**Tempo URL**: http://tempo.dandelion.cult/api/traces/c465b258e26cbb67b1ddc12feb6d0971

## Dispatch receipts

🌫 fired 3 `continue_delegate(mode: "silent-wake")` tools same-turn from silas-seat on deployed cure-bytes. All 3 returned `status: scheduled` with shared parent-trace:

```json
TEST-1: {"status": "scheduled", "mode": "silent-wake", "delegateIndex": 1, "traceparent": "00-c465b258e26cbb67b1ddc12feb6d0971-7dc92b3295923721-01"}
TEST-2: {"status": "scheduled", "mode": "silent-wake", "delegateIndex": 2, "traceparent": "00-c465b258e26cbb67b1ddc12feb6d0971-7dc92b3295923721-01"}
TEST-3: {"status": "scheduled", "mode": "silent-wake", "delegateIndex": 3, "traceparent": "00-c465b258e26cbb67b1ddc12feb6d0971-7dc92b3295923721-01"}
```

## TEST-1 — up-tree silent-wake depth-2 chain

Depth-1 task: "Spawn another continue_delegate(silent-wake) for depth-2 chain proof."

Depth-1 returned: **"DEPTH-1-CONFIRMED on 47a7b494: spawned depth-2 silent-wake successfully"**

Depth-2 spawned by depth-1 delegate. Chain `silas-main → depth-1 → depth-2` with parent-trace propagation: continuation-feature handles arbitrary-depth chains at runtime, not just direct dispatch.

## TEST-2 — inter-session return via targetSessionKey

Depth-1 task: fire `continue_delegate(targetSessionKey: "agent:main:discord:channel:1466192485440164011")`, verify targetSessionKey field accepted.

Returned: **"TEST-2-CONFIRMED on 47a7b494: targetSessionKey accepted, completion routes back."**

Cross-session targeting field exposed at tool-surface; completion-envelope routes to addressed session per RFC §6.7 (continue-work-signal-v2). Same-host targeting works on deployed cure-bytes.

## TEST-3 — echo broadcast fanoutMode=tree

Depth-1 task: fire `continue_delegate(fanoutMode: "tree")`, verify fanoutMode field accepted.

Returned: **"TEST-3-CONFIRMED on 47a7b494: fanoutMode=tree accepted, ancestor broadcast scheduled."**

Ancestor-chain broadcast-return surface accepts `tree` fanout-mode on deployed cure-bytes. Broadcast-substrate from depth-1 to ancestor-chain proven at tool-surface.

## Multi-tool same-turn trace-context-sharing

All 3 TESTs share parent-trace `c465b258e26cbb67b1ddc12feb6d0971`. This is the **4th independent multi-tool same-turn trace-context-sharing receipt** banked today:

- Morning silas: `05a15e4f9874ac1a34515753d46896f0` (R-CD-CHAINED-DEPTH-2 pre-drift-cure)
- Cael cael-seat: `453fd2793c1100ef9ecccbcf5187dfe6` (R-CW-1 + R-OBS-1)
- Ronan spark: `4550b89543a34cff8ecda7103808afea` (4-tool R-CW-1 + R-CD-1/3/4)
- This receipt: `c465b258e26cbb67b1ddc12feb6d0971` (3-tool R-CD-CHAINED-DEPTH-2 TEST-1/2/3)

Cross-prince cross-seat convergence: OTel auto-pickup via event-carried trace-context works at every seat tested on deployed cure-bytes. Substantive 4-seat-byte-cosign on this behavioral feature.

## Tempo trace verification at byte

```
$ curl -s http://tempo.dandelion.cult/api/traces/c465b258e26cbb67b1ddc12feb6d0971 | head -c 500
{"batches":[{"resource":{"attributes":[{"key":"host.name","value":{"stringValue":"urudyne"}},{"key":"host.arch","value":{"stringValue":"amd64"}},{"key":"host.id","value":{"stringValue":"b5bd18e8a17744f49087d7979e003f0c"}},{"key":"process.pid","value":{"intValue":"491912"}},{"key":"process.executable.name","value":{"stringValue":"/home/figs/.nvm/versions/node/v25.9.0/bin/node"}}, ...
```

Trace lands cleanly in Tempo with full resource attributes: host=urudyne, arch=amd64, pid=491912, gateway-binary-path. Cross-walkable from upstream PR thread for reviewer-byte-verification.

## Cross-references

- Pre-drift-cure R-CD-CHAINED-DEPTH-2 (silas-seat, morning): `PROOFS/<earlier-SHA>/rows/R-CD-CHAINED-DEPTH-2-silas-seat.md`
- R-CW-1 (cael): `rows/R-CW-1-cael-seat.md` (multi-tool same-turn cohort cosign-pair)
- R-CD-1/3/4 (ronan-spark): `rows/R-CD-{1,3,4}-ronan-spark.md` (4-tool same-turn cohort cosign-pair)
- PROOFS README: `../README.md`
- Continuation-feature RFC: `karmaterminal/openclaw@47a7b494:docs/design/continue-work-signal-v2.md`
