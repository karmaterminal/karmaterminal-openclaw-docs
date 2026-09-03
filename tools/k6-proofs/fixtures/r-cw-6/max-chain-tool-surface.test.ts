// Copied into a disposable exact-candidate worktree by run-max-chain-fixture.mjs.
// This file owns only the runtime/durable boundary so a typed-tool failure
// cannot suppress its receipt.
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { clearRuntimeConfigSnapshot, setRuntimeConfigSnapshot } from "../../config/config.js";
import {
  loadSessionEntry,
  replaceSessionEntry,
} from "../../config/sessions/session-accessor.js";
import type { SessionEntry } from "../../config/sessions.js";
import type { OpenClawConfig } from "../../config/types.openclaw.js";
import {
  resetContinuationWorkDispatchForTests,
  scheduleContinuationWork,
  scheduleContinuationWorkBatch,
} from "./work-dispatch.js";
import { checkContinuationBudget } from "./scheduler.js";
import {
  loadContinuationChainState,
  persistContinuationChainState,
} from "./state.js";

const maxChainLength = __RCW6_MAX_CHAIN_LENGTH__;
const startingCount = maxChainLength - 2;
const cfg = {
  agents: {
    defaults: {
      continuation: {
        enabled: true,
        maxChainLength,
        defaultDelayMs: 60_000,
        minDelayMs: 60_000,
        maxDelayMs: 120_000,
        costCapTokens: 50_000_000,
        maxDelegatesPerTurn: 4,
        maxPendingWork: 32,
      },
    },
  },
} as unknown as OpenClawConfig;
const runtimeConfig = {
  enabled: true,
  maxChainLength,
  defaultDelayMs: 60_000,
  minDelayMs: 60_000,
  maxDelayMs: 120_000,
  costCapTokens: 50_000_000,
  maxDelegatesPerTurn: 4,
  maxPendingWork: 32,
  crossSessionTargeting: "enabled" as const,
  busySkipBackoff: { baseMs: 1_000, ceilingMs: 60_000, factor: 2 },
};

let roots: string[];

beforeEach(async () => {
  roots = [];
  const { resetTaskFlowRegistryForTests } =
    await import("../../tasks/task-runtime.test-helpers.js");
  resetContinuationWorkDispatchForTests();
  resetTaskFlowRegistryForTests({ persist: false });
  setRuntimeConfigSnapshot(cfg);
});

afterEach(async () => {
  const { resetTaskFlowRegistryForTests } =
    await import("../../tasks/task-runtime.test-helpers.js");
  resetContinuationWorkDispatchForTests();
  resetTaskFlowRegistryForTests({ persist: false });
  clearRuntimeConfigSnapshot();
  await Promise.all(roots.map(async (root) => await fs.rm(root, { recursive: true, force: true })));
});

it("proves below-limit, at-limit, and first-over-limit with durable recovery", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "rcw6-runtime-boundary-"));
  roots.push(root);
  const storePath = path.join(root, "sessions.json");
  const sessionKey = `agent:main:subagent:rcw6-runtime:${crypto.randomUUID()}`;
  const sessionEntry = {
    sessionId: "rcw6-runtime-boundary",
    updatedAt: Date.now(),
    continuationChainCount: startingCount,
    continuationChainStartedAt: Date.now(),
    continuationChainTokens: 0,
  } as SessionEntry;
  await replaceSessionEntry({ sessionKey, storePath }, sessionEntry);

  const logs: string[] = [];
  const result = await scheduleContinuationWorkBatch({
    sessionKey,
    chainState: loadContinuationChainState(sessionEntry),
    requests: [
      { reason: "R-CW-6 below-limit hop", delaySeconds: 60 },
      { reason: "R-CW-6 at-limit hop", delaySeconds: 60 },
      { reason: "R-CW-6 first-over-limit hop", delaySeconds: 60 },
    ],
    config: runtimeConfig,
    log: (message) => logs.push(message),
  });

  const { listTaskFlowsForOwnerKey } =
    await import("../../tasks/task-flow-registry.js");
  const scheduledFlows = listTaskFlowsForOwnerKey(sessionKey)
    .map((flow) => flow.stateJson as { hop?: number; reason?: string })
    .toSorted((left, right) => (left.hop ?? 0) - (right.hop ?? 0));
  expect(result).toMatchObject({ scheduledCount: 2, cappedCount: 1, capped: true });
  expect(result.chainState.currentChainCount).toBe(maxChainLength);
  expect(scheduledFlows.map((flow) => flow.hop)).toEqual([
    maxChainLength - 1,
    maxChainLength,
  ]);
  expect(scheduledFlows.map((flow) => flow.reason)).toEqual([
    "R-CW-6 below-limit hop",
    "R-CW-6 at-limit hop",
  ]);
  expect(scheduledFlows.some((flow) => flow.reason?.includes("first-over-limit"))).toBe(false);
  expect(logs.some((message) => message.includes("chain-capped"))).toBe(true);

  persistContinuationChainState({
    sessionEntry,
    count: result.chainState.currentChainCount,
    startedAt: result.chainState.chainStartedAt,
    tokens: result.chainState.accumulatedChainTokens,
    ...(result.chainState.chainId ? { chainId: result.chainState.chainId } : {}),
  });
  await replaceSessionEntry({ sessionKey, storePath }, sessionEntry);
  const recoveredEntry = loadSessionEntry({
    sessionKey,
    storePath,
    readConsistency: "latest",
  });
  const recoveredState = loadContinuationChainState(recoveredEntry);
  const flowsBeforeRecoveredAttempt = listTaskFlowsForOwnerKey(sessionKey).length;
  const recoveryLogs: string[] = [];
  const recoveredAttempt = await scheduleContinuationWork({
    sessionKey,
    chainState: recoveredState,
    request: { reason: "R-CW-6 recovered first-over-limit hop", delaySeconds: 60 },
    config: runtimeConfig,
    log: (message) => recoveryLogs.push(message),
  });
  const flowsAfterRecoveredAttempt = listTaskFlowsForOwnerKey(sessionKey).length;
  const structuredReason = checkContinuationBudget({
    sessionKey,
    chainState: recoveredState,
    config: runtimeConfig,
  });

  expect(recoveredEntry?.continuationChainCount).toBe(maxChainLength);
  expect(recoveredState.currentChainCount).toBe(maxChainLength);
  expect(recoveredAttempt).toMatchObject({ scheduled: false, capped: true });
  expect(recoveredAttempt.chainState.currentChainCount).toBe(maxChainLength);
  expect(structuredReason).toBe("chain-capped");
  expect(recoveryLogs.some((message) => message.includes("chain-capped"))).toBe(true);
  expect(flowsAfterRecoveredAttempt).toBe(flowsBeforeRecoveredAttempt);

  const receiptPath = process.env.RCW6_RUNTIME_RECEIPT_PATH;
  if (!receiptPath) throw new Error("RCW6_RUNTIME_RECEIPT_PATH is required");
  await fs.writeFile(
    receiptPath,
    `${JSON.stringify(
      {
        schema: "openclaw.project81.r-cw-6.runtime-boundary.v1",
        configuredMaximum: maxChainLength,
        initialCurrentChainCount: startingCount,
        cases: [
          {
            name: "below-limit",
            currentChainCountBefore: maxChainLength - 2,
            attemptedHop: maxChainLength - 1,
            scheduled: true,
            resultingChainCount: maxChainLength - 1,
          },
          {
            name: "at-limit",
            currentChainCountBefore: maxChainLength - 1,
            attemptedHop: maxChainLength,
            scheduled: true,
            resultingChainCount: maxChainLength,
          },
          {
            name: "first-over-limit",
            currentChainCountBefore: maxChainLength,
            attemptedHop: maxChainLength + 1,
            scheduled: false,
            capped: true,
            reason: structuredReason,
            resultingChainCount: maxChainLength,
          },
        ],
        structuredRejection: {
          code: structuredReason,
          currentChainCount: recoveredState.currentChainCount,
          maxChainLength,
          attemptedHop: maxChainLength + 1,
        },
        noSpawn: {
          flowCountBeforeRejectedHop: flowsBeforeRecoveredAttempt,
          flowCountAfterRejectedHop: flowsAfterRecoveredAttempt,
          rejectedReasonAbsentFromDurableFlows: true,
          chainCountUnchanged: recoveredAttempt.chainState.currentChainCount === maxChainLength,
        },
        durableState: {
          persistedCount: sessionEntry.continuationChainCount,
          reloadedCount: recoveredEntry?.continuationChainCount,
          recoveredBudgetReason: structuredReason,
          recoveredAttemptScheduled: recoveredAttempt.scheduled,
        },
      },
      null,
      2,
    )}\n`,
    { mode: 0o600 },
  );
});
