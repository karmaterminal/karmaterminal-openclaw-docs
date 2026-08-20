# R-NC-ABANDON-SETTLE-RACE

**State:** pass (unit-via-existing-settle-owner).

## Contract

Abandonment, failure, adopt-complete, supersede/guillotine, and already-settled
share `settleOnce`. Mixed-cancel ALS does not add a second settle owner.

## Fresh controls

| Control | Receipt |
| --- | --- |
| 27 drain tests (adopt tombstone, supersede, adoption-lost, await abandon) | [05](../receipts/05-head-drain-settle-green.txt) EXIT=0 |
| Channels owner 103 / 1130 | [11](../receipts/11-head-channels-owner.txt) EXIT=0 |
| Production hunk (ALS + bind forward + settleUnadopted) | [production-hunk.patch](../receipts/production-hunk.patch) |

`ingress-drain-lifecycle.test.ts` is excluded from the channels include list
on this head. Bind forwarding is asserted via plugin-sdk runtime (7 tests)
and the production hunk.

## Microsoft Teams aged-threshold sibling

| Combination | Fresh receipt |
| --- | --- |
| `70d47bec` + retargeted assertion | [04](../receipts/04-head-msteams-green.txt) 4 passed EXIT=0 |
| Exact-base drain + retargeted assertion overlay | [06](../receipts/06-base-msteams-retarget-red.txt) pending `attempts: 8` EXIT=1 |

`rawActivity` in receipt 06 is redacted. Feishu/Mattermost copies still stay
pending because they never meet the 24h floor.

## Not claimed

Dedicated concurrent-settle stress harness. Fleet heal.
