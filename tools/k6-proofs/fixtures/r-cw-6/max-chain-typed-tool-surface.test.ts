// Copied into a disposable exact-candidate worktree by run-max-chain-fixture.mjs.
// This file owns only the typed continue_work surface so its result remains
// independent from the runtime/durable boundary.
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createTestPreparedRunAdmission } from "../../agents/admitted-run-context.test-support.js";
import { runAgentAttempt } from "../../agents/command/attempt-execution.js";
import { createOpenClawContinuationTools } from "../../agents/openclaw-tools.continuation.js";
import { clearRuntimeConfigSnapshot, setRuntimeConfigSnapshot } from "../../config/config.js";
import {
  loadSessionEntry,
  replaceSessionEntry,
} from "../../config/sessions/session-accessor.js";
import type { SessionEntry } from "../../config/sessions.js";
import type { OpenClawConfig } from "../../config/types.openclaw.js";
import { peekSystemEvents, resetSystemEventsForTest } from "../../infra/system-events.js";
import { resetContinuationWorkDispatchForTests } from "./work-dispatch.js";

const runEmbeddedAgentMock = vi.hoisted(() => vi.fn());
const runCliAgentMock = vi.hoisted(() => vi.fn());
vi.mock("../../agents/cli-runner.js", () => ({ runCliAgent: runCliAgentMock }));
vi.mock("../../agents/model-selection.js", () => ({
  isCliProvider: () => false,
  normalizeProviderId: (provider: string) => provider.trim().toLowerCase(),
}));
vi.mock("../../agents/provider-auth-aliases.js", () => ({
  resolveProviderAuthAliasMap: () => ({}),
  resolveProviderIdForAuth: (provider: string) => provider.trim().toLowerCase(),
}));
vi.mock("../../agents/model-runtime-aliases.js", async () => {
  const actual = await vi.importActual<typeof import("../../agents/model-runtime-aliases.js")>(
    "../../agents/model-runtime-aliases.js",
  );
  return {
    ...actual,
    resolveCliRuntimeExecutionProvider: ({ provider }: { provider?: string }) => provider,
  };
});
vi.mock("../../agents/embedded-agent.js", () => ({ runEmbeddedAgent: runEmbeddedAgentMock }));

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

let roots: string[];

beforeEach(async () => {
  roots = [];
  const { resetTaskFlowRegistryForTests } =
    await import("../../tasks/task-runtime.test-helpers.js");
  resetContinuationWorkDispatchForTests();
  resetTaskFlowRegistryForTests({ persist: false });
  resetSystemEventsForTest();
  setRuntimeConfigSnapshot(cfg);
  runEmbeddedAgentMock.mockReset();
  runCliAgentMock.mockReset();
});

afterEach(async () => {
  const { resetTaskFlowRegistryForTests } =
    await import("../../tasks/task-runtime.test-helpers.js");
  resetContinuationWorkDispatchForTests();
  resetTaskFlowRegistryForTests({ persist: false });
  resetSystemEventsForTest();
  clearRuntimeConfigSnapshot();
  await Promise.all(roots.map(async (root) => await fs.rm(root, { recursive: true, force: true })));
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
    continueWorkOpts?: {
      requestContinuation: (request: { reason: string; delaySeconds: number }) => void;
    };
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
    providerOverride: "anthropic",
    originalProvider: "anthropic",
    modelOverride: "fixture",
    modelRoutingProvenance: {
      requestedProvider: "anthropic",
      requestedModel: "fixture",
      stage: "initial",
    },
    cfg,
    sessionEntry,
    sessionId: sessionEntry.sessionId,
    sessionKey,
    sessionAgentId: "main",
    lifecycleGeneration: "rcw6-fixture",
    sessionFile: path.join(root, "session.jsonl"),
    workspaceDir: root,
    body: "disposable fixture",
    isFallbackRetry: false,
    resolvedThinkLevel: "off",
    timeoutMs: 1_000,
    runId: "rcw6-fixture-run",
    opts: {} as Parameters<typeof runAgentAttempt>[0]["opts"],
    runContext: {} as Parameters<typeof runAgentAttempt>[0]["runContext"],
    spawnedBy: undefined,
    messageChannel: undefined,
    skillsSnapshot: undefined,
    resolvedVerboseLevel: undefined,
    agentDir: root,
    onAgentEvent: vi.fn(),
    authProfileProvider: "anthropic",
    sessionStore,
    storePath,
    sessionHasHistory: false,
  });

  const { listTaskFlowsForOwnerKey } =
    await import("../../tasks/task-flow-registry.js");
  const flows = listTaskFlowsForOwnerKey(sessionKey)
    .map((flow) => flow.stateJson as { hop?: number; reason?: string })
    .toSorted((left, right) => (left.hop ?? 0) - (right.hop ?? 0));
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
  expect(flows.map((flow) => flow.hop)).toEqual([maxChainLength - 1, maxChainLength]);
  expect(flows.some((flow) => flow.reason?.includes("first-over-limit"))).toBe(false);
  expect(sessionStore[sessionKey]?.continuationChainCount).toBe(maxChainLength);
  expect(persisted?.continuationChainCount).toBe(maxChainLength);
  expect(capNotice).toContain("1 of 3 continue_work elections were not scheduled");

  const receiptPath = process.env.RCW6_TYPED_RECEIPT_PATH;
  if (!receiptPath) throw new Error("RCW6_TYPED_RECEIPT_PATH is required");
  await fs.writeFile(
    receiptPath,
    `${JSON.stringify(
      {
        schema: "openclaw.project81.r-cw-6.typed-tool-surface.v1",
        configuredMaximum: maxChainLength,
        initialCurrentChainCount: startingCount,
        registeredContinueWorkTools,
        continueWorkToolExecutions,
        realToolExecutorInvoked:
          registeredContinueWorkTools === 1 && continueWorkToolExecutions === 3,
        capturedElections: 3,
        scheduledFlows: flows.map((flow) => ({ hop: flow.hop, reason: flow.reason })),
        firstOverLimitFlowPresent: false,
        finalInMemoryCount: sessionStore[sessionKey]?.continuationChainCount,
        finalPersistedCount: persisted?.continuationChainCount,
        capNoticeObserved: Boolean(capNotice),
      },
      null,
      2,
    )}\n`,
    { mode: 0o600 },
  );
});
