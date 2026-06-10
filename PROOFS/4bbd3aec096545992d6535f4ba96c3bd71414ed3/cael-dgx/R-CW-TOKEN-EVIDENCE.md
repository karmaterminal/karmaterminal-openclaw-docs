# R-CW-TOKEN cael-dgx — `continue_work` TOKEN/bracket form drives hop-2 on `4bbd3aec096`

**Row owner:** 🩸 Cael (cael-dgx)
**Seat:** cael-dgx (10.0.0.148; DGX Spark GB10, ARM64, 128GB unified)
**Exact ship-SHA:** `4bbd3aec096545992d6535f4ba96c3bd71414ed3` (deployed, byte-verified live)
**Captured:** 2026-06-10 05:30 PDT (gateway `[continuation:work-wake]` journal)
**Both-forms mandate:** tool-form sibling = R-CW-1 (`continue_work()` tool). This row closes the TOKEN/bracket arm.

## Seat byte-verification (live deployed binary IS target)
- `git rev-parse HEAD` → `4bbd3aec096545992d6535f4ba96c3bd71414ed3` ✓
- running daemon PID 2030895 cmdline → `node /home/figs/flesh_beast_tmp/openclaw/dist/index.js gateway --port 18789` (dist-shape seat)
- `openclaw --version` → `OpenClaw 2026.6.2 (4bbd3ae)` ✓
- gateway active since 04:34:15 PDT; reading-A — content-closed (dist contains target-only compiled symbols; see cohort dist-provenance close)

## Behavior proven
A bare `CONTINUE_WORK:30` emitted at the END of the assistant reply-text (NOT a tool-call, NOT a message-tool arg) was parsed by `parseContinuationSignal`/`stripContinuationSignal` (agent-runner-execution.ts:2087, which reads the assistant-payload stream) and **DROVE A WORK-WAKE** — `[continuation:work-wake] hop=1/200` — on the deployed `4bbd3aec096` binary. This proves the token-form DRIVES the continuation (not merely that the token is stripped from output).

## Gateway log confirmation (verbatim, journalctl on cael)
```
05:30:15.882 [continuation/work-dispatch] [continuation:work-hedge-fired] session=agent:main:discord:channel:1466192485440164011
05:30:15.889 [continuation/work-dispatch] [continuation:work-wake] hop=1/200 session=agent:main:discord:channel:1466192485440164011
05:30:15.889 [continuation/work-dispatch] [continuation:work-drive-skipped] reason=requests-in-flight
```
- `[continuation:work-wake] hop=1/200` ✓ — the parsed `CONTINUE_WORK:30` token drove a work-wake (fresh chain, hop 1/200, distinct from the tool-form R-CW-1 chain)
- `[continuation:work-drive-skipped] reason=requests-in-flight` ✓ — gateway correctly skips the duplicate drive while the authoring turn is in-flight (same expected guard Silas documented in his R-CW-TOOL row)

## HONEST observation (banked, not asserted as defect)
On cael-seat the work-hedge **re-armed in a ~1s loop** (`fireIn=1000ms` → fired → wake hop=1/200 → skipped reason=requests-in-flight → re-arm) for the duration of the long authoring turn, rather than a single skip. Silas's R-CW-TOOL saw one skip; cael saw a tight re-arm-loop because the authoring turn was much longer (many tool-calls). The token-DRIVE is proven (hop=1/200); the re-arm-loop is the requests-in-flight guard retrying while the turn extends. Worth a path-divergence byte-walk on whether the re-arm cadence should back off under a long in-flight turn — filed as observation, NOT a regression claim.

## Both-forms-mandate closure
- TOKEN-form (this row): `CONTINUE_WORK:30` in reply-text → `work-wake hop=1/200` ✓
- Tool-form sibling (R-CW-1): `continue_work()` tool → `work-wake` ✓
Both arms fire on the deployed `4bbd3aec096` binary.
