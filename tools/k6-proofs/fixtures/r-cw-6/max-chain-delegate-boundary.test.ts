// This file is copied into a disposable exact-candidate worktree by
// run-max-chain-fixture.mjs. It parameterizes the production delegate dispatch
// boundary at the same maxChainLength used by the scheduler and typed-tool
// receipts; it is deliberately not run in this docs checkout.
import fs from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { clearRuntimeConfigSnapshot } from "../../src/config/config.js";
import { resetContinuationTracer } from "../../src/infra/continuation-tracer.js";

const enqueueSystemEventMock = vi.fn();
const spawnSubagentDirectMock = vi.fn();

vi.mock("../../src/agents/subagents/spawn/subagent-spawn.js", () => ({
  spawnSubagentDirect: (...args: unknown[]) => spawnSubagentDirectMock(...args),
}));

vi.mock("../../src/infra/system-events.js", () => ({
  enqueueSystemEventRaw: (text: string, options: unknown) => enqueueSystemEventMock(text, options),
}));

vi.mock("../../src/logging/subsystem.js", () => {
  const sink = () => undefined;
  const logger = {
    subsystem: "r-cw-6-fixture",
    isEnabled: () => true,
    trace: sink,
    debug: sink,
    info: sink,
    warn: sink,
    error: sink,
    fatal: sink,
    raw: sink,
    child: () => logger,
  };
  return { createSubsystemLogger: () => logger };
});

vi.mock("../../src/tasks/task-flow-registry.js", async () => {
  const harness = await import(
    "../../src/auto-reply/continuation/delegate-taskflow-registry.test-harness.js"
  );
  return harness.createTaskFlowRegistryMock();
});

import {
  dispatchToolDelegates,
  resetDelegateDispatchHedgesForTests,
} from "../../src/auto-reply/continuation/delegate-dispatch.js";
import {
  mockTaskFlows,
  resetMockTaskFlows,
} from "../../src/auto-reply/continuation/delegate-taskflow-registry.test-harness.js";
import { enqueuePendingDelegate } from "../../src/auto-reply/continuation/delegate-store.js";
import { resetContinuationStateForTests } from "../../src/auto-reply/continuation/state.js";

const maxChainLength = __RCW6_MAX_CHAIN_LENGTH__;
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

beforeEach(() => {
  resetMockTaskFlows();
  enqueueSystemEventMock.mockClear();
  spawnSubagentDirectMock.mockReset().mockResolvedValue({ status: "accepted" });
  vi.useFakeTimers();
});

afterEach(() => {
  resetDelegateDispatchHedgesForTests();
  resetContinuationStateForTests();
  resetContinuationTracer();
  clearRuntimeConfigSnapshot();
  resetMockTaskFlows();
  vi.useRealTimers();
});

it("proves the selected max-chain delegate boundary before spawn and fails the rejected flow", async () => {
  const sessionKey = "r-cw-6-selected-delegate-boundary";
  enqueuePendingDelegate(sessionKey, { task: "R-CW-6 selected boundary accepted delegate" });
  enqueuePendingDelegate(sessionKey, { task: "R-CW-6 selected boundary rejected delegate" });

  const result = await dispatchToolDelegates({
    sessionKey,
    chainState: {
      currentChainCount: maxChainLength - 1,
      chainStartedAt: Date.now(),
      accumulatedChainTokens: 0,
    },
    ctx: { sessionKey },
    maxChainLength,
    config: runtimeConfig,
  });

  const failedFlows = [...mockTaskFlows.values()].filter((flow) => flow.status === "failed");
  const capNoticeObserved = enqueueSystemEventMock.mock.calls.some(([message]) =>
    String(message).includes("chain-capped"),
  );

  expect(result).toMatchObject({ dispatched: 1, rejected: 1 });
  expect(result.chainState.currentChainCount).toBe(maxChainLength);
  expect(spawnSubagentDirectMock).toHaveBeenCalledTimes(1);
  expect(failedFlows).toHaveLength(1);
  expect(capNoticeObserved).toBe(true);

  const receiptPath = process.env.RCW6_DELEGATE_RECEIPT_PATH;
  if (!receiptPath) throw new Error("RCW6_DELEGATE_RECEIPT_PATH is required");
  await fs.writeFile(
    receiptPath,
    `${JSON.stringify(
      {
        schema: "openclaw.project81.r-cw-6.selected-delegate-boundary.v1",
        configuredMaximum: maxChainLength,
        initialCurrentChainCount: maxChainLength - 1,
        attemptedHops: [maxChainLength, maxChainLength + 1],
        dispatched: result.dispatched,
        rejected: result.rejected,
        resultingChainCount: result.chainState.currentChainCount,
        spawnCalls: spawnSubagentDirectMock.mock.calls.length,
        rejectedBeforeSecondSpawn: spawnSubagentDirectMock.mock.calls.length === 1,
        rejectedFlowStatus: failedFlows[0]?.status,
        chainCappedNoticeObserved: capNoticeObserved,
      },
      null,
      2,
    )}\n`,
    { mode: 0o600 },
  );
});
