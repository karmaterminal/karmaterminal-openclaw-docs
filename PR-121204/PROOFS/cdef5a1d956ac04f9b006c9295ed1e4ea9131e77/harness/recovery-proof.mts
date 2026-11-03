/**
 * Real-transport recovery proof for openclaw/openclaw#121204.
 *
 * Runs the PRODUCTION Discord monitor composition from the tree under test
 * (`--tree`) against a local mock Discord (mock-discord.mts): the production
 * REST client and Gateway plugin reach it over real loopback HTTP and a real
 * WebSocket through DISCORD_API_URL, the production endpoint override.
 * Production preflight runs at claim time; the agent turn after preflight is a
 * stand-in that adopts through the production lifecycle (see METHOD.md).
 *
 *   phase A (outage, wedged drain): the gateway connects (HELLO, IDENTIFY,
 *     READY, GUILD_CREATE) and delivers the backlog as MESSAGE_CREATE frames;
 *     the production listener -> message handler -> Discord ingress monitor
 *     admits each one durably to SQLite, but the drain is not started (the one
 *     declared testing hook `createIngressMonitor` wraps the production monitor
 *     with a no-op start). The process then shuts down cleanly.
 *   phase B (recovery): a fresh process over the same state dir runs the
 *     unmodified composition (drain on); after READY + GUILD_CREATE the gateway
 *     delivers a fresh @mention. Every row then goes through the production
 *     drain, pending-disposition pass (head: the stale policy), claim,
 *     production preflight (with REST hydration / reply re-fetch against the
 *     mock) and, when preflight admits it, the turn stand-in.
 *
 * Scenarios: `recovery` (A/B above), `edit-decide` and `edit-commit` (a mention
 * pattern config edit published mid-recovery: while the stale policy decides,
 * or after it returned and before the fail commits).
 *
 * Usage:
 *   node --import <tree>/scripts/tsx.mjs recovery-proof.mts --tree <tree> --run <dir> \
 *        --phase A|B --scenario recovery|edit-decide|edit-commit [--timeout-ms 120000]
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { pathToFileURL } from "node:url";
import { startMockDiscord } from "./mock-discord.mts";

type Scenario = "recovery" | "edit-decide" | "edit-commit";
const argv = process.argv.slice(2);
const arg = (flag: string) => {
  const index = argv.indexOf(flag);
  return index >= 0 ? argv[index + 1] : undefined;
};
const TREE = path.resolve(arg("--tree") ?? "");
const RUN = path.resolve(arg("--run") ?? "");
const PHASE = arg("--phase") as "A" | "B";
const SCENARIO = (arg("--scenario") ?? "recovery") as Scenario;
const TIMEOUT_MS = Number(arg("--timeout-ms") ?? 120_000);
if (!arg("--tree") || !arg("--run") || !["A", "B"].includes(PHASE)) {
  throw new Error("usage: --tree <repo> --run <dir> --phase A|B --scenario <name>");
}

// ---- synthetic identities (obviously fake snowflakes) -------------------------
const ACCOUNT_ID = "default";
const GUILD_ID = "100000000000000001";
const GATED = "200000000000000001"; // mention-gated (default requireMention)
const BOT_ID = "300000000000000001";
const HUMAN = "400000000000000001";
const HUMAN_2 = "400000000000000002";
const MIN = 60_000;
const LABELS: Array<[string, string]> = [
  [GUILD_ID, "<guild>"],
  [GATED, "<gated>"],
  [BOT_ID, "<bot>"],
  [HUMAN, "<human>"],
  [HUMAN_2, "<human-2>"],
];
const ids = new Map<string, string>(); // snowflake -> message label
const label = (text: string) => {
  let out = text;
  for (const [id, name] of ids) {
    out = out.split(id).join(name);
  }
  for (const [id, name] of LABELS) {
    out = out.split(id).join(name);
  }
  return out.split(RUN).join("<run>").split(TREE).join("<tree>");
};
const t0 = Date.now();
const log = (tag: string, message: string) =>
  console.log(`+${String(Date.now() - t0).padStart(6, " ")}ms [${tag}] ${label(message)}`);

// ---- run layout + process environment (set before any production import) -----
const STATE = path.join(RUN, "state");
for (const dir of [STATE, path.join(RUN, "home"), path.join(RUN, "tmp")]) {
  mkdirSync(dir, { recursive: true });
}
const clockFile = path.join(RUN, "T.json");
if (PHASE === "A") {
  writeFileSync(clockFile, JSON.stringify({ T: Date.now() }));
}
const T = (JSON.parse(readFileSync(clockFile, "utf8")) as { T: number }).T;

// ---- fixtures ------------------------------------------------------------------
const user = (id: string, username: string, bot = false) => ({
  id,
  username,
  discriminator: "0",
  global_name: null,
  avatar: null,
  ...(bot ? { bot: true } : {}),
});
const BOT_USER = user(BOT_ID, "proofbot", true);
const HUMAN_USER = user(HUMAN, "member");
const HUMAN_2_USER = user(HUMAN_2, "member-two");
let nextId = 500000000000000001n;
const snowflake = (name: string) => {
  const id = String(nextId++);
  ids.set(id, name);
  return id;
};
const frame = (params: {
  id: string;
  content: string;
  sentAt: number;
  author?: ReturnType<typeof user>;
  mentions?: Array<ReturnType<typeof user>>;
  extra?: Record<string, unknown>;
}) => ({
  id: params.id,
  type: 0,
  channel_id: GATED,
  guild_id: GUILD_ID,
  content: params.content,
  author: params.author ?? HUMAN_USER,
  member: { roles: [], joined_at: new Date(T - 365 * 24 * 60 * MIN).toISOString() },
  attachments: [],
  embeds: [],
  components: [],
  mentions: params.mentions ?? [],
  mention_roles: [],
  mention_everyone: false,
  pinned: false,
  tts: false,
  timestamp: new Date(params.sentAt).toISOString(),
  edited_timestamp: null,
  ...params.extra,
});

type Planned = { name: string; frame: Record<string, unknown>; expect: string };
const backlog: Planned[] = [];
const restMessages = new Map<string, Record<string, unknown>>();
const AMBIENT = 20;
if (SCENARIO === "recovery") {
  for (let i = 1; i <= AMBIENT; i += 1) {
    const name = `amb-${String(i).padStart(2, "0")}`;
    backlog.push({
      name,
      expect: "ambient",
      frame: frame({
        id: snowflake(name),
        content: `ambient chatter ${i}, nobody addressed the bot`,
        sentAt: T - 60 * MIN + (i - 1) * 2 * MIN,
      }),
    });
  }
  // An old native @mention, a no-ping reply to the bot whose nested target is
  // canonical, a reply whose nested target arrived without a body (preflight
  // re-fetches it; REST names the bot), and a raw <@bot> whose frame lacks
  // mention metadata (preflight hydrates it over REST).
  backlog.push({
    name: "old-mention",
    expect: "addressed",
    frame: frame({
      id: snowflake("old-mention"),
      content: `<@${BOT_ID}> old question asked during the outage`,
      sentAt: T - 41 * MIN,
      mentions: [BOT_USER],
    }),
  });
  const answer1 = snowflake("bot-answer-1");
  const answer1Frame = frame({
    id: answer1,
    content: "earlier answer from the bot",
    sentAt: T - 70 * MIN,
    author: BOT_USER,
  });
  restMessages.set(answer1, answer1Frame);
  backlog.push({
    name: "reply-canonical",
    expect: "addressed",
    frame: frame({
      id: snowflake("reply-canonical"),
      content: "thanks, and what about the second step?",
      sentAt: T - 35 * MIN,
      extra: {
        type: 19,
        message_reference: { type: 0, message_id: answer1, channel_id: GATED, guild_id: GUILD_ID },
        referenced_message: answer1Frame,
      },
    }),
  });
  const answer2 = snowflake("bot-answer-2");
  restMessages.set(
    answer2,
    frame({ id: answer2, content: "another earlier answer", sentAt: T - 69 * MIN, author: BOT_USER }),
  );
  backlog.push({
    name: "reply-refetch",
    expect: "addressed",
    frame: frame({
      id: snowflake("reply-refetch"),
      content: "that one does not work for me",
      sentAt: T - 33 * MIN,
      extra: {
        type: 19,
        message_reference: { type: 0, message_id: answer2, channel_id: GATED, guild_id: GUILD_ID },
        // Nested target without a body: preflight re-fetches it over REST.
        referenced_message: {
          id: answer2,
          channel_id: GATED,
          content: "",
          author: HUMAN_2_USER,
          attachments: [],
          embeds: [],
          mentions: [],
          timestamp: new Date(T - 69 * MIN).toISOString(),
          type: 0,
        },
      },
    }),
  });
  const rawId = snowflake("raw-hydrate");
  const rawFull = frame({
    id: rawId,
    content: `<@${BOT_ID}> did the deploy finish?`,
    sentAt: T - 30 * MIN,
    mentions: [BOT_USER],
  });
  restMessages.set(rawId, rawFull);
  backlog.push({
    name: "raw-hydrate",
    expect: "addressed",
    frame: { ...rawFull, mentions: [] },
  });
} else {
  // Mention-pattern edit scenarios: "helper" is not a configured pattern until
  // the edit lands mid-recovery. helper-1 heads the lane so it is decided first.
  const helpers = [
    ["helper-1", 62],
    ["helper-2", 45],
    ["helper-3", 29],
  ] as const;
  for (const [name, ago] of helpers) {
    backlog.push({
      name,
      expect: "addressed-after-edit",
      frame: frame({
        id: snowflake(name),
        content: "helper, can you take a look at the build?",
        sentAt: T - ago * MIN,
        author: HUMAN_2_USER,
      }),
    });
  }
  for (let i = 1; i <= AMBIENT; i += 1) {
    const name = `amb-${String(i).padStart(2, "0")}`;
    backlog.push({
      name,
      expect: "ambient",
      frame: frame({
        id: snowflake(name),
        content: `ambient chatter ${i}, nobody addressed the bot`,
        sentAt: T - 60 * MIN + (i - 1) * 2 * MIN,
      }),
    });
  }
}
backlog.sort((a, b) => Date.parse(String(a.frame.timestamp)) - Date.parse(String(b.frame.timestamp)));
const freshId = snowflake("fresh-mention");

// ---- mock Discord (separate loopback server; not OpenClaw code) ---------------
const requireFromDiscord = createRequire(path.join(TREE, "extensions/discord/package.json"));
const mock = await startMockDiscord({
  ws: requireFromDiscord("ws"),
  log,
  label,
  botUser: BOT_USER,
  guild: {
    id: GUILD_ID,
    name: "proof-guild",
    channels: [{ id: GATED, name: "general", type: 0, position: 0, guild_id: GUILD_ID }],
  },
  messages: restMessages,
});

const baseCfg = {
  channels: {
    discord: {
      enabled: true,
      token: "proof-token-not-a-credential",
      groupPolicy: "open",
    },
  },
  agents: { list: [{ id: "main", default: true }] },
  logging: { file: path.join(RUN, `openclaw-${PHASE}.log`), level: "debug" },
};
const editedCfg = {
  ...baseCfg,
  messages: { groupChat: { mentionPatterns: ["\\bhelper\\b"] } },
};
writeFileSync(path.join(RUN, "openclaw.json"), JSON.stringify(baseCfg, null, 2));
Object.assign(process.env, {
  HOME: path.join(RUN, "home"),
  TMPDIR: path.join(RUN, "tmp"),
  OPENCLAW_STATE_DIR: STATE,
  OPENCLAW_CONFIG_PATH: path.join(RUN, "openclaw.json"),
  OPENCLAW_PROFILE: "proof121204",
  DISCORD_API_URL: mock.apiUrl,
});

// ---- production modules from the tree under test -------------------------------
const mod = (rel: string) => import(pathToFileURL(path.join(TREE, rel)).href);
const treeSha = execFileSync("git", ["-C", TREE, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const treeDirty = execFileSync("git", ["-C", TREE, "status", "--porcelain"], { encoding: "utf8" })
  .split("\n")
  .filter(Boolean).length;
log("env", `node ${process.version} phase=${PHASE} scenario=${SCENARIO}`);
log("env", `tree sha=${treeSha} dirty=${treeDirty}`);
log(
  "env",
  `tree has ingress-stale-policy.ts=${existsSync(path.join(TREE, "extensions/discord/src/monitor/ingress-stale-policy.ts"))}`,
);
log("env", `DISCORD_API_URL=${mock.apiUrl} (loopback mock) state=${STATE}`);
log("clock", `T=${new Date(T).toISOString()} now=T+${Math.round((Date.now() - T) / 1000)}s`);

const { createChannelIngressQueue } = await mod("src/channels/message/ingress-queue.ts");
const { GatewayScheduler } = await mod("src/infra/gateway-scheduler.ts");
const { createPluginServiceScheduler } = await mod("src/plugins/service-scheduler.ts");
const { setDiscordRuntime } = await mod("extensions/discord/src/runtime.ts");
const startup = await mod("extensions/discord/src/monitor/provider.startup.ts");
const { discordProviderRuntime } = await mod("extensions/discord/src/monitor/provider-runtime.ts");
const sessionRuntime = await mod("extensions/discord/src/monitor/provider-session.runtime.ts");
const { createDiscordLivePolicyReader } = await mod("extensions/discord/src/monitor/live-policy.ts");
const { createDiscordIngressMonitor } = await mod("extensions/discord/src/monitor/ingress.ts");
const { getGateway } = await mod("extensions/discord/src/monitor/gateway-registry.ts");
const { createRuntimeChannel } = await mod("src/plugins/runtime/runtime-channel.ts");

// ---- the plugin runtime surface Discord ingress + preflight read ------------------
// `channel` is the production createRuntimeChannel() (src/plugins/runtime/runtime-channel.ts).
// Production binds state.openChannelIngressQueue in src/plugins/registry-runtime.ts
// to createChannelIngressQueue({ ...options, channelId: pluginId, stateDir }).
// Every other access is logged and refused so METHOD.md can list it exactly.
const runtimeChannel = createRuntimeChannel();
let failInterceptor: ((id: string) => void) | undefined;
const openQueue = (options?: Record<string, unknown>) => {
  const queue = createChannelIngressQueue({
    ...options,
    channelId: "discord",
    stateDir: (options?.stateDir as string | undefined) ?? STATE,
  });
  const fail = queue.fail.bind(queue);
  queue.fail = async (value: unknown, failOptions: Record<string, unknown>) => {
    const id = typeof value === "string" ? value : String((value as { id: string }).id);
    failInterceptor?.(id);
    const committed = await fail(value, failOptions);
    log(
      "queue",
      `fail(${id}, reason=${String(failOptions.reason)}${typeof failOptions.isCurrent === "function" ? ", guard" : ""}) -> ${committed ? "committed" : "not committed"}`,
    );
    return committed;
  };
  return queue;
};
const refused = (pathName: string): any =>
  new Proxy(() => {}, {
    get: (_target, key) => {
      if (key === "then") {
        return undefined;
      }
      const next = `${pathName}.${String(key)}`;
      log("runtime", `access ${next} (not provided)`);
      return refused(next);
    },
    apply: () => {
      throw new Error(`proof runtime: ${pathName}() is not provided`);
    },
  });
setDiscordRuntime(
  new Proxy(
    { channel: runtimeChannel, state: new Proxy({ openChannelIngressQueue: openQueue }, {
      get: (target, key) => (key in target ? (target as any)[key] : refused(`state.${String(key)}`)),
    }) },
    { get: (target, key) => (key in target ? (target as any)[key] : refused(String(key))) },
  ),
);

// ---- config + live policy (provider.ts wiring) ------------------------------------
let currentCfg: Record<string, unknown> = baseCfg;
const readConfig = () => currentCfg;
const runtime = {
  log: (message: unknown) => log("runtime-log", String(message)),
  error: (message: unknown) => log("runtime-error", String(message)),
  exit: () => {},
};
const reader = createDiscordLivePolicyReader({
  cfg: baseCfg,
  readConfig,
  accountId: ACCOUNT_ID,
  discordConfig: baseCfg.channels.discord,
  token: baseCfg.channels.discord.token,
  runtime,
  resolvedAllowlist: { guildEntries: undefined, allowFrom: [] },
});
let editArmed = false;
let edited = false;
const publishEdit = (where: string) => {
  if (edited) {
    return;
  }
  edited = true;
  currentCfg = editedCfg;
  writeFileSync(path.join(RUN, "openclaw.json"), JSON.stringify(editedCfg, null, 2));
  log("config", `EDIT published ${where}: messages.groupChat.mentionPatterns=["\\\\bhelper\\\\b"]`);
};
const readPolicy = async () => {
  const policy = await reader();
  if (PHASE === "B" && SCENARIO === "edit-decide" && editArmed && !edited) {
    // Land the edit right after the stale policy took its snapshot (so the
    // verdict is computed on the old config); on a tree without the policy,
    // the first read after hydration.
    const caller = new Error().stack ?? "";
    if (caller.includes("ingress-stale-policy") || !existsSync(path.join(TREE, "extensions/discord/src/monitor/ingress-stale-policy.ts"))) {
      publishEdit("after the stale policy read its snapshot, before its verdict");
    }
  }
  return policy;
};
if (PHASE === "B" && SCENARIO === "edit-commit") {
  failInterceptor = (id) => {
    if (editArmed && !edited) {
      publishEdit(`after the stale policy returned fail(${id}), before the fail commit`);
    }
  };
}

// ---- turn stand-in (the declared testing hook after production preflight) ------
const turns: Array<{ seq: number; name: string; wasMentioned: unknown; at: number }> = [];
const processDiscordMessage = async (ctx: any) => {
  const name = ids.get(String(ctx.message?.id)) ?? String(ctx.message?.id);
  const seq = turns.length + 1;
  turns.push({ seq, name, wasMentioned: ctx.effectiveWasMentioned ?? ctx.wasMentioned, at: Date.now() });
  log(
    "turn",
    `#${seq} ${name} admitted by production preflight (wasMentioned=${String(ctx.wasMentioned)} effectiveWasMentioned=${String(ctx.effectiveWasMentioned)} inboundEventKind=${String(ctx.inboundEventKind)} sender=${ctx.author?.id})`,
  );
  // Production adopts here through bindIngressLifecycleToReplyOptions in the reply pipeline.
  await ctx.turnAdoptionLifecycle?.onAdopted?.();
  log("turn", `#${seq} ${name} adopted (stand-in turn; no model)`);
};

// ---- sqlite projection ------------------------------------------------------------
// The production state database under OPENCLAW_STATE_DIR (src/state/openclaw-state-db.ts).
const SQLITE_FILE = path.join(STATE, "state", "openclaw.sqlite");
type Row = {
  event_id: string;
  status: string;
  updated_at: number;
  attempts: number;
  failed_reason: string | null;
  last_error: string | null;
};
function readRows(): Row[] {
  const file = SQLITE_FILE;
  if (!existsSync(file)) {
    return [];
  }
  // A read-only observer: waits out the production writer's lock (busy timeout).
  const db = new DatabaseSync(file, { readOnly: true, timeout: 10_000 });
  try {
    const hasTable = db
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'channel_ingress_events'")
      .get();
    if (!hasTable) {
      return [];
    }
    return db
      .prepare(
        `SELECT event_id, status, updated_at, attempts, failed_reason, last_error FROM channel_ingress_events
          WHERE channel_id = 'discord' AND account_id = ? ORDER BY received_at ASC, rowid ASC`,
      )
      .all(ACCOUNT_ID) as Row[];
  } finally {
    db.close();
  }
}
function dumpRows(title: string) {
  const rows = readRows();
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const key = row.failed_reason ? `${row.status}:${row.failed_reason}` : row.status;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  log("sqlite", `${title}: ${rows.length} rows ${JSON.stringify(counts)}`);
  for (const row of rows) {
    log(
      "sqlite",
      `  {${ids.get(row.event_id) ?? row.event_id} status=${row.status} attempts=${row.attempts} failed_reason=${row.failed_reason ?? "null"} last_error=${row.last_error ? JSON.stringify(row.last_error) : "null"}}`,
    );
  }
  return rows;
}
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ---- the provider composition (monitorDiscordProvider minus commands/voice/ACP) ---
const abort = new AbortController();
const gatewayScheduler = new GatewayScheduler();
const schedulerOwner = createPluginServiceScheduler(gatewayScheduler);
const { client, gateway, gatewaySupervisor, autoPresenceController } =
  await startup.createDiscordMonitorClient({
    scheduler: schedulerOwner.scheduler,
    accountId: ACCOUNT_ID,
    applicationId: BOT_ID,
    token: baseCfg.channels.discord.token,
    commands: [],
    components: [],
    modals: [],
    voiceEnabled: false,
    discordConfig: baseCfg.channels.discord,
    runtime,
    createClient: discordProviderRuntime.createClient,
    isDisallowedIntentsError: () => false,
  });
const { botUserId } = await startup.fetchDiscordBotIdentity({
  client,
  token: baseCfg.channels.discord.token,
  runtime,
  logStartupPhase: (phase: string, details?: string) =>
    log("startup", `${phase}${details ? ` ${details}` : ""}`),
});
const threadBindings = sessionRuntime.createNoopThreadBindingManager(ACCOUNT_ID);
const messageHandler = sessionRuntime.createDiscordMessageHandler({
  readPolicy,
  client,
  cfg: baseCfg,
  discordConfig: baseCfg.channels.discord,
  accountId: ACCOUNT_ID,
  token: baseCfg.channels.discord.token,
  runtime,
  buildContext: runtimeChannel.inbound.buildContext,
  abortSignal: abort.signal,
  botUserId,
  guildHistories: new Map(),
  historyLimit: 20,
  mediaMaxBytes: 100 * 1024 * 1024,
  textLimit: 2000,
  replyToMode: "off",
  dmEnabled: true,
  dmPolicy: "pairing",
  groupDmEnabled: false,
  groupDmChannels: [],
  allowFrom: [],
  guildEntries: undefined,
  threadBindings,
  testing: {
    processDiscordMessage,
    ...(PHASE === "A"
      ? {
          // Outage: frames are admitted durably but the drain never runs.
          createIngressMonitor: (params: any) => {
            const monitor = createDiscordIngressMonitor(params);
            return new Proxy(monitor, {
              get: (target, key) =>
                key === "start"
                  ? () => log("drain", "start() suppressed: drain wedged for the outage")
                  : Reflect.get(target, key),
            });
          },
        }
      : {}),
  },
});
const stopListeners = startup.registerDiscordMonitorListeners({
  readPolicy,
  cfg: baseCfg,
  client,
  accountId: ACCOUNT_ID,
  discordConfig: baseCfg.channels.discord,
  runtime,
  botUserId,
  dmEnabled: true,
  groupDmEnabled: false,
  groupDmChannels: [],
  dmPolicy: "pairing",
  allowFrom: [],
  groupPolicy: "open",
  guildEntries: undefined,
  logger: {
    info: (...a: unknown[]) => log("listener", a.map(String).join(" ")),
    warn: (...a: unknown[]) => log("listener-warn", a.map(String).join(" ")),
    error: (...a: unknown[]) => log("listener-error", a.map(String).join(" ")),
    debug: () => {},
  } as any,
  messageHandler,
});
const lifecycle = discordProviderRuntime
  .runDiscordGatewayLifecycle({
    accountId: ACCOUNT_ID,
    gateway,
    runtime,
    abortSignal: abort.signal,
    isDisallowedIntentsError: () => false,
    voiceManager: null,
    voiceManagerRef: { current: null },
    threadBindings,
    gatewaySupervisor,
  })
  .catch((error: unknown) => log("lifecycle", `ended: ${String(error)}`));
log("startup", `composition up: botUserId=${botUserId} (from GET /users/@me)`);

await mock.ready;
const deadline = Date.now() + TIMEOUT_MS;
while (Date.now() < deadline) {
  const registered = getGateway(ACCOUNT_ID);
  const hydrating = registered?.isGatewayChannelInventoryHydrating?.(GUILD_ID);
  if (registered?.isConnected && hydrating !== true) {
    log(
      "gateway",
      `registered=${Boolean(registered)} connected=${registered.isConnected} hydrating(<guild>)=${String(hydrating)} inventory[<gated>]=${JSON.stringify(registered.getGatewayChannelInfo?.(GATED) ?? null)}`,
    );
    break;
  }
  await sleep(20);
}

async function shutdown(code: number) {
  abort.abort();
  await messageHandler.deactivate();
  await stopListeners();
  autoPresenceController?.stop?.();
  gateway?.disconnect?.();
  await lifecycle;
  await mock.close();
  process.exit(code);
}

// ============================================================================
if (PHASE === "A") {
  for (const entry of backlog) {
    mock.dispatch("MESSAGE_CREATE", entry.frame);
    log(
      "discord-gateway",
      `-> MESSAGE_CREATE ${entry.name} sentAt=T${Math.round((Date.parse(String(entry.frame.timestamp)) - T) / MIN)}min mentions=${(entry.frame.mentions as unknown[]).length}${entry.frame.type === 19 ? " reply" : ""}`,
    );
  }
  while (Date.now() < deadline && readRows().length < backlog.length) {
    await sleep(50);
  }
  dumpRows("end of A (outage): durable backlog admitted over the gateway, drain wedged");
  log("verdict", `A: ${readRows().filter((r) => r.status === "pending").length}/${backlog.length} rows pending`);
  await shutdown(0);
}

// ============================================================================
dumpRows("at recovery start (rows persisted by phase A)");
editArmed = true;
if (SCENARIO === "recovery") {
  mock.dispatch(
    "MESSAGE_CREATE",
    frame({ id: freshId, content: `<@${BOT_ID}> are you back?`, sentAt: Date.now(), mentions: [BOT_USER] }),
  );
  log("discord-gateway", "-> MESSAGE_CREATE fresh-mention sentAt=T+now mentions=1 (live)");
}
const recoveryStartedAt = Date.now();
const expected = backlog.length + (SCENARIO === "recovery" ? 1 : 0);
let last = "";
while (Date.now() < deadline) {
  await sleep(100);
  const rows = readRows();
  const pending = rows.filter((r) => r.status === "pending" || r.status === "claimed").length;
  const snapshot = `rows=${rows.length} open=${pending} failed=${rows.filter((r) => r.status === "failed").length} completed=${rows.filter((r) => r.status === "completed").length} turns=${turns.length}`;
  if (snapshot !== last) {
    log("queue", snapshot);
    last = snapshot;
  }
  if (rows.length >= expected && pending === 0) {
    break;
  }
}
const rows = dumpRows(`end of B (${SCENARIO})`);
const byName = new Map(rows.map((row) => [ids.get(row.event_id) ?? row.event_id, row]));
const turnNames = turns.map((t) => t.name);
log("result", `turn order: ${turnNames.join(" -> ") || "(none)"}`);
const rest = mock.restCalls.filter((call) => /\/messages\/\d+$/u.test(call.path));
log("result", `REST message fetches by preflight: ${rest.map((c) => label(`${c.method} ${c.path} ${c.status}`)).join(", ") || "(none)"}`);
// Production preflight's own decision lines, read back from the run's file log
// (logging.file in the run config); hostname/paths are not copied.
const fileLog = path.join(RUN, `openclaw-${PHASE}.log`);
let preflightSkips = 0;
let preflightPasses = 0;
if (existsSync(fileLog)) {
  for (const line of readFileSync(fileLog, "utf8").split("\n")) {
    let entry: { "0"?: string; _meta?: { date?: string } };
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    const text = entry["0"] ?? "";
    if (/\[discord-preflight\] (shouldRequireMention=|drop: )/u.test(text)) {
      if (text.includes("drop: no-mention")) {
        preflightSkips += 1;
      }
      if (/mentionDecision\.shouldSkip=false/u.test(text)) {
        preflightPasses += 1;
      }
      log("preflight", `${entry._meta?.date ?? ""} ${text}`);
    }
  }
}
log("result", `production preflight decisions: mention-gate pass=${preflightPasses} drop:no-mention=${preflightSkips}`);
// Claim completion order straight from SQLite (updated_at of the completing transition).
const completedOrder = rows
  .filter((r) => r.status === "completed")
  .sort((a, b) => a.updated_at - b.updated_at)
  .map((r) => ids.get(r.event_id) ?? r.event_id);
log("result", `completion order (SQLite): ${completedOrder.join(" -> ") || "(none)"}`);
const freshTurn = turns.find((t) => t.name === "fresh-mention");
log(
  "result",
  `fresh-mention: completed #${completedOrder.indexOf("fresh-mention") + 1} of ${completedOrder.length}; turn ${freshTurn ? `${freshTurn.at - recoveryStartedAt}ms after the gateway delivered it` : "never"}`,
);
const ambient = rows.filter((r) => (ids.get(r.event_id) ?? "").startsWith("amb-"));
const ambientStale = ambient.filter((r) => r.failed_reason === "stale-ambient-backlog").length;
const ambientTurns = turnNames.filter((n) => n.startsWith("amb-")).length;
const status = (name: string) => {
  const row = byName.get(name);
  return row ? `${row.status}${row.failed_reason ? `:${row.failed_reason}` : ""}` : "missing";
};
if (SCENARIO === "recovery") {
  const addressed = ["old-mention", "reply-canonical", "reply-refetch", "raw-hydrate", "fresh-mention"];
  const freshPos = turnNames.indexOf("fresh-mention") + 1;
  const ambientCompleted = ambient.filter((r) => r.status === "completed").length;
  log(
    "verdict",
    `B: ambient ${ambient.length}: failed(stale-ambient-backlog)=${ambientStale} completed(preflight-skipped)=${ambientCompleted} turns=${ambientTurns}; ` +
      addressed.map((n) => `${n}=${status(n)}/turn=${turnNames.includes(n)}`).join(" ") +
      `; fresh-mention turn #${freshPos || "never"} of ${turns.length}, completed #${completedOrder.indexOf("fresh-mention") + 1} of ${completedOrder.length} claims`,
  );
} else {
  const helpers = ["helper-1", "helper-2", "helper-3"];
  log(
    "verdict",
    `B(${SCENARIO}): edit published=${edited}; ` +
      helpers.map((n) => `${n}=${status(n)}/turn=${turnNames.includes(n)}`).join(" ") +
      `; ambient failed(stale-ambient-backlog)=${ambientStale}/${ambient.length} turns=${ambientTurns}`,
  );
}
await shutdown(0);
