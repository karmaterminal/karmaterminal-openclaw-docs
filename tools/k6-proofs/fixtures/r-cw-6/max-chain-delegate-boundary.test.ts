// This file is copied into a disposable exact-candidate worktree by
// run-max-chain-fixture.mjs. It parameterizes the production delegate dispatch
// boundary at the same maxChainLength used by the scheduler and typed-tool
// receipts; it is deliberately not run in this docs checkout.
//
// Delegate custody is the candidate's real continuation custody store, so the
// runner executes this file in the candidate's database-worker lane. Only the
// two side-effect surfaces are replaced: the spawn owner (so no subagent run can
// start) and the raw system-event enqueue the dispatcher imports.
import fs from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const { enqueueSystemEventMock, spawnSubagentDirectMock } = vi.hoisted(() => ({
  enqueueSystemEventMock: vi.fn(),
  spawnSubagentDirectMock: vi.fn(),
}));

vi.mock("../../src/agents/subagents/spawn/subagent-spawn.js", () => ({
  spawnSubagentDirect: spawnSubagentDirectMock,
}));

vi.mock("../../src/infra/system-events.js", () => ({
  enqueueSystemEventRaw: enqueueSystemEventMock,
}));

vi.mock("../../src/logging/subsystem.js", async (importOriginal) => {
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
  return {
    ...(await importOriginal<typeof import("../../src/logging/subsystem.js")>()),
    createSubsystemLogger: () => logger,
  };
});

import { spawnSubagentDirect } from "../../src/agents/subagents/spawn/subagent-spawn.js";
import {
  readCustodyRecordForTest,
  useContinuationCustodyTestState,
} from "../../src/auto-reply/continuation/custody/custody.test-support.js";
import {
  dispatchToolDelegates,
  resetDelegateDispatchHedgesForTests,
} from "../../src/auto-reply/continuation/delegate-dispatch.js";
import { enqueuePendingDelegate } from "../../src/auto-reply/continuation/delegate-store.js";
import { resetContinuationStateForTests } from "../../src/auto-reply/continuation/state.js";
import { clearRuntimeConfigSnapshot } from "../../src/config/config.js";
import { upsertSessionEntryCore } from "../../src/config/sessions/session-accessor.js";
import { resetContinuationTracer } from "../../src/infra/continuation-tracer.js";
import { resolveSystemEventQueueKey } from "../../src/infra/system-event-ownership.js";
import { closeOpenClawAgentDatabasesForTest } from "../../src/state/openclaw-agent-db.js";

useContinuationCustodyTestState();

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
const acceptedTask = "R-CW-6 selected boundary accepted delegate";
const rejectedTask = "R-CW-6 selected boundary rejected delegate";

// A spawn owner that moved again would leave the dispatcher calling an
// unmocked spawn. Refuse before dispatch rather than discover it afterwards.
async function assertDispatcherSpawnOwnerIsMocked(): Promise<void> {
  const dispatcherSource = await fs.readFile(
    new URL("../../src/auto-reply/continuation/delegate-dispatch.ts", import.meta.url),
    "utf8",
  );
  expect(dispatcherSource).toMatch(
    /import\s*\{\s*spawnSubagentDirect\s*\}\s*from\s*"\.\.\/\.\.\/agents\/subagents\/spawn\/subagent-spawn\.js"/u,
  );
  expect(spawnSubagentDirect).toBe(spawnSubagentDirectMock);
}

beforeEach(() => {
  closeOpenClawAgentDatabasesForTest();
  enqueueSystemEventMock.mockReset();
  spawnSubagentDirectMock.mockReset().mockResolvedValue({ status: "accepted" });
  vi.useFakeTimers();
});

afterEach(() => {
  resetDelegateDispatchHedgesForTests();
  resetContinuationStateForTests();
  resetContinuationTracer();
  clearRuntimeConfigSnapshot();
  closeOpenClawAgentDatabasesForTest();
  vi.useRealTimers();
});

it("proves the selected max-chain delegate boundary before spawn and fails the rejected flow", async () => {
  await assertDispatcherSpawnOwnerIsMocked();
  const sessionKey = "r-cw-6-selected-delegate-boundary";
  // Dispatch revalidates the owner session before spawning the accepted hop.
  await upsertSessionEntryCore(
    { agentId: "main", sessionKey },
    {
      sessionId: "r-cw-6-selected-delegate-owner",
      lifecycleRevision: "r-cw-6-selected-delegate-owner",
      updatedAt: Date.now(),
    },
  );
  const acceptedRecord = await enqueuePendingDelegate(sessionKey, { task: acceptedTask });
  const rejectedRecord = await enqueuePendingDelegate(sessionKey, { task: rejectedTask });

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

  const acceptedAfter = await readCustodyRecordForTest(acceptedRecord.recordId);
  const rejectedAfter = await readCustodyRecordForTest(rejectedRecord.recordId);
  const spawnedTasks = spawnSubagentDirectMock.mock.calls.map(([request]) =>
    String((request as { task?: unknown }).task),
  );
  const ownerQueueKey = resolveSystemEventQueueKey(sessionKey, "main");
  const capNoticeObserved = enqueueSystemEventMock.mock.calls.some(
    ([message, options]) =>
      String(message).includes("chain-capped") &&
      (options as { sessionKey?: unknown; trusted?: unknown } | undefined)?.sessionKey ===
        ownerQueueKey &&
      (options as { trusted?: unknown } | undefined)?.trusted === true,
  );
  const spawnedOnlyAcceptedDelegate =
    spawnedTasks.length === 1 &&
    spawnedTasks[0]?.includes(acceptedTask) === true &&
    !spawnedTasks.some((task) => task.includes(rejectedTask));
  const rejectedRecordFailedForChainCap =
    rejectedAfter?.status === "failed" &&
    String(rejectedAfter.failureReason).includes("chain-capped") &&
    acceptedAfter?.status !== "failed";

  expect(result).toMatchObject({ dispatched: 1, rejected: 1 });
  expect(result.chainState.currentChainCount).toBe(maxChainLength);
  expect(spawnSubagentDirectMock).toHaveBeenCalledTimes(1);
  expect(spawnedOnlyAcceptedDelegate).toBe(true);
  expect(rejectedAfter?.status).toBe("failed");
  expect(rejectedRecordFailedForChainCap).toBe(true);
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
        spawnedOnlyAcceptedDelegate,
        durableDelegateStore: "continuation-custody",
        rejectedFlowStatus: rejectedAfter?.status,
        rejectedRecordFailedForChainCap,
        chainCappedNoticeObserved: capNoticeObserved,
      },
      null,
      2,
    )}\n`,
    { mode: 0o600 },
  );
});
