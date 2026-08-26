# Warm-target qualification

| Field | Value |
|---|---|
| Warm target | `25051f3b77409c45f5ce71c3b3b05aae85b0f8f9` |
| Qualification mode | `affected-slice-materiality` |
| Exact target Mode-B | `false` |
| Exact target execution | `false` |
| Immediate source corpus | `2ffc7ca0615f5917acf809d1ccba82b0ef5b2d5a` |
| Frozen qualified basis | `c7131791a6d33ab83d1a820c7cdb81c1b1384931` |
| Pinned upstream parent | `80985b9663252da97bf8d67dd2cbeba0fa03aeea` |
| Pending exact-live runtime | `a0aa4ec8aefe95ced34342978b64c270c16ec3e9` |

Warm target `25051f3b...` is the ordinary merge of frozen basis `c7131791...`
and pinned upstream parent `80985b96...`. It intentionally has no exact
Mode-B or live execution. Qualification is compositional and bounded to the
declared affected slice.

## Affected-slice receipt

- Owner set: 11 files / 686 assertions.
- Independent subset: 11 files / 544 assertions.
- Production types, full test types, and build: pass.
- Three generated snapshots: current.
- Raw receipts:
  [`../promotion/25051f3b77409c45f5ce71c3b3b05aae85b0f8f9/`](../promotion/25051f3b77409c45f5ce71c3b3b05aae85b0f8f9/).
- Every raw promotion output is content-addressed by the packet's
  `SHA256SUMS`.

## Immutable ancestor qualification

| Identity | Run / review | Result |
|---|---|---|
| Source `2ffc7ca0...` | Mode-B `32895790947`, workflow `342cc9c6d190e1ba57d9995d29e394c993a3e79b` | `failure`; 165,696 passed, 39 failed, 9 load flakes, 32 deterministic |
| Frozen basis `c7131791...` | Mode-B `32911065508`, same workflow SHA | `failure`; 167,237 passed, 21 failed, 3 load flakes, 18 deterministic |
| Frozen basis `c7131791...` | independent heartbeat relocation review | `APPROVE`; 1 file / 40 assertions |

The c713 review applies only to c713 qualification identity. Neither ancestor
Mode-B run is target Mode-B.

## Final disposition

| Class | Disposition |
|---|---|
| `REUSE` | Immutable historical corpus plus bounded structural applicability. |
| `INVALIDATE` | No ancestor execution transfers into an exact warm-target execution claim. |
| `UNKNOWN` | None inside the declared affected slice after docs `e19110e4...` receipt closure. |

Historical execution stays bound to `37300f29...`. Exact live proof on runtime
`a0aa4ec8...` remains pending until the Ronan receipt.
