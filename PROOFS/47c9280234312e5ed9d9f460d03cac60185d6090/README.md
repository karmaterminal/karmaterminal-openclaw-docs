# PROOFS / 47c9280234312e5ed9d9f460d03cac60185d6090 / Cure-(21) — runtime-identical-attest extension

## What this corpus is

Cure-(21) candidate `47c9280234312e5ed9d9f460d03cac60185d6090` — current PR head of [openclaw/openclaw#79925](https://github.com/openclaw/openclaw/pull/79925) as of 2026-05-19T00:14:37Z.

Force-pushed via karmafeast operator-bypass `gh api PATCH /git/refs/heads/frond-scribe-claude/20260509/narrow-surgery-tight` (workflow ref). Parent: `upstream/main@d124c5aa20`.

## Why this is a thin corpus

Cure-(21) is a **three-file cure-substrate-orphan restore** with **zero touch to the continuation feature surface**. Per the Cure-(15)/(19)/(20)-family discipline, three files that existed on upstream parent but had been silently orphaned during prior squash-iterations were restored byte-faithfully:

- `docs/gateway/doctor.md` — `--lint` mode section + JSON/severity filtering docs
- `.github/workflows/mantis-discord-status-reactions.yml` — `clear_issue_comment_reaction` cleanup job
- `ui/src/ui/views/usage-render-overview.ts` — `DailyBarTooltipTrigger` + viewport-clamping + focus-visible accessibility

All three restored byte-identical to upstream parent state. Continuation-keyword check: 0 hits in all 3 restored files.

## Runtime-identical-attest at this SHA

The substantive continuation-feature proof corpus does NOT need re-capture at this SHA because the **24-file continuation surface bytes are identical between cure-(20)v3 `a726a815af` and cure-(21) `47c9280234`**. The R-TA-1-RECONFIRM at this SHA verifies this claim at byte:

### R-TA-1-RECONFIRM at cure-(21)

- **Commit on docs main**: [`ef57a35`](https://github.com/karmaterminal/karmaterminal-openclaw-docs/commit/ef57a35) (Silas urudyne seat)
- **Traceparent**: `00-d4cd1931b0075386eb8c031ee0d6df76-ebd9a220a7ce7367-01`
- **Response shape**: byte-identical to all 8 prior R-TA-1-RECONFIRMs across the 11-cure arc
- **Built bytes**: `OpenClaw 2026.5.17 (47c9280)` built `2026-05-19T00:31:14Z`

The R-TA-1-RECONFIRM at this SHA is the operationally-equivalent attest to R-TA-1 capture at this SHA, plus formally extends the runtime-identical-attest chain across the full 11-cure arc.

### Independent byte-walks of the cure-(21) → cure-(20)v3 surface delta

3/4 prince seats independently verified at byte:

- **🩸 Cael** at [Discord 1506069944](https://discord.com/channels/1235610176883523614/1466192485440164011/1506069944): 3 files / +340 / -22 + 6 spot-checks on 24-file continuation surface (0 hunks)
- **🌫 Silas** at [Discord 1506069944](https://discord.com/channels/1235610176883523614/1466192485440164011/1506069944)-era: independent byte-walk + 6 spot-checks (0 hunks) + R-TA-1-RECONFIRM
- **🌊 Ronan** at [Discord 1506071707](https://discord.com/channels/1235610176883523614/1466192485440164011/1506071707): GH API content-SHA byte-walk via blob-hash comparison (working-tree-independent + degraded-gateway-independent). 3 P2 restoration files blob-equal to upstream parent `d124c5aa20`; 3 spot-checked continuation-surface files blob-equal between cure-(20)v3 ↔ cure-(21):

  | File | cure-(20)v3 blob-SHA | cure-(21) blob-SHA |
  |------|---------------------|-------------------|
  | `src/infra/continuation-tracer.ts` | `564806d5ec` | `564806d5ec` ✅ |
  | `src/agents/tools/request-compaction-tool.ts` | `264ed69d39` | `264ed69d39` ✅ |
  | `src/auto-reply/continuation/scheduler.ts` | `b45d628f5a` | `b45d628f5a` ✅ |

  | P2 file | cure-(21) blob-SHA | upstream parent blob-SHA |
  |---------|-------------------|-------------------------|
  | `docs/gateway/doctor.md` | `27bcd2e6fb` | `27bcd2e6fb` ✅ |
  | `.github/workflows/mantis-discord-status-reactions.yml` | `e92eab9866` | `e92eab9866` ✅ |
  | `ui/src/ui/views/usage-render-overview.ts` | `70b0877fc4` | `70b0877fc4` ✅ |

## 11-cure arc runtime-identical-attest chain

24 continuation-load-bearing files have ZERO hunks between original cure-(13) squash and current head per [docs PR #84](https://github.com/karmaterminal/karmaterminal-openclaw-docs/pull/84) Appendix A. Chain extends:

cure-(13) `718d8558eb` → cure-(14a) → cure-(14b) → cure-(15) → cure-(16) → cure-(17) → cure-(18) `607d72ac33` → cure-(19) → cure-(20)v1 → cure-(20)v2 → cure-(20)v3 `a726a815af` → **cure-(21) `47c9280234`**

Each hop's R-TA-1-RECONFIRM (now 9 in chain: cure-(14a) through cure-(21)) documents live-runtime traceparent-equivalence at the force-push SHA. Surface bytes byte-stable across all hops.

## Substantive feature-proof origin

The substantive continuation-feature proof corpus (8-row, live runtime tool-fires + traceparents + cross-session targeting + post-compaction-threshold + chain-budget accounting + token-counter additivity + Tempo server-side trace stitching + 4/4 fleet deploy-validation) resides at:

- [`PROOFS/a726a815afa22cadb429ec89eafd552170f216f6/`](https://github.com/karmaterminal/karmaterminal-openclaw-docs/tree/main/PROOFS/a726a815afa22cadb429ec89eafd552170f216f6/) — cure-(20)v3 corpus (current substantive evidence)
- [`PROOFS/718d8558eb618304b5cc43c8a3b5d93ff5bef454/`](https://github.com/karmaterminal/karmaterminal-openclaw-docs/tree/main/PROOFS/718d8558eb618304b5cc43c8a3b5d93ff5bef454/) — cure-(13) baseline 8-row substantive feature-proof origin

These corpora serve cure-(21) head bytes via the runtime-identical-attest chain — 24-file continuation surface is byte-stable from cure-(13) through cure-(21).

## 4/4 prince-seat deploy verification at cure-(21)

Verified at byte across all 4 prince seats:

| Prince | Deploy run | Gateway PID | ActiveEnterTimestamp | Bytes |
|--------|-----------|-------------|---------------------|-------|
| 🩸 cael | success | (fresh) | 17:30:xx PDT | OpenClaw 2026.5.17 (47c9280) |
| 🌊 ronan | `26068478880` success | 171322 | 17:30:22 PDT | OpenClaw 2026.5.17 (47c9280) |
| 🌫 silas | success | (fresh) | 17:31:14 PDT | OpenClaw 2026.5.17 (47c9280) |
| 🌻 elliott | success | 2826548 | 17:31:19 PDT | OpenClaw 2026.5.17 (47c9280) |

All 4 seats fresh on cure-(21) bytes; deploys all `conclusion=success` at workflow level + gateway-PID-change-confirmed per the 3-byte-check verification canon.

## See

- [PR #79925](https://github.com/openclaw/openclaw/pull/79925) — current head `47c9280234`
- [`../a726a815afa22cadb429ec89eafd552170f216f6/`](../a726a815afa22cadb429ec89eafd552170f216f6/) — cure-(20)v3 substantive proof corpus (runtime-identical to this SHA)
- [`../718d8558eb618304b5cc43c8a3b5d93ff5bef454/`](../718d8558eb618304b5cc43c8a3b5d93ff5bef454/) — cure-(13) baseline 8-row feature-proof origin
- [Docs PR #84](https://github.com/karmaterminal/karmaterminal-openclaw-docs/pull/84) — runtime-identical-attest Appendix A
- R-TA-1-RECONFIRM at this SHA: docs main commit `ef57a35`
