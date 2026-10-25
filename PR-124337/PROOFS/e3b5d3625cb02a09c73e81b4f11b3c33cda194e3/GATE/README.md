# #124337 back-merge gate at `e3b5d3625cb`

Head `e3b5d3625cb` = PR `9fd80c6cdbd` + merge of upstream main `12b56e6492c` (`3607dc4366c`) + Slack test port (`bb5da2e7098`) + line-cap fold (`e3b5d3625cb`). Linux x86-64, Node 26.12.1. `meta.txt` records HEAD and a clean tree at start and end.

- `pnpm install --frozen-lockfile`: rc 0, tree clean afterwards.
- `tsgo:core`, `tsgo:extensions`, `tsgo:core:test`, `tsgo:extensions:test`: rc 0.
- Vitest (`scripts/run-vitest.mjs`): 67 unit files, the PR's changed tests plus same-directory tests that import a changed module, plus the two conflict files. All pass, and the 1 e2e (`telegram-ingress-coalescing.cancellation.e2e`) passes.
- `oxlint`, `oxfmt --check` on the 47 changed `.ts` files: rc 0.
- `check-line-cap-ratchet --base 12b56e6492c` (upstream main): OK.
- `pnpm run check`: every check passes except the line-cap ratchet. With no `--base`, that ratchet compares against the local `origin/main`, the fork's main (`cc595439453`), not upstream. The 8 files it reports are all untouched by this PR: they are upstream's own growth since the fork's main. Against upstream main it is OK (above).

`gate.sh` is the exact script.
