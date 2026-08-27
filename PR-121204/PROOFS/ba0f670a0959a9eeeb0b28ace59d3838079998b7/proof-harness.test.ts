import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { ChannelType, type APIMessage } from "discord-api-types/v10";
import {
  createChannelIngressDrain,
  type ChannelIngressQueue,
} from "openclaw/plugin-sdk/channel-outbound";
import {
  closeOpenClawStateDatabaseForTest,
  createChannelIngressQueueForTests,
} from "openclaw/plugin-sdk/plugin-state-test-runtime";
import type { RuntimeEnv } from "openclaw/plugin-sdk/runtime-env";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createDiscordIngressMonitor, type DiscordIngressLifecycle } from "./ingress.js";

const SOURCE_SHA = "3bf1ca1d211f4f303ca1bfec9e47daef8f4192f9";
const COMPOSITE_SHA = "6e6da7bba079b0fc50d134b96657cda683985837";
const FROZEN_NOW = Date.parse("2026-08-23T16:00:00.000Z");
const BOT_ID = "8100000000000000003";
const GUILD_ID = "8100000000000000001";
const CHANNEL_ID = "8100000000000000002";
const LANE_KEY = `channel:${CHANNEL_ID}`;

type DiscordIngressPayload = {
  version: 1;
  receivedAt: number;
  rawMessage: APIMessage;
  channelKind?: "non-thread" | "thread";
};

type CoreIngressPayload = {
  text: string;
  kind: "ambient" | "addressed";
};

function requireProofEnv(name: "PR121204_PROOF_NONCE" | "PR121204_PROOF_OUTPUT"): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function createMessage(
  id: string,
  content: string,
  timestamp: number,
  mentions: APIMessage["mentions"],
): APIMessage {
  return {
    id,
    channel_id: CHANNEL_ID,
    guild_id: GUILD_ID,
    channel_type: ChannelType.GuildText,
    content,
    author: {
      id: "8100000000000000004",
      username: "proof-operator",
      discriminator: "0",
      avatar: null,
    },
    attachments: [],
    embeds: [],
    mentions,
    mention_roles: [],
    mention_everyone: false,
    timestamp: new Date(timestamp).toISOString(),
    edited_timestamp: null,
    components: [],
    pinned: false,
    type: 0,
    tts: false,
  } as unknown as APIMessage;
}

function sqliteRows(stateDir: string) {
  const database = new DatabaseSync(path.join(stateDir, "state", "openclaw.sqlite"), {
    readOnly: true,
  });
  try {
    return database
      .prepare(
        `SELECT event_id, lane_key, status, attempts, received_at, updated_at,
                claimed_at, completed_at, failed_at, failed_reason,
                last_attempt_at, last_error
           FROM channel_ingress_events
          ORDER BY received_at, event_id`,
      )
      .all();
  } finally {
    database.close();
  }
}

async function writeReceipt(receipt: Record<string, unknown>): Promise<void> {
  const output = requireProofEnv("PR121204_PROOF_OUTPUT");
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(
    output,
    `${JSON.stringify(
      {
        schema: "openclaw.pr121204.exact-source-proof-row.v1",
        sourceSha: SOURCE_SHA,
        executionCompositeSha: COMPOSITE_SHA,
        seat: "rune",
        nonce: requireProofEnv("PR121204_PROOF_NONCE"),
        isolatedTestState: true,
        gatewayJournal: {
          emitted: false,
          reason: "The sanctioned test runner used an isolated temporary SQLite state directory.",
        },
        ...receipt,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

async function withState<T>(
  prefix: string,
  run: (stateDir: string) => Promise<T>,
): Promise<T> {
  const created = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  const stateDir = await fs.realpath(created);
  try {
    return await run(stateDir);
  } finally {
    closeOpenClawStateDatabaseForTest();
    await fs.rm(stateDir, { recursive: true, force: true });
  }
}

function createDiscordQueue(stateDir: string, now: () => number) {
  return createChannelIngressQueueForTests<DiscordIngressPayload>({
    channelId: "discord",
    accountId: "pr121204-proof",
    stateDir,
    now,
  });
}

function createMonitor(
  queue: ChannelIngressQueue<DiscordIngressPayload>,
  now: () => number,
  dispatched: string[],
) {
  const runtime: Pick<RuntimeEnv, "error" | "log"> = { error: vi.fn(), log: vi.fn() };
  return createDiscordIngressMonitor({
    accountId: "pr121204-proof",
    client: {} as never,
    runtime,
    botUserId: BOT_ID,
    guildEntries: {
      [GUILD_ID]: {
        channels: {
          [CHANNEL_ID]: { enabled: true, requireMention: false },
        },
      },
    },
    now,
    queue,
    dispatch: async (event: { id?: string }, lifecycle: DiscordIngressLifecycle) => {
      if (!event.id) {
        throw new Error("Expected a Discord ingress event id");
      }
      dispatched.push(event.id);
      await lifecycle.onAdopted();
    },
  });
}

describe("PR 121204 exact-source proof", () => {
  beforeAll(async () => {
    await import("openclaw/plugin-sdk/channel-inbound");
  });

  afterEach(() => {
    vi.useRealTimers();
    closeOpenClawStateDatabaseForTest();
  });

  it("row 1 stale direct-open ambient does not starve fresh mention", async () => {
    await withState("openclaw-pr121204-row1-", async (stateDir) => {
      const nonce = requireProofEnv("PR121204_PROOF_NONCE");
      const staleId = `${nonce}-stale`;
      const freshId = `${nonce}-fresh`;
      const queue = createDiscordQueue(stateDir, () => FROZEN_NOW);
      const stale = createMessage(staleId, "old ambient test text", FROZEN_NOW - 16 * 60_000, []);
      const fresh = createMessage(
        freshId,
        `fresh proof mention <@${BOT_ID}>`,
        FROZEN_NOW,
        [{ id: BOT_ID }] as APIMessage["mentions"],
      );
      await queue.enqueue(
        staleId,
        { version: 1, receivedAt: FROZEN_NOW, rawMessage: stale, channelKind: "non-thread" },
        { laneKey: LANE_KEY, receivedAt: FROZEN_NOW },
      );
      await queue.enqueue(
        freshId,
        { version: 1, receivedAt: FROZEN_NOW + 1, rawMessage: fresh, channelKind: "non-thread" },
        { laneKey: LANE_KEY, receivedAt: FROZEN_NOW + 1 },
      );
      const before = sqliteRows(stateDir);
      const dispatched: string[] = [];
      const monitor = createMonitor(queue, () => FROZEN_NOW, dispatched);
      monitor.start();
      try {
        await vi.waitFor(() => expect(dispatched).toEqual([freshId]));
        expect(await queue.listFailed?.({ limit: "all" })).toMatchObject([
          { id: staleId, reason: "stale-ambient-backlog" },
        ]);
      } finally {
        await monitor.stop();
      }
      const after = sqliteRows(stateDir);
      await writeReceipt({
        row: "stale-direct-open-ambient-vs-fresh-mention",
        observationWindowUtc: {
          start: new Date(FROZEN_NOW).toISOString(),
          end: new Date(FROZEN_NOW + 1).toISOString(),
        },
        before,
        after,
        ingressDispatches: dispatched,
        downstreamAgentExecution: {
          exercised: false,
          limit: "The real Discord durable ingress boundary was exercised; downstream agent execution was replaced by an adoption callback.",
        },
        verdict: "PASS",
        exactSourceIsolation: true,
      });
    });
  });

  it("row 2 corrupt pending does not starve fresh addressed event", async () => {
    await withState("openclaw-pr121204-row2-", async (stateDir) => {
      const nonce = requireProofEnv("PR121204_PROOF_NONCE");
      const corruptId = `${nonce}-corrupt`;
      const freshId = `${nonce}-fresh`;
      const queue = createDiscordQueue(stateDir, () => FROZEN_NOW);
      await queue.enqueue(corruptId, null as unknown as DiscordIngressPayload, {
        laneKey: LANE_KEY,
        receivedAt: FROZEN_NOW - 60 * 60_000,
      });
      const fresh = createMessage(
        freshId,
        `fresh addressed proof event <@${BOT_ID}>`,
        FROZEN_NOW,
        [{ id: BOT_ID }] as APIMessage["mentions"],
      );
      await queue.enqueue(
        freshId,
        { version: 1, receivedAt: FROZEN_NOW, rawMessage: fresh, channelKind: "non-thread" },
        { laneKey: LANE_KEY, receivedAt: FROZEN_NOW },
      );
      const before = sqliteRows(stateDir);
      const dispatched: string[] = [];
      const monitor = createMonitor(queue, () => FROZEN_NOW, dispatched);
      monitor.start();
      try {
        await vi.waitFor(() => expect(dispatched).toEqual([freshId]));
        expect(await queue.listFailed?.({ limit: "all" })).toMatchObject([
          { id: corruptId, reason: "invalid-event" },
        ]);
      } finally {
        await monitor.stop();
      }
      const after = sqliteRows(stateDir);
      await writeReceipt({
        row: "corrupt-pending-vs-fresh-addressed",
        observationWindowUtc: {
          start: new Date(FROZEN_NOW - 60 * 60_000).toISOString(),
          end: new Date(FROZEN_NOW).toISOString(),
        },
        before,
        after,
        ingressDispatches: dispatched,
        downstreamAgentExecution: {
          exercised: false,
          limit: "The real Discord durable ingress boundary was exercised; downstream agent execution was replaced by an adoption callback.",
        },
        verdict: "PASS",
        exactSourceIsolation: true,
      });
    });
  });

  it("row 3 watchdog recovers boundedly without completed-row replay", async () => {
    vi.useFakeTimers();
    await withState("openclaw-pr121204-row3-", async (stateDir) => {
      const nonce = requireProofEnv("PR121204_PROOF_NONCE");
      const stalledId = `${nonce}-stalled`;
      const followerId = `${nonce}-follower`;
      let clock = FROZEN_NOW;
      const queue = createChannelIngressQueueForTests<CoreIngressPayload>({
        channelId: "test",
        accountId: "pr121204-proof",
        stateDir,
        now: () => clock,
      });
      await queue.enqueue(
        stalledId,
        { text: "pre-adoption stall", kind: "addressed" },
        { laneKey: LANE_KEY, receivedAt: clock },
      );
      await queue.enqueue(
        followerId,
        { text: "same-lane follower", kind: "addressed" },
        { laneKey: LANE_KEY, receivedAt: clock + 1 },
      );
      const before = sqliteRows(stateDir);
      const dispatched: string[] = [];
      const drain = createChannelIngressDrain({
        queue,
        now: () => clock,
        adoptionStallTimeoutMs: 5_000,
        retryPolicy: { baseMs: 1_000, maxMs: 1_000 },
        dispatchClaimedEvent: async (event, lifecycle) => {
          dispatched.push(event.id);
          if (dispatched.length === 1) {
            await new Promise(() => {});
          }
          await lifecycle.onAdopted();
        },
      });
      await drain.drainOnce();
      clock += 5_000;
      await vi.advanceTimersByTimeAsync(5_000);
      await drain.waitForIdle();
      const afterWatchdog = sqliteRows(stateDir);

      expect(await drain.drainOnce()).toEqual({ started: 0 });
      clock += 1_000;
      expect(await drain.drainOnce()).toEqual({ started: 1 });
      await drain.waitForIdle();
      expect(await drain.drainOnce()).toEqual({ started: 1 });
      await drain.waitForIdle();
      expect(dispatched).toEqual([stalledId, stalledId, followerId]);
      const afterRecovery = sqliteRows(stateDir);

      await expect(
        queue.enqueue(stalledId, { text: "duplicate", kind: "addressed" }),
      ).resolves.toMatchObject({ kind: "completed" });
      expect(await drain.drainOnce()).toEqual({ started: 0 });
      await drain.waitForIdle();
      expect(dispatched).toEqual([stalledId, stalledId, followerId]);
      const afterReplayProbe = sqliteRows(stateDir);
      drain.dispose();

      await writeReceipt({
        row: "watchdog-bounded-recovery-no-completed-replay",
        observationWindowUtc: {
          start: new Date(FROZEN_NOW).toISOString(),
          end: new Date(clock).toISOString(),
        },
        before,
        afterWatchdog,
        afterRecovery,
        afterReplayProbe,
        ingressDispatches: dispatched,
        downstreamAgentExecution: {
          exercised: false,
          limit: "The core durable drain lifecycle was exercised; no downstream agent was invoked.",
        },
        verdict: "PASS-COMPOSITE-CONTEXT",
        exactSourceIsolation: false,
        exactSourceLimit:
          "The bounded retry path differs from accepted source SHA and entered the composite in replay commit c98224eefa5c05dc74727a645f634c5e0a583ec0.",
      });
    });
  });
});
