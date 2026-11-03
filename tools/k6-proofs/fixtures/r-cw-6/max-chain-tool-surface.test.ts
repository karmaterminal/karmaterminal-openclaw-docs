// This file is copied into a disposable exact-candidate worktree by
// run-max-chain-fixture.mjs. It is deliberately not run in this docs checkout:
// all imports resolve against the candidate's production runtime.
//
// Scheduled work is held in the candidate's real continuation custody store, so
// the runner executes this file in the candidate's database-worker lane.
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearRuntimeConfigSnapshot, setRuntimeConfigSnapshot } from "../../src/config/config.js";
import {
  loadSessionEntry,
  replaceSessionEntry,
} from "../../src/config/sessions/session-accessor.js";
import type { SessionEntry } from "../../src/config/sessions.js";
import type { OpenClawConfig } from "../../src/config/types.openclaw.js";
import { peekSystemEvents, resetSystemEventsForTest } from "../../src/infra/system-events.js";
import { createTestPreparedRunAdmission } from "../../src/agents/admitted-run-context.test-support.js";
import { runAgentAttempt } from "../../src/agents/command/attempt-execution.js";
import { createOpenClawContinuationTools } from "../../src/agents/openclaw-tools.continuation.js";
import {
  listCustodyRecordsForTest,
  useContinuationCustodyTestState,
} from "../../src/auto-reply/continuation/custody/custody.test-support.js";
import { checkContinuationBudget } from "../../src/auto-reply/continuation/scheduler.js";
import { decodeWorkState } from "../../src/auto-reply/continuation/work-flow-state.js";
import {
  resetContinuationWorkDispatchForTests,
  scheduleContinuationWork,
  scheduleContinuationWorkBatch,
} from "../../src/auto-reply/continuation/work-dispatch.js";
import {
  loadContinuationChainState,
  persistContinuationChainState,
} from "../../src/auto-reply/continuation/state.js";
import { clearSessionStoreCacheForTest } from "../../src/config/sessions/store-writer-state.js";
import {
  closeOpenClawAgentDatabasesAsync,
  closeOpenClawAgentDatabasesForTest,
} from "../../src/state/openclaw-agent-db.js";

useContinuationCustodyTestState();

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

// Every durable work record the owner holds, in hop order, decoded by the
// candidate's own work-state codec.
async function listOwnerWork(sessionKey: string): Promise<Array<{ hop?: number; reason?: string }>> {
  const records = await listCustodyRecordsForTest({ ownerSessionKey: sessionKey, kinds: ["work"] });
  return records
    .map((record) => {
      const work = decodeWorkState(record);
      return { hop: work?.hop, reason: work?.reason };
    })
    .toSorted((left, right) => (left.hop ?? 0) - (right.hop ?? 0));
}

// Every custody record the owner holds, of any kind (work, delegate,
// post_compaction): a rejected election must leave none behind, whatever kind
// a regression might give it.
async function countOwnerRecords(sessionKey: string): Promise<number> {
  return (await listCustodyRecordsForTest({ ownerSessionKey: sessionKey })).length;
}

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
    resetContinuationWorkDispatchForTests();
    resetSystemEventsForTest();
    clearSessionStoreCacheForTest();
    setRuntimeConfigSnapshot(cfg);
    runEmbeddedAgentMock.mockReset();
    runCliAgentMock.mockReset();
  });

  afterEach(async () => {
    resetContinuationWorkDispatchForTests();
    clearRuntimeConfigSnapshot();
    resetSystemEventsForTest();
    clearSessionStoreCacheForTest();
    // Drain worker-retained agent databases before removing their roots.
    await closeOpenClawAgentDatabasesAsync();
    closeOpenClawAgentDatabasesForTest();
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
    await replaceSessionEntry({ sessionKey, storePath }, sessionEntry);

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

    const scheduledFlows = await listOwnerWork(sessionKey);
    expect(await countOwnerRecords(sessionKey)).toBe(2);
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
    clearSessionStoreCacheForTest();
    const recoveredEntry = loadSessionEntry({
      sessionKey,
      storePath,
      readConsistency: "latest",
    });
    const recoveredState = loadContinuationChainState(recoveredEntry);
    const flowsBeforeRecoveredAttempt = await countOwnerRecords(sessionKey);
    const recoveryLogs: string[] = [];
    const recoveredAttempt = await scheduleContinuationWork({
      sessionKey,
      chainState: recoveredState,
      request: { reason: "R-CW-6 recovered first-over-limit hop", delaySeconds: 60 },
      config: runtimeConfig,
      log: (message) => recoveryLogs.push(message),
    });
    const flowsAfterRecoveredAttempt = await countOwnerRecords(sessionKey);
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
    await replaceSessionEntry({ sessionKey, storePath }, sessionEntry);

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
      preparedRunAdmission: createTestPreparedRunAdmission("rcw6-fixture-run"),
      pluginGeneration: undefined,
      modelRoutingProvenance: { requestedProvider: "anthropic", requestedModel: "fixture", stage: "initial" },
      providerOverride: "anthropic", originalProvider: "anthropic", modelOverride: "fixture", cfg,
      sessionEntry, sessionId: sessionEntry.sessionId, sessionKey, sessionAgentId: "main",
      lifecycleGeneration: "rcw6-fixture", sessionFile: path.join(root, "session.jsonl"),
      workspaceDir: root, body: "disposable fixture", isFallbackRetry: false, resolvedThinkLevel: "off",
      timeoutMs: 1_000, runId: "rcw6-fixture-run", opts: {} as never, runContext: {} as never,
      spawnedBy: undefined, messageChannel: undefined, skillsSnapshot: undefined,
      resolvedVerboseLevel: undefined, agentDir: root, onAgentEvent: vi.fn(),
      authProfileProvider: "anthropic", sessionStore, storePath, sessionHasHistory: false,
    });

    const flows = await listOwnerWork(sessionKey);
    const ownerRecordCount = await countOwnerRecords(sessionKey);
    // The attempt publishes its patched entry into the caller's session store
    // map; that map, not the entry object passed in, is the in-memory owner.
    const finalInMemoryCount = sessionStore[sessionKey]?.continuationChainCount;
    clearSessionStoreCacheForTest();
    const persisted = loadSessionEntry({
      sessionKey,
      storePath,
      readConsistency: "latest",
    });
    const capNotice = peekSystemEvents(sessionKey).find((event) =>
      event.includes("1 of 3 continue_work elections were not scheduled"),
    );

    expect(runEmbeddedAgentMock).toHaveBeenCalledTimes(1);
    expect(registeredContinueWorkTools).toBe(1);
    expect(continueWorkToolExecutions).toBe(3);
    expect(flows).toHaveLength(2);
    expect(ownerRecordCount).toBe(2);
    expect(flows.map((flow) => flow.hop)).toEqual([maxChainLength - 1, maxChainLength]);
    expect(flows.some((flow) => flow.reason?.includes("first-over-limit"))).toBe(false);
    expect(finalInMemoryCount).toBe(maxChainLength);
    expect(persisted?.continuationChainCount).toBe(maxChainLength);
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
      finalInMemoryCount,
      finalPersistedCount: persisted?.continuationChainCount,
      capNoticeObserved: Boolean(capNotice),
    });
  });
});
