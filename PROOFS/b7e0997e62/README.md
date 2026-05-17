# PROOFS / `b7e0997e62`

Proof corpus for upstream PR `openclaw/openclaw#79925` after the final squash
of the cure-(1) lane into the PR-presenting branch head:

- branch: `frond-scribe-claude/20260509/narrow-surgery-tight`
- deploy / presentation SHA: `b7e0997e62cddef4ab73613a4741491477bccc77`
- base for the cure walk: `446e285f7da956f0a2006a7187fc8c03dee1c4d4`

This bundle supersedes pre-squash candidate-head references for presentation
purposes. The old candidate SHAs remain historically valid receipts, but this
directory is the maintainer-facing proof surface for the bytes that now sit on
the PR head.

## Why this bundle exists

The cohort converged on the extended cure at pre-squash candidate
`5615cf2516`, then figs correctly required a clean single-commit presentation
before push. The result is `b7e0997e62`: same cure bytes, lane bookkeeping
stripped from the PR head.

## Shipping diff summary

Against `446e285f7d`, `b7e0997e62` changes 6 files / +354 / -20:

- `src/agents/subagent-announce.ts`
- `src/agents/subagent-announce.chain-guard.test.ts`
- `src/agents/subagent-announce.targeted-return.integration.test.ts`
- `src/agents/tools/continue-delegate-tool.crosssession-gate.test.ts`
- `src/auto-reply/continuation/delegate-dispatch-post-compaction.test.ts`
- `src/auto-reply/reply/post-compaction-delegate-dispatch.test.ts`

## Proof rows

| Row | Focus | Evidence | Verdict |
|---|---|---|---|
| R-P2-1 | Cure-region byte walk on shipping head | `R-P2-1/cure_diff_summary.txt` | ✓ PASS |
| R-P2-2 | Extended 7th-path chain-hop gate preserved in squash | `R-P2-2/chain_hop_extension_summary.txt` | ✓ PASS |
| R-P2-3 | Pre-squash provenance / receipts mapping to shipping head | `R-P2-3/pre_squash_provenance.txt` | ✓ PASS |

## Maintainer-facing read

The important honesty line is:

- the squashed head preserves the exact cure the cohort cosigned
- the load-bearing 18-line delete survives intact
- the 7th-path chain-hop fix discovered during the parallel-harness audit also
  survives intact
- only lane bookkeeping was removed for upstream presentation
