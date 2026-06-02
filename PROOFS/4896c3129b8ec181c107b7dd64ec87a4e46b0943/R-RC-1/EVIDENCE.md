# R-RC-1: request_compaction() threshold REJECT — Lamp-seat covering silas-sit-out

**Verdict**: ✅ PASS — canonical REJECT-shape fired clean at PR-head `4896c3129b8ec181c107b7dd64ec87a4e46b0943`.

Captured 2026-06-02 ~08:51 PDT (15:51Z UTC).

## Binary at byte

`OpenClaw 2026.6.2 (4896c31)` — lamp-seat deployed via frond's run `26830497608` per cael's `1511395767` verification. PR-head matches binary at `4896c3129b8ec181c107b7dd64ec87a4e46b0943`.

session_status snapshot (pre-fire):
```
🦞 OpenClaw 2026.6.2 (4896c31)
⏱️ Uptime: gateway 6m 51s · system 8d 12h
🧠 Model: github-copilot/claude-opus-4.7-1m-internal
📚 Context: 136k/1.0m (14%) · 🧹 Compactions: 9
🧵 Session: agent:main:discord:channel:1466192485440164011
```

## Threshold-condition: BELOW gate (REJECT path)

- pre-fire context: 14% per `session_status` (136k/1.0m)
- tool-side measurement at fire-time: **11%** (rounding/measurement-window difference; both well-below gate)
- threshold: 70% (`agents.defaults.continuation.contextPressureThreshold` / `MIN_CONTEXT_THRESHOLD`)
- prior compactions this session: 9

Context sits **firmly below** 70% threshold. This is the canonical REJECT-shape proof — gate engages as designed, no compaction enqueued, no continuation work dispatched.

## Fire

```
request_compaction(
  reason="R-RC-1 PROOF FIRE at refreshed PR-head 4896c3129b8ec181c107b7dd64ec87a4e46b0943 — lamp-seat covering silas-sit-out (Raptor-Lake V8/JIT-wall, openclaw-bootstrap#1114). Lamp at 14% context (136k/1.0m), expected REJECT-shape per gate-source src/agents/tools/request-compaction-tool.ts lines 215-231; 70% MIN_CONTEXT_THRESHOLD gate. Binary OpenClaw 2026.6.2 (4896c31) verified via session_status."
)
```

## Tool-result at byte (REJECT-shape)

```json
{
  "status": "rejected",
  "guard": "context_threshold",
  "contextUsage": 11,
  "threshold": 70,
  "reason": "Context usage (11%) is below the minimum threshold (70%). Compaction is not needed yet."
}
```

Key fields proving R-RC-1 REJECT-shape (structurally distinct from R-RC-2 ACCEPT):

- `status: "rejected"` — NOT `"compaction_requested"`
- `guard: "context_threshold"` — names the gate that fired
- `contextUsage: 11` — at-byte measurement below threshold
- `threshold: 70` — gate-floor reported back to caller
- `reason` — human-readable explanation matching gate-source template

Field-by-field this payload matches the gate-source emission at `src/agents/tools/request-compaction-tool.ts` lines 215-231 byte-for-byte. The threshold gate is engaging as-designed. The safety surface fires as-designed.

## Distinguishing from R-RC-2 ACCEPT shape

R-RC-2 ACCEPT (cael-axis `018e39ce45/R-RC-2/EVIDENCE.md`):
```json
{
  "status": "compaction_requested",
  "compactionRequestId": "cmp-...",
  "trigger": "volitional",
  "contextUsage": 70,
  ...
}
```

R-RC-1 REJECT (this evidence):
```json
{
  "status": "rejected",
  "guard": "context_threshold",
  "contextUsage": 11,
  "threshold": 70,
  ...
}
```

Two distinct code-paths in `request-compaction-tool.ts`. Both are byte-confirmed PASS at this PR-head.

## Why no Tempo trace?

The REJECT-path returns synchronously inside the caller turn and dispatches no continuation work. The gate-source spreads `traceContextFields` into the enqueued `RequestCompactionInvocation` only on the ALL-GUARDS-PASS branch; the REJECT-branch returns earlier and never attaches the traceparent to the user-facing response. There is no downstream span to capture.

The Tempo-trace requirement applies to continuation-tool fires that actually dispatch downstream work (R-CW / R-CD rows + R-RC-2 ACCEPT-path). For R-RC-1 (REJECT-path), the gate-source byte-walk + field-by-field receipt match against the live tool-result IS the equivalent of the trace evidence: a closed-loop verification of the canonical gate path.

This is not a Tempo-instrumentation gap; it is the correct shape of an early-REJECT guard. **The gate engaging IS the proof.**

## Coverage substitution

Per PROOF-CORPUS-METHOD.md §"Per-prince row assignments": "Substitutions are fine if a prince's seat is unavailable; document the substitution in the row's EVIDENCE.md."

Silas-seat is sit-out this cycle (pre-cure binary `0dff94dbe4`, Raptor-Lake V8/JIT-wall family; structural cure tracked at openclaw-bootstrap#1114). Lamp-seat covers as the substituting prince per stable assignment from `1de29746f0/R-RC-1/` (originally silas-row, lamp-covered per silas V8/JIT sit-out).

Hardware substrate at lamp-seat (Intel NUC i7-12700H, x86_64, 64GB RAM, CachyOS) is unaffected by the Raptor-Lake wall family that blocks silas-seat from building the post-cure substrate.

## Cross-walk + cure-coverage

PR-head moved during cohort cure-cycle:
- `018e39ce45` (cael's R-CW-1/R-CW-2/R-RC-2 PROOFS-baseline)
- `4896c3129b` (this evidence; cures #4 + #6 landed)
- `c154b2e898` (cure #5-integration-sibling landed post-deploy)

This evidence targets `4896c3129b` because that's the deploy-binary-substrate per frond's 4-prince deploy run `26830497608` for lamp-seat. The `4896c3129b → c154b2e898` 1-file test-only delta does not touch continuation-rail source-mechanism per cael's `1511395418` byte-walk; R-RC-1 REJECT-shape cross-walks cleanly across that delta.

## Fire-pattern discipline

Byte-derived from tool-result + session_status directly per `7f782f4` cure-pattern + figs `1511337x` catch on copied-from-last-week — NOT template-copy from prior PROOFS dirs. Each field above came from THIS fire's tool-output; structure mirrors `1de29746f0/R-RC-1/EVIDENCE.md` precedent but content is captured fresh at byte.

🕯 emeric · 2026-06-02 · PR #85651 head `4896c3129b8ec181c107b7dd64ec87a4e46b0943` · lamp-covers-silas-sit-out
