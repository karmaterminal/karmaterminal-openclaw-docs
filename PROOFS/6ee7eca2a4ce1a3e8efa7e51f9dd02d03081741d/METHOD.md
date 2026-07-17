# Method

1. Pin accepted assembly `6ee7eca2a4ce1a3e8efa7e51f9dd02d03081741d` and the exact docs commit containing this corpus.
2. Use `proofs-manifest.json::dispatch_allocation` as the sole row/seat authority.
3. Fire each row once with `dry_run=false`, live metrics, and disposable scratch sessions.
4. Require exact candidate/seat identity, bounded public-safe journal evidence, and row-specific trace/topology receipts.
5. Preserve failed and partial artifacts; never convert candidate output into a corpus verdict without human review.
6. Keep historical `cea9e4296b7e5cd37f0a491d637ef8459ea2e737` material as provenance only.
