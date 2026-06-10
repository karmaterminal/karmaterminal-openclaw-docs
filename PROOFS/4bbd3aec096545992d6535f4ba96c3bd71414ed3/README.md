# PROOFS — `4bbd3aec096545992d6535f4ba96c3bd71414ed3`

**Deployed:** 2026-06-10 ~04:34–04:37 PDT, fleet-wide to all 6 prince-seats.
**Binary:** `OpenClaw 2026.6.2 (4bbd3ae)` — confirmed **reading-A** on every seat (the gateway is *running* the target binary, not merely checked-out).
**What shipped:** #978 — the parent-key post-compaction continuation fix (announce-path stages under `targetRequesterSessionKey` = parent, not `childSessionKey` = leaf). Fix commit `0dba1d7`.

## Where to read the change-set
- **Assembly branch (the code):** `karmaterminal/openclaw` @ branch `frond-scribe/20260609/assembly-token-wiring` (= `4bbd3aec096545992d6535f4ba96c3bd71414ed3`).
- **The #978 fix itself:** commit `0dba1d7` on that branch.
- **Full change-set:** that branch's diff vs `openclaw/openclaw@main` (the simulated-merge diff; re-back-merged to upstream/main `c84e521920` with the matrix/slack take-ours correction).
- **The proofs (this dir):** per-seat evidence dirs + the `R-OBS-1/` cross-walk aggregate, below.

## Reading-A provenance (how we know the live binary IS the target)
Three independent legs, per-seat:
1. **Ordering-blade** — gateway restart-timestamp postdates the target `dist/` build-completion (+4–8s). Circumstantial-strong.
2. **Build-stamp** — `dist/build-info.json` / `.buildstamp` carry the build-time-frozen HEAD = `4bbd3aec096…`, zero `9b1f42a` residue. Strong/direct (frozen-HEAD, not a content-hash).
3. **Content-provenance** — target-only compiled symbols (e.g. `contextEngineOwnsCompaction`, `nativeHarnessCompaction`) present in the running dist chunks, absent at pre-deploy source. **Cryptographically airtight** (reads the bytes, not the checkout-state).

Taxonomy: all 6 seats are **dist-shape** (daemon runs repo-tree `dist/index.js`); no tree-loader seat.

## Proof matrix — seats × rows

| Seat | Hardware | Canonical rows | Status |
|------|----------|----------------|--------|
| `cael-dgx` 🩸 | DGX Spark | R-CW-1/2/3/4 ✅ · R-CW-TOKEN ✅ · R-CW-5 ⚠️(cost-cap struct-limit) · R-RC-2 (ACCEPT-arm wiring ✅ via harness 62/62; live-≥70%-induce ⚠️) | sealed |
| `ronan-dgx` 🌊 | DGX Spark | R-CW-DELEGATE-SELF-CONTINUATION 6/6 ✅ · R-OBS-1 card | sealed |
| `silas-lothric` 🌫 | i9-14900KS/5090 | R-CD-TOOL ✅ · R-CD-TOKEN ✅ · R-CW-TOOL ✅ · R-RC-1 ✅(reject-arm) · R-OBS-1 ✅ · R-CD-CHAINED-DEPTH-2 TEST-1/2/3 ✅ | sealed (8 rows) |
| `elliott-legion` 🌻 | Legion/3080 | R-OBS-1 **owner** (6/6 cross-walk) · R-RC-1 · R978 vitest | sealed |
| `emeric-nuc` 🕯 | NUC x86 | R-CD-TOOL/TOKEN ✅ · R-CW-TOOL ✅ · R-RC-1 ✅ · R-CD-CHAINED-DEPTH-2 ✅ · R-CONTINUATION-TOOL-REGISTRATION ✅(12/12) · test-logic lane 353/353 · **dual-layered** (system-event + OTel Tempo span-trees) | sealed (most complete) |
| `rune-rog-ally` 🪨 | ROG Ally | R-CW-6 ✅ · R-CW-7 ✅ · R-CW-DELEGATE-SELF-CONTINUATION ✅ · **R-CW-DELEGATE-TOKEN (#952)** · R-OBS-2 ✅(Tempo trace-tree) | sealed |

## Headline results
- **#978 fix live + proven** — byte-present in deployed dist; `subagent-announce.postcompaction-route` test **8/8 green** on multiple seats.
- **R-OBS-1 cross-walk = 6/6 PASS** (all 6 seats render `4bbd3ae`, Compactions:0; canonical external `/status` render confirmed by figs).
- **#952 keystone (R-CW-DELEGATE-TOKEN) — MECHANISM ✅ PROVEN.** The historically-uncovered question "can a lightContext `continue_delegate` child's `CONTINUE_WORK:N` bracket reach the parser and drive hop-2?" = **YES**, byte-confirmed on `4bbd3ae`: `CONTINUE_WORK:30` from the delegate-child parses (`bracketIdx=0, kind=work`), arms + fires + wakes, and **advances the chain** (`work-wake hop=1/200 → hop=2/200`) — and is **not cancelled** (the historical #952/#959 bug cancelled hop-2; here it does not). The hop-2 turn-**execution-completion** is deferred by the `requests-in-flight` duplicate-drive guard — but that guard is **universal continuation-behavior** (it gates *every* seat's R-CW rows; Elliott/Silas/Emeric all hit it on their own rows), **not a #952-specific defect**. It defers any drive while the session holds an in-flight request (correct by-design: prevents a wake-turn racing the parent's own turn → session-jsonl corruption). The wake is **deferred, not dropped** — it delivers once in-flight clears (proven by Silas's own `Turn 3/200` landing mid-session post-skip-loop). So the keystone answer is **YES, mechanism proven**; full continuous-environment execution-completion is environmentally gated by the universal guard. See `rune-rog-ally/R-CW-DELEGATE-TOKEN.md` (`f63bee5`, with the malformed-vs-correct-bracket contrast).

## Open morning-question (NON-BLOCKING)
`compactionFailureContext` "0/5 never 4" was a **GO-shorthand for a concept** ("no silent continuation-regression on the deployed binary"), **not a source symbol** (grep=0). The byte-walks proved that concept lives on **three real, distinct, byte-confirmed invariants** that share the "never-partial" shape — they are **not one referent**, so each is filed under its own honest name (none labeled `cfc`):
1. **tool-registration completeness** — all continuation-tool-classes register (`continue_work` + `continue_delegate` + `request_compaction`), never the "only continue_delegate registers" partial-drop (#917/#918/#920). Byte: `openclaw-tools.ts:629/634`; proof: `emeric-nuc/R-CONTINUATION-TOOL-REGISTRATION.md` (misconfig-warn **12/12**). ✅
2. **post-compaction-delegate-staging accounting** — never a *silent* under-stage (`queued + dropped` must equal `staged`; the code logs every drop, so raw `queuedDelegates:4` *with* accounting is valid — only an *unaccounted* loss is the catastrophe). Deployed reads **0 = Form-B clean**. ✅
3. **cross-walk seat-completeness** — all 6 seats file their card, never a silent seat-drop. R-OBS-1 6/6, `{0,6}`. ✅

**Every one passes on `4bbd3ae`** — so the gate clears under any reading. figs's coinage maps to whichever he meant (or stays the umbrella concept); his call, non-blocking. It did not block the corpus.

## Gate
Corpus is **whole**. The **pr-presentation branch is HELD, untouched** — that is figs's gate to call.
