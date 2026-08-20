# Receipts

Fresh command/exit logs generated 2026-08-16 on disposable worktrees at
`5626a79` and `70d47bec`. Host paths substituted
(`<product-worktree-head>`, `<product-worktree-base>`). MS Teams
`rawActivity` redacted. Original SHA-256 values are in `../SHA256SUMS`.

Pre-P1 `0a77fdcf` receipts (including the 539-shard suite) are **not** here.

| File | Step | Exit |
| --- | --- | ---: |
| `01-base-fossil-red.txt` | exact base + fossil | 1 |
| `02-head-fossil-green.txt` | head + fossil | 0 |
| `03-head-mixed-cancel-green.txt` | mixed fan-in cancel | 0 |
| `04-head-msteams-green.txt` | MS Teams aged sibling | 0 |
| `05-head-drain-settle-green.txt` | drain settle/adopt/supersede | 0 |
| `06-base-msteams-retarget-red.txt` | base drain + new MS Teams test | 1 |
| `07-head-plugin-sdk.txt` | plugin-sdk shard | 0 |
| `08-reverse-fossil-red.txt` | production reverse + fossil | 1 |
| `09-reverse-mixed-cancel-red.txt` | production reverse + mixed cancel | 1 |
| `10-reapply-green.txt` | reapply production + 34 tests | 0 |
| `11-head-channels-owner.txt` | channels owner shard | 0 |
| `12-head-plugin-sdk-runtime.txt` | fan-in runtime | 0 |
| `production-hunk.patch` | M1+P1 three-file production diff | — |
