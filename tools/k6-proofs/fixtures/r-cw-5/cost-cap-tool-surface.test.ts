// This file is copied into a disposable exact-candidate worktree by
// run-cost-cap-fixture.mjs. It is deliberately not run in this docs checkout:
// all imports resolve against the candidate's production runtime.
import crypto from "node:crypto";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runAgentAttempt } from "../../src/agents/command/attempt-execution.js";
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

const cfg = {
  agents: {
    defaults: {
      continuation: {
        enabled: true,
        maxChainLength: 4,
        defaultDelayMs: 15_000,
        minDelayMs: 5_000,
        maxDelayMs: 86_400_000,
        costCapTokens: __RCW5_CAP__,
        maxDelegatesPerTurn: 4,
      },
    },
  },
} as unknown as OpenClawConfig;

describe("R-CW-5 disposable typed tool surface", () => {
  beforeEach(() => {
    runEmbeddedAgentMock.mockReset();
    runCliAgentMock.mockReset();
  });

  afterEach(() => {
    clearRuntimeConfigSnapshot();
    resetSystemEventsForTest();
  });

  it("rejects exhausted typed-tool elections without a durable continuation", async () => {
    await withOpenClawTestState(
      { layout: "state-only", prefix: "rcw5-tool-surface-" },
      async (state) => {
        setRuntimeConfigSnapshot(cfg);
        const agentId = `rcw5-${crypto.randomUUID()}`;
        const sessionKey = `agent:${agentId}:subagent:${crypto.randomUUID()}`;
        const sessionEntry = {
          sessionId: `rcw5-${crypto.randomUUID()}`,
          updatedAt: Date.now(),
          continuationChainCount: 0,
          continuationChainStartedAt: Date.now(),
          continuationChainTokens: __RCW5_OVER_CAP__,
        } as SessionEntry;
        const storePath = resolveOpenClawAgentSqlitePath({ agentId, env: state.env });
        const scope = { agentId, env: state.env, sessionKey, storePath };
        const { listTaskFlowsForOwnerKey } = await import("../../src/tasks/task-flow-registry.js");
        const { resetTaskFlowRegistryForTests } =
          await import("../../src/tasks/task-runtime.test-helpers.js");

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
          expect(listTaskFlowsForOwnerKey(sessionKey)).toHaveLength(0);
          runEmbeddedAgentMock.mockImplementationOnce(
            async (args: {
              continueWorkOpts?: {
                requestContinuation: (request: { reason: string; delaySeconds: number }) => void;
              };
            }) => {
              args.continueWorkOpts?.requestContinuation({
                reason: "R-CW-5 disposable first",
                delaySeconds: 1,
              });
              args.continueWorkOpts?.requestContinuation({
                reason: "R-CW-5 disposable second",
                delaySeconds: 1,
              });
              return {
                payloads: [{ text: "done" }],
                meta: {
                  durationMs: 1,
                  finalAssistantVisibleText: "done",
                  agentMeta: {
                    sessionId: sessionEntry.sessionId,
                    provider: "anthropic",
                    model: "fixture",
                    usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
                  },
                },
              };
            },
          );

          await runAgentAttempt({
            providerOverride: "anthropic",
            originalProvider: "anthropic",
            modelOverride: "fixture",
            cfg,
            sessionEntry,
            sessionId: sessionEntry.sessionId,
            sessionKey,
            sessionAgentId: agentId,
            lifecycleGeneration: "rcw5-fixture",
            sessionFile: state.path("session.jsonl"),
            workspaceDir: state.workspaceDir,
            body: "disposable fixture",
            isFallbackRetry: false,
            resolvedThinkLevel: "off",
            timeoutMs: 1_000,
            runId: "rcw5-fixture-run",
            opts: {} as never,
            runContext: {} as never,
            spawnedBy: undefined,
            messageChannel: undefined,
            skillsSnapshot: undefined,
            resolvedVerboseLevel: undefined,
            agentDir: state.agentDir(agentId),
            onAgentEvent: vi.fn(),
            authProfileProvider: "anthropic",
            sessionStore: { [sessionKey]: sessionEntry },
            storePath,
            sessionHasHistory: false,
          });

          expect(listTaskFlowsForOwnerKey(sessionKey)).toHaveLength(0);
          resetTaskFlowRegistryForTests({ persist: false });
          expect(listTaskFlowsForOwnerKey(sessionKey)).toHaveLength(0);
          expect(closeOpenClawAgentDatabaseByPath(storePath)).toBe(true);
          const recoveredEntry = loadSessionEntry(scope);
          expect(recoveredEntry).not.toBe(sessionEntry);
          expect(recoveredEntry?.continuationChainTokens).toBe(__RCW5_OVER_CAP__);
          expect(peekSystemEvents(sessionKey)).toContain(
            "[continuation] 2 of 2 continue_work elections were not scheduled (chain/cost/pending cap).",
          );
        } finally {
          resetTaskFlowRegistryForTests({ persist: false });
        }
      },
    );
  });
});
