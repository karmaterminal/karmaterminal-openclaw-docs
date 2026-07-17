// This file is copied into a disposable exact-candidate worktree by
// run-max-chain-fixture.mjs. It parameterizes the production delegate dispatch
// boundary at the same maxChainLength used by the scheduler and typed-tool
// receipts; it is deliberately not run in this docs checkout.
import fs from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { clearRuntimeConfigSnapshot } from "../../src/config/config.js";
import { resetContinuationTracer } from "../../src/infra/continuation-tracer.js";

const mockFlows = new Map<string, Record<string, unknown>>();
const enqueueSystemEventMock = vi.fn();
const spawnSubagentDirectMock = vi.fn();
let flowIdCounter = 0;

vi.mock("../../src/agents/subagent-spawn.js", () => ({
  spawnSubagentDirect: (...args: unknown[]) => spawnSubagentDirectMock(...args),
}));

vi.mock("../../src/infra/system-events.js", () => ({
  enqueueSystemEvent: (text: string, options: unknown) => enqueueSystemEventMock(text, options),
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

vi.mock("../../src/tasks/task-flow-registry.js", () => ({
  createManagedTaskFlow: vi.fn((params: Record<string, unknown>) => {
    const flowId = `flow-${++flowIdCounter}`;
    const flow = {
      flowId,
      syncMode: "managed",
      ownerKey: params.ownerKey,
      controllerId: params.controllerId,
      status: "queued",
      stateJson: params.stateJson,
      goal: params.goal,
      currentStep: params.currentStep,
      revision: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    mockFlows.set(flowId, flow);
    return flow;
  }),
  listTaskFlowsForOwnerKey: vi.fn((ownerKey: string) =>
    [...mockFlows.values()].filter((flow) => flow.ownerKey === ownerKey),
  ),
  getTaskFlowById: vi.fn((flowId: string) => mockFlows.get(flowId)),
  updateFlowRecordByIdExpectedRevision: vi.fn(
    (params: { flowId: string; expectedRevision: number; patch: Record<string, unknown> }) => {
      const flow = mockFlows.get(params.flowId);
      if (!flow || flow.revision !== params.expectedRevision) {
        return {
          applied: false,
          reason: flow ? "revision_conflict" : "not_found",
          current: flow ? { ...flow } : undefined,
        };
      }
      Object.assign(flow, params.patch);
      flow.revision = Number(flow.revision) + 1;
      return { applied: true, flow: { ...flow } };
    },
  ),
  finishFlow: vi.fn((params: { flowId: string; expectedRevision: number }) => {
    const flow = mockFlows.get(params.flowId);
    if (!flow || flow.revision !== params.expectedRevision) {
      return { applied: false, reason: flow ? "revision_conflict" : "not_found" };
    }
    flow.status = "succeeded";
    flow.revision = Number(flow.revision) + 1;
    return { applied: true, flow: { ...flow } };
  }),
  failFlow: vi.fn((params: { flowId: string }) => {
    const flow = mockFlows.get(params.flowId);
    if (flow) flow.status = "failed";
    return { applied: Boolean(flow) };
  }),
  deleteTaskFlowRecordById: vi.fn((flowId: string) => {
    mockFlows.delete(flowId);
  }),
}));

import {
  dispatchToolDelegates,
  resetDelegateDispatchHedgesForTests,
} from "../../src/auto-reply/continuation/delegate-dispatch.js";
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
  mockFlows.clear();
  enqueueSystemEventMock.mockClear();
  spawnSubagentDirectMock.mockReset().mockResolvedValue({ status: "accepted" });
  flowIdCounter = 0;
  vi.useFakeTimers();
});

afterEach(() => {
  resetDelegateDispatchHedgesForTests();
  resetContinuationStateForTests();
  resetContinuationTracer();
  clearRuntimeConfigSnapshot();
  mockFlows.clear();
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

  const failedFlows = [...mockFlows.values()].filter((flow) => flow.status === "failed");
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
