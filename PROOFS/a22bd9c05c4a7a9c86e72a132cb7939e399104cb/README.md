# Preserved exact-head packet: `a22bd9c05c4a7a9c86e72a132cb7939e399104cb` (j12′)

**Status: a preserved exact-head packet. NOT acceptance-complete, NOT terminal.**

- **It holds:** gates 3 and 4 and the j12′ fold source review at this exact SHA, each as its own
  receipt under `gates/`.
- **Every other row is `missing`:** none has fired at this SHA.
- **Outstanding, and downstream of this packet:** exact-head fleet readiness, and every remaining
  live row. No seat runs `a22bd9c05c` yet; step 3 of the fleet readiness (the emeric canary cut) is
  held.
- **`a22bd9c05c` is preserved for presentation.** This lane did not touch the presentation ref or
  any openclaw branch.
- **`PROOFS/INDEX.json` does not point here,** and nothing here is a terminal or 38-PASS claim.

Structural completeness is not proof. Read `RESOLVED-SHA.md` for the identities and the fleet
state, and `METHOD.md` for how the packet was built.

## Rollup (computed from the row states)

| total | pass | partial | thin | fail | honest_limit | missing |
|---|---|---|---|---|---|---|
| 37 | 0 | 1 | 0 | 0 | 0 | 36 |

**Why 37 rows, not 38.** F′'s 38 required rows, less `R-CW-5A` and `R-CW-6A`, plus
`R-CD-RECIPIENT-AUTHORITY`:

- 🌊's F″ method ruling (docs#616, merged) makes R-CW-5A and R-CW-6A required preflight
  *attachments* of R-CW-5/6 in any corpus folded after it, never rows. Here they are recorded in
  `preflight_attachments`, both `missing`.
- `R-CD-RECIPIENT-AUTHORITY` is gate 3 of the j12′ gate list.

openclaw#1271's terminal rollup names 38 rows. That terminal matrix is 🌊's to set, and this packet
does not decide it.

## The gates (distinct receipts)

| gate | ruling | scope | receipt |
|---|---|---|---|
| Gate 3: `R-CD-RECIPIENT-AUTHORITY` | PASS-candidate (🌊, docs#620 comment 6651745479) | the gate-3 fire only; not a corpus fold | `gates/GATE-3-R-CD-RECIPIENT-AUTHORITY.md` |
| Gate 4: Mode-B 41927761314 and the local cut shards | PASS-candidate (🌊, openclaw#1271 comment 6653747059) | the candidate-owned Mode-B precondition; Mode-B concluded failure with exactly j12's 64 failing tests | `gates/GATE-4-MODE-B-AND-LOCAL-SHARDS.md`, `gates/gate-4-summary.json` |
| j12′ fold source review | PASS-candidate (🌊, openclaw#1271 comment 6655365352) | a source review of the 11-file `2907e656` → `a22bd9c05c` diff; no test receipt, no fleet GO | `gates/FOLD-SOURCE-REVIEW.md` |

## Rows

`R-CD-RECIPIENT-AUTHORITY` is the only row with a receipt at this SHA. It is held at `partial` with
its PASS-candidate kept: not a behavior gap, but four fold gaps named in its `EVIDENCE.md`. They
are:

- no corpus fold review yet;
- the HMAC receipts are verifiable only by the observer-key holder;
- the row's method is on draft docs#620, not docs main;
- openclaw#1271's fleet order.

| row | state | candidate verdict |
|---|---|---|
| `R-CD-1` | `missing` | not fired at this SHA |
| `R-CD-2` | `missing` | not fired at this SHA |
| `R-CD-3` | `missing` | not fired at this SHA |
| `R-CD-4` | `missing` | not fired at this SHA |
| `R-CD-CHAINED-DEPTH-2` | `missing` | not fired at this SHA |
| `R-CD-COLLECTION-ON-COLLAPSE` | `missing` | not fired at this SHA |
| `R-CD-MODEL-CHAINED-ALT` | `missing` | not fired at this SHA |
| `R-CD-MODEL-DEFAULT` | `missing` | not fired at this SHA |
| `R-CD-MODEL-TOKEN` | `missing` | not fired at this SHA |
| `R-CD-MODEL-TOOL` | `missing` | not fired at this SHA |
| `R-CD-RECIPIENT-AUTHORITY` | `partial` | `PASS-candidate` (gate 3, not folded) |
| `R-CD-RETURN-COVENANT-AUTHORITY` | `missing` | not fired at this SHA |
| `R-CD-RETURN-OVERLAP` | `missing` | not fired at this SHA |
| `R-CD-SILENT` | `missing` | not fired at this SHA |
| `R-CD-TOKEN` | `missing` | not fired at this SHA |
| `R-CONFIG-DEFAULTS` | `missing` | not fired at this SHA |
| `R-CONFIG-INTERSESSION` | `missing` | not fired at this SHA |
| `R-CW-1` | `missing` | not fired at this SHA |
| `R-CW-2` | `missing` | not fired at this SHA |
| `R-CW-3` | `missing` | not fired at this SHA |
| `R-CW-4` | `missing` | not fired at this SHA |
| `R-CW-5` | `missing` | not fired at this SHA |
| `R-CW-6` | `missing` | not fired at this SHA |
| `R-CW-7` | `missing` | not fired at this SHA |
| `R-CW-DELEGATE-CHILD-LIVE` | `missing` | not fired at this SHA |
| `R-CW-DELEGATE-SELF-CONTINUATION` | `missing` | not fired at this SHA |
| `R-CW-DELEGATE-TOKEN` | `missing` | not fired at this SHA |
| `R-CW-MULTI` | `missing` | not fired at this SHA |
| `R-CW-MULTI-COLLAPSE` | `missing` | not fired at this SHA |
| `R-CW-TOKEN` | `missing` | not fired at this SHA |
| `R-OBS-1` | `missing` | not fired at this SHA |
| `R-OBS-2` | `missing` | not fired at this SHA |
| `R-OBS-STATUS` | `missing` | not fired at this SHA |
| `R-RC-1` | `missing` | not fired at this SHA |
| `R-RC-2` | `missing` | not fired at this SHA |
| `R-REGRESSION-TRAP-TESTS` | `missing` | not fired at this SHA |
| `R-TRACE-REDACTION-1121` | `missing` | not fired at this SHA |

Required preflight attachments (F″; not rows, outside the rollup):

| attachment | attached to | state |
|---|---|---|
| `R-CW-5A` | `R-CW-5` | `missing` |
| `R-CW-6A` | `R-CW-6` | `missing` |

## Allocation

`proofs-manifest.json::dispatch_allocation` authorizes no fire.

- `R-CD-RECIPIENT-AUTHORITY` fired once (run `rra-e0b97a595e89973b`, 🕯 on emeric's isolated proof
  gateway) and is consumed.
- The other 36 rows are held. They get owners only from a later allocation, after exact-head fleet
  readiness.

## Provenance

Earlier corpora are provenance only, and no historical verdict is carried. Each missing row's
`EVIDENCE.md` names what F′ (`f15237ec92`) recorded, for diagnosis only. The current board that
`PROOFS/INDEX.json` names is unchanged by this packet.
