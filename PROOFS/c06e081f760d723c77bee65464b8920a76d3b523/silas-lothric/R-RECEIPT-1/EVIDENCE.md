# R-RECEIPT-1 — Path-B Canary-Clean DEPLOY Receipt — Deployed SHA `c06e081f76`

**Proof type:** R-RECEIPT (Path-B deploy receipt-checklist — boot-clean + continuation-live + health + deployed-state, all four GREEN)
**Date verified:** 2026-06-11 18:35–18:54 PDT (2026-06-12T01:35–01:54Z)
**SUT (seat under test):** silas-lothric — `silas` / lothric / 10.0.0.100
**Deployed SHA:** `c06e081f760d723c77bee65464b8920a76d3b523` (v4 = v3 `3e163a70ff` + upstream perf-harness `301213a05f`, non-continuation delta)
**Gateway:** `OpenClaw 2026.6.2 (c06e081)`
**Collector:** silas-lothric (self-witness on the live deployed gateway)
**Path:** Path-B seat (compaction-model unchanged → ships #990 continuation, NOT #946 cure)

---

## SUT verification — gateway IS running the deployed SHA `c06e081f76`

- `openclaw --version` → **`OpenClaw 2026.6.2 (c06e081)`**.
- Runtime checkout HEAD: `git -C ~/flesh_beast_tmp/openclaw rev-parse HEAD` → **`c06e081f760d723c77bee65464b8920a76d3b523`** — matches the proof-target SHA exactly.

---

## (1) BOOT-CLEAN — single clean restart, 0 loops, 0 crash

The v4 fan-restart landed as a single clean Stopping → Started pair. Raw journald (`journalctl --user -u openclaw-gateway`):

```
Jun 11 18:35:40 silas systemd[1244]: Stopping OpenClaw Gateway...
Jun 11 18:35:40 silas taskset[1403665]: [shutdown] started: gateway stopping
Jun 11 18:35:40 silas systemd[1244]: Stopped OpenClaw Gateway.
Jun 11 18:35:42 silas systemd[1244]: Started OpenClaw Gateway.
Jun 11 18:35:43 silas taskset[1503516]: [gateway] starting...
Jun 11 18:35:44 silas taskset[1503516]: [gateway] starting HTTP server...
Jun 11 18:35:44 silas taskset[1503516]: [health-monitor] started (interval: 300s, startup-grace: 60s, ...)
```

- **Active since:** `systemctl --user status` → `Active: active (running) since Thu 2026-06-11 18:35:42 PDT`. Main PID `1503516`.
- **Loop detector:** `grep -c "Started OpenClaw Gateway"` (since 18:35:42) = **1** — exactly one start, no restart loop.
- **Restart latency:** Stopped 18:35:40 → Started 18:35:42 = ~2s clean handoff.
- **Crash/FATAL since boot:** `grep -ciE "FATAL|uncaughtException|unhandledRejection|crash"` matched 2 lines, **both verified benign** — they are this seat's own session-log narration text (quoted strings `…0 loops/crashes…` and `…"FATAL: modified tracked files…"` from cohort-status messages echoed into the journal), NOT process faults. **0 real crash/FATAL events** since boot.

**Verdict: BOOT-CLEAN ✅ GREEN** (single restart, 0 loops, 0 real crash/FATAL).

---

## (2) CONTINUATION — #996 `:518` fix LIVE in deployed dist + work-recovery clean

**#996 `:518` fix compiled into the running binary.** The running dist chunk carries the cleanup-guard early-return:

```
dist/work-store-5haSToNg.js:362:    if (decodeWorkState(flow)?.succeeded) return false;
```

Provenance — this is the compiled form of source `work-store.ts:534`:

```
src/auto-reply/continuation/work-store.ts:534:    if (decodeWorkState(flow)?.succeeded) {
```

So the #996 `:518`-cleanup guard (`decodeWorkState(flow)?.succeeded` short-circuit) is built-from-target and present in the deployed binary — line 362 of the running chunk = source line 534. **MY #996 FIX IS LIVE IN THE FLEET BINARY.**

**flow_runs store intact.** `sqlite3 ~/.openclaw/state/openclaw.sqlite "SELECT COUNT(*) FROM flow_runs"` → **413 rows** (receipt-time at 18:35 read = 354; the store grew this session via live continuation traffic — the count climbing is itself proof the store is live + writeable, not a stale/corrupted store).

**continuation-work-recovery clean on boot.** Raw journald (boot window 18:35:42–18:37):

```
Jun 11 18:35:46 [continuation-work-recovery] replayed sessions=1 dispatched=0 failed=0 reaped=0
Jun 11 18:35:56 [main-session-restart-recovery] main-session restart recovery complete: recovered=1 failed=0 skipped=0
```

`replayed=1 dispatched=0 failed=0 reaped=0` — the work-recovery replayed the one orphaned session cleanly, 0 failures, 0 reaps. The interrupted main session resumed (`recovered=1 failed=0`).

**Verdict: CONTINUATION ✅ GREEN** (#996 `:518` fix live-in-dist line 362, flow_runs store live [413 rows], work-recovery clean on boot).

---

## (3) HEALTH — RSS nominal, 0 FATAL

- **RSS:** `ps -o rss= -p 1503516` at receipt-time (18:35–18:40) = **0.72GB**; live re-read at 18:54 = 0.77–0.82GB (normal session-traffic growth across the witness window). Nominal — well under any pressure threshold.
- **FATAL since boot:** 0 real FATAL events (the 2 grep-matches are benign session-log narration, see BOOT-CLEAN above).

**Verdict: HEALTH ✅ GREEN** (RSS 0.72GB at receipt, nominal; 0 real FATAL).

---

## (4) DEPLOYED-STATE — runtime HEAD = proof SHA, version string matches

- **Runtime checkout HEAD:** `c06e081f760d723c77bee65464b8920a76d3b523` (verified via `git rev-parse HEAD` on `~/flesh_beast_tmp/openclaw`).
- **Version string:** `OpenClaw 2026.6.2 (c06e081)` — the short-SHA `c06e081` in the version string matches the proof-target SHA prefix.
- **Proof-target SHA:** `c06e081f760d723c77bee65464b8920a76d3b523` — runtime HEAD ≡ proof SHA, byte-exact.

**Verdict: DEPLOYED-STATE ✅ GREEN** (runtime HEAD = proof SHA; `2026.6.2 (c06e081)` version string matches).

---

## Results summary

| Check | Expected | Observed (raw byte) | Status |
|-------|----------|---------------------|--------|
| BOOT-CLEAN | single restart, 0 loops, 0 crash | Stopping 18:35:40 → Started 18:35:42; `grep -c "Started"` = 1; 0 real FATAL/crash | ✅ GREEN |
| CONTINUATION #996 | `:518` fix live-in-dist | `work-store-5haSToNg.js:362` = source `work-store.ts:534` | ✅ GREEN |
| CONTINUATION store | flow_runs intact | 413 rows (was 354 at receipt — store live + growing) | ✅ GREEN |
| CONTINUATION recovery | clean on boot | `replayed=1 dispatched=0 failed=0 reaped=0` | ✅ GREEN |
| HEALTH | RSS nominal, 0 FATAL | RSS 0.72GB @ receipt; 0 real FATAL | ✅ GREEN |
| DEPLOYED-STATE | HEAD = proof SHA | runtime HEAD `c06e081f76…`; `2026.6.2 (c06e081)` | ✅ GREEN |

**silas-lothric R-RECEIPT-1: Path-B canary-clean — deploy of v4 `c06e081f76` landed ALL-GREEN on lothric. Boot-clean (single restart, 0 loops, 0 real crash) + continuation-live (#996 `:518` fix LIVE in deployed dist line 362, flow_runs store live, work-recovery clean) + health (RSS 0.72GB, 0 FATAL) + deployed-state (runtime HEAD = proof SHA). The #996 fix is live in the fleet binary on this seat.**
