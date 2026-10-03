/**
 * Real-behaviour proof harness for openclaw/openclaw#121204.
 *
 * Drives the PRODUCTION Discord ingress boundary end to end, with no vitest and
 * no mocks of the modules under test, in two processes over one SQLite state dir:
 *
 *   R1 "outage": gateway frames arrive, the drain is not running
 *     raw MESSAGE_CREATE frame (APIMessage)
 *       -> createDiscordIngressMonitor(...).accept       (extensions/discord/src/monitor/ingress.ts;
 *            the exact function createDiscordMessageHandler wires)
 *         -> inspectDiscordMessage + payload codec       (production, inside ingress.ts)
 *           -> createChannelIngressMonitor.admit          (src/channels/message/ingress-monitor.ts)
 *             -> createChannelIngressQueue (real SQLite durable queue, temp state dir)
 *     The monitor is never started in R1, so every row is persisted `pending` and
 *     the process exits: that is the durable backlog a gateway recovery replays.
 *
 *   R2 "recovery": a fresh process over the same state dir
 *     -> new GatewayPlugin (extensions/discord/src/internal/gateway.ts), registered through
 *        the production gateway registry (monitor/gateway-registry.ts), fed READY and
 *        GUILD_CREATE through its own handleDispatch -> DiscordGatewayChannelInventory
 *     -> createDiscordLivePolicyReader (monitor/live-policy.ts) over a real OpenClawConfig;
 *        numeric guild/channel ids, so the production allowlist resolver makes no REST call
 *     -> createDiscordIngressMonitor with botUserId + readPolicy, exactly as
 *        createDiscordMessageHandler passes them; resolveChannelInfo and
 *        isChannelInventoryHydrating are NOT passed, so the production defaults
 *        (getGateway(accountId)?.getGatewayChannelInfo / isGatewayChannelInventoryHydrating) run
 *     -> accept one FRESH mention, then start the monitor: createChannelIngressDrain pumps,
 *        applyIngressPendingDispositions (src/channels/message/ingress-drain-pending-disposition.ts)
 *        runs createDiscordStaleAmbientPendingDisposition over the pending window,
 *        then claims per lane and calls deliver -> mapGatewayDispatchData -> params.dispatch.
 *
 * What is NOT production here (stated honestly):
 *   - no Discord WebSocket and no Discord REST: the GatewayPlugin's `client` is a
 *     two-method stub ({ dispatchGatewayEvent, getPlugin }) and READY / GUILD_CREATE
 *     payloads are synthetic frames handed to handleDispatch (the method the socket
 *     `message` handler calls); the live-policy reader gets a fetcher that throws
 *     (it is never called: numeric ids need no resolution);
 *   - `dispatch` is a stub at the seam createDiscordMessageHandler passes to the
 *     monitor (`dispatcher(event, client, { abortSignal, turnAdoptionLifecycle })`).
 *     It records the message and calls lifecycle.onAdopted(), which is what the
 *     production dispatcher does once the turn's session state is durable. No
 *     preflight, no agent turn, no model: "dispatched" below means "claimed from
 *     the durable queue and delivered to the dispatcher seam";
 *   - the Client passed to createDiscordIngressMonitor is `{}`; mapGatewayDispatchData
 *     only reads the raw frame for these fixtures (same as the PR's own boundary test);
 *   - message ids, guild/channel/user snowflakes and message bodies are synthetic.
 *
 * Usage:
 *   node --import <tree>/scripts/tsx.mjs discord-recovery-proof.mts \
 *        --tree <repo tree> --state <state dir> --phase R1|R2 [--ambient 20] [--timeout-ms 90000]
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { pathToFileURL } from "node:url";

type Args = { tree: string; state: string; phase: "R1" | "R2"; ambient: number; timeoutMs: number };

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const get = (flag: string) => {
    const index = argv.indexOf(flag);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  const tree = get("--tree");
  const state = get("--state");
  const phase = get("--phase") as Args["phase"] | undefined;
  if (!tree || !state || !phase || !["R1", "R2"].includes(phase)) {
    throw new Error("usage: --tree <repo> --state <dir> --phase R1|R2 [--ambient N] [--timeout-ms N]");
  }
  return {
    tree: path.resolve(tree),
    state: path.resolve(state),
    phase,
    ambient: Number(get("--ambient") ?? 20),
    timeoutMs: Number(get("--timeout-ms") ?? 90_000),
  };
}

const args = parseArgs();
const t0 = Date.now();
const log = (tag: string, message: string) => {
  const ms = String(Date.now() - t0).padStart(6, " ");
  console.log(`+${ms}ms [${tag}] ${message}`);
};

const mod = (rel: string) => import(pathToFileURL(path.join(args.tree, rel)).href);

// ---- tree identity + feature detection (no behaviour depends on it; it labels the log)
const treeSha = execFileSync("git", ["-C", args.tree, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const treeDirty = execFileSync("git", ["-C", args.tree, "status", "--porcelain"], { encoding: "utf8" })
  .trim()
  .split("\n")
  .filter(Boolean).length;
const treeHasStalePolicy = existsSync(
  path.join(args.tree, "extensions/discord/src/monitor/ingress-stale-policy.ts"),
);
const treeHasPendingDisposition = existsSync(
  path.join(args.tree, "src/channels/message/ingress-drain-pending-disposition.ts"),
);

// ---- production modules ------------------------------------------------------
const { createChannelIngressQueue } = await mod("src/channels/message/ingress-queue.ts");
const { createDiscordIngressMonitor } = await mod("extensions/discord/src/monitor/ingress.ts");
const { createDiscordLivePolicyReader } = await mod("extensions/discord/src/monitor/live-policy.ts");
const { GatewayPlugin } = await mod("extensions/discord/src/internal/gateway.ts");
const { registerGateway, getGateway } = await mod("extensions/discord/src/monitor/gateway-registry.ts");
const allowList = await mod("extensions/discord/src/monitor/allow-list.ts");

// ---- fixed synthetic identities ------------------------------------------------
// Numeric (snowflake-shaped) so the production allowlist resolver needs no REST.
const ACCOUNT_ID = "default";
const GUILD_ID = "100000000000000001";
const GATED_CHANNEL_ID = "200000000000000001"; // requireMention unset -> default true
const OPEN_CHANNEL_ID = "200000000000000002"; // requireMention: false (direct-open)
const BOT_USER_ID = "300000000000000001";
const HUMAN_USER_ID = "400000000000000001";
const LANE_LABEL: Record<string, string> = {
  [`channel:${GATED_CHANNEL_ID}`]: "channel:<gated>",
  [`channel:${OPEN_CHANNEL_ID}`]: "channel:<open>",
};
const laneLabel = (laneKey: string | null | undefined) =>
  (laneKey && LANE_LABEL[laneKey]) || String(laneKey);
const MIN = 60_000;

// One real OpenClawConfig: one guild, the direct-open channel configured
// `requireMention: false`, the gated channel left at the default.
const cfg = {
  channels: {
    discord: {
      enabled: true,
      token: "proof-token-not-a-credential",
      guilds: {
        [GUILD_ID]: {
          channels: {
            [OPEN_CHANNEL_ID]: { requireMention: false },
          },
        },
      },
    },
  },
};

// ---- raw MESSAGE_CREATE frame fixture (fields ingress + policy read; cf. the PR test)
function rawMessage(params: {
  id: string;
  channelId: string;
  content: string;
  sentAt: number;
  mentionBot?: boolean;
}) {
  return {
    id: params.id,
    channel_id: params.channelId,
    guild_id: GUILD_ID,
    content: params.content,
    author: { id: HUMAN_USER_ID, username: "member", discriminator: "0", avatar: null },
    attachments: [],
    embeds: [],
    mentions: params.mentionBot ? [{ id: BOT_USER_ID }] : [],
    mention_roles: [],
    mention_everyone: false,
    timestamp: new Date(params.sentAt).toISOString(),
    edited_timestamp: null,
    components: [],
    pinned: false,
    type: 0,
    tts: false,
  };
}

// ---- observation: raw SQLite projection -------------------------------------
function findSqlite(dir: string): string | undefined {
  if (!existsSync(dir)) {
    return undefined;
  }
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      const nested = findSqlite(full);
      if (nested) {
        return nested;
      }
    } else if (/\.(db|sqlite)$/u.test(name)) {
      return full;
    }
  }
  return undefined;
}

type RowProjection = {
  event_id: string;
  lane_key: string | null;
  status: string;
  attempts: number;
  last_error: string | null;
  failed_reason: string | null;
  received_at: number;
  updated_at: number;
};

function readRows(): RowProjection[] {
  const file = findSqlite(args.state);
  if (!file) {
    return [];
  }
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    return db
      .prepare(
        `SELECT event_id, lane_key, status, attempts, last_error, failed_reason, received_at, updated_at
           FROM channel_ingress_events
          WHERE channel_id = ? AND account_id = ?
          ORDER BY received_at ASC, rowid ASC`,
      )
      .all("discord", ACCOUNT_ID) as RowProjection[];
  } finally {
    db.close();
  }
}

function dumpRows(label: string) {
  const rows = readRows();
  if (rows.length === 0) {
    log("sqlite", `${label}: no rows for channel=discord account=${ACCOUNT_ID}`);
    return;
  }
  const counts: Record<string, number> = {};
  for (const row of rows) {
    counts[row.status] = (counts[row.status] ?? 0) + 1;
  }
  log("sqlite", `${label}: ${rows.length} rows, by status ${JSON.stringify(counts)}`);
  for (const row of rows) {
    log(
      "sqlite",
      `  {${row.event_id} lane=${laneLabel(row.lane_key)} status=${row.status} attempts=${row.attempts}` +
        ` failed_reason=${row.failed_reason ?? "null"} last_error=${row.last_error ? JSON.stringify(row.last_error) : "null"}}`,
    );
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ---- the real durable queue (what state.openChannelIngressQueue opens in production)
const queue = createChannelIngressQueue({
  channelId: "discord",
  accountId: ACCOUNT_ID,
  stateDir: args.state,
  now: () => Date.now(),
});

// ---- the dispatch stub at the createDiscordMessageHandler seam -----------------
const dispatched: Array<{ seq: number; id: string; lane: string; at: number }> = [];
const runtime = {
  log: (message: string) => log("runtime-log", String(message)),
  error: (message: string) => log("runtime-error", String(message)),
};

function createMonitor(extra: Record<string, unknown>) {
  return createDiscordIngressMonitor({
    accountId: ACCOUNT_ID,
    client: {},
    runtime,
    queue,
    ...extra,
    dispatch: async (event: any, lifecycle: any) => {
      const seq = dispatched.length + 1;
      const lane = laneLabel(`channel:${event.channel_id ?? event.channelId ?? "?"}`);
      dispatched.push({ seq, id: String(event.id), lane, at: Date.now() });
      log("dispatch", `#${seq} ${event.id} reached the dispatcher seam on ${lane}`);
      // Production: the dispatcher adopts once recovery-relevant session state is
      // durable; the drain then completes (tombstones) the SQLite claim.
      await lifecycle.onAdopted();
      log("dispatch", `#${seq} ${event.id} adopted -> ingress claim completed`);
    },
  });
}

log("env", `node ${process.version} phase=${args.phase}`);
log("env", `tree=${args.tree} sha=${treeSha} dirty=${treeDirty}`);
log(
  "env",
  `tree has ingress-stale-policy.ts=${treeHasStalePolicy} ingress-drain-pending-disposition.ts=${treeHasPendingDisposition}`,
);
log("env", `state=${args.state} ambient=${args.ambient}`);

// ============================================================================
if (args.phase === "R1") {
  // Outage: frames reach the Discord ingress monitor and are durably admitted,
  // but no drain runs (the monitor is never started) and the process exits.
  const T = Date.now();
  log("clock", `T=${new Date(T).toISOString()} (admission clock; every backlog frame is admitted now)`);
  const monitor = createMonitor({});
  const plan: Array<Parameters<typeof rawMessage>[0]> = [];
  for (let i = 1; i <= args.ambient; i += 1) {
    // Ambient chatter, T-60min .. T-22min, one every two minutes.
    plan.push({
      id: `amb-${String(i).padStart(2, "0")}`,
      channelId: GATED_CHANNEL_ID,
      content: `ambient chatter ${i}, nobody addressed the bot`,
      sentAt: T - 60 * MIN + (i - 1) * 2 * MIN,
    });
  }
  // An old mention of the bot in the gated channel (T-41min) and an old
  // unaddressed request in the direct-open channel (T-31min).
  plan.push({
    id: "old-mention",
    channelId: GATED_CHANNEL_ID,
    content: `<@${BOT_USER_ID}> old question asked during the outage`,
    sentAt: T - 41 * MIN,
    mentionBot: true,
  });
  plan.push({
    id: "open-request",
    channelId: OPEN_CHANNEL_ID,
    content: "unaddressed request in the direct-open channel",
    sentAt: T - 31 * MIN,
  });
  plan.sort((a, b) => a.sentAt - b.sentAt);
  for (const entry of plan) {
    await monitor.accept(rawMessage(entry));
    log(
      "ingress",
      `accept(${entry.id}) lane=${laneLabel(`channel:${entry.channelId}`)} sentAt=T${Math.round((entry.sentAt - T) / MIN)}min` +
        `${entry.mentionBot ? " mentions=bot" : ""} -> admitted (drain not running)`,
    );
  }
  dumpRows("end of R1 (outage): durable backlog, drain never ran");
  const pending = await queue.listPending({ limit: "all" });
  const verdict =
    pending.length === plan.length
      ? `R1: ${plan.length} frames durably pending (${args.ambient} ambient + old-mention + open-request); process exits without draining`
      : `R1: UNEXPECTED pending=${pending.length} (planned ${plan.length})`;
  log("verdict", verdict);
  process.exit(0);
}

// ============================================================================
// R2 recovery: a fresh gateway process over the same state dir.
{
  const T = Date.now();
  log("clock", `T=${new Date(T).toISOString()} (recovery clock)`);
  dumpRows("at recovery start (rows persisted by R1)");

  // 1. The gateway comes up: a real GatewayPlugin in the production registry,
  //    fed READY then GUILD_CREATE through handleDispatch (what the socket
  //    `message` handler calls). The client is a two-method stub; no socket.
  const gateway = new GatewayPlugin({ autoInteractions: false });
  (gateway as any).client = {
    dispatchGatewayEvent: async () => {},
    getPlugin: () => undefined,
  };
  const handleDispatch = (t: string, d: unknown) => (gateway as any).handleDispatch({ t, d });
  registerGateway(ACCOUNT_ID, gateway);
  log(
    "gateway",
    `GatewayPlugin registered for account; getGatewayChannelInfo=${typeof (gateway as any).getGatewayChannelInfo} isGatewayChannelInventoryHydrating=${typeof (gateway as any).isGatewayChannelInventoryHydrating}`,
  );
  await handleDispatch("READY", { session_id: "proof-session", guilds: [{ id: GUILD_ID, unavailable: true }] });
  log(
    "gateway",
    `READY dispatched (1 guild announced) isConnected=${(gateway as any).isConnected} hydrating(guild)=${(gateway as any).isGatewayChannelInventoryHydrating?.(GUILD_ID)}`,
  );
  await handleDispatch("GUILD_CREATE", {
    id: GUILD_ID,
    voice_states: [],
    channels: [
      { id: GATED_CHANNEL_ID, name: "general", type: 0 },
      { id: OPEN_CHANNEL_ID, name: "concierge", type: 0 },
    ],
    threads: [],
  });
  const registered = getGateway(ACCOUNT_ID);
  log(
    "gateway",
    `GUILD_CREATE dispatched (2 text channels) hydrating(guild)=${registered?.isGatewayChannelInventoryHydrating?.(GUILD_ID)}` +
      ` inventory[<gated>]=${JSON.stringify(registered?.getGatewayChannelInfo?.(GATED_CHANNEL_ID) ?? null)}` +
      ` inventory[<open>]=${JSON.stringify(registered?.getGatewayChannelInfo?.(OPEN_CHANNEL_ID) ?? null)}`,
  );

  // 2. The production live-policy reader over the real config. The fetcher
  //    throws so any REST attempt would be visible in the log; numeric ids
  //    mean the allowlist resolver never calls it.
  let fetchCalls = 0;
  const readPolicy = createDiscordLivePolicyReader({
    cfg,
    readConfig: () => cfg,
    accountId: ACCOUNT_ID,
    token: cfg.channels.discord.token,
    runtime: { ...runtime, exit: () => {} },
    discordRestFetch: async () => {
      fetchCalls += 1;
      throw new Error("proof: no network");
    },
  });
  const policy = await readPolicy();
  const guildInfo = allowList.resolveDiscordGuildEntry({ guildId: GUILD_ID, guildEntries: policy.guildEntries });
  const requireMentionFor = (channelId: string, name: string) =>
    allowList.resolveDiscordShouldRequireMention({
      isGuildMessage: true,
      isThread: false,
      channelConfig: allowList.resolveDiscordChannelConfigWithFallback({
        guildInfo,
        channelId,
        channelName: name,
        channelSlug: name,
        scope: "channel",
      }),
      guildInfo,
      isAutoThreadOwnedByBot: false,
    });
  log(
    "policy",
    `live policy read: isCurrent=${policy.isCurrent()} guildEntries=${JSON.stringify(policy.guildEntries)} restFetchCalls=${fetchCalls}`,
  );
  log(
    "policy",
    `resolveDiscordShouldRequireMention: <gated>=${requireMentionFor(GATED_CHANNEL_ID, "general")} <open>=${requireMentionFor(OPEN_CHANNEL_ID, "concierge")}`,
  );

  // 3. The Discord ingress monitor, wired as createDiscordMessageHandler wires it.
  //    On a tree without the PR, botUserId/readPolicy are unknown params and are ignored.
  const monitor = createMonitor({ botUserId: BOT_USER_ID, readPolicy });

  // 4. A fresh mention arrives before the first drain pass (recovery replay).
  await monitor.accept(
    rawMessage({
      id: "fresh-mention",
      channelId: GATED_CHANNEL_ID,
      content: `<@${BOT_USER_ID}> are you back?`,
      sentAt: T,
      mentionBot: true,
    }),
  );
  log("ingress", `accept(fresh-mention) lane=channel:<gated> sentAt=T-0 mentions=bot -> admitted`);
  dumpRows("before drain start");

  // 5. Drain.
  monitor.start();
  log("drain", "monitor started (production drain, pollIntervalMs=1000 as ingress.ts sets)");
  const deadline = Date.now() + args.timeoutMs;
  let lastSnapshot = "";
  while (Date.now() < deadline) {
    await sleep(100);
    const pending = await queue.listPending({ limit: "all" });
    const claims = await queue.listClaims();
    const failed = (await queue.listFailed?.({ limit: "all" })) ?? [];
    const snapshot = `pending=${pending.length} claims=${claims.length} failed=${failed.length} dispatched=${dispatched.length}`;
    if (snapshot !== lastSnapshot) {
      log("queue", snapshot);
      lastSnapshot = snapshot;
    }
    if (pending.length === 0 && claims.length === 0) {
      break;
    }
  }
  await monitor.stop();
  log("drain", `monitor stopped after ${Date.now() - T}ms`);
  dumpRows("end of R2 (recovery)");

  // 6. Verdict, computed from the final SQLite projection + the dispatch record.
  const rows = readRows();
  const byId = new Map(rows.map((row) => [row.event_id, row]));
  const ambientIds = rows.map((r) => r.event_id).filter((id) => id.startsWith("amb-"));
  const ambientFailedStale = ambientIds.filter(
    (id) => byId.get(id)?.status === "failed" && byId.get(id)?.failed_reason === "stale-ambient-backlog",
  );
  const ambientDispatched = dispatched.filter((d) => d.id.startsWith("amb-")).length;
  const order = dispatched.map((d) => d.id);
  const freshPos = order.indexOf("fresh-mention") + 1;
  const status = (id: string) => byId.get(id)?.status ?? "missing";
  log("result", `dispatch order: ${order.join(" -> ") || "(none)"}`);
  log(
    "result",
    `ambient rows: ${ambientIds.length} total, failed(stale-ambient-backlog)=${ambientFailedStale.length}, dispatched=${ambientDispatched}`,
  );
  log(
    "result",
    `old-mention=${status("old-mention")} open-request=${status("open-request")} fresh-mention=${status("fresh-mention")}` +
      ` restFetchCalls=${fetchCalls} pendingLeft=${rows.filter((r) => r.status === "pending").length}`,
  );
  const verdict =
    freshPos > 0
      ? `R2: fresh-mention dispatched at position ${freshPos} of ${dispatched.length} (${freshPos - 1} rows before it);` +
        ` ambient failed stale-ambient-backlog=${ambientFailedStale.length}/${ambientIds.length}, ambient dispatched=${ambientDispatched};` +
        ` old-mention=${status("old-mention")}, open-request=${status("open-request")}, fresh-mention=${status("fresh-mention")}`
      : `R2: fresh-mention NEVER dispatched within ${args.timeoutMs}ms; dispatched=${dispatched.length} pendingLeft=${rows.filter((r) => r.status === "pending").length}`;
  log("verdict", verdict);
  process.exit(0);
}
