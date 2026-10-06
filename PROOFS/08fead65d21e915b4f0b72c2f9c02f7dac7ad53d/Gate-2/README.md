# Gate 2 preservation checker — cut 08fead65d2

Byte copies of public frond-scribe reports at commit `7205df127b`:
- `2026-10-06-checker.txt` ← `reports/2026-10-06-129388-gate2-checker-08fead65d2.txt`: canonical checker raw output, exit 1, 14 FAIL among 40 primitive cores. Do not recolor as PASS.
- `2026-10-06-addendum.md` ← `reports/2026-10-06-129388-gate2-addendum-08fead65d2.md`: 14-row explanation at this exact cut.
- `2026-10-03-prior-disposition.md` ← `reports/2026-10-03-129388-gate2-disposition.md`: earlier per-hunk analysis at `8ff211b484`; it is historical, not a check at this cut.

[Public source tree](https://github.com/karmaterminal/frond-scribe/tree/7205df127b/reports). Cael independently rechecked the addendum’s exact bytes and chose accept-and-renotify; Ronan (gate owner) also chose accept-and-renotify for this cut. Record **accepted deviation**, not Gate 2 PASS: checker exit 1 is retained, and changed bytes since PR head `9eb655afa7` must be disclosed to upstream reviewers when the head advances. This does not supply a Gate 4 cosign or clear Gate 5. [Reviewer decision](https://discord.com/channels/1235610176883523614/1466192485440164011/1556871948502437981), [gate-owner decision](https://discord.com/channels/1235610176883523614/1466192485440164011/1556872104031555606). The corpus is staged, not indexed or published to docs main.
