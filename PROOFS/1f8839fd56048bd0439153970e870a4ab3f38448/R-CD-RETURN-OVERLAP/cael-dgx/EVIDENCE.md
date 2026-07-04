# R-CD-RETURN-OVERLAP — Cael live proof on bca2b0b

Verdict: **PASS, with wake-causality caveat**.

This row proves the overlap/collection behavior requested by docs#246 on Cael (`cael-dgx`) against deployed candidate `bca2b0b89ab886bf23a10e4983926f6b374b3188` / `OpenClaw 2026.6.11 (bca2b0b)`: a silent/no-wake delegate return and a silent-wake delegate return, both targeted back to the same root session and overlapping the same active/continuation window, were both durably delivered to root with no lost silent return, no orphaned return, no duplicate wake storm, and no invented extra child execution.

Caveat: the specimen does **not** prove that the `silent-wake` return was the sole cause of a fresh root generation. The root session was already active / had continuation work in flight, so the visible wake surface folded into the active/queued continuation window. This is the behavior the row was intended to document: collapsed/collected returns under overlap, not one isolated wake per returned child.

## Specimen

- Prefix: `RCD_RETURN_OVERLAP_BCA2B0B_CAEL_20260704_1521`
- Silent marker: `RCD_RETURN_OVERLAP_BCA2B0B_CAEL_20260704_1521_SILENT_RETURN`
- Waking marker: `RCD_RETURN_OVERLAP_BCA2B0B_CAEL_20260704_1521_WAKING_RETURN`
- Root session: `agent:main:discord:channel:1466192485440164011`
- Silent child session: `agent:main:subagent:continuation-7bdd46e2035532e982d84c5b7c3da6fc`
- Waking child session: `agent:main:subagent:continuation-dc71cbaff90c1ec7bdcd5514a1e21d31`
- Tempo trace id: `0d676f84623ebfe6499a324d039ee050`

## Method

From the root Cael session, schedule two typed `continue_delegate` calls using the same target/root and same 8s delay window:

1. Delegate S: `mode="silent"`, `fanoutMode="tree"`; return only the silent marker.
2. Delegate W: `mode="silent-wake"`, `fanoutMode="tree"`; return only the waking marker.

The children were deliberately boring: no tools, no nested continuation, no bracket tokens, just the requested final marker.

## Key bytes

### Durable flow rows

`db/flow-rows-concise.json` records two terminal delegate rows:

- `029d408a-5353-4eeb-91ae-5d5d6fce672d` — `core/continuation-delegate`, owner root, `status=succeeded`, `delayMs=8000`, `fanoutMode=tree`, child `agent:main:subagent:continuation-7bdd46e2035532e982d84c5b7c3da6fc`, traceparent `00-0d676f84623ebfe6499a324d039ee050-614a4f019c05a9fc-01`.
- `273b73ef-fdb8-447c-8e89-c803e119ecf0` — `core/continuation-delegate`, owner root, `status=succeeded`, `silentWake=true`, `delayMs=8000`, `fanoutMode=tree`, child `agent:main:subagent:continuation-dc71cbaff90c1ec7bdcd5514a1e21d31`, same traceparent.

### Durable task rows

`db/task-rows-concise.json` records both root-delivery task rows as `succeeded` / `delivered`:

- Silent return task `continuation-delegate-7bdd46e2035532e982d84c5b7c3da6fc`, root requester, returned `RCD_RETURN_OVERLAP_BCA2B0B_CAEL_20260704_1521_SILENT_RETURN ... run=dcf4b8a2-8e32-4b21-9046-33b8c6222191`.
- Waking return task `continuation-delegate-dc71cbaff90c1ec7bdcd5514a1e21d31`, root requester, returned `RCD_RETURN_OVERLAP_BCA2B0B_CAEL_20260704_1521_WAKING_RETURN ... run=64977420-0a5c-4321-8f9b-39b66a99292b`.

Each child also has a mirrored child-owned task row with `status=succeeded` / `delivery_status=not_applicable`, which is the expected local execution record rather than a second root delivery.

### Journal/root delivery

`journal/journal-filtered.log` records:

- both delegates spawned from root:
  - `mode=silent` at hop `5/200`;
  - `mode=silent-wake` at hop `6/200`.
- child final outputs:
  - silent marker at `15:21:44.596`;
  - waking marker at `15:21:55.519`.
- both targeted returns delivered to root:
  - `15:21:44.955 [continuation:targeted-return] Delivered to agent:main:discord:channel:1466192485440164011 from ...7bdd46e...`
  - `15:21:55.815 [continuation:targeted-return] Delivered to agent:main:discord:channel:1466192485440164011 from ...dc71cb...`

The same journal window shows no duplicate wake storm and no repeated child execution for either marker.

### Transcripts

`sessions/` contains the child transcripts and trajectories. `main/session-prefix-grep.txt` contains the root tool-call and transcript grep receipts for the prefix. The child transcripts show each child emitted exactly its assigned marker.

### Tempo

Machine-readable Tempo JSON is saved at:

- `tempo/trace-0d676f84623ebfe6499a324d039ee050.json`
- `tempo/trace-0d676f84623ebfe6499a324d039ee050-summary.json`

## Evaluation against docs#246

- Silent/context-only return collected without independent wake: **yes** — the silent child returned and root delivery is recorded; no independent child-triggered wake storm was observed.
- Waking return participated in the same root/overlap window: **yes, with caveat** — the `silentWake=true` delegate returned and was delivered to root while root continuation work was already in flight; the wake surface was folded/collapsed rather than producing an isolated extra generation solely attributable to W.
- Correct collapsed/collected result set: **yes** — both markers are present in durable task/session/journal receipts; no lost silent return, no orphaned return, no duplicate durable root delivery, and no invented child execution.

Therefore this row is recorded as **PASS with caveat** rather than thin/partial: the observed byte answers the row's intended overlap/collapse behavior, while explicitly not claiming isolated wake causality.
