# Delegate attachment I/O proof rows (P86 / docs#491)

Eight rows covering the typed `continue_delegate` **INPUT** snapshot surface and
the managed delegate **OUTPUT** claim lifecycle, as assembled in the Project 86
candidate.

Binding: [karmaterminal/karmaterminal-openclaw-docs#491](https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/491)
— acceptance item 4 ("Exact-canary Project 86 receipts").

---

## Why these rows exist

Issue #491 is a deployment/proof binding gap, not a feature gap. The delegate
input surface and the managed return-claim control plane are assembled in the
candidate; what was missing was *reviewable automation* that produces public-safe
receipts for them. Before #491, the 38-row Project 86 plan had **no** row for
delegate attachment I/O: every `R-CD-*` row proved scheduling, wake, return, and
model propagation, and none of them touched attachments or artifact claims.

These rows close that hole. They are one-command local-gateway WebSocket
scenarios in the existing harness shape — same manifest schema, same evidence
writer, same validator, same fold contract.

---

## Runtime controller binding

Every row names the controller it exercises. If you are reviewing a receipt,
this is the map from sentinel to source:

| Row | Runtime surface at the candidate |
|---|---|
| R-CD-IN-1 | `src/agents/tools/continue-delegate-tool.ts` (`attachments`, `attachAs`), `src/agents/subagent-attachments.ts` |
| R-CD-IN-RECOVERY | `src/auto-reply/continuation/delegate-flow-store.ts` (persisted attachment state, `hasStoredDelegateAttachmentState`) |
| R-CD-IN-REVOKE | `continue-delegate-tool.ts` policy refusal + `delegate-flow-store.ts` `scrubStoredDelegateAttachmentState` |
| R-CD-OUT-PUBLISH | `src/agents/tools/delegate-artifacts-tool.ts` (`delegate_artifacts_publish`), `src/agents/delegate-artifact-store.ts` |
| R-CD-OUT-CLAIM | `delegate-artifacts-tool.ts` (`action: list \| inspect \| materialize \| discard`), `src/agents/delegate-artifacts.ts` |
| R-CD-OUT-UNAUTHORIZED | `src/agents/delegate-artifact-recipient.ts`, `delegate-artifact-store.ts` claim/binding status |
| R-CD-OUT-REPLAY | `src/agents/delegate-artifact-delivery.ts` (delivery phases `attempt` / `replay` / `acknowledged`), `src/state/delegate-artifacts-schema.ts` |
| R-CD-IO-NEG | `src/agents/internal-events.ts` (explicit-action announcement footer) |

---

## Row table

| Row | Manifest | Scenario | Class | Expected artifact class |
|---|---|---|---|---|
| R-CD-IN-1 | `r-cd-in-1.json` | `r-cd-in-1-typed-input-snapshot.js` | k6-runnable | PASS-candidate |
| R-CD-IN-RECOVERY | `r-cd-in-recovery.json` | `r-cd-in-recovery-queued-restart.js` | orchestration-required | PARTIAL-candidate |
| R-CD-IN-REVOKE | `r-cd-in-revoke.json` | `r-cd-in-revoke-no-spawn-scrub.js` | orchestration-required | PARTIAL-candidate |
| R-CD-OUT-PUBLISH | `r-cd-out-publish.json` | `r-cd-out-publish-claim.js` | k6-runnable | PASS-candidate |
| R-CD-OUT-CLAIM | `r-cd-out-claim.json` | `r-cd-out-claim-lifecycle.js` | k6-runnable | PASS-candidate |
| R-CD-OUT-UNAUTHORIZED | `r-cd-out-unauthorized.json` | `r-cd-out-unauthorized-reject.js` | k6-runnable | PASS-candidate |
| R-CD-OUT-REPLAY | `r-cd-out-replay.json` | `r-cd-out-restart-replay.js` | orchestration-required | PARTIAL-candidate |
| R-CD-IO-NEG | `r-cd-io-neg.json` | `r-cd-io-negative-boundary.js` | k6-runnable | PASS-candidate |

### Both-forms mandate: not applicable

Only the typed `continue_delegate` tool can carry attachment blobs. The bracket
form is explicitly documented at the candidate as unable to:

> `Bracket [[CONTINUE_DELEGATE: ...]] syntax cannot carry attachment blobs; reference an existing workspace file instead.`
> — `src/agents/system-prompt.ts`

So these rows have no token-form sibling, and a single-surface row here is
complete rather than incomplete. This is the same shape as the R-OBS-1
not-applicable ruling.

---

## Running a row

One command per row, in the standard harness shape:

```bash
OPENCLAW_GATEWAY_WS="ws://127.0.0.1:18789" \
OPENCLAW_GATEWAY_TOKEN="***" \
OPENCLAW_SESSION_KEY="<recipient-session>" \
OPENCLAW_CANDIDATE_SHA="<40-char-sha>" \
OPENCLAW_SEAT_NAME="<seat>" \
OPENCLAW_CREATE_DISPOSABLE_SESSION=true \
OPENCLAW_ROW_MANIFEST="tools/k6-proofs/manifests/r-cd-out-claim.json" \
  k6 run tools/k6-proofs/scenarios/r-cd-out-claim-lifecycle.js \
  | tee /tmp/r-cd-out-claim.txt
```

Then post-process exactly as any other row:

```bash
node tools/k6-proofs/scripts/evidence-writer.mjs \
  --input /tmp/r-cd-out-claim.txt \
  --row R-CD-OUT-CLAIM \
  --seat <seat> \
  --sha <40-char-sha> \
  --manifest tools/k6-proofs/manifests/r-cd-out-claim.json
```

The GitHub `k6 PROOF row` workflow carries all eight scenarios as dispatch
choices.

### Row-specific environment

| Variable | Rows | Meaning |
|---|---|---|
| `OPENCLAW_QUEUE_DELAY_SECONDS` | R-CD-IN-RECOVERY | Queue window the delegate stays pending (default 120) |
| `OPENCLAW_RESTART_WINDOW_MS` | R-CD-OUT-REPLAY | Window during which the operator restarts the gateway (default 120000) |
| `OPENCLAW_RESTART_ORCHESTRATED` | R-CD-IN-RECOVERY, R-CD-OUT-REPLAY | Set `true` **only** when a restart genuinely happened |
| `OPENCLAW_NEGATIVE_WINDOW_MS` | R-CD-IO-NEG and the OUT rows | Bounded window held open to catch unsolicited delivery |

---

## The honesty contract

These rows are built so that a PARTIAL cannot be quietly upgraded.

**`computeVerdict` returns `PASS-candidate` only when** every required receipt
fired **and** every negative check held **and** any declared orchestration
precondition was observed. Anything else is `PARTIAL-candidate`. There is no
third path and no override env var.

**Orchestration gates.** Two preconditions cannot be produced by a k6 harness and
must not be faked:

1. *Policy revoke* (R-CD-IN-REVOKE). The gateway exposes `config.get` but no
   `config.set`. The scenario reads the live value of
   `tools.sessions_spawn.attachments.enabled`. If it is still `true`, or if the
   config surface does not expose it at all, the row is PARTIAL with the reason
   recorded verbatim in `evidence.orchestration.reason`. It never assumes a
   default and never infers a revoke that was not applied.
2. *Gateway restart* (R-CD-IN-RECOVERY, R-CD-OUT-REPLAY). Restarting a seat is an
   operator action. The harness logs when its restart window opens and otherwise
   does nothing. Without `OPENCLAW_RESTART_ORCHESTRATED=true` **and** an observed
   post-window receipt, the row is PARTIAL.

A PARTIAL from these rows is still informative: the pre-condition legs that did
fire are recorded as receipts, so the artifact says exactly how far the run got
and precisely which operator step was missing.

**Positive controls.** Two rows would be vacuous without one, and both carry it:

- R-CD-OUT-UNAUTHORIZED requires `recipient-positive-control` — the true
  recipient must still be able to inspect. Without it, a rejection could just
  mean the claim was dead.
- R-CD-IO-NEG requires `claim-announced-positive-control` — a real claim must
  have been announced. Without it, a clean negative window proves nothing.

---

## Redaction boundary

The rows deliberately move a known payload through the system so the negative
checks have something to detect. Handling rules:

- The payload is a synthetic canary, `P86-CANARY-<rowNonce>`. It is never a
  secret, never user content, and never a real transcript.
- Evidence records only `{ bytes, sha256_prefix }` for it — `contentReceipt()`
  in `lib/delegate-attachment-io.js`. The content itself is never written to an
  artifact.
- Every captured frame passes through `redactEvent` from `lib/gateway-ws.js`
  before it enters `redacted_events`. The allowlist has no `text`/`content` key.
- The harness must name the canary in the instruction it sends, so frames
  carrying `[k6-proof-harness]` are excluded from the raw-byte scan. This is the
  established R-CD-1 prompt-echo convention; echoes are counted in
  `prompt_echoes_ignored` rather than silently dropped.
- No tokens, no session secrets, no prompt bodies, and no raw attachment bytes
  ever reach a receipt.

---

## See also

- [`CONTRIBUTING-ROWS.md`](../CONTRIBUTING-ROWS.md) — row PR checklist and fold contract
- [`../README.md`](../README.md) — harness usage and redaction boundary
- [`../row-manifest.schema.json`](../row-manifest.schema.json) — manifest schema
- `tools/k6-proofs/scripts/__tests__/delegate-attachment-io-rows.test.mjs` — the
  contract test that keeps these invariants from drifting
