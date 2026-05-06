# swim-35 BRIEF

**Anchor:** [#607](https://github.com/karmaterminal/openclaw-bootstrap/issues/607)

## What this swim ships

A green-light to land the continuation feature (PR #38780 + carryover) by closing the three known stabilization gaps:

1. **#414 (A1)** — `store[sessionKey]` raw-key normalization. Silent sessionKey divergence is the worst class of continuation bug because nothing logs.
2. **#581 (A2)** — `continue_delegate` horizon ignored on canary; delegate fires within 3-15s regardless of `delayMs`. Fleet-confirmed pre-deploy.
3. **#606 (B1)** — `deploy.sh` post-deploy verification gap. Root cause amplifier for #580; without it, dist-tip / git-tip silent divergence keeps recurring.

## Out of scope

- New feature work (feature freeze for ship-cut).
- Schema changes that require user-facing migration.
- ⚓ rebase work (handled in project #47).
