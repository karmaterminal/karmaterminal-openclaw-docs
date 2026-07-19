# Method

1. Pin accepted assembly `4c235d8c1997e8964160117f8d6bf650ad1e8203` and the exact docs commit containing this corpus.
2. Use `proofs-manifest.json::dispatch_allocation` as the sole row/seat authority.
3. Fire each row once with `dry_run=false`, live metrics, and disposable scratch sessions.
4. Require exact candidate/seat identity, bounded public-safe journal evidence, and row-specific trace/topology receipts.
5. Preserve failed and partial artifacts; never convert candidate output into a corpus verdict without human review.
6. Run the critical first wave first: Ronan `R-CD-CHAINED-DEPTH-2`, Rune `R-CD-4`, Cael `R-CD-MODEL-TOOL`, and Elliott `R-CD-TOKEN`.
7. Require serialized sessions, fresh nonces, authoritative child/return correlation, raw public-safe Tempo JSON, and bounded gateway journals for those continuation rows.
8. Keep historical `6ee7eca2a4ce1a3e8efa7e51f9dd02d03081741d` material as provenance only.
9. Permit `honest_limit` only for `R-RC-2`, and only when the exact live receipt proves `request_compaction` was denied because context pressure remained below threshold. Every other row must resolve to `pass`, `partial`, `fail`, or remain `missing`.
