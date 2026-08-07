# Frozen local proof-root transfer

This directory is a byte-for-byte transfer of Cael's local proof root captured at:

`/home/figs/.local/state/openclaw-proof-runs/03939273216bc0c08a2df2d768f2f8d6549ca1f2-rowwise-20260806T205552Z`

It is evidence preservation only. It is **not** a corpus fold, a pass/fail claim, a product patch, or authorization to rerun rows.

Contents:

- `FROZEN_ROOT/` — transferred root, unchanged.
- `COPILOT_AUDIT_REPORT.md` — the local read-only audit report supplied with the transfer.
- `MANIFEST-38.tsv` — the 36 canonical rows plus two fixture rows, with their recorded exit codes and artifact directories.
- `SHA256SUMS` — SHA-256 for every transferred root file and transfer-level artifact.
- `TRANSFER_RECEIPT.txt` — file/byte counts and anchor hashes.

Reviewers must verify `SHA256SUMS` before interpreting any receipt. Classifications in the transferred material are historical/local observations until independently reviewed from these bytes.
