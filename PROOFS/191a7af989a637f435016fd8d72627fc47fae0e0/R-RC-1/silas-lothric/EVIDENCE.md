# R-RC-1 — request_compaction threshold REJECT canary (Silas)

**Ship SHA:** `191a7af989a637f435016fd8d72627fc47fae0e0`
**Runtime:** `OpenClaw 2026.6.10 (191a7af)`
**Seat:** 🌫 Silas / `silas-lothric`
**Captured:** 2026-06-27 10:27 PDT
**Verdict:** ✅ PASS-candidate — threshold guard rejected below configured minimum as designed.

## Fire

Silas fired `request_compaction()` from the active Discord main session after the `191a7af989a637f435016fd8d72627fc47fae0e0` prince-room deploy. The intent was the R-RC-1 low-context guard proof, not a real compaction request.

### Receipt

```json
{
  "status": "rejected",
  "guard": "context_threshold",
  "contextUsage": 39,
  "threshold": 70,
  "reason": "Context usage (39%) is below the minimum threshold (70%). Compaction is not needed yet."
}
```

## Meaning

The row proves `request_compaction()` does not accept an agent-initiated compaction request below the configured threshold. This is the expected safety gate: low-fill sessions cannot churn compaction just because the tool is present.

## Runtime / SHA identity

- `openclaw --version` on Silas returned `OpenClaw 2026.6.10 (191a7af)`.
- Runtime checkout head resolved to `191a7af989a637f435016fd8d72627fc47fae0e0`.
- `gh api repos/karmaterminal/openclaw/commits/191a7af989 --jq .sha` resolved the same full SHA.

## Honest trace note

The guard rejection returned directly from the tool surface. The tool receipt did not expose a trace id/traceparent for this rejected guard path, so this PASS-candidate is filed with the exact tool receipt as the load-bearing evidence rather than fabricating a Tempo pointer. If 🌿 wants a trace-backed variant, rerun from a surface that emits the tool trace id.

## No-secrets statement

The filed artifacts contain no gateway token, session key, nonce, prompt body, raw provider response, or private user content. The only payload is the public-safe rejection receipt above.
