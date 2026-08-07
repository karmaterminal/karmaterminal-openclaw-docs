# Method

1. Pin accepted assembly `6ee7eca2a4ce1a3e8efa7e51f9dd02d03081741d` and immutable docs refs `246c447ad9d93039ff4777890d4b4027613bd9f3` / `93bbbf4ab4998b620d1cf5612bd3246445df8b57`.
2. Use `proofs-manifest.json::dispatch_allocation` as the sole row/seat authority.
3. Fire each allocated row at most once with live metrics and disposable sessions.
4. Review exact candidate/seat/docs identity, bounded public-safe journal receipts, row-required trace topology, and candidate result status.
5. Promote candidate evidence only after independent review. `R-CW-3` was promoted to PASS after its dedicated Tempo redaction review passed.
6. Preserve PARTIAL and HONEST-LIMIT behavior exactly. Keep rows MISSING when required traces are absent, committed scenarios are scaffold-only, or timeout interruption leaves possible fire consumption uncertain.
7. Do not refire consumed or possibly consumed rows without explicit group authorization.
