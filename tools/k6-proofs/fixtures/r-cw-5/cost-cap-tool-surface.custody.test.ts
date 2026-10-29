// This file is copied into a disposable exact-candidate worktree by
// run-cost-cap-fixture.mjs. It is deliberately not run in this docs checkout:
// all imports resolve against the candidate's production runtime.
//
// Continuation work is durable as continuation custody records once the
// candidate ships custody (fork #1408); upstream 6652f7eac8 removed the
// TaskFlow runtime the earlier template observed. Custody runs through the
// real shared-state worker in a per-test state directory, so the runner
// executes this file as the candidate's infra project, beside its
// database-worker-core suites.
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearRuntimeConfigSnapshot, setRuntimeConfigSnapshot } from "../../src/config/config.js";
import { replaceSessionEntry } from "../../src/config/sessions/session-accessor.js";
import type { SessionEntry } from "../../src/config/sessions.js";
import type { OpenClawConfig } from "../../src/config/types.openclaw.js";
import { peekSystemEvents, resetSystemEventsForTest } from "../../src/infra/system-events.js";
import { runAgentAttempt } from "../../src/agents/command/attempt-execution.js";
import {
  listCustodyRecordsForTest,
  useContinuationCustodyTestState,
} from "../../src/auto-reply/continuation/custody/custody.test-support.js";

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

useContinuationCustodyTestState();

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

type ContinuationRequest = { reason: string; delaySeconds: number };

// One delay for every election, admitted or not: an hour, so admitted work
// cannot fire during the test, and the over-cap and control elections differ
// only in the chain's tokens.
const ELECTION_DELAY_SECONDS = 3_600;

describe("R-CW-5 disposable typed tool surface", () => {
  let root: string;
  let storePath: string;
  let sessionKey: string;
  let sessionEntry: SessionEntry;

  async function seedSession(continuationChainTokens: number): Promise<void> {
    sessionEntry = {
      sessionId: "rcw5-disposable-session",
      updatedAt: Date.now(),
      continuationChainCount: 0,
      continuationChainStartedAt: Date.now(),
      continuationChainTokens,
    } as SessionEntry;
    await replaceSessionEntry({ sessionKey, storePath }, sessionEntry);
  }

  // The embedded-agent double elects through the real typed callback that the
  // production attempt runner hands it.
  async function electThroughAttempt(requests: ContinuationRequest[], runId: string): Promise<void> {
    runEmbeddedAgentMock.mockImplementationOnce(async (args: {
      continueWorkOpts?: { requestContinuation: (request: ContinuationRequest) => void };
    }) => {
      for (const request of requests) args.continueWorkOpts?.requestContinuation(request);
      return {
        payloads: [{ text: "done" }],
        meta: {
          durationMs: 1,
          finalAssistantVisibleText: "done",
          agentMeta: {
            sessionId: "rcw5-disposable-session",
            provider: "anthropic",
            model: "fixture",
            usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
          },
        },
      };
    });

    await runAgentAttempt({
      providerOverride: "anthropic", originalProvider: "anthropic", modelOverride: "fixture", cfg,
      sessionEntry, sessionId: sessionEntry.sessionId, sessionKey, sessionAgentId: "main",
      lifecycleGeneration: "rcw5-fixture", sessionFile: path.join(root, "session.jsonl"),
      workspaceDir: root, body: "disposable fixture", isFallbackRetry: false, resolvedThinkLevel: "off",
      timeoutMs: 1_000, runId, opts: {} as never, runContext: {} as never,
      spawnedBy: undefined, messageChannel: undefined, skillsSnapshot: undefined,
      resolvedVerboseLevel: undefined, agentDir: root, onAgentEvent: vi.fn(),
      authProfileProvider: "anthropic", sessionStore: { [sessionKey]: sessionEntry }, storePath,
      sessionHasHistory: false,
    });
  }

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "rcw5-tool-surface-"));
    storePath = path.join(root, "sessions.json");
    sessionKey = `agent:main:subagent:rcw5:${crypto.randomUUID()}`;
    await seedSession(__RCW5_OVER_CAP__);
    setRuntimeConfigSnapshot(cfg);
    runEmbeddedAgentMock.mockReset();
    runCliAgentMock.mockReset();
  });

  afterEach(async () => {
    clearRuntimeConfigSnapshot();
    resetSystemEventsForTest();
    await fs.rm(root, { recursive: true, force: true });
  });

  it("rejects exhausted typed-tool elections without a durable continuation", async () => {
    await electThroughAttempt(
      [
        { reason: "R-CW-5 disposable first", delaySeconds: ELECTION_DELAY_SECONDS },
        { reason: "R-CW-5 disposable second", delaySeconds: ELECTION_DELAY_SECONDS },
      ],
      "rcw5-fixture-run",
    );

    // The custody store is this test's own, so no record anywhere is no
    // durable work at all, not merely none under this owner.
    expect(await listCustodyRecordsForTest({ ownerSessionKey: sessionKey })).toHaveLength(0);
    expect(await listCustodyRecordsForTest()).toHaveLength(0);
    expect(sessionEntry.continuationChainTokens).toBe(__RCW5_OVER_CAP__);
    expect(peekSystemEvents(sessionKey)).toContain(
      "[continuation] 2 of 2 continue_work elections were not scheduled (chain/cost/pending cap).",
    );
  });

  // Positive control: the same surface and observation do see durable work
  // when the chain is under the cap, so "no record" above is not vacuous.
  it("schedules a below-cap typed-tool election as one durable custody record", async () => {
    await seedSession(__RCW5_CAP__ - 1);
    await electThroughAttempt(
      [{ reason: "R-CW-5 disposable admitted", delaySeconds: ELECTION_DELAY_SECONDS }],
      "rcw5-fixture-run-admitted",
    );

    const records = await listCustodyRecordsForTest();
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ kind: "work", status: "queued", ownerSessionKey: sessionKey });
    expect(peekSystemEvents(sessionKey).join("\n")).not.toContain("were not scheduled");
    expect(peekSystemEvents(sessionKey).join("\n")).not.toContain("was not scheduled");
  });
});
