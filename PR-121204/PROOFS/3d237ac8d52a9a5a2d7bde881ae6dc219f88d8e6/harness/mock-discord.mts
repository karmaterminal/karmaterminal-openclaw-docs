/**
 * Local mock of the Discord platform for the #121204 recovery proof: one
 * loopback HTTP server that answers the REST routes the production client
 * calls, and a WebSocket Gateway on the same origin speaking the Discord
 * Gateway protocol (HELLO, IDENTIFY -> READY + GUILD_CREATE, HEARTBEAT ->
 * HEARTBEAT_ACK, RESUME -> RESUMED, DISPATCH). Nothing here is OpenClaw code;
 * the production client reaches it only through DISCORD_API_URL, the
 * production endpoint override that admits loopback http:// and ws://.
 */
import http from "node:http";
import type { AddressInfo } from "node:net";

type Json = Record<string, unknown>;
type Log = (tag: string, message: string) => void;

export type MockDiscordOptions = {
  ws: { WebSocketServer: new (options: { server: http.Server }) => any };
  log: Log;
  /** Labels for synthetic snowflakes, applied to every log line. */
  label: (text: string) => string;
  botUser: Json;
  guild: { id: string; name: string; channels: Json[] };
  /** Messages REST can return by id (GET /channels/:c/messages/:m). */
  messages: Map<string, Json>;
};

export type MockDiscord = {
  apiUrl: string;
  port: number;
  /** Resolves once a client has IDENTIFYed and READY + GUILD_CREATE were sent. */
  ready: Promise<void>;
  dispatch: (t: string, d: Json) => void;
  restCalls: Array<{ method: string; path: string; status: number }>;
  close: () => Promise<void>;
};

export async function startMockDiscord(options: MockDiscordOptions): Promise<MockDiscord> {
  const { log, label } = options;
  const restCalls: MockDiscord["restCalls"] = [];
  let port = 0;
  let sequence = 0;
  let socket: any;
  let resolveReady!: () => void;
  const ready = new Promise<void>((resolve) => {
    resolveReady = resolve;
  });

  const json = (res: http.ServerResponse, status: number, body: unknown) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(status === 204 ? undefined : JSON.stringify(body));
  };

  const route = (method: string, path: string): { status: number; body?: unknown } => {
    const p = decodeURIComponent(path.replace(/^\/api\/v10/u, "").replace(/\?.*$/u, ""));
    let m: RegExpMatchArray | null;
    if (method === "GET" && p === "/gateway/bot") {
      return {
        status: 200,
        body: {
          url: `ws://127.0.0.1:${port}`,
          shards: 1,
          session_start_limit: { total: 1000, remaining: 999, reset_after: 0, max_concurrency: 1 },
        },
      };
    }
    if (method === "GET" && p === "/users/@me") {
      return { status: 200, body: options.botUser };
    }
    if (method === "GET" && (m = p.match(/^\/channels\/(\d+)\/messages\/(\d+)$/u))) {
      const message = options.messages.get(m[2]!);
      return message
        ? { status: 200, body: message }
        : { status: 404, body: { message: "Unknown Message", code: 10008 } };
    }
    if (method === "GET" && (m = p.match(/^\/channels\/(\d+)$/u))) {
      const channel = options.guild.channels.find((entry) => entry.id === m![1]);
      return channel
        ? { status: 200, body: { ...channel, guild_id: options.guild.id } }
        : { status: 404, body: { message: "Unknown Channel", code: 10003 } };
    }
    if (method === "GET" && (m = p.match(/^\/guilds\/(\d+)$/u))) {
      return { status: 200, body: { id: options.guild.id, name: options.guild.name, roles: [] } };
    }
    // Side effects (typing, reactions, sends) are accepted and recorded only.
    if (method === "POST" || method === "PUT" || method === "DELETE" || method === "PATCH") {
      return { status: 204 };
    }
    return { status: 404, body: { message: "Unknown route (mock)", code: 0 } };
  };

  const server = http.createServer((req, res) => {
    const method = req.method ?? "GET";
    const path = req.url ?? "/";
    req.resume();
    req.on("end", () => {
      const { status, body } = route(method, path);
      restCalls.push({ method, path, status });
      log("discord-rest", label(`${method} ${path} -> ${status}`));
      json(res, status, body ?? {});
    });
  });

  const wss = new options.ws.WebSocketServer({ server });
  const send = (payload: Json) => socket?.send(JSON.stringify(payload));
  const dispatch = (t: string, d: Json) => {
    sequence += 1;
    send({ op: 0, t, s: sequence, d });
  };
  wss.on("connection", (ws: any, req: http.IncomingMessage) => {
    socket = ws;
    log("discord-gateway", `client connected ${req.url ?? ""}`);
    send({ op: 10, d: { heartbeat_interval: 41_250 } });
    ws.on("message", (raw: Buffer) => {
      const payload = JSON.parse(raw.toString("utf8")) as { op: number; d: any };
      if (payload.op === 1) {
        send({ op: 11 });
        return;
      }
      if (payload.op === 2) {
        log(
          "discord-gateway",
          `IDENTIFY intents=${payload.d?.intents} token=${payload.d?.token ? "<redacted>" : "<none>"}`,
        );
        dispatch("READY", {
          v: 10,
          user: options.botUser,
          session_id: "proof-session",
          resume_gateway_url: `ws://127.0.0.1:${port}`,
          guilds: [{ id: options.guild.id, unavailable: true }],
          application: { id: options.botUser.id, flags: 0 },
        });
        log("discord-gateway", label(`-> READY (guild ${options.guild.id} unavailable)`));
        dispatch("GUILD_CREATE", {
          id: options.guild.id,
          name: options.guild.name,
          unavailable: false,
          member_count: 3,
          roles: [],
          members: [],
          voice_states: [],
          presences: [],
          channels: options.guild.channels,
          threads: [],
        });
        log(
          "discord-gateway",
          label(`-> GUILD_CREATE ${options.guild.id} (${options.guild.channels.length} channels)`),
        );
        resolveReady();
        return;
      }
      if (payload.op === 6) {
        log("discord-gateway", "RESUME -> RESUMED");
        dispatch("RESUMED", {});
        return;
      }
      log("discord-gateway", `client op ${payload.op}`);
    });
    ws.on("close", (code: number) => log("discord-gateway", `client closed ${code}`));
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as AddressInfo).port;
  return {
    apiUrl: `http://127.0.0.1:${port}/api/v10`,
    port,
    ready,
    dispatch,
    restCalls,
    close: async () => {
      for (const client of wss.clients) {
        client.terminate();
      }
      wss.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
