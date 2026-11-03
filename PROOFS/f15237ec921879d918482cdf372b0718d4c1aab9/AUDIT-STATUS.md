# F′ audit status of echo-vulnerable rows (2026-10-30)

After R-CD-3 turned out to be a harness false positive, an audit of every k6 scenario (`tools/k6-proofs/AUDIT-sentinel-echo-20261030.md on docs branch codeagent/harness-sentinel-audit @ ed28bb0e`) found 14 row scenarios whose verdict sentinel can match the agent's own outbound text. A second lane found R-RC-1 resting on an unmeasured receipt.

Per 🌊 (Discord 20:50Z): each row records **confirmed echo**, **unverified / echo-vulnerable**, or **producer verified**. An audit flag alone is not a confirmed false pass. **No state is changed by this file except R-CD-3**, which was corrected at `7ac3e7b8`. No verdict is raised. Every original receipt stays in place under its row directory.

**Producer verified:** none recorded. F″ re-fires every row at its exact SHA with the fixed harness, which supersedes this record.

| row | state (unchanged) | original run(s) | audit status | reading |
|---|---|---|---|---|
| R-CD-1 | pass | `20261030T012952Z-r-cd-1-44aa4c89` | **unverified-echo-vulnerable** | Audit: parent echoes were refused by the window, and the later matches fit real child output. Only the window separated them. |
| R-CD-3 | missing | `20261030T013104Z-r-cd-3-44aa4c89` | **confirmed-echo** | Producer and order confirmed for the false return; the row was corrected to missing at 7ac3e7b8. |
| R-CD-4 | pass | `20261030T013415Z-r-cd-4-44aa4c89` | **unverified-echo-vulnerable** | Audit: a live ack 20 s after dispatch fits a real woken turn, but the history path would also accept an ack inside the priming run. |
| R-CD-CHAINED-DEPTH-2 | pass | `20261030T013602Z-r-cd-chained-depth-2-44aa4c89` | **unverified-echo-vulnerable** | Audit: the timing fits real hop output, but both hop sentinels are in the root's own call. |
| R-CD-COLLECTION-ON-COLLAPSE | pass | `static-validator-20261030T013043Z` | **unverified-loose-check** | Audit: the evidence is sound (targeted-return line plus session-bound sentinel), but the check reads outbound copies. |
| R-CD-MODEL-TOKEN | pass | `20261030T013747Z-r-cd-model-token-44aa4c89` | **unverified-echo-vulnerable** | Audit: the spawn acceptance matched the parent's own sessions_spawn events; nothing shows hop-1 used the bracket rather than the typed tool. |
| R-CD-RETURN-OVERLAP | pass | `20261030T013904Z-r-cd-return-overlap-44aa4c89` | **unverified-loose-check** | Audit: the evidence is sound (journal marker lines are bound to child sessions, each with a targeted-return line), but the check is loose. |
| R-CD-SILENT | missing (was pass) | `20261030T013909Z-r-cd-silent-44aa4c89` | **confirmed echo, corrected 2026-10-31** | Audit: the child's completion is real, but the parent's readback names a token the parent wrote into its own continue_delegate call. |
| R-CW-1 | pass | `20261030T014303Z-r-cw-1-44aa4c89,20261030T021254Z-r-cw-1-bca3fca7` | **unverified-echo-vulnerable** | Audit: CW-WOKE came 5.69 s after CW-SCHEDULED (5 s delay); most likely the wake input row quoting the reason, not the woken agent. |
| R-CW-2 | pass | `20261030T014440Z-r-cw-2-44aa4c89` | **unverified-echo-vulnerable** | Audit: CW2-WOKE came 38.4 s after CW2-SCHEDULED (delay 0). The timing doesn't identify the source, and the reason carries the sentinel. |
| R-CW-3 | pass | `20261030T014534Z-r-cw-3-44aa4c89` | **unverified-echo-vulnerable** | Audit: CW3-WOKE came 5.296 s after CW3-SCHEDULED (5 s delay); fits the wake input row quoting the reason, not the woken agent. |
| R-CW-4 | pass | `20261030T014605Z-r-cw-4-44aa4c89` | **unverified-echo-vulnerable** | Audit: hop spacing and the trace topology (three continue_work spans) corroborate three hops. A prompt echo is structurally possible. |
| R-CW-TOKEN | missing (was pass) | `20261030T014725Z-r-cw-token-44aa4c89` | **confirmed echo, corrected 2026-10-31** | Audit: TOKEN-HOP2-DONE was matched 160 ms after the hop-1 work-wake, too soon for a model turn; likely an echo of the spawn task. The wake itself fired (journal). |
| R-RC-1 | pass | `20261030T014819Z-r-rc-1-44aa4c89` | **unverified-unmeasured-receipt** | Lane f2-compaction-unmeasured-text @ 412ef5f1: this PASS rests on a request_compaction receipt with context_usage null (unmeasured), not a measured threshold. |
| R-RC-2 | partial (was honest_limit) | `20261030T014846Z-r-rc-2-44aa4c89` | **confirmed echo, corrected 2026-10-31** | Audit: the measured toolResult receipt is real (context 13, threshold 70, threshold_rejected_measured). The child-report half parsed context=unknown from the parent-stream path; likely an echo of the child task. |
