# PR 121204 ClawSweeper follow-up evidence — `cafcf7c85fec045c2ecc8c682932514e84353db8`

## Binding

- Upstream PR: <https://github.com/openclaw/openclaw/pull/121204>
- Follow-up PR: <https://github.com/karmaterminal/openclaw/pull/1236>
- Base: `02bd9d77142248a07e4ad50387a166db1823b494`
- Head: `cafcf7c85fec045c2ecc8c682932514e84353db8`
- Disposition: superseded draft; this head is not the selected remediation vehicle.

## Evidence retained from this head

The follow-up PR records a focused local run over the Discord ingress monitor,
direct-config stale handling, and the core ingress queue: 73 tests passed with
zero failures. It also records clean formatting and `git diff --check` results.

The source delta adds a corrupt-row lane-isolation regression and rearranges the
stale-expiry predicate around a raw non-thread channel check.

## Limit

This head does **not** close the ClawSweeper P1 fact-boundary finding. Its
predicate still derives channel type from `rawMessage.channel`, while the normal
durable Discord gateway envelope identified by the review does not contain that
hydrated object. No recovered-gateway behavioral receipt was collected on this
head.

PR 1236 is therefore retained only as a historical static-test receipt and is
superseded by PR 1237. It is not merge, deployment, or real-behavior proof.

## Redaction

This record intentionally omits message content, author/account identifiers,
Discord event and channel identifiers, lane keys, hostnames, local paths,
credentials, and credential-bearing configuration. No raw runtime payload is
published here.
