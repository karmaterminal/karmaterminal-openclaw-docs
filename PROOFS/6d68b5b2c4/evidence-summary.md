# Proof Corpus: `6d68b5b2c4` (PR openclaw/openclaw#79925)

## Context
- **PR head at proof-time**: `4e11558fff73a705192b54b74d32b7bc259ad3a9` (test-file-only delta from deployed `6d68b5b2c4`; no runtime behavior change)
- **SUT**: silas-canary (10.0.0.153 / silas.dandelion.cult) deployed `6d68b5b2c4`
- **Collector**: cael-seat (10.0.0.148) running `094f45345a`
- **Time**: 2026-05-14T03:05-03:10Z (2026-05-13 20:05-20:10 PDT)

## Results

| Proof | Tool | Result | Tempo Trace |
|-------|------|--------|-------------|
| R-CW-1 | continue_work(delaySeconds=5) | **PASS** | `tempo-dfccb2892b5a1fdebc73fa91612037ec-cael-rcw1.json` (21KB) |
| R-CD-1 | continue_delegate(mode=normal) | **PASS** | `tempo-5eef29dd743331e4eeba4388050cb93f-cael-rcd1.json` (27KB) |
| R-CD-2 | continue_delegate(mode=silent) | **PASS** | `tempo-54c80eab7f9669b91d08286cc9e03956-cael-rcd2.json` (43KB) |
| R-OBS-1 | session_status observability | **PASS** | (inline in proof) |
| R-RC-1 | request_compaction gate-behavior | **PASS** | (inline in proof; rejects at 29% < 70%) |

## Delta vs PR head
PR head `4e11558fff` differs from deployed `6d68b5b2c4` by 1 commit: `server.sessions-send.test.ts` position-fragility fix (`.at(0)` → `.find()`). Test-file only; zero runtime behavior delta. Proofs cover the identical runtime surface.

## Tempo traces
All traces collected via SSH port-forward through elliott (k3s port-forward to tempo-0 pod in observability namespace). Service name: `cael-prince`.
