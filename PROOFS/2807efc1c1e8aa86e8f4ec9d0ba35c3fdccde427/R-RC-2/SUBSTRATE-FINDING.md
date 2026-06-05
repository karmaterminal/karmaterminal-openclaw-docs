# R-RC-2: request_compaction over-threshold ACCEPT — HONEST-LIMIT (held pending)

Seat: cael (🩸) / cael-dgx · Build: OpenClaw 2026.6.2 (2807efc)

## Canonical behavior
request_compaction() is ACCEPTED (enqueues compaction) when contextUsage > threshold (70%).

## Why PASS-shape can't fire clean right now
cael-dgx current context usage: **33%** (332k/1.0m, session_status 08:17 PDT) — **below the 70% ACCEPT threshold**. Firing request_compaction now would return the REJECT receipt (guard: context_threshold), proving only the REJECT-path and OVERCLAIMING the ACCEPT-row.

## Honest classification: ⚠️ HONEST-LIMIT (held pending), NOT a failure
Identical discipline to the cure-12 `581678f4` corpus where elliott-seat held R-RC-1-addendum pending at 15% ctx rather than overclaim the ACCEPT-path from a below-threshold seat.

## Resolution path
R-RC-2 ACCEPT-path will be fired honestly when a seat reaches >70% ctx on a main-session turn. The REJECT-path (R-RC-1) is silas-canonical (low-ctx). Until a seat climbs above threshold, R-RC-2 stays ⚠️ held — no overclaim.

## Gate-source integrity
The request_compaction threshold-gate (70%) is byte-identical between assembly SHA `2807efc1c1e` and presentation-head `9d07233` — the #923 change does not touch compaction-gating. NOT a cure-regression.
