// This file is copied into a disposable exact-candidate worktree by
// run-max-chain-fixture.mjs. It is deliberately not run in this docs checkout:
// all imports resolve against the candidate's production runtime.
import crypto from "node:crypto";
import fs from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runAgentAttempt } from "../../src/agents/command/attempt-execution.js";
import { createOpenClawContinuationTools } from "../../src/agents/openclaw-tools.continuation.js";
import { checkContinuationBudget } from "../../src/auto-reply/continuation/scheduler.js";
import {
  loadContinuationChainState,
  persistContinuationChainState,
} from "../../src/auto-reply/continuation/state.js";
import {
  resetContinuationWorkDispatchForTests,
  scheduleContinuationWork,
  scheduleContinuationWorkBatch,
} from "../../src/auto-reply/continuation/work-dispatch.js";
import { clearRuntimeConfigSnapshot, setRuntimeConfigSnapshot } from "../../src/config/config.js";
import {
  loadSessionEntry,
  patchSessionEntry,
  upsertSessionEntry,
} from "../../src/config/sessions/session-accessor.js";
import type { SessionEntry } from "../../src/config/sessions/types.js";
import type { OpenClawConfig } from "../../src/config/types.openclaw.js";
import { peekSystemEvents, resetSystemEventsForTest } from "../../src/infra/system-events.js";
import {
  closeOpenClawAgentDatabaseByPath,
  resolveOpenClawAgentSqlitePath,
} from "../../src/state/openclaw-agent-db.js";
import { withOpenClawTestState } from "../../src/test-utils/openclaw-test-state.js";

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

function embeddedResult(sessionId: string) {
  return {
    payloads: [{ text: "done" }],
    meta: {
      durationMs: 1,
      finalAssistantVisibleText: "done",
      agentMeta: {
        sessionId,
        provider: "anthropic",
        model: "fixture",
        usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      },
    },
  };
}

describe("R-CW-6 disposable max-chain runtime surface", () => {
  beforeEach(() => {
    resetSystemEventsForTest();
    runEmbeddedAgentMock.mockReset();
    runCliAgentMock.mockReset();
  });

  afterEach(() => {
    clearRuntimeConfigSnapshot();
    resetSystemEventsForTest();
  });

  it("proves below-limit, at-limit, and first-over-limit with durable recovery", async () => {
    await withOpenClawTestState(
      { layout: "state-only", prefix: "rcw6-runtime-boundary-" },
      async (state) => {
        setRuntimeConfigSnapshot(cfg);
        const agentId = `rcw6-runtime-${crypto.randomUUID()}`;
        const sessionKey = `agent:${agentId}:subagent:${crypto.randomUUID()}`;
        const sessionEntry = {
          sessionId: `rcw6-runtime-${crypto.randomUUID()}`,
          updatedAt: Date.now(),
          continuationChainCount: startingCount,
          continuationChainStartedAt: Date.now(),
          continuationChainTokens: 0,
        } as SessionEntry;
        const storePath = resolveOpenClawAgentSqlitePath({ agentId, env: state.env });
        const scope = { agentId, env: state.env, sessionKey, storePath };
        const { listTaskFlowsForOwnerKey } = await import("../../src/tasks/task-flow-registry.js");
        const { resetTaskFlowRegistryForTests } =
          await import("../../src/tasks/task-runtime.test-helpers.js");

        resetContinuationWorkDispatchForTests();
        resetTaskFlowRegistryForTests();
        try {
          expect(await upsertSessionEntry(scope, sessionEntry)).not.toBeNull();
          expect(
            await patchSessionEntry(
              scope,
              () => ({
                continuationChainCount: sessionEntry.continuationChainCount,
                continuationChainStartedAt: sessionEntry.continuationChainStartedAt,
                continuationChainTokens: sessionEntry.continuationChainTokens,
              }),
              { preserveActivity: true, requireWriteSuccess: true },
            ),
          ).not.toBeNull();
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
          expect(scheduledFlows.some((flow) => flow.reason?.includes("first-over-limit"))).toBe(
            false,
          );
          expect(logs.some((message) => message.includes("chain-capped"))).toBe(true);

          persistContinuationChainState({
            sessionEntry,
            count: result.chainState.currentChainCount,
            startedAt: result.chainState.chainStartedAt,
            tokens: result.chainState.accumulatedChainTokens,
            ...(result.chainState.chainId ? { chainId: result.chainState.chainId } : {}),
          });
          expect(
            await patchSessionEntry(
              scope,
              () => ({
                continuationChainCount: sessionEntry.continuationChainCount,
                continuationChainStartedAt: sessionEntry.continuationChainStartedAt,
                continuationChainTokens: sessionEntry.continuationChainTokens,
                continuationChainId: sessionEntry.continuationChainId,
              }),
              { preserveActivity: true, requireWriteSuccess: true },
            ),
          ).not.toBeNull();
          expect(closeOpenClawAgentDatabaseByPath(storePath)).toBe(true);
          const recoveredEntry = loadSessionEntry(scope);
          if (!recoveredEntry) throw new Error("canonical SQLite session row did not reload");
          const recoveredState = loadContinuationChainState(recoveredEntry);

          resetTaskFlowRegistryForTests({ persist: false });
          const flowsBeforeRecoveredAttempt = listTaskFlowsForOwnerKey(sessionKey).length;
          const recoveryLogs: string[] = [];
          const recoveredAttempt = await scheduleContinuationWork({
            sessionKey,
            chainState: recoveredState,
            request: { reason: "R-CW-6 recovered first-over-limit hop", delaySeconds: 60 },
            config: runtimeConfig,
            log: (message) => recoveryLogs.push(message),
          });
          resetTaskFlowRegistryForTests({ persist: false });
          const recoveredFlows = listTaskFlowsForOwnerKey(sessionKey);
          const flowsAfterRecoveredAttempt = recoveredFlows.length;
          const structuredReason = checkContinuationBudget({
            sessionKey,
            chainState: recoveredState,
            config: runtimeConfig,
          });

          expect(recoveredEntry).not.toBe(sessionEntry);
          expect(recoveredEntry.continuationChainCount).toBe(maxChainLength);
          expect(recoveredState.currentChainCount).toBe(maxChainLength);
          expect(recoveredAttempt).toMatchObject({ scheduled: false, capped: true });
          expect(recoveredAttempt.chainState.currentChainCount).toBe(maxChainLength);
          expect(structuredReason).toBe("chain-capped");
          expect(recoveryLogs.some((message) => message.includes("chain-capped"))).toBe(true);
          expect(flowsAfterRecoveredAttempt).toBe(flowsBeforeRecoveredAttempt);
          expect(
            recoveredFlows.some((flow) =>
              (flow.stateJson as { reason?: string }).reason?.includes(
                "recovered first-over-limit",
              ),
            ),
          ).toBe(false);

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
              reloadedCount: recoveredEntry.continuationChainCount,
              recoveredBudgetReason: structuredReason,
              recoveredAttemptScheduled: recoveredAttempt.scheduled,
            },
          });
        } finally {
          resetContinuationWorkDispatchForTests();
          resetTaskFlowRegistryForTests({ persist: false });
        }
      },
    );
  });

  it("captures typed continue_work elections and creates no first-over-limit flow", async () => {
    await withOpenClawTestState(
      { layout: "state-only", prefix: "rcw6-typed-surface-" },
      async (state) => {
        setRuntimeConfigSnapshot(cfg);
        const agentId = `rcw6-typed-${crypto.randomUUID()}`;
        const sessionKey = `agent:${agentId}:subagent:${crypto.randomUUID()}`;
        const sessionEntry = {
          sessionId: `rcw6-typed-${crypto.randomUUID()}`,
          updatedAt: Date.now(),
          continuationChainCount: startingCount,
          continuationChainStartedAt: Date.now(),
          continuationChainTokens: 0,
        } as SessionEntry;
        const storePath = resolveOpenClawAgentSqlitePath({ agentId, env: state.env });
        const scope = { agentId, env: state.env, sessionKey, storePath };
        const { listTaskFlowsForOwnerKey } = await import("../../src/tasks/task-flow-registry.js");
        const { resetTaskFlowRegistryForTests } =
          await import("../../src/tasks/task-runtime.test-helpers.js");
        let registeredContinueWorkTools = 0;
        let continueWorkToolExecutions = 0;

        const runTypedAttempt = async (entry: SessionEntry, reasons: string[], runId: string) => {
          runEmbeddedAgentMock.mockImplementationOnce(
            async (args: {
              continueWorkOpts?: {
                requestContinuation: (request: { reason: string; delaySeconds: number }) => void;
              };
            }) => {
              if (!args.continueWorkOpts)
                throw new Error("runAgentAttempt did not forward continueWorkOpts");
              const tools = createOpenClawContinuationTools({
                config: cfg,
                agentSessionKey: sessionKey,
                runSessionKey: sessionKey,
                sessionId: entry.sessionId,
                runId,
                drainsContinuationDelegateQueue: false,
                continueWorkOpts: args.continueWorkOpts,
              });
              const matchingTools = tools.filter((tool) => tool.name === "continue_work");
              registeredContinueWorkTools += matchingTools.length;
              const continueWorkTool = matchingTools[0];
              if (!continueWorkTool) throw new Error("real continue_work tool did not register");
              for (const [index, reason] of reasons.entries()) {
                await continueWorkTool.execute(`${runId}-tool-${index + 1}`, {
                  reason,
                  delaySeconds: 60,
                });
                continueWorkToolExecutions += 1;
              }
              return embeddedResult(entry.sessionId);
            },
          );

          await runAgentAttempt({
            providerOverride: "anthropic",
            originalProvider: "anthropic",
            modelOverride: "fixture",
            cfg,
            sessionEntry: entry,
            sessionId: entry.sessionId,
            sessionKey,
            sessionAgentId: agentId,
            lifecycleGeneration: "rcw6-fixture",
            sessionFile: state.path(`${runId}.jsonl`),
            workspaceDir: state.workspaceDir,
            body: "disposable fixture",
            isFallbackRetry: false,
            resolvedThinkLevel: "off",
            timeoutMs: 1_000,
            runId,
            opts: {} as never,
            runContext: {} as never,
            spawnedBy: undefined,
            messageChannel: undefined,
            skillsSnapshot: undefined,
            resolvedVerboseLevel: undefined,
            agentDir: state.agentDir(agentId),
            onAgentEvent: vi.fn(),
            authProfileProvider: "anthropic",
            sessionStore: { [sessionKey]: entry },
            storePath,
            sessionHasHistory: false,
          });
        };

        resetContinuationWorkDispatchForTests();
        resetTaskFlowRegistryForTests();
        try {
          expect(await upsertSessionEntry(scope, sessionEntry)).not.toBeNull();
          expect(
            await patchSessionEntry(
              scope,
              () => ({
                continuationChainCount: sessionEntry.continuationChainCount,
                continuationChainStartedAt: sessionEntry.continuationChainStartedAt,
                continuationChainTokens: sessionEntry.continuationChainTokens,
              }),
              { preserveActivity: true, requireWriteSuccess: true },
            ),
          ).not.toBeNull();
          const flowCountBeforeAcceptedAttempt = listTaskFlowsForOwnerKey(sessionKey).length;
          await runTypedAttempt(
            sessionEntry,
            ["R-CW-6 typed below-limit", "R-CW-6 typed at-limit"],
            "rcw6-before-reopen",
          );
          expect(sessionEntry.continuationChainCount).toBe(maxChainLength);
          expect(closeOpenClawAgentDatabaseByPath(storePath)).toBe(true);
          const recoveredEntry = loadSessionEntry(scope);
          if (!recoveredEntry)
            throw new Error("typed continuation state did not reload from SQLite");
          expect(recoveredEntry).not.toBe(sessionEntry);
          expect(recoveredEntry.continuationChainCount).toBe(maxChainLength);

          resetTaskFlowRegistryForTests({ persist: false });
          const flowCountBeforeRejectedAttempt = listTaskFlowsForOwnerKey(sessionKey).length;
          const executionsBeforeRejectedAttempt = continueWorkToolExecutions;
          await runTypedAttempt(
            recoveredEntry,
            ["R-CW-6 typed first-over-limit"],
            "rcw6-after-reopen",
          );
          resetTaskFlowRegistryForTests({ persist: false });
          const flows = listTaskFlowsForOwnerKey(sessionKey)
            .map((flow) => flow.stateJson as { hop?: number; reason?: string })
            .toSorted((left, right) => (left.hop ?? 0) - (right.hop ?? 0));
          const acceptedBeforeReopen =
            flowCountBeforeRejectedAttempt - flowCountBeforeAcceptedAttempt;
          const rejectedAfterReopen =
            continueWorkToolExecutions -
            executionsBeforeRejectedAttempt -
            (flows.length - flowCountBeforeRejectedAttempt);
          expect(closeOpenClawAgentDatabaseByPath(storePath)).toBe(true);
          const finalEntry = loadSessionEntry(scope);

          expect(runEmbeddedAgentMock).toHaveBeenCalledTimes(2);
          expect(registeredContinueWorkTools).toBe(2);
          expect(continueWorkToolExecutions).toBe(3);
          expect(flows).toHaveLength(2);
          expect(flows).toHaveLength(flowCountBeforeRejectedAttempt);
          expect(flows.map((flow) => flow.hop)).toEqual([maxChainLength - 1, maxChainLength]);
          expect(flows.some((flow) => flow.reason?.includes("first-over-limit"))).toBe(false);
          expect(acceptedBeforeReopen).toBe(2);
          expect(rejectedAfterReopen).toBe(1);
          expect(finalEntry?.continuationChainCount).toBe(maxChainLength);
          expect(
            peekSystemEvents(sessionKey).some((event) =>
              event.includes("continue_work elections were not scheduled"),
            ),
          ).toBe(false);

          await writeReceipt("RCW6_TYPED_RECEIPT_PATH", {
            schema: "openclaw.project81.r-cw-6.typed-tool-surface.v1",
            configuredMaximum: maxChainLength,
            initialCurrentChainCount: startingCount,
            registeredContinueWorkTools,
            continueWorkToolExecutions,
            realToolExecutorInvoked:
              registeredContinueWorkTools === 2 && continueWorkToolExecutions === 3,
            capturedElections: 3,
            scheduledFlows: flows.map((flow) => ({ hop: flow.hop, reason: flow.reason })),
            firstOverLimitFlowPresent: false,
            finalInMemoryCount: recoveredEntry.continuationChainCount,
            finalPersistedCount: finalEntry?.continuationChainCount,
            acceptedBeforeReopen,
            rejectedAfterReopen,
            flowCountBeforeRejectedAttempt,
            flowCountAfterRejectedAttempt: flows.length,
            databaseReopened: true,
          });
        } finally {
          resetContinuationWorkDispatchForTests();
          resetTaskFlowRegistryForTests({ persist: false });
        }
      },
    );
  });
});
