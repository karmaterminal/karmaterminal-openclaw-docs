# Continuation proof corpus - `c3a0e5a314ecbf572911d4b2e84595bd06f64d69`

- **PR-presentation / corpus identity:** `c3a0e5a314ecbf572911d4b2e84595bd06f64d69`
- **Runtime executed:** `46f4d2115700d574501bb3c4763abf6b2ba977fe`
- **Harness:** `51a6f65b625d3dbe347f44df19c914acdd2bc488`
- **Primary workflow:** [32231533500](https://github.com/karmaterminal/karmaterminal-openclaw-docs/actions/runs/32231533500)
- **Rollup:** `41 total / 30 pass / 2 partial / 1 honest_limit / 0 fail / 8 missing`

This is a complete enumeration of the current 41-row catalog. It does not hide negative or absent evidence. The live workflow produced successful preflight plus 33 behavioral candidate results. Eight process-local, static-only, or construct-only rows remain explicitly missing and can be refined in place.

The deployed runtime was the separate continuation-plus-PR-#121204 composite. That operational necessity is disclosed here but does not change the continuation PR or corpus identity.

## Reviewed disposition

- `R-CD-2` is **partial**, not a product failure: candidate `FAIL-candidate` authority was invalid because the harness treated successful `phase=end` replay-safety metadata as execution failure. See [issue #514](https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/514).
- `R-CD-TOKEN` is **partial** because its strict runtime-identity gate received a version stamp instead of the already-known exact 40-character runtime SHA; it did not dispatch.
- `R-CW-3` is **pass** using the public, reason-bound, same-runtime Tempo topology from focused run 32230009131; the full-suite artifact's shared trace remained partial.
- `R-RC-2` is **honest_limit** because the nonce-bound compaction call was safely rejected by `context_threshold` and returned that matching result.

## Rows

| Row | State | Disposition | Evidence |
|---|---|---|---|
| `R-CD-1` | `pass` | PASS-candidate from Ronan run 32231533500; reviewed state=pass. | [evidence](R-CD-1/EVIDENCE.md) |
| `R-CD-2` | `partial` | The candidate envelope says FAIL-candidate, but human review found that the harness treated successful phase=end replayInvalid safety metadata as execution failure. Folded partial; tracked by docs issue #514. | [evidence](R-CD-2/EVIDENCE.md) |
| `R-CD-3` | `pass` | PASS-candidate from Ronan run 32231533500; reviewed state=pass. | [evidence](R-CD-3/EVIDENCE.md) |
| `R-CD-4` | `pass` | PASS-candidate from Ronan run 32231533500; reviewed state=pass. | [evidence](R-CD-4/EVIDENCE.md) |
| `R-CD-CHAINED-DEPTH-2` | `pass` | PASS-candidate from Ronan run 32231533500; reviewed state=pass. | [evidence](R-CD-CHAINED-DEPTH-2/EVIDENCE.md) |
| `R-CD-COLLECTION-ON-COLLAPSE` | `pass` | PASS-candidate from Ronan run 32231533500; reviewed state=pass. | [evidence](R-CD-COLLECTION-ON-COLLAPSE/EVIDENCE.md) |
| `R-CD-MODEL-CHAINED-ALT` | `pass` | PASS-candidate from Ronan run 32231533500; reviewed state=pass. | [evidence](R-CD-MODEL-CHAINED-ALT/EVIDENCE.md) |
| `R-CD-MODEL-DEFAULT` | `pass` | PASS-candidate from Ronan run 32231533500; reviewed state=pass. | [evidence](R-CD-MODEL-DEFAULT/EVIDENCE.md) |
| `R-CD-MODEL-TOKEN` | `pass` | PASS-candidate from Ronan run 32231533500; reviewed state=pass. | [evidence](R-CD-MODEL-TOKEN/EVIDENCE.md) |
| `R-CD-MODEL-TOOL` | `pass` | PASS-candidate from Ronan run 32231533500; reviewed state=pass. | [evidence](R-CD-MODEL-TOOL/EVIDENCE.md) |
| `R-CD-RETURN-OVERLAP` | `pass` | PASS-candidate from Ronan run 32231533500; reviewed state=pass. | [evidence](R-CD-RETURN-OVERLAP/EVIDENCE.md) |
| `R-CD-SILENT` | `pass` | PASS-candidate from Ronan run 32231533500; reviewed state=pass. | [evidence](R-CD-SILENT/EVIDENCE.md) |
| `R-CD-TOKEN` | `partial` | No behavior was fired: the exact candidate was known, but the workflow supplied only the human version stamp to the row's strict 40-character runtime identity gate. Folded partial; tracked by docs issue #514. | [evidence](R-CD-TOKEN/EVIDENCE.md) |
| `R-CONFIG-DEFAULTS` | `pass` | PASS-candidate from Ronan run 32231533500; reviewed state=pass. | [evidence](R-CONFIG-DEFAULTS/EVIDENCE.md) |
| `R-CONFIG-INTERSESSION` | `pass` | PASS-candidate from Ronan run 32231533500; reviewed state=pass. | [evidence](R-CONFIG-INTERSESSION/EVIDENCE.md) |
| `R-CW-1` | `pass` | PASS-candidate from Ronan run 32231533500; reviewed state=pass. | [evidence](R-CW-1/EVIDENCE.md) |
| `R-CW-2` | `pass` | PASS-candidate from Ronan run 32231533500; reviewed state=pass. | [evidence](R-CW-2/EVIDENCE.md) |
| `R-CW-3` | `pass` | The full-suite candidate was partial because its shared trace contained three continue_work tool spans. Folded pass from focused run 32230009131 on the same runtime, which produced one reason-bound tool/work/fire topology and public Tempo JSON. | [evidence](R-CW-3/EVIDENCE.md) |
| `R-CW-4` | `pass` | PASS-candidate from Ronan run 32231533500; reviewed state=pass. | [evidence](R-CW-4/EVIDENCE.md) |
| `R-CW-5` | `missing` | Cost-cap exhaustion uses a disposable exact-candidate typed-tool fixture; continue_work is intentionally not externally invocable through the gateway loopback. Not executed in run 32231533500; retained as an explicit missing row for refinement. | [evidence](R-CW-5/EVIDENCE.md) |
| `R-CW-5A` | `missing` | Offline source/harness contract check for R-CW-5; cannot establish live cap exhaustion. Not executed in run 32231533500; retained as an explicit missing row for refinement. | [evidence](R-CW-5A/EVIDENCE.md) |
| `R-CW-6` | `missing` | The max-chain boundary uses a disposable exact-candidate runtime fixture; continue_work is intentionally not externally invocable through the gateway loopback. Not executed in run 32231533500; retained as an explicit missing row for refinement. | [evidence](R-CW-6/EVIDENCE.md) |
| `R-CW-6A` | `missing` | Offline source/harness contract check for R-CW-6; cannot establish the process-local runtime boundary receipt. Not executed in run 32231533500; retained as an explicit missing row for refinement. | [evidence](R-CW-6A/EVIDENCE.md) |
| `R-CW-7` | `pass` | PASS-candidate from Ronan run 32231533500; reviewed state=pass. | [evidence](R-CW-7/EVIDENCE.md) |
| `R-CW-DELEGATE-CHILD-LIVE` | `pass` | PASS-candidate from Ronan run 32231533500; reviewed state=pass. | [evidence](R-CW-DELEGATE-CHILD-LIVE/EVIDENCE.md) |
| `R-CW-DELEGATE-SELF-CONTINUATION` | `pass` | PASS-candidate from Ronan run 32231533500; reviewed state=pass. | [evidence](R-CW-DELEGATE-SELF-CONTINUATION/EVIDENCE.md) |
| `R-CW-DELEGATE-TOKEN` | `pass` | PASS-candidate from Ronan run 32231533500; reviewed state=pass. | [evidence](R-CW-DELEGATE-TOKEN/EVIDENCE.md) |
| `R-CW-MULTI` | `pass` | PASS-candidate from Ronan run 32231533500; reviewed state=pass. | [evidence](R-CW-MULTI/EVIDENCE.md) |
| `R-CW-MULTI-COLLAPSE` | `pass` | PASS-candidate from Ronan run 32231533500; reviewed state=pass. | [evidence](R-CW-MULTI-COLLAPSE/EVIDENCE.md) |
| `R-CW-TOKEN` | `pass` | PASS-candidate from Ronan run 32231533500; reviewed state=pass. | [evidence](R-CW-TOKEN/EVIDENCE.md) |
| `R-OBS-1` | `pass` | PASS-candidate from Ronan run 32231533500; reviewed state=pass. | [evidence](R-OBS-1/EVIDENCE.md) |
| `R-OBS-2` | `pass` | PASS-candidate from Ronan run 32231533500; reviewed state=pass. | [evidence](R-OBS-2/EVIDENCE.md) |
| `R-OBS-BACKEND-DISPOSITION` | `missing` | A degraded telemetry backend produces explicit unavailable/partial evidence plus the keys needed to rebind the same slice later, instead of a zero that reads as absence. Not executed in run 32231533500; retained as an explicit missing row for refinement. | [evidence](R-OBS-BACKEND-DISPOSITION/EVIDENCE.md) |
| `R-OBS-CONT-PROVENANCE` | `missing` | Accepted continuation entry spans carry primitive/origin classification plus stable public-safe run, session, and turn correlation, so a typed-tool span and its accepted-entry span can be causally joined after the fact. Not executed in run 32231533500; retained as an explicit missing row for refinement. | [evidence](R-OBS-CONT-PROVENANCE/EVIDENCE.md) |
| `R-OBS-PROOF-MARKER` | `missing` | Proof-originated traffic is separable from organic fleet traffic by a durable telemetry marker carrying the Project-81/k6 proof run id, the row id, the product candidate SHA, and the immutable harness ref. Not executed in run 32231533500; retained as an explicit missing row for refinement. | [evidence](R-OBS-PROOF-MARKER/EVIDENCE.md) |
| `R-OBS-STATUS` | `pass` | PASS-candidate from Ronan run 32231533500; reviewed state=pass. | [evidence](R-OBS-STATUS/EVIDENCE.md) |
| `R-OBS-TERMINAL-OUTCOME` | `missing` | Continuation and finalization terminate into a canonical outcome enum on a span, replacing the log-string heuristics that are currently the only available signal for zero-payload and finalization failure. Not executed in run 32231533500; retained as an explicit missing row for refinement. | [evidence](R-OBS-TERMINAL-OUTCOME/EVIDENCE.md) |
| `R-RC-1` | `pass` | PASS-candidate from Ronan run 32231533500; reviewed state=pass. | [evidence](R-RC-1/EVIDENCE.md) |
| `R-RC-2` | `honest_limit` | Nonce-bound request_compaction toolResult was rejected with guard=context_threshold and the matching child report was returned. This is the policy-defined honest limit; missing Tempo correlation is disclosed. | [evidence](R-RC-2/EVIDENCE.md) |
| `R-REGRESSION-TRAP-TESTS` | `pass` | PASS-candidate from Ronan run 32231533500; reviewed state=pass. | [evidence](R-REGRESSION-TRAP-TESTS/EVIDENCE.md) |
| `R-TRACE-REDACTION-1121` | `pass` | PASS-candidate from Ronan run 32231533500; reviewed state=pass. | [evidence](R-TRACE-REDACTION-1121/EVIDENCE.md) |

## Navigation

- [METHOD.md](METHOD.md)
- [RESOLVED-SHA.md](RESOLVED-SHA.md)
- [ARTIFACTS.md](ARTIFACTS.md)
- [proofs-manifest.json](proofs-manifest.json)
