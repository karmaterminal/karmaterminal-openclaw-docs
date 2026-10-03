# Resolved identities

| Identity | Exact value |
| --- | --- |
| PR #124337 head (executed) | `b2d5e48e5b59da6d1d29b2bfb7b2af51aee58f0a` |
| Control: first parent of the tested two-commit series, i.e. upstream `openclaw/openclaw` main at execution (executed) | `363b9d0ae746cde25d0846ce8a05e962bef4f26e` |
| Hosted PR base at the time of this corpus (upstream `main`, which moves; `b2d5e48e5b` merges cleanly into it) | `44cdd57720` |
| Fork review branch carrying the head | `karmaterminal/openclaw` `gloss/124337-repaint-r2` |
| Previous PR head, preserved as `savegame/124337-pure-38e9433da46b` | `38e9433da46b785a58f1d6a10161c348741af08e` |
| Harness sha256 | `d433fe2787c514931d48462f06242160c111d4bfde6aedfe942191e49e261645` |

The executed head and the PR head are the same SHA. **No composite or cherry-picked variant is credited.**

Review of the fork review branch: no blocking findings at `f0337f79c6` from 🌊, 🕯 and 🌻. `git range-diff` shows `b2d5e48e5b` is the same two patches (`=`) rebased onto `363b9d0ae7`. Tracking: karmaterminal/openclaw#1419.
