# P' 8ba08c76d8 Mode-B classification
candidate 40834471377 @ 8ba08c76d8f74a63238f2ce79302168748c31965 (oc-8cpu-32gb, hosted_on_arc) · compare: j9 cand 40689895077 @ 5e4093fdf1 (the j9 classification on bootstrap#1727) · U9 control 40705770015 @ 8ea3ef8d86
P' delta vs 5e4093fdf1: inventory regen 6e54864188 + leak fix 293c977f62 (test) + #1499 (5 announce files).

## static gates (job 123316216839)
- FAIL check: lint only. extensions 20W/7E, core 229W/0E, other passes 0/0. typecheck/guards/build:strict-smoke PASS.
- 7 errors IDENTICAL to j9 cand: proper-lockfile-runtime.mjs x4 unbound-method, discrawl-normalize.mjs x2 restrict-plus-operands, journal-allocation-probe.mjs x1 no-misused-promises. All U9-identical; #1499 touches none. → upstream-owned, 0 fork-owned.

## shard reds (interim, 08:2xZ: 18 done / 6 running / 59 queued)
- core-tooling-3, -7, -11, -12, -13, -16: all red at j9 cand and classified baseline there (3/12/13 U9-control red; 7 test-projects-empty-native U8/U9 identical; 11 control-ui-reactive-graph U8; 16 line-cap-ratchet tooling dependency). Confirm per test case at completion.
- core-runtime-infra-process: red at j9 cand (logger.browser-import deterministic, new at U9) AND red in U9 control 40705770015 → upstream baseline.
- local(agentic-command-support,extension-telegram,…): red at j9 cand AND U9 control 40705770015 → upstream baseline (confirm test case at completion).
- core-tooling-4, core-tooling-8: red at j9 cand and U9 control → baseline.
- agentic-agents-core-models: red at j9 cand (decision-inference.openai.integration, U8-red) AND U9 control → baseline (confirm test case at completion).
- local(agentic-cli,extension-slack,…): j9 cand red + U9 cancelled-control red → baseline (confirm).
- hosted(extension-providers,extension-feishu,…): j9 classified 5 provider files == U9 solo → upstream (confirm same files).
- hosted(auto-reply-reply-dispatch-lifecycle,…) job 123316218529: 1 deterministic, src/auto-reply/reply/dispatch-from-config.lifecycle.test.ts:72 (preparedLookup) — j9: U8-red + j8cand-red → baseline. Not a #1499 file.
- hosted(agentic-gateway-core-inventory,…) job 123316218416: 51 deterministic in doctor-gateway-legacy-services (U8-red baseline) + doctor-gateway-daemon-flow (U9 control CI-env confirmed) → upstream.
- hosted(agentic-gateway-core-1,…) job 123316218414: 2 deterministic, src/gateway/desktop/rfb-probe.test.ts (retained RFB connection) — U9 control CI-env confirmed at j9 → upstream.
- hosted(extension-qa,core-unit-support) job 123316218659: 13 qa-lab crabline-* files + harness-runtime.integration + proper-lockfile-runtime + test-file-scenario-runner.native — exactly the j9 set (crabline 13 == U9 solo fail counts; others U8-red) → upstream.
- hosted(agentic-commands-doctor-auth,…) job 123316218547: 1 deterministic, doctor-config-preflight.recovery — j9: U8-red → baseline.
- hosted(agentic-control-plane-agent-chat,…) job 123316218640: 1 deterministic, gateway server.sessions.delete-lifecycle — U9 control CI-env confirmed at j9 → upstream.
- WATCH at completion: agentic-agents-support (j9 watch item: harness gateway-question.authority-worker; resolved at j9 via agents-support --no-cache 0 failures).
- core-runtime-config job 123316218212: 1 deterministic, session-accessor.sqlite-exact-read 'preserves exact exclusions across UTF-16le' — the same case as j9 cand. j9 closed it CI-only (full runtime-config project locally green on cand and U9, exact-read 30/30). #1499 touches no runtime-config source/test → same classification, CI-only.
- hosted(extension-browser,core-runtime-infra-heartbeat-core,…) job 123316218554: browser session-tab-storage-compat.sqlite + infra/shell-env, 1 deterministic each — j9: U8-red → baseline.
- local(core-runtime-infra-storage-state,agentic-control-plane-startup-core) job 123316217577: CANCELLED (budget) — also cancelled on j9 cand and the U9 control → matched; no evidence either way. Covered at j9 by the local storage-state proof; #1499 touches no storage-state source.
- hosted(core-unit-src-security-support,agentic-agents-core-tools,…) job 123316218580: agent-tools.execution-validation + bash-tools.exec-runtime.broker — j9: U8-red → baseline.
- hosted(core-runtime-media-ui-2,…) job 123316218648: ui session-row-tint.node — j9: U8-red → baseline.
- core-runtime-infra-system-runtime job 123316218364: package-update-permission-drift + update-retained-runtime-imports.process — j9: U8-red; red in U9 control → baseline.
- hosted(core-unit-fast-isolated,extension-provider-openai,…) job 123316218365: extensions/openai/embedding-batch (5 lines, 1 deterministic) — the same failure at j9 cand job 122822495751; j9 solo: cand 1F/17P == U9 1F → upstream. extensions/openai is byte-identical to U9 at P'.
- hosted(extension-media,core-runtime-infra-repo-tooling) job 123316218557: extensions/deepgram/audio-flux, 1 deterministic — the same file red at j9 cand (122822495902) AND U9 control (122878120232); extensions/deepgram is U9-identical → upstream.
- core-unit-src-security-3 job 123316218272: doctor-core-checks.runtime (4) + doctor-health-contributions (4) + skills/runtime/discovery.integration (1) — IDENTICAL file set and counts to U9 control job 122878119927 → upstream (this also closes j9's pending CI-env item for doctor-core-checks.runtime).
- hosted(extension-zalo,core-runtime-shared,…) job 123316218578: CANCELLED at the job budget (5344s), in-flight supplemental extension-database-workers — the same as j9 cand and j8 (known coverage gap; extension-database-workers runner killed in both runs) → matched, no evidence.
- core-unit-fast-1 job 123316218269: http-json + worker-task-pool.memory — j9: U8-red → baseline.
- hosted(extensions,agentic-commands-doctor-plugins-tools,…) job 123316218340: cua-computer/driver-client (U8-red baseline) + voyage/embedding-batch (j9 solo: cand 1F/6P == U9 1F/6P → upstream); 1 flake greened → upstream.
- hosted(core-runtime-cron-parallel-service,…) job 123316218517: cron/service/ops.gateway-mutations — j9: U8-red → baseline.
- agentic-plugin-sdk job 123316218368: src/plugin-sdk/qa-runtime (non-integer timer delay RangeError) — U9 control CI-env confirmed at j9 → upstream.
- hosted(core-runtime-media-ui-3,…) job 123316219267: ui background-invalidation.node — j9: U8-red → baseline; media-ui-3 also red in the U9 control.
- agentic-gateway-server-isolated job 123316218429: CANCELLED at the budget — also cancelled on j9 cand, j8 and the U9 control → matched, no evidence.
- hosted(auto-reply-reply-dispatch-core,agentic-commands-doctor-shared,…) job 123316218638: doctor/repair-sequencing (4× timeouts) — j9: U8-red + j8cand-red, U9-identical → baseline.
- hosted(core-unit-src-security-1,…) job 123316218674: doctor-maintenance.native-identity (6) + stopped-systemd (2) + node-worker-transfer-client(.git) (9+8) — IDENTICAL file set and counts to j9 cand job 122822495929; j9: U8-red → baseline.
- agentic-plugins job 123316218366: 7 files (bundled-plugin-icons, capability-provider-runtime.generation, cli-config-lifetime, path-safety, plugin-module-generation.sdk, plugin-sdk-deprecated-imports, public-surface-runtime) — IDENTICAL file set and counts to j9 cand job 122822495800; the j9 set was confirmed red in the U9 control CI → upstream.
- aggregate + status: the roll-up of the above.

## FINAL (run complete 2026-10-29)
- Conclusion failure: 37 failed (36 shards/static + aggregate), 3 cancelled, 41 success, 9 skipped.
- Failed-job set at P' ⊂ j9 cand set (37 vs 38). Red at P' only: NONE. Red at j9 only: hosted(agentic-agents-support,…) (now green; the 293c977f62 test fix).
- Every red file is classified upstream/baseline (U8-red, U9-control-red, U9-solo-identical, or U9 CI-env confirmed); the 3 cancellations (storage-state, zalo/extension-database-workers, gateway-server-isolated) are budget cancellations matched on j9 cand and the U9 control.
- #1499 delta files (5 announce files) appear in no red.
- VERDICT: 0 fork-owned.
