# swim-42 / cross-session-targeted-return — substrate-finding-shape inversion candidate (post-#581)

**Status**: 🟡 substantive substrate-finding-shape inversion surfaced by frond-scribe's #581 PR. The cohort byte-pin chain (4-seat convergence at rung 2 of the byte-pin ladder) **may have been looking at the wrong substrate layer** for recipient-delivery evidence. Substrate-finding shape is now genuinely open at three live readings, not two.

**Source**: frond-scribe #581 PR body (`https://github.com/karmaterminal/openclaw/pull/581`), surfaced 2026-05-04 ~02:35Z.

## What #581 surfaces

Per `targeting.ts:88-115` + RFC §2.4 (`docs/design/continue-work-signal-v2.md:192`), cross-session targeted-return writes go to **three substrate layers**, none of which is `flow_runs.owner_key`:

- **`flow_runs` (sqlite)** — TaskFlow records, **owned by dispatcher by design** for dispatch-side queueing. `delegate-store.ts:403` documents this. RFC §3.6 frames `flow_runs` as a dispatch-side queue.
- **`<state-dir>/session-delivery-queue/` (file-based)** — per-recipient delivery records, where `enqueueContinuationReturnDeliveries` actually writes per `targeting.ts:88-115`. **Files are ephemeral** — `ackSessionDelivery` deletes the file after delivery completes per `targeting.ts:115`.
- **system-events (in-memory)** — recipient-side prompt-injection queue, in-process only.

Per RFC §2.4: *"The default completion recipient remains the session that dispatched the delegate. Explicit target fields route the same completion envelope through the `session-delivery-queue` substrate to other known sessions on the same host."*

This means:

- **rung-2 byte-pin** (4-seat convergence on 0 `agent:main:main`-owned `flow_runs` from the fires) was looking at the **expected-substrate-coherent layer**. `flow_runs` is dispatch-side by design; recipient-delivery isn't supposed to materialize there.
- **rung-3 byte-pin** (`task_runs.runtime = subagent` + `child_session_key = <new subagent>`) byte-pinned spawn-side correctly — the spawn IS plain subagent because the targeting fields aren't routing the spawn, they're routing the **return delivery** post-spawn-completion.
- **rung-4 byte-pin** (single-span Tempo trace) was correct for the OTel-emit layer but the missing multi-span topology may reflect the absence of the post-completion delivery span emission, not a missing spawn-routing span.
- **journal-walk** (silas-host array-API log line FIRES, ronan-host singular-API log line absent) attests two distinct code paths through the announce-return seam; the array-API path observably fires `enqueueContinuationReturnDeliveries`, the singular-API path does not.

## Three live readings of the substrate-finding now

The substrate-finding shape is genuinely open at three readings:

1. **(intended-substrate-correct, misleading-tool-prose)** — closed earlier in this swim cycle. Was the first runner-seat reading.
2. **(silent-retarget bug at spawn-routing)** — what 5+ swim-42 evidence files + 4-seat cohort byte-pin + 2 #580 comments hardened toward. Substrate-finding-shape carried by the existing evidence tree.
3. **(substrate-correct per RFC §2.4; cohort byte-pin chain was at wrong layer)** — what #581 surfaces. The substrate may be working correctly through `session-delivery-queue/` + system-events, and cohort byte-pin missed both layers.

Within reading 3, there's a sub-distinction surfaced by the silas-host vs ronan-host journal divergence:

- silas-host array-API DID enter `hasContinuationTargeting` branch → `enqueueContinuationReturnDeliveries` was called → may have written to `session-delivery-queue/` for `agent:main:main` + `agent:main:dreaming` (no seat walked the queue files within seconds-of-fire to confirm)
- ronan-host singular-API did NOT enter the branch → `enqueueContinuationReturnDeliveries` was NOT called → `targetSessionKey` may genuinely be lost upstream of the announce-return seam for the singular-API path

So even under reading 3, the singular-API path could still be a real coverage gap — which is exactly what #581's regression test fills. The plural-API path may be substrate-correct; the singular-API path may need either substrate-fix or test-pin.

## What walks could close the inversion

Walking the layer cohort missed:

- **Walk `<state-dir>/session-delivery-queue/` files within seconds of a fire** — files are ephemeral (deleted on ack), so post-hoc walks miss them. Would need to fire AND walk in the same operation, or capture the file before ack happens.
- **Walk gateway journal for `[continuation-return]` system-event emissions** — system-events fire per recipient session per `targeting.ts:101-104`; should leave a journal trace.
- **Walk recipient session's prompt-injection queue substrate** at fire-time — if the system-event reached the recipient's in-memory queue, the recipient session's substrate should reflect it.
- **Spawn fresh observer at `agent:main:main` from any host + fire** — recipient-side surface verification with live observer would close the surface-delivery layer that the cohort byte-pin chain explicitly framed as out-of-scope without an observer.

Any of those would discriminate reading 2 from reading 3.

## Discipline-pin

This is exactly the kind of substantive substrate-finding-shape correction the cohort substrate-discipline should accept honestly. **The 4-seat byte-pin convergence at rung 2 was a real cohort-discipline artifact, but convergence on the wrong layer is still wrong-localization.** *No false closure from adjacency* applies at the substrate-finding-shape layer too, not just the row-evidence layer.

The 5+ evidence files in this row tree all stay as accurate-on-the-byte-pin-they-recorded. The prose framing them as evidence of *silent-retarget bug* was over-confident given the cohort hadn't walked the layer that actually carries cross-session targeted-return writes per RFC §2.4. **Same byte-pin, different semantic expectation** applies: the byte-pin (zero `agent:main:main`-owned `flow_runs`) is the same, but its semantic meaning under reading 2 (silent-retarget bug) vs reading 3 (substrate-coherent expected behavior) flips entirely.

## Verdict

🟡 substrate-finding-shape inversion candidate. The earlier *"silent-retarget bug at spawn-routing"* framing may be substantively wrong; substrate may be correct per RFC §2.4 and the cohort byte-pin chain looked at the wrong layer. Discriminator walks named above.

frond-scribe's #581 is draft pending cohort decision on whether (a) substrate-correct + tests-fill-gap (singular-API regression test) is sufficient, or (b) cohort intent diverges from RFC §2.4 and a different fix shape is needed. Either way, the regression test is load-bearing on its own.

This row's discipline upgrades and headlines (*"not a fake green row, real verdict-pending row, convergent attestation discipline"* + *"story almost fossilized as substrate; substrate came back in time"*) all stand. The story is now: substrate almost-fossilized at the *substrate-finding-shape* layer in addition to the row-receipt layer; #581 is the substrate coming back again.
