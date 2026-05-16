# METHOD — cure-(2) proof corpus methodology

This document describes how to reproduce the cure-(2) proof corpus from scratch.

## Reproducer commands

### Verify cure-(2) commit at byte

```bash
# Fetch the commit metadata from GitHub
gh api repos/karmaterminal/openclaw/commits/46733c4fb917d3905014bc16ce50a5a507548486 \
  --jq '{sha: .sha[:12], message: .commit.message[:300], author: .commit.author.name, date: .commit.author.date, files: [.files[] | {path: .filename, additions: .additions, deletions: .deletions}]}'
# Expected: 4 files / +72/-4, "cure-(2): surgical-merge skills-fix #82397 over continuation-feature"

# Fetch the actual patch for line-anchor verification
gh api repos/karmaterminal/openclaw/commits/46733c4fb917d3905014bc16ce50a5a507548486 \
  --jq '.files[] | "=== " + .filename + " ===\n" + .patch'
```

### Deploy CANDIDATE_SHA to a prince seat

```bash
# Pre-deploy gates
cd /home/figs/flesh_beast_tmp/openclaw
git status --short   # expect: no modified tracked files (only dist-runtime.pre-* backup dirs)
openclaw config validate   # expect: "Config valid"

# Fire deploy
gh workflow run deploy-gateway.yml --repo karmaterminal/openclaw-bootstrap \
  -f target_prince=<prince-name> \
  -f ref=46733c4fb917d3905014bc16ce50a5a507548486 \
  -f bypass_validation=true \
  -f bypass_reason='cure-(2) byte-walk + proofs matrix'

# Watch the run
gh run list --repo karmaterminal/openclaw-bootstrap --workflow=deploy-gateway.yml --limit 3
gh run watch <run-id> --repo karmaterminal/openclaw-bootstrap --exit-status

# Post-deploy verification
openclaw --version   # expect: OpenClaw 2026.5.17 (46733c4)
cd /home/figs/flesh_beast_tmp/openclaw && git log -1 --format='%h %s' HEAD
# expect: 46733c4fb9 cure-(2): surgical-merge skills-fix #82397 over continuation-feature (4 files +72/-4)
```

### Capture /status R-OBS-1 substrate

Via Discord client, external observer (figs) invokes `/status` in `#sprites-of-thornfield`.
All 4 prince bots respond simultaneously with status cards.
Capture the verbatim render to `R-OBS-1/external_observer_full_fleet.txt`.

Required invariants per prince card:
- Build SHA matches `46733c4`
- `🔄 Continuation: chain X/200 | volitional: 0` line PRESENT
- `volitional: 0` (no spurious increment from cure-(2) skills-fix surgical-merge)
- Chain counter non-negative integer, under 200 cap

### Capture continuation-tool fires with Tempo traces

Per `RUNBOOKS/PROOF-CORPUS-METHOD.md`'s row assignments:

```
R-CW-1 / R-CW-2 / R-RC-2: cael-seat
R-CD-1 / R-CD-2 / R-CD-3 / R-CD-4 / R-CD-CHAINED-DEPTH-2 Chain-1/2/3: ronan-seat
R-RC-1 / R-CD-CHAINED-DEPTH-2 TEST-1/2/3: silas-canary-seat
R-OBS-1: elliott-seat + figs cross-walk
```

For each tool-fire, capture:
1. Tool-call response payload (with `traceparent` field) → `R-<row>/<descriptive>_receipt.txt`
2. Journal log line snippet from gateway journal → embedded in EVIDENCE.md
3. Grafana Tempo trace JSON → `R-<row>/<descriptive>_trace.json` via:
   ```bash
   curl -s "http://tempo.dandelion.cult/api/traces/<trace-id>" -o R-<row>/<descriptive>_trace.json
   ```
4. Span hierarchy summary → `R-<row>/span_summary.tsv` via Tempo span-tree extraction
5. EVIDENCE.md per row with: seat / SHA / binary / PID / fire-timestamp / tool-fire-shape / tool-response / traceparent decomp / Tempo URL / verdict

### Authoring discipline

Per `RUNBOOKS/PROOF-CORPUS-METHOD.md`:
- One commit per row (or related sub-row group)
- Commit message names the row: `PROOFS/46733c4fb917.../R-XX: <brief>`
- Push direct to main (no branch/PR detour)
- README.md verdict table updated alongside row commits

## Cross-references

- `RUNBOOKS/ENTRYPOINT.md` — entrypoint pointing to PROOF-CORPUS-METHOD
- `RUNBOOKS/PR-DRIFT-CURE-GATES-RUNBOOK.md` — 6-gate procedure (Gate 4 = proof-corpus)
- `RUNBOOKS/PROOF-CORPUS-METHOD.md` — full method reference
- Past corpora as exemplar bars:
  - `PROOFS/0831fb5e80/` (May 2026; canary-seat substrate-luck enabled R-RC-1 PASS-shape)
  - `PROOFS/e90a87015479d7a7ff6ae73deda9a84f1a448418/` (2026-05-16 morning; cure-(1) drift-cure full Tempo trace coverage; 4-prince fleet at byte; updated verdict-table after 🌻 byte-walk flag)
  - `PROOFS/46733c4fb917d3905014bc16ce50a5a507548486/` (2026-05-16 evening; cure-(2) skills-fix surgical-merge over continuation-feature; this corpus)

## When a row's PASS-shape is structurally blocked

If PASS-shape cannot fire at submission-time (e.g. R-RC-1 at all-seats-over-threshold context-state):
1. File the honest-negative receipts that DO exist (gate-stack engagement evidence)
2. Create `<row>/SUBSTRATE-FINDING.md` consolidating the gate-stack receipts into a structural-finding writeup
3. Verify the gate-source is BYTE-IDENTICAL between PR-head and CANDIDATE_SHA (proves NOT cure-regression)
4. Frame for PR-comment: "<Row> REJECT-path verified via gate-stack receipts at high-context; structural PASS-shape blocked at submission-time per <substrate-condition>"

(Option-g per cael's 2026-05-16 framing — substrate-finding-of-structural-difficulty IS the proof.)
