# Exact runtime R-CW-1 receipt

| Field | Value |
|---|---|
| Runtime composite | `a0aa4ec8aefe95ced34342978b64c270c16ec3e9` |
| Warm pure ancestor | `25051f3b77409c45f5ce71c3b3b05aae85b0f8f9` |
| Harness docs SHA | `0e75318a68d7145c0c5b99e8b11bda304f4f9fd2` |
| Seat | Ronan, isolated loopback gateway |
| Row | `R-CW-1` |
| Functional verdict | `PASS-candidate` |
| Observability verdict | `PARTIAL-candidate` |

The exact isolated runtime created a disposable proof session, accepted
`sessions.send`, emitted `CW-SCHEDULED`, and delivered delayed `CW-WOKE`.
`run-result.json` records zero k6/postprocess errors and binds the observed
behavior to the exact runtime and approved harness identities.

This packet does not claim a complete observability proof. The isolated gateway
had no authorized OTel collector configured, emitted no gateway trace ID, and
the Tempo query ingress was not an OTLP intake endpoint. The missing
continuation-trace and Tempo receipts remain explicit review debt; no collector
endpoint or credential was guessed, and no product defect is inferred.

Historical execution remains historical. This is new exact execution on the
runtime composite only; it does not mean the warm pure SHA itself was executed
as a standalone gateway.
