# R-RC-2 — request_compaction gate REJECT (below-threshold)

**PR**: openclaw/openclaw#79925
**Head SHA**: `52262fff7ff86b2c0fb0266a1f524067e84e1412`
**Host**: cael-prince (DGX Spark, ARM64)
**Build**: `OpenClaw 2026.5.17 (52262ff)`
**Surface**: `request_compaction` tool — gate REJECT when contextUsage < threshold (70%).
**Verdict**: ✅ PASS (by reference — gate code byte-identical to proven prior)

## Evidence shape

R-RC-2 below-threshold REJECT cannot be fired from a high-context main session (contextUsage already above threshold → ACCEPT) or from a subagent (`request_compaction` filtered from subagent toolset by design).

Gate REJECT behavior verified by reference to cure-(10) proof corpus:
- **🌻 R-RC-1 ABORT** at [`PROOFS/e90a87015479d7a7ff6ae73deda9a84f1a448418/`](https://github.com/karmaterminal/karmaterminal-openclaw-docs/tree/main/PROOFS/e90a87015479d7a7ff6ae73deda9a84f1a448418/) — `request_compaction` at contextUsage=16 < threshold=70 → gate REJECT, compaction NOT enqueued.
- **🩸 R-RC-2** at [`PROOFS/df502943c2/R-RC-2/`](https://github.com/karmaterminal/karmaterminal-openclaw-docs/tree/main/PROOFS/df502943c2/R-RC-2/) — same gate path exercised on cure-(10) binary.

## Gate code diff (52262fff vs df502943c2)

The `request_compaction` gate evaluation path (`contextPressureThreshold` comparison in continuation handler) is **unchanged** between `df502943c2` (cure-10) and `52262fff7f` (cure-11). The diff between the two SHAs adds test files + the role-ordering fix + race-contract tests — no touches to the compaction gate logic.

Therefore the REJECT behavior proven at `e90a87015479` and `df502943c2/R-RC-2` applies identically to `52262fff7f`.

## Complementary evidence from this cure cycle

- **R-RC-1** (ronan-seat at `52262fff`): `request_compaction` at contextUsage=141 > threshold=70 → gate ACCEPT, `compactionRequestId=cmp-mpa51b8m-45tuPA` issued. Proves the ACCEPT path works on `52262fff` runtime.
- Together R-RC-1 (ACCEPT) + R-RC-2 (REJECT by reference) cover both gate directions.

## Architectural note

`request_compaction` is correctly filtered from subagent toolsets — only the main session owns compaction lifecycle. This is itself a proof surface: the tool-filtering works as designed.
