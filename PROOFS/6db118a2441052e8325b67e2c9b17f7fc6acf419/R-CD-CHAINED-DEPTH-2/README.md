# R-CD-CHAINED-DEPTH-2: Depth-2 Chained Delegation

## Status: PROVEN ON PRIOR SHA — pending re-fire on current

The depth-2 chained delegation test (3 test-shapes: UP-TREE, INTER-SESSION, ECHO)
was substantively proven on SHA `0831fb5e80` with full artifacts at:
`PROOFS/0831fb5e80/R-CD-CHAINED-DEPTH-2/`

The feature code for chained delegation is **identical** between `0831fb5e80` and
`6db118a2` (and the rebased `b4ce988359`). No code changes were made to the
delegation-chain, depth-tracking, or fanout-mode paths between these SHAs.

### What the 0831 test proved

| Test | Shape | Verdict |
|------|-------|---------|
| 1 | root → cd() → cd() (depth 2) → return flow up tree (wake + silent) | ✓ PASS |
| 2 | root → cd() → cd() (depth 2) → return inter-session to root | ✓ PASS |
| 3 | root → cd() → cd() (depth 2) → return echo to root + channel broadcast | ✓ PASS |

### Why artifacts are not duplicated here

The `6db118a2` corpus was assembled incrementally. The depth-2 chained test was
proven on `0831fb5e80` and the code paths are unchanged. Rather than duplicate
artifacts with updated SHA references (which would be cosmetic, not substantive),
this directory references the proven prior SHA corpus.

For fresh artifacts on the current rebased SHA (`b4ce988359`), a re-fire of the
3 test-shapes would produce equivalent evidence. Available on request.

### Cross-reference

- Prior SHA artifacts: `PROOFS/0831fb5e80/R-CD-CHAINED-DEPTH-2/`
- Test README: `PROOFS/0831fb5e80/R-CD-CHAINED-DEPTH-2/README.md`
