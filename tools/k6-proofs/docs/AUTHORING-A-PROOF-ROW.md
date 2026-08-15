# Authoring a proof row

The short path from "this row is assigned to me" to "this row produces evidence
somebody else can check". Everything here points at code that already runs; it
is not an additional rule pile. When this page and the code disagree, the code
is right and this page is a bug.

Read [`CONTRIBUTING-ROWS.md`](../CONTRIBUTING-ROWS.md) for the PR/Project-81
process. This page is only about the scenario and its evidence.

---

## The two runtimes, and why the boundary is load-bearing

| | k6 VU runtime | Node post-run |
| --- | --- | --- |
| Files | `scenarios/*.js`, the `lib/` modules they import | `scripts/*.mjs`, the `lib/` modules only those import |
| May use | `k6`, `k6/ws`, `k6/crypto`, `k6/metrics`, `__ENV`, `__VU` | anything, including `node:crypto` |
| Must never use | any `node:` import, `require()`, computed `import()`, `process`, `Buffer`, `__dirname` | — |

k6 resolves a scenario's **entire** ESM graph before the first VU starts. One
`node:` edge anywhere below a scenario aborts the run at initialization with
exit 107 — before a single frame is sent. That is not a theoretical concern:
it is exactly how R-CD-4 produced a PARTIAL containing no product evidence at
all, because a structural observer imported the HMAC receipt module that seals
the post-run authority.

The boundary is enforced, not trusted:

```bash
node tools/k6-proofs/scripts/check-k6-scenario-import-closure.mjs --repo-root "$PWD"
```

It walks every scenario's transitive closure and fails closed on `node:` and
bare builtin imports, unresolvable relative imports, `require()`, dynamic
`import()` with a non-literal specifier, and Node-only globals. It runs in
`run-proof.sh`, in `scripts/run-proofs.sh`, in both GitHub Actions workflows,
and in the catalog contract test. Run it yourself before you push.

**Rule of thumb:** if a helper needs a gateway token, an HMAC, a file, or a
process, it belongs in the post-run half and the scenario must not import it.
Split it the way `lib/r-cd-4-authority.mjs` (k6-safe observer) and
`lib/r-cd-4-return-authority.mjs` (Node-only sealer) are split.

---

## Reuse before you write

Most of what a new row needs already exists. Reimplementing it is how rows
drift into weaker copies of a proven mechanic.

### Session mechanics — `lib/proof-session.js` (k6-safe)

```js
import { connectFrame, RequestTracker, redactEvent, nonce } from '../lib/gateway-ws.js';
import {
  GatewayHandshake,
  disposableSessionKey,
  recordClassifiedEvent,
} from '../lib/proof-session.js';

const tracker = new RequestTracker();
const handshake = new GatewayHandshake({
  tracker,
  fallbackMs: 500,
  onReady: () => { createDisposableSession(socket); },
});

socket.on('open', () => { handshake.begin(socket, token); });

socket.on('message', (raw) => {
  const classified = tracker.classify(JSON.parse(raw));
  handshake.observe(classified);
  recordClassifiedEvent(evidence, classified, redactEvent);
  // … row-specific handling …
});
```

- `handshake.begin` sends a **tracked** connect, so the row starts when the
  gateway acknowledges rather than after a fixed guess. `fallbackMs` is an
  upper bound only, and the path taken (`connect-ack` / `connect-rejected` /
  `deadline-fallback`) is recorded in `handshake.receipt()`.
- `disposableSessionKey('r-cd-4-parent', rowNonce)` is the one normalization.
  Do not inline `.toLowerCase().replace(/[^a-z0-9-]/g, '-')`; a row whose
  normalization differs creates sessions its own negative controls no longer
  recognize.
- `recordClassifiedEvent` keeps `redacted_events` a single shape that
  `scripts/evidence-writer.mjs` can trust. If your row needs a stricter
  redaction, pass `options.redactData` — the difference is preserved, not
  flattened.

### Do not add a fixed sleep for something you can observe

`socket.setTimeout(fn, N)` is correct for an observation window or a
deliberately delayed probe. It is wrong as a stand-in for a response you
already receive. If you find yourself guessing how long a request takes, react
to its response instead. `scripts/__tests__/scenario-handshake-contract.test.mjs`
fails a row that re-arms a pre-dispatch delay in its open handler.

### Child discovery and completion

- `lib/row-child-correlation.mjs` — a child key is authoritative only when the
  *same structured record* binds it to the row nonce. A nonce appearing
  somewhere in an outer aggregate event is not binding.
- `lib/r-cd-4-authority.mjs` — exact-marker sentinel matching, ambiguity
  handling (two candidate children invalidates authority; it does not pick one).
- `lib/r-cd-model-tool-authority.mjs` — `spawnedBy` set-diff, and sticky
  evidence that a later empty poll cannot silently clear.

### Receipts — `lib/receipt-seal.mjs` (Node-only)

Every authoritative receipt seals with the gateway token:

```js
import { sealReceipt, verifyReceiptSeal, fingerprint16, digest64 } from './receipt-seal.mjs';

const canonical = (receipt) => JSON.stringify({ /* the fields this row closes */ });
const sealed = sealReceipt(receipt, signingKey, canonical);
const check = verifyReceiptSeal(sealed, signingKey, canonical);   // { valid, reason }
```

The primitives are shared; the **canonical field list stays row-owned**, so one
row's signature can never certify another row. `verifyReceiptSeal` returns a
reason for every rejection — including a missing key — and never throws.

Publish fingerprints, never identities: `fingerprint16(sessionKey)`, not the
session key.

---

## Evidence that stays honest when the backend is down

A row that cannot get its trace must say *why*. The collector writes
`continuation-trace-observability.json` on **every** exit:

| status | meaning |
| --- | --- |
| `correlated` | a trace was found and passed every topology gate |
| `backend-unavailable` | Tempo could not be reached or returned an error |
| `no-matching-trace` | Tempo answered, and nothing matched the window |
| `ambiguous-trace` | more than one trace matched; no first-wins selection |
| `topology-invalid` | a trace matched but failed a topology gate |
| `contract-invalid` | the manifest/evidence could not produce a query at all |

Only `correlated` may carry `traceId` / `traceJson` / `correlationReceipt`.
Every other status carries `rebind` — service name, TraceQL query, search
window, reason hash and length, and public-safe nonce/session fingerprints — so
the row can be re-bound when the backend returns **without refiring the
product**.

The same distinction applies to logs. `resolveTargetedReturnAuthority` reports
`journal-unavailable` when no journal was read and `no-delivery` when a
captured journal genuinely contains no matching delivery. Never let an evidence
gap render as a product claim.

---

## Metric naming

Prometheus metric names allow only `[a-zA-Z0-9_]`. Keep the hyphenated form for
the row *name* and use underscores inside metric names:

- row `r-cd-1` → `r_cd_1_pass`, `r_cd_1_fail`, `r_cd_1_duration_ms`,
  `r_cd_1_pass_rate` (+ a `rate > 0.99` threshold).

See [`../METRICS.md`](../METRICS.md).

---

## Both forms

`continue_work` and `continue_delegate` each have two independent entry
surfaces: the typed tool and the token/bracket form. They take partially
different code paths, and a lightContext subagent has no tool at all — so a
tool-only proof is blind to the exact path that #952 broke. A row proving one
form is incomplete. `request_compaction` is tool-only and needs no bracket row.

---

## Before you push

```bash
# 1. the graph is k6-safe
node tools/k6-proofs/scripts/check-k6-scenario-import-closure.mjs --repo-root "$PWD"

# 2. k6 can actually load and initialize the scenario
k6 inspect tools/k6-proofs/scenarios/r-<row>.js

# 3. the harness contracts still hold
node --test tools/k6-proofs/scripts/__tests__/*.test.mjs tools/k6-proofs/tests/*.test.mjs
```

Add a focused test for whatever your row asserts, and a negative test for the
thing that would make it a false PASS. A row whose negative control never runs
is not proven — five R-CD-MODEL-TOOL negative controls sat cancelled inside a
synchronous parent test for their whole life. If you nest subtests, `await`
them.
