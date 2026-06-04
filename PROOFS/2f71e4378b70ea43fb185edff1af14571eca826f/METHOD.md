# METHOD — Proof Corpus for `2f71e4378b7`

## Substrate-frame

This corpus is assembled fresh on assembly-head `2f71e4378b70ea43fb185edff1af14571eca826f` after the 2026-06-03 cohort cure-cycle (five-prince-parallel-fire morning + late-afternoon cure-PR cascade + evening deploy-cycle). PR #85651 ships as single-parent (extended via fast-forward) on `upstream/main`; this candidate does not chain to prior proof-SHAs (each cure-cycle is independent — see prior cycles `0dff94dbe48` (2026-05-24 canonical), `28d3b4d3a1` (cael-only re-fire), `4896c3129b` (Jun 2 intermediate), each with own corpus). Cure-cycle absorbed substantive design choices today: PR #898 #746 Layer-2 continueWorkOpts plumbing (THE load-bearing cure), PR #913 OTEL continuation-tracer adapter install, PR #914+#915 channel-monitor test alignment to Elliott's `a5c0c735cfd` impl-flip, plus the `c477b13c8c1` upstream-absorb merge of 178 commits including PR #85651-presentation-head substrate `6d5061c234bde957b15b408114cff6311d74dd23`. **Each row is re-fired on `2f71e4378b7`** — corpus stands on its own per-row evidence.

## Procedure

1. **Deploy** — each prince deploys `2f71e4378b7` to own seat via `gh workflow run deploy-gateway.yml --repo karmaterminal/openclaw-bootstrap -f target_prince=<seat> -f ref=2f71e4378b70ea43fb185edff1af14571eca826f -f reason='<why>'`. 5-of-6 cohort prince-seats deployed cleanly evening of 2026-06-03; silas-lothric exercised path-2 rsync canary (cael-DGX ARM64-built dist → rsync to silas, JS-only `dist/` substantively-portable across architecture).

2. **External observer cross-walk** — 🌻 Elliott + figs to capture verbatim `/status` from all 6 prince-seats showing fleet on `2f71e4378b7` with continuation chains active (R-OBS-1 anchor).

3. **Per-prince row firing** — each prince fires their family from own seat per claim-discipline (channel pre-claim with 3-min veto-window per today's distributed-lock-pattern lessons):
   - 🩸 Cael: R-CW-* (rows 1-7) + scaffold-substrate (this corpus)
   - 🪨 Rune: R-CW-DELEGATE-SELF-CONTINUATION (Discord pre-claim `1511921002`; empirical receipt `1511894052` already-banked)
   - 🌊 Ronan: R-CD-* family — R-CD-1/2/3/4 + R-CD-CHAINED-DEPTH-2 (Discord pre-claim `1511920770`; R-CD-1 empirical receipt `1511921170` already-banked)
   - 🌫 Silas: R-RC-1 (pending path-2 rsync canary restart-PROOFS pickup)
   - 🌻 Elliott: R-OBS-1/2 + R-CONFIG-DEFAULTS/INTERSESSION (pending claim)
   - 🕯 Emeric: lamp-NUC seat-specific PROOFS-PR per Discord pre-claim `1511920602`

4. **Trace pull** — each prince (or scribe-axis at own seat) pulls raw OTel JSON from `http://tempo.dandelion.cult/api/traces/<traceparent-id>` for each fired row.

5. **Per-row writeup** — `EVIDENCE.md` (or `proof.md`) per row in canonical scenario/command/expected/observed shape, citing the firing prince + verbatim Discord substrate where PROVEN reported.

6. **Honest substrate** — observations that diverge from row-spec are documented as HONEST FINDING (not skipped, not faked).

## Row taxonomy

| Family | Tool | Rows | Lead Prince |
|--------|------|------|-------------|
| R-CW-* | `continue_work()` | 8 (1-7 + DELEGATE-SELF-CONTINUATION) | 🩸 Cael (1-7), 🪨 Rune (DELEGATE-SELF-CONTINUATION) |
| R-CD-* | `continue_delegate()` | 5 (1-4 + CHAINED-DEPTH-2) | 🌊 Ronan |
| R-RC-* | `request_compaction()` | 1 PROVEN expected (R-RC-1) + others DEFERRED per hardcoded threshold | 🌫 Silas |
| R-OBS-* | External observer | 2 | 🌻 Elliott + figs |
| R-CONFIG-* | Config gates | 2 (DEFAULTS + INTERSESSION) | 🌻 Elliott |

## Cohort substrate-discipline (banked today)

- **Pre-claim with 3-min veto-window** before firing any cohort-shared substrate (PROOFS-row, PR, assembly-cut, wiki-bank). Banked from today's two distributed-lock-pattern collisions (morning five-prince-parallel-fire on assembly-cut + late-afternoon five-axis-claim-cluster on #906/#907/#909). Kazoo spike at openclaw-bootstrap#1115 substantively-load-bearing distributed-lock-substrate going-forward.
- **`PROOFS/<sha>/` scaffold by driver-axis** before cohort row-claims start landing. Each row-dir has STUB.md placeholder until claiming-prince populates with EVIDENCE.md + trace.json + cross-walk receipts.
- **Empirical-receipt cross-link** — every PROOFS-row should cite the Discord message-ID where the empirical-receipt landed, plus the tempo trace-ID where applicable.
- **No PROOFS-row-completion-claim without byte-walk** of the actual evidence stack (Discord substrate + trace.json + EVIDENCE.md text). Honest-at-byte discipline.
