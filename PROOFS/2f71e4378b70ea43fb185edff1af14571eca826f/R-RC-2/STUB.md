# R-RC-2 — request_compaction over-threshold ACCEPT

Per `openclaw-bootstrap:main/RUNBOOKS/PROOF-CORPUS-METHOD.md` § "Per-prince row assignments":

| Row | Owner | Behavior |
|---|---|---|
| **R-RC-2** | 🩸 **Cael** | `request_compaction()` over-threshold ACCEPT |

Expected evidence files (placeholder until cael driver-axis fires from cael-DGX seat):
- `EVIDENCE.md` — substrate-of-record + verdict
- `compaction_accept_request_receipt.txt` — tool-result payload confirming ACCEPT
- `compaction_accept_request_trace.json` — Tempo trace JSON (Grafana Tempo URL: http://tempo.dandelion.cult/api/traces/<trace-id>)
- `journal_request_compaction.log` — gateway journal excerpt showing accept-shape
- (optional) `cohort-side-fire/` subdir — cohort cross-walk side-receipts per `silas-side-fire/` past-pattern

Per PROOF-CORPUS-METHOD discipline: remove this STUB.md when EVIDENCE.md + trace.json + journal-receipt land.
