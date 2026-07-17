// This file is copied into a disposable exact-candidate worktree by
// run-max-chain-fixture.mjs. It is deliberately not run in this docs checkout:
// all imports resolve against the candidate's production runtime.
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearRuntimeConfigSnapshot, setRuntimeConfigSnapshot } from "../../src/config/config.js";
import {
  clearSessionStoreCacheForTest,
  loadSessionStore,
  saveSessionStore,
  type SessionEntry,
} from "../../src/config/sessions.js";
import type { OpenClawConfig } from "../../src/config/types.openclaw.js";
import { peekSystemEvents, resetSystemEventsForTest } from "../../src/infra/system-events.js";
import { runAgentAttempt } from "../../src/agents/command/attempt-execution.js";
import { createOpenClawContinuationTools } from "../../src/agents/openclaw-tools.continuation.js";
import { checkContinuationBudget } from "../../src/auto-reply/continuation/scheduler.js";
import {
  resetContinuationWorkDispatchForTests,
  scheduleContinuationWork,
  scheduleContinuationWorkBatch,
} from "../../src/auto-reply/continuation/work-dispatch.js";
import {
  loadContinuationChainState,
  persistContinuationChainState,
} from "../../src/auto-reply/continuation/state.js";

const runEmbeddedAgentMock = vi.hoisted(() => vi.fn());
const runCliAgentMock = vi.hoisted(() => vi.fn());
vi.mock("../../src/agents/cli-runner.js", () => ({ runCliAgent: runCliAgentMock }));
vi.mock("../../src/agents/model-selection.js", () => ({
  isCliProvider: () => false,
  normalizeProviderId: (provider: string) => provider.trim().toLowerCase(),
}));
vi.mock("../../src/agents/provider-auth-aliases.js", () => ({
  resolveProviderAuthAliasMap: () => ({}),
  resolveProviderIdForAuth: (provider: string) => provider.trim().toLowerCase(),
}));
vi.mock("../../src/agents/model-runtime-aliases.js", async () => {
  const actual = await vi.importActual<typeof import("../../src/agents/model-runtime-aliases.js")>(
    "../../src/agents/model-runtime-aliases.js",
  );
  return {
    ...actual,
    resolveCliRuntimeExecutionProvider: ({ provider }: { provider?: string }) => provider,
  };
});
vi.mock("../../src/agents/embedded-agent.js", () => ({ runEmbeddedAgent: runEmbeddedAgentMock }));

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

async function writeReceipt(envName: string, value: unknown): Promise<void> {
  const receiptPath = process.env[envName];
  if (!receiptPath) throw new Error(`${envName} is required`);
  await fs.writeFile(receiptPath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}

function embeddedResult() {
  return {
    payloads: [{ text: "done" }],
    meta: {
      durationMs: 1,
      finalAssistantVisibleText: "done",
      agentMeta: {
        sessionId: "rcw6-disposable-session",
        provider: "anthropic",
        model: "fixture",
        usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      },
    },
  };
}

describe("R-CW-6 disposable max-chain runtime surface", () => {
  let roots: string[];

  beforeEach(async () => {
    roots = [];
    const { resetTaskFlowRegistryForTests } = await import("../../src/tasks/task-runtime.test-helpers.js");
    resetContinuationWorkDispatchForTests();
    resetTaskFlowRegistryForTests({ persist: false });
    clearSessionStoreCacheForTest();
    resetSystemEventsForTest();
    setRuntimeConfigSnapshot(cfg);
    runEmbeddedAgentMock.mockReset();
    runCliAgentMock.mockReset();
  });

  afterEach(async () => {
    const { resetTaskFlowRegistryForTests } = await import("../../src/tasks/task-runtime.test-helpers.js");
    resetContinuationWorkDispatchForTests();
    resetTaskFlowRegistryForTests({ persist: false });
    clearRuntimeConfigSnapshot();
    clearSessionStoreCacheForTest();
    resetSystemEventsForTest();
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
    const sessionStore = { [sessionKey]: sessionEntry };
    await saveSessionStore(storePath, sessionStore, { skipMaintenance: true });
    clearSessionStoreCacheForTest();

    const logs: string[] = [];
    const initialState = loadContinuationChainState(sessionEntry);
    const result = await scheduleContinuationWorkBatch({
      sessionKey,
      chainState: initialState,
      requests: [
        { reason: "R-CW-6 below-limit hop", delaySeconds: 60 },
        { reason: "R-CW-6 at-limit hop", delaySeconds: 60 },
        { reason: "R-CW-6 first-over-limit hop", delaySeconds: 60 },
      ],
      config: runtimeConfig,
      log: (message) => logs.push(message),
    });

    const { listTaskFlowsForOwnerKey } = await import("../../src/tasks/task-flow-registry.js");
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
    await saveSessionStore(storePath, sessionStore, { skipMaintenance: true });
    clearSessionStoreCacheForTest();
    const recoveredStore = loadSessionStore(storePath, { skipCache: true });
    const recoveredEntry = recoveredStore[sessionKey];
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

    await writeReceipt("RCW6_RUNTIME_RECEIPT_PATH", {
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
    });
  });

  it("captures typed continue_work elections and creates no first-over-limit flow", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "rcw6-typed-surface-"));
    roots.push(root);
    const storePath = path.join(root, "sessions.json");
    const sessionKey = `agent:main:subagent:rcw6-typed:${crypto.randomUUID()}`;
    const sessionEntry = {
      sessionId: "rcw6-disposable-session",
      updatedAt: Date.now(),
      continuationChainCount: startingCount,
      continuationChainStartedAt: Date.now(),
      continuationChainTokens: 0,
    } as SessionEntry;
    const sessionStore = { [sessionKey]: sessionEntry };
    await saveSessionStore(storePath, sessionStore, { skipMaintenance: true });
    clearSessionStoreCacheForTest();

    let registeredContinueWorkTools = 0;
    let continueWorkToolExecutions = 0;
    runEmbeddedAgentMock.mockImplementationOnce(async (args: {
      continueWorkOpts?: { requestContinuation: (request: { reason: string; delaySeconds: number }) => void };
    }) => {
      if (!args.continueWorkOpts) throw new Error("runAgentAttempt did not forward continueWorkOpts");
      const tools = createOpenClawContinuationTools({
        config: cfg,
        agentSessionKey: sessionKey,
        runSessionKey: sessionKey,
        sessionId: sessionEntry.sessionId,
        runId: "rcw6-fixture-run",
        drainsContinuationDelegateQueue: false,
        continueWorkOpts: args.continueWorkOpts,
      });
      const matchingTools = tools.filter((tool) => tool.name === "continue_work");
      registeredContinueWorkTools = matchingTools.length;
      const continueWorkTool = matchingTools[0];
      if (!continueWorkTool) throw new Error("real continue_work tool did not register");
      for (const [index, input] of [
        { reason: "R-CW-6 typed below-limit", delaySeconds: 60 },
        { reason: "R-CW-6 typed at-limit", delaySeconds: 60 },
        { reason: "R-CW-6 typed first-over-limit", delaySeconds: 60 },
      ].entries()) {
        await continueWorkTool.execute(`rcw6-typed-tool-${index + 1}`, input);
        continueWorkToolExecutions += 1;
      }
      return embeddedResult();
    });

    await runAgentAttempt({
      providerOverride: "anthropic", originalProvider: "anthropic", modelOverride: "fixture", cfg,
      sessionEntry, sessionId: sessionEntry.sessionId, sessionKey, sessionAgentId: "main",
      lifecycleGeneration: "rcw6-fixture", sessionFile: path.join(root, "session.jsonl"),
      workspaceDir: root, body: "disposable fixture", isFallbackRetry: false, resolvedThinkLevel: "off",
      timeoutMs: 1_000, runId: "rcw6-fixture-run", opts: {} as never, runContext: {} as never,
      spawnedBy: undefined, messageChannel: undefined, skillsSnapshot: undefined,
      resolvedVerboseLevel: undefined, agentDir: root, onAgentEvent: vi.fn(),
      authProfileProvider: "anthropic", sessionStore, storePath, sessionHasHistory: false,
    });

    const { listTaskFlowsForOwnerKey } = await import("../../src/tasks/task-flow-registry.js");
    const flows = listTaskFlowsForOwnerKey(sessionKey)
      .map((flow) => flow.stateJson as { hop?: number; reason?: string })
      .toSorted((left, right) => (left.hop ?? 0) - (right.hop ?? 0));
    clearSessionStoreCacheForTest();
    const persisted = loadSessionStore(storePath, { skipCache: true });
    const capNotice = peekSystemEvents(sessionKey).find((event) =>
      event.includes("1 of 3 continue_work elections were not scheduled"),
    );

    expect(runEmbeddedAgentMock).toHaveBeenCalledTimes(1);
    expect(registeredContinueWorkTools).toBe(1);
    expect(continueWorkToolExecutions).toBe(3);
    expect(flows).toHaveLength(2);
    expect(flows.map((flow) => flow.hop)).toEqual([maxChainLength - 1, maxChainLength]);
    expect(flows.some((flow) => flow.reason?.includes("first-over-limit"))).toBe(false);
    expect(sessionEntry.continuationChainCount).toBe(maxChainLength);
    expect(persisted[sessionKey]?.continuationChainCount).toBe(maxChainLength);
    expect(capNotice).toContain("1 of 3 continue_work elections were not scheduled");

    await writeReceipt("RCW6_TYPED_RECEIPT_PATH", {
      schema: "openclaw.project81.r-cw-6.typed-tool-surface.v1",
      configuredMaximum: maxChainLength,
      initialCurrentChainCount: startingCount,
      registeredContinueWorkTools,
      continueWorkToolExecutions,
      realToolExecutorInvoked: registeredContinueWorkTools === 1 && continueWorkToolExecutions === 3,
      capturedElections: 3,
      scheduledFlows: flows.map((flow) => ({ hop: flow.hop, reason: flow.reason })),
      firstOverLimitFlowPresent: false,
      finalInMemoryCount: sessionEntry.continuationChainCount,
      finalPersistedCount: persisted[sessionKey]?.continuationChainCount,
      capNoticeObserved: Boolean(capNotice),
    });
  });
});
