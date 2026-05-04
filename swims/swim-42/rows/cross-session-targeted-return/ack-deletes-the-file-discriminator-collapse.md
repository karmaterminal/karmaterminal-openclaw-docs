# swim-42 / cross-session-targeted-return — ack-deletes-the-file: silas-seat queue-walk discriminator collapses

**Status**: 🟡 silas-seat byte-pinned `session-delivery-queue/` empty post-fire as evidence the layer didn't materialize. Source-walk shows that byte-pin is **not actually attestation of absence-of-delivery** because `ackSessionDelivery` deletes the file in the normal-fire path immediately after `enqueueSessionDelivery` returns. Empty queue dir is consistent with both "delivery succeeded" and "delivery never wrote anything."

**Source**: silas-seat byte-pin (msg `1500690...`-area) + runner-seat source-walk against `~/flesh_beast_tmp/openclaw/src/auto-reply/continuation/targeting.ts:88-117` + `~/flesh_beast_tmp/openclaw/src/infra/session-delivery-queue-storage.ts:265-340`.

## What silas-seat byte-pinned

silas-seat walked `~/.openclaw/session-delivery-queue/` on silas-host post-OV-2-multi-recipient-fire and found:
- directory exists, only contents = `failed/` subdir (Apr 29, old)
- 0 files for `agent:main:main` OR `agent:main:dreaming`
- the journal log line `[continuation:targeted-return] Delivered to ...` HAD fired on this host for the same OV-2 fire

silas-seat's reading: branch was entered (journal proves it), `enqueueSessionDelivery` was called (the log line is emitted from after that call returns), but no file lands in the queue dir.

## What the source-walk shows

`src/auto-reply/continuation/targeting.ts:88-117`, the loop body inside `enqueueContinuationReturnDeliveries`, runs in this exact order per recipient:

1. `await deps.enqueueSessionDelivery(payload, stateDir)` — returns the `deliveryId`
2. `deps.enqueueSystemEvent(text, opts)` — synchronous in-memory queue write
3. `if (params.wakeRecipients) deps.requestHeartbeatNow(...)` — synchronous
4. `await deps.ackSessionDelivery(deliveryId, stateDir)` — **renames + unlinks the file**
5. increment `delivered`

`src/infra/session-delivery-queue-storage.ts:326-340`, the `ackSessionDelivery` body:

```ts
export async function ackSessionDelivery(id: string, stateDir?: string): Promise<void> {
  const { jsonPath, deliveredPath } = resolveQueueEntryPaths(id, stateDir);
  try {
    await fs.promises.rename(jsonPath, deliveredPath);
  } catch (err) {
    // ...
  }
  await unlinkBestEffort(deliveredPath);
}
```

So in the normal-fire path, the queue file:
1. lands on disk via `enqueueSessionDelivery` → `writeQueueEntry`
2. gets renamed to `.delivered` via `ackSessionDelivery`
3. is immediately unlinked from `.delivered` via `unlinkBestEffort`

Total file lifetime: bounded by the time between `enqueueSessionDelivery` returning and `ackSessionDelivery` completing — single function-call sequence, no async delay between them, no intentional persistence window.

The `failed/` subdir is where files would land if `ackSessionDelivery` failed — explaining why silas-host has old entries there but nothing fresh from this fire.

## What this collapses

silas-seat's discriminator (empty queue dir post-fire = evidence delivery didn't materialize) **collapses**. Empty queue dir is the *expected* outcome of normal-fire path because ack-deletes-the-file. The empty-queue evidence is consistent with:

- **delivery succeeded** (file written, ack ran, file deleted — the intended path)
- **delivery never wrote anything** (no file ever written — bug)
- **delivery wrote then failed silently before ack** (less likely; would leave file in `failed/`, which silas-host doesn't have for this fire)

The first two are indistinguishable from the post-hoc queue walk alone.

## What this means for the substrate-finding-shape

The substrate-finding-shape inversion-candidate at `substrate-finding-shape-inversion-candidate.md` is not resolved by silas-seat's queue-walk; it's still genuinely open. The 4-host journal coverage (1 fire on silas-host, 0 on the rest) attests:
- branch was entered for at least one fire (silas-host array-API)
- branch was not entered for the singular-API fires (ronan-host)

But neither attests whether `enqueueSessionDelivery` actually wrote a queue file (since ack-deletes-the-file makes that unobservable from external walks).

## Discriminator candidates that survive

1. **system-events in-memory per recipient session** — `enqueueSystemEvent` is called from `targeting.ts:101-104` separately from `enqueueSessionDelivery`. If the recipient session isn't actively running, the system-event lands in their in-process queue but isn't observable until the recipient session is woken. **Walking the recipient session's runtime in-memory queue at fire-time** would attest whether system-events arrive.
2. **temporary log statements at `targeting.ts:101` and `:114`** to byte-pin whether `enqueueSystemEvent` AND `ackSessionDelivery` both fire — frond-scribe-territory; can land as a debug commit on the fix-580 branch.
3. **fire from a session whose recipient session IS actively attached** — if the system-event arrives at an attached recipient, the recipient observably reacts, which closes the surface-delivery layer that has been explicitly out-of-scope from runner-seat fires.
4. **byte-pin `session-delivery-queue/.delivered/` and `session-delivery-queue/failed/`** for any rename-but-not-unlink artifacts — if the rename succeeds but the unlink fails, the `.delivered` file should persist; absence in both subdirs is additional evidence the file never got written, but only suggestive.

## Discipline-pin

This is *no false closure from adjacency* applied at the substrate-evidence-walk layer this time. silas-seat's queue-walk was real and well-intentioned, but the empty result was over-read as *attestation-of-absence* when the source actually says *expected-empty-on-success-too*. Same byte-pin discipline that closed OV-1 substrate-side now applies to substrate-walk-prose: the walk's accuracy depends on what the source actually does in the path being attested.

## Verdict

🟡 silas-seat's queue-walk discriminator collapsed under source-walk. Substrate-finding-shape inversion-candidate stays open. Surviving discriminators named above; none are runner-seat-firable without either (a) instrumentation on the fix-580 branch or (b) a live-attached recipient at the named target session.

frond-scribe's #581 + cohort substrate-finding-shape direction is still figs/cohort's call. From driver-seat: holding further substrate-walk hardening until either #581 lands or one of the surviving discriminators gets executed by a seat positioned to do so.

## Three-host cross-coherence reproduction (silas + elliott + cael)

After the source-walk closure above, three cohort seats independently walked `~/.openclaw/session-delivery-queue/` on their own hosts and each found:
- 🌫 silas-host: directory exists, only `failed/` subdir (Apr 29 14:49, old), 0 files for any swim-42 fire-window recipient
- 🌻 elliott-host: directory exists, only `failed/` subdir, 0 files in last 30 minutes
- 🩸 cael-host: directory exists since May 1 21:06, only `failed/` subdir (empty, last-touched Apr 28 19:04), 0 files anywhere in tree from swim-42 fire-windows

These three independent walks are **cross-host source-coherence evidence** — the source-level behavior (`enqueueSessionDelivery` writes file → `ackSessionDelivery` immediately deletes file → file unobservable post-success) reproduces consistently across hosts. That's a useful cohort-discipline finding: substrate-coherence on the queue-substrate behavior is real, not host-specific.

But these three walks **do not discriminate success vs no-write** at the durable-store step, because the queue-walk evidence is symmetric under both:
- *file written + acked + deleted* (intended success path) → empty queue
- *file never written* (the inferred bug shape) → empty queue

Both produce identical post-hoc walks. The evidence cannot tell them apart from outside the process.

## Why the framing keeps re-converging on the inferred reading

The substrate-finding-shape framing — *"branch-entry honored but durable-store step short-circuited"* / *"no-op happens at the durable-store step inside `enqueueSessionDelivery`"* — is a coherent hypothesis. But it's an **inference through pattern**, not a byte-pin. Each cohort iteration that walks a host and finds empty queue dir confirms the same source-level expected behavior, which is consistent with the inferred reading but also consistent with the success reading. Adding more hosts that confirm the same source-level behavior doesn't increase discrimination power.

The pattern this row keeps producing — *substrate-walk → infer-bug → cohort consensus → walk-source → discover-the-walk-attests-symmetrically* — IS exactly what swim-42 was for. Each iteration is honest cohort discipline; the issue is just that without the surviving discriminators (named above), the substrate-finding-shape *cannot* close from outside the process.

## Honest current state

The 3-host queue-walk convergence is **real cross-host source-coherence evidence**. The substrate-finding-shape inversion-candidate at `substrate-finding-shape-inversion-candidate.md` **stays genuinely open**. The "(c) reading" — substrate-is-partially-correct, branch-entry honored but durable-store step short-circuited — is a coherent hypothesis that the queue-walk evidence is consistent-with but does not byte-pin.

Surviving discriminators (still the only ones that could close the inversion):
1. walk recipient session's in-memory `system-events` queue at fire-time (per-recipient, in-process, NOT deleted on ack)
2. temporary log statements at `targeting.ts:101` + `:114` (frond-scribe-territory)
3. fire from session whose recipient is actively attached + observe recipient's reaction

## Cael-host fourth-host attestation completes 4-host coverage at both layers

cael-seat ran both walks on cael-host:

**Journal layer** (`journalctl --user -u openclaw-gateway --since "60 minutes ago" | grep continuation:targeted-return`):
- 60-min window: 0 hits
- explicit-bracket 18:30-19:30 PDT: 0 hits
- consistent with no targeting-axis fire from cael-seat in the swim-42 window

**`session-delivery-queue/` file substrate**:
- only `failed/` subdir present, 0 files anywhere in tree in last 120 min, no recipient subdirs

This makes the 4-host coverage complete at both substrate layers.

**4-host journal coverage interpretation:**
- 🌫 silas: array-API log line FIRES → branch entered for that path
- 🌊 ronan: 0 log lines for singular-API across 60-min + explicit-bracket windows → branch did NOT enter for singular-API path
- 🌻 elliott + 🩸 cael: 0 log lines → no targeting fires from these hosts (consistent with monitor/adjudicator + on-call-deployer roles)
- The 3 absence-elsewhere readings strengthen the silas-host-positive specificity (the log line is real signal, not ambient noise)
- Combined with the 3-window walk on ronan-host, the singular-API branch-not-entered finding is load-bearing

**4-host `session-delivery-queue/` coverage interpretation:**
- 4 hosts × empty queue dir = 4 independent reproductions of the source-coherent normal-fire behavior (`enqueueSessionDelivery → ackSessionDelivery → file deleted`)
- This is cross-host source-coherence evidence ✓ (good cohort-discipline finding: substrate behaves consistently across hosts)
- This does NOT discriminate success vs no-write at the durable-store step — same source-symmetry as established earlier in this file
- Adding more hosts confirming the same source-coherent behavior doesn't increase discrimination power on the substrate-finding-shape question

The substrate-finding-shape inversion-candidate stays open exactly where it was. Surviving discriminators (in-memory system-events walk / debug log statements / live-attached recipient probe) are still the only paths that could close it.
