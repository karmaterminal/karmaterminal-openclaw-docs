# R-OBS-1 — continuation observability/status banner proof on `575a46b61d4efeb4600ead64f13e63e1f9021d44`

**Target SHA:** `575a46b61d4efeb4600ead64f13e63e1f9021d44` (`575a46b61d4e`)  
**Source repo:** `/home/figs/flesh_beast_tmp/openclaw`  
**Docs repo:** `/home/figs/source/karmaterminal-openclaw-docs`  
**Executed:** 2026-06-29 16:18-16:19 PDT on `rune`  
**Verdict:** PASS

## Scope

R-OBS-1 is the external/user-visible observability row for continuation state. On this ref, the directly relevant automated proof is the `/status` continuation banner formatter: it verifies that status output surfaces continuation enablement, chain maximum, fan-out maximum, pending delegate count, and staged post-compaction count in the human-visible status card rather than hiding that runtime state.

For context, issue/PR `#192` also names the related continuation registration rescue (`request_compaction` registration) and live delegate consumption regressions. I therefore also re-ran the two previously cited regression files from that PR's test plan to verify the adjacent registration/queued-delegate substrate on this exact source ref.

## Commands run

From `/home/figs/flesh_beast_tmp/openclaw` at detached HEAD `575a46b61d4efeb4600ead64f13e63e1f9021d44`:

```bash
pnpm test --run src/commands/status.continuation-banner.test.ts
```

Result:

```text
$ node scripts/test-projects.mjs --run src/commands/status.continuation-banner.test.ts
[test] starting test/vitest/vitest.unit-fast.config.ts

 RUN  v4.1.8 /home/figs/flesh_beast_tmp/openclaw

 ✓  unit-fast  src/commands/status.continuation-banner.test.ts (6 tests) 2ms

 Test Files  1 passed (1)
      Tests  6 passed (6)
   Start at  16:19:48
   Duration  2.82s (transform 2.10s, setup 0ms, import 2.74s, tests 2ms, environment 0ms)

[test] passed 1 Vitest shard in 6.26s
```

Adjacent #192/continuation regression rerun:

```bash
pnpm test --run src/agents/tools-effective-inventory.test.ts src/auto-reply/continuation-delegate-store.test.ts
```

Result:

```text
$ node scripts/test-projects.mjs --run src/agents/tools-effective-inventory.test.ts src/auto-reply/continuation-delegate-store.test.ts
[test] starting test/vitest/vitest.unit-fast.config.ts

 RUN  v4.1.8 /home/figs/flesh_beast_tmp/openclaw

 ✓  unit-fast  src/auto-reply/continuation-delegate-store.test.ts (15 tests) 48ms

 Test Files  1 passed (1)
      Tests  15 passed (15)
   Start at  16:18:52
   Duration  674ms (transform 373ms, setup 0ms, import 542ms, tests 48ms, environment 0ms)

[test] starting test/vitest/vitest.agents.config.ts

 RUN  v4.1.8 /home/figs/flesh_beast_tmp/openclaw

 ✓  agents  src/agents/tools-effective-inventory.test.ts (23 tests) 1219ms

 Test Files  1 passed (1)
      Tests  23 passed (23)
   Start at  16:18:54
   Duration  1.62s (transform 938ms, setup 261ms, import 34ms, tests 1.22s, environment 0ms)

[test] passed 2 Vitest shards in 7.46s
```

## Assertions covered

`src/commands/status.continuation-banner.test.ts` covers the visible status-card continuation row:

- continuation disabled omits the overview row;
- quiet enabled sessions show `enabled · chain max N · fan-out max N`;
- pending delegate counts are visible with correct singular/plural wording;
- staged post-compaction counts are visible;
- pending delegates and staged post-compaction counts render together for active continuation sessions.

The adjacent #192 regression rerun confirms the source ref still passes the tool-inventory and delegate-store tests associated with the original rescue plan:

- effective tool inventory remains green; and
- continuation delegate queue/storage behavior remains green.

## Repository state note

Before writing this proof, the docs repo was fetched and fast-forward checked against `origin/main`; it was already up to date. Existing unrelated untracked content (`PROOFS/118-status-cleanup/`) was left untouched.

## Verdict

PASS. The R-OBS-1 status/observability formatter tests pass on source ref `575a46b61d4efeb4600ead64f13e63e1f9021d44`, and the adjacent #192 continuation registration/delegate-store regressions also pass on the same ref.
