# swim-43/N006 — OTel traceparent propagation across queue boundary

**Swim:** swim-43-v2026.5.5-full
**Block:** N — Family Observability
**Row ID:** N006
**Tracker anchor:** karmaterminal/openclaw-bootstrap#915 (parent #907)
**Case file:** `SWIM/cases/N006.md`
**SUT SHA (target):** `24b76bf` on `karmaterminal/openclaw:frond/v2026.5.5/canonical`
**SUT host:** cael-host
**SUT seat:** `agent:main:discord:channel:1466192485440164011`
**Test file candidates:** N/A (live observability row)
**Timing window:** integration
**Evidence class:** live-row
**Gather:** OTel config, reachability probe, TaskFlow/traceparent evidence, collector-side or local trace evidence

## Surface under test

Per `SWIM/cases/N006.md`: W3C `traceparent` carrier is accepted at producer surface, persisted across queue boundary, and re-applied by consuming spans so the resulting trace tree is connected end-to-end.

The end-to-end version of this row needs three things:
1. producer-side `traceparent` injection
2. persistence across TaskFlow / queue boundary
3. collector-side evidence that the resulting spans arrived and can be reconstructed as one tree

## Coverage expectation

- **Unit tests expected:** N/A
- **Integration tests expected:** 1 live row on deployed v5.5 substrate
- **Fleet-scale tests expected:** N/A
- **Evidence artifacts expected:** OTel config, exporter reachability, persisted carrier bytes or equivalent, collector/tree evidence or a documented reason that surface is broken

## Measurement protocol

### What we expect — literal substrate bytes for PASS

**Source (a) config surface**
```bash
openclaw config get diagnostics.otel
```

**Source (a) collector reachability**
```bash
curl -X POST -H 'Content-Type: application/json' --data '{}' <otel-endpoint>/v1/traces
```
PASS-compatible surface should at least be reachable at the configured endpoint.

**Source (a)/(b) trace evidence**
- explicit `traceparent` on the producer surface
- carrier persisted across queue boundary (TaskFlow / durable state)
- consumer-side span or trace-tree evidence showing connected lineage

### What FAIL looks like

```text
FAIL = traceparent is accepted and collector is reachable, but queue-boundary propagation breaks or connected tree cannot be reconstructed.

INCONCLUSIVE = partial evidence exists but not enough to prove end-to-end propagation.

METHOD-BROKEN = the configured observability surface itself is not reachable, so the collector-side PASS surface cannot be exercised.
```

### Result — actual output, byte-pinned

#### Fire 1 — config exists, collector endpoint broken by hostname resolution on cael-host

**Config surface**
```text
$ ssh cael 'openclaw config get diagnostics.otel'
{
  "enabled": true,
  "endpoint": "http://elliott.dandelion.cult:4318",
  "protocol": "http/protobuf",
  "serviceName": "cael-prince",
  "traces": true
}
```

**Configured hostname reachability fails**
```text
$ ssh cael 'getent hosts elliott.dandelion.cult'
(no output)

$ ssh cael "curl -sS -o /tmp/otel.out -w 'HTTP %{http_code}\n' -X POST -H 'Content-Type: application/json' --data '{}' http://elliott.dandelion.cult:4318/v1/traces"
curl: (6) Could not resolve host: elliott.dandelion.cult
HTTP 000
```

**Direct IP reachability succeeds**
```text
$ ssh cael "curl -sS -o /tmp/otel-ip.out -w 'HTTP %{http_code}\n' -X POST -H 'Content-Type: application/json' --data '{}' http://10.0.0.10:4318/v1/traces"
HTTP 200
{"partialSuccess":{}}
```

This narrows the observability finding sharply:
- OTel config is present and enabled
- collector is up and reachable by IP
- configured exporter endpoint is broken on cael-host by hostname resolution / binding shape

### Verdict

**Current verdict: METHOD-BROKEN for end-to-end collector proof surface.**

This is not "OTel absent" and not "collector down." It is a narrower infrastructure break:
- the configured endpoint `elliott.dandelion.cult:4318` is not resolvable from cael-host
- collector-side ingestion evidence therefore cannot currently serve as the PASS surface for the end-to-end N006 claim

What remains testable today:
- agent-side traceparent construction / emission
- local journal-side trace literals, if any
- TaskFlow-side carrier persistence, if surfaced

What is **not** honestly byte-walkable today without fixing infra/config first:
- end-to-end claim that a queued `traceparent` reaches the collector and can be reconstructed as one tree via the configured endpoint

## Status ladder

- [x] **Triaged**
- [x] **Authored**
- [x] **Fire-1 substrate finding captured** — config exists but collector endpoint broken by hostname resolution
- [x] **METHOD-BROKEN (current collector proof surface)**
- [ ] **Alternate local-only traceparent proof OR collector fix**
- [ ] **Verified end-to-end PASS/FAIL**

## References

- **Case file**: `SWIM/cases/N006.md`
- **Spine issue**: `karmaterminal/openclaw-bootstrap#915`
- **Docs issue**: `karmaterminal/karmaterminal-openclaw-docs#39`

## Notes

This row now has a concrete precondition finding: before making claims about trace-context propagation, the configured collector endpoint must be reachable by the configured hostname, or the row must be reframed as a local-only traceparent construction/persistence test instead of end-to-end collector proof.
