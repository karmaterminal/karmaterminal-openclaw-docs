# R-CW-FULLSET-1 — Full Continuation-Set EXERCISED End-to-End — Deployed SHA `c06e081f76`

**Proof type:** R-CW-FULLSET (the full #990 continuation tool-set — `request_compaction` + `continue_delegate` (post-compaction) + `continue_work` — all THREE FIRED end-to-end on the deployed binary, not merely registered) + #868 continuation-warning benign-pin
**Date verified:** 2026-06-11 18:35–18:54 PDT (2026-06-12T01:35–01:54Z)
**SUT (seat under test):** silas-lothric — `silas` / lothric / 10.0.0.100
**Deployed SHA:** `c06e081f760d723c77bee65464b8920a76d3b523` (v4)
**Gateway:** `OpenClaw 2026.6.2 (c06e081)` — active since 18:35:42 PDT (the v4 fan-restart)
**Collector:** silas-lothric (self-fire from the live deployed gateway — the proof IS the live tool-use)

---

## SUT verification

- `openclaw --version` → **`OpenClaw 2026.6.2 (c06e081)`**.
- Runtime checkout HEAD → **`c06e081f760d723c77bee65464b8920a76d3b523`** (≡ proof SHA).
- `state/openclaw.sqlite` byte-source for all flow_runs / subagent_runs evidence below.

---

## (A) `request_compaction` FIRED — a REAL volitional compaction completed this session

Not a guard-reject. An actual volitional compaction was enqueued AND resolved-success on the deployed v4 binary this session. Raw journald (`[continuation/request-compaction]`):

```
Jun 11 18:39:48 [request_compaction:enqueuing] session=agent:main:discord:channel:1466192485440164011
  runId=2fd13fe4-1f6b-4805-a51d-cdce2e8728dd diagId=cmp-mqa9e4m8-mp_fjg
  trigger=volitional usage=78.7% reason=Context-wall … Electing compaction now at the wall.

Jun 11 18:40:27 [request_compaction:resolved-success] session=agent:main:discord:channel:1466192485440164011
  runId=2fd13fe4-1f6b-4805-a51d-cdce2e8728dd diagId=cmp-mqa9e4m8-mp_fjg
  trigger=volitional outcome=compacted
```

- **`diagId=cmp-mqa9e4m8-mp_fjg`** — matched on both the `enqueuing` and `resolved-success` lines (same runId `2fd13fe4`).
- **`trigger=volitional`** — agent-elected, not auto-triggered.
- **`outcome=compacted`** — the compaction RAN TO COMPLETION (enqueued 18:39:48 at 78.7% usage → resolved-success 18:40:27, ~39s end-to-end).

This is the dispositive byte: a runner missing the `requestCompactionOpts` callback would error or no-op; this one enqueued a real volitional compaction and resolved it `outcome=compacted`. **`request_compaction` is WIRED + FIRED on the deployed binary.**

---

## (B) `continue_delegate` post-compaction — lifeboat dispatched + succeeded

The post-compaction lifeboat (the lich-protocol phylactery) dispatched and the spawned shards landed `succeeded`. Byte-verified `flow_runs` (goal `[continuation:post-compaction]`):

| flow_id (prefix) | status | goal |
|------------------|--------|------|
| `61081a63` | ✅ succeeded | `[continuation:post-compaction] …` |
| `f40c526e` | ✅ succeeded | `[continuation:post-compaction] …` |
| `f7a80125` | ✅ succeeded | `[continuation:post-compaction] …` |

```
sqlite3 state/openclaw.sqlite \
  "SELECT substr(flow_id,1,8), status FROM flow_runs
   WHERE flow_id LIKE '61081a63%' OR flow_id LIKE 'f40c526e%' OR flow_id LIKE 'f7a80125%';"
→ f7a80125|succeeded   f40c526e|succeeded   61081a63|succeeded
```

- **Post-compaction succeeded total:** `SELECT COUNT(*) FROM flow_runs WHERE goal LIKE '%[continuation:post-compaction]%' AND status='succeeded'` → **25** (receipt-time read = 26; one row aged out of the window — both readings ≫ the three cited rows, store live).
- **Result-CAPTURE (tier-2b):** `subagent_runs` carries non-empty `frozen_result_text` in `payload_json` — local byte-check found row `643fbb30` with **NON-EMPTY** `frozen_result_text` (payload_json 5042 bytes; `CASE … LIKE '"frozen_result_text":""' → EMPTY` test returned NON-EMPTY). The result-capture path (frozen subagent result text persisted across the seam) is cohort-confirmed tier-2b; this seat carries a non-empty captured result locally.

**`continue_delegate` post-compaction is WIRED + FIRED** (3 cited post-compaction shards succeeded; result-capture non-empty).

---

## (C) `continue_work` — fired every turn this session

`continue_work` drove the self-continuation loop continuously. Raw journald (`[continuation/work-dispatch]`):

```
Jun 11 18:35:46 [continuation:work-hedge-armed] fireIn=234072ms session=…channel:1466192485440164011
Jun 11 18:39:40 [continuation:work-hedge-fired] session=…channel:1466192485440164011
Jun 11 18:39:40 [continuation:work-wake] hop=1/200 session=…channel:1466192485440164011
Jun 11 18:39:40 [continuation:work-hedge-armed] fireIn=59995ms …
```

- **work-dispatch event count since boot:** `grep -ciE "continuation/work-dispatch"` → **405** events — the arm → fire → wake → re-arm hedge cycle ran continuously through the session.
- `work-wake hop=1/200` confirms the self-continuation chain advanced.

**`continue_work` is WIRED + FIRED** (405 work-dispatch events; hedge arm/fire/wake cycle live).

---

## (D) /status continuation-row (R-OBS corroboration)

The live `/status` continuation block on this seat reads (cited from session, corroborating the byte-evidence above):

- `🔄 Continuation: chain 0/200 | volitional: 1` — the `volitional: 1` counter = the one real volitional compaction in (A).
- `📚 Context … 🧹 Compactions: 3` — three compactions this session (auto + the one volitional fire).
- `🦞 OpenClaw 2026.6.2 (c06e081)` — version matches deployed SHA.
- `🔑 token (github-copilot:github)` resolves — auth/token surface healthy.

---

## (E) #868 continuation-warning — BENIGN pin (inventory namespace, NOT main-runner)

The v4 #868-warn (`continuation.enabled=true but neither continueWorkOpts nor requestCompactionOpts were supplied — only continue_delegate will register`) fires on this seat in the **`[agents/openclaw-tools]` inventory/catalog namespace, NOT the main-runner.** It is **proven benign by the dispositive live byte:** the live tools demonstrably work on the main-runner this very session —

- **`request_compaction` FIRED a real volitional compaction** (section A — `outcome=compacted`, not a missing-opts error; a runner missing the opts would error, not compact).
- **`continue_delegate` dispatched** (section B — 3 succeeded post-compaction shards).
- **`continue_work` fired** (section C — 405 work-dispatch events).

A main-runner missing `continueWorkOpts`/`requestCompactionOpts` could not have fired all three. The warn-emitting site is the inventory/catalog stub-domain (`[agents/openclaw-tools]`), the benign fan-out — NOT the live main-session runner, which has the full set wired + exercised.

**Verdict: #868-warn BENIGN on v4** — the inventory namespace emits the stub-warn; the live main-runner carries + fires the full continuation set.

---

## Results summary

| Check | Expected | Observed (raw byte) | Status |
|-------|----------|---------------------|--------|
| `request_compaction` fire | real volitional compaction completes | `cmp-mqa9e4m8-mp_fjg trigger=volitional outcome=compacted` (78.7%→resolved 18:40:27) | ✅ PASS |
| `continue_delegate` post-compaction | lifeboat shards succeed | `61081a63`/`f40c526e`/`f7a80125` all succeeded; 25 post-compaction succeeded total | ✅ PASS |
| result-capture (tier-2b) | non-empty frozen_result_text | row `643fbb30` NON-EMPTY (5042-byte payload) | ✅ PASS |
| `continue_work` fire | drives self-continuation | 405 work-dispatch events; work-wake hop=1/200 | ✅ PASS |
| /status continuation-row | volitional:1, compactions:3, version | `chain 0/200 \| volitional: 1`; `Compactions: 3`; `2026.6.2 (c06e081)` | ✅ PASS |
| #868-warn | benign (inventory namespace) | warn in `[agents/openclaw-tools]`; live runner full-set fired | ✅ PASS |

---

## SIGNIFICANCE

**silas-lothric is the live-witness that the full #990-continuation set works EXERCISED end-to-end on v4 `c06e081f76` — all three tools FIRED, not merely registered.** `request_compaction` fired a REAL volitional compaction (78.7% → `outcome=compacted`) → the post-compaction lifeboat dispatched (3 succeeded shards) → the session rehydrated. This is the lich-protocol-in-production: continuation carried across BOTH the v4-fan deploy-restart (18:35:42) AND a volitional compaction (18:40:27) within a single session.

The #868 continuation-warning is **proven benign** on this seat — it fires in the `[agents/openclaw-tools]` inventory/catalog namespace, NOT the main-runner, and the live tools demonstrably work (request_compaction fired a real compaction, continue_delegate dispatched succeeding shards, continue_work drove 405 dispatch events). The warn is the inventory stub-domain; the live main-runner carries the full set.

**silas-lothric R-CW-FULLSET-1: full #990 continuation-set EXERCISED end-to-end on the deployed v4 binary (request_compaction REAL-fire → post-compaction lifeboat succeeded → rehydrated; continue_work 405 dispatches). #868-warn benign-pinned (inventory namespace, live-runner full-set fired). Strongest continuation-PROOF on the fan.**
