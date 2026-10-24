// Loopback mock of the Discord platform for the openclaw#124337 Gateway proof.
// Adapted from the #121204 corpus mock (harness/mock-discord.mts): REST + a WebSocket Gateway on one
// origin, reached by the shipped Gateway only through DISCORD_API_URL (loopback http/ws only).
// Additions: DM channel, message sends answered with a message object and logged with their text,
// and a control route (POST /__control/dm) that dispatches a MESSAGE_CREATE from the human.
// Usage: node mock-discord.mjs <port> <log.jsonl> <ws-module-dir>
import http from "node:http";
import fs from "node:fs";
import { createRequire } from "node:module";

const port = Number(process.argv[2]);
const logPath = process.argv[3];
const require = createRequire(`${process.argv[4]}/`);
const { WebSocketServer } = require("ws");

const BOT = { id: "3000000000000000001", username: "proof-bot", discriminator: "0", bot: true, global_name: "proof-bot" };
const HUMAN = { id: "4000000000000000001", username: "proof-human", discriminator: "0", global_name: "proof-human" };
const DM = { id: "2000000000000000001", type: 1, recipients: [HUMAN], last_message_id: null };
const GUILD = { id: "1000000000000000001", name: "proof-guild" };
const GCH = { id: "2000000000000000002", type: 0, name: "general", guild_id: GUILD.id, position: 0, permission_overwrites: [], nsfw: false, parent_id: null };
const messages = new Map();
let nextMessage = 5000000000000000001n;
let sequence = 0;
let socket;

const log = (o) => fs.appendFileSync(logPath, JSON.stringify({ t: new Date().toISOString(), ...o }) + "\n");

function readBody(req) {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => resolve(raw));
  });
}

function send(payload) {
  socket?.send(JSON.stringify(payload));
}
function dispatch(t, d) {
  sequence += 1;
  send({ op: 0, t, s: sequence, d });
}

function contentOf(raw, type) {
  if (!raw) return undefined;
  if (type?.includes("json")) {
    try {
      return JSON.parse(raw).content;
    } catch {
      return undefined;
    }
  }
  const m = raw.match(/name="payload_json"\r\n\r\n([\s\S]*?)\r\n--/u);
  if (m) {
    try {
      return JSON.parse(m[1]).content;
    } catch {}
  }
  return undefined;
}

function route(method, path, raw, type) {
  const p = decodeURIComponent(path.replace(/^\/api\/v10/u, "").replace(/\?.*$/u, ""));
  let m;
  if (method === "GET" && p === "/gateway/bot") {
    return { status: 200, body: { url: `ws://127.0.0.1:${port}`, shards: 1, session_start_limit: { total: 1000, remaining: 999, reset_after: 0, max_concurrency: 1 } } };
  }
  if (method === "GET" && p === "/gateway") return { status: 200, body: { url: `ws://127.0.0.1:${port}` } };
  if (method === "GET" && p === "/users/@me") return { status: 200, body: BOT };
  if (method === "GET" && p === "/oauth2/applications/@me") return { status: 200, body: { id: BOT.id, name: "proof-app", flags: 0, bot: BOT } };
  if (method === "GET" && /^\/applications\/\d+\/commands/u.test(p)) return { status: 200, body: [] };
  if (method === "GET" && (m = p.match(/^\/channels\/(\d+)\/messages\/(\d+)$/u))) {
    const msg = messages.get(m[2]);
    return msg ? { status: 200, body: msg } : { status: 404, body: { message: "Unknown Message", code: 10008 } };
  }
  if (method === "GET" && (m = p.match(/^\/channels\/(\d+)\/messages$/u))) return { status: 200, body: [] };
  if (method === "GET" && (m = p.match(/^\/channels\/(\d+)$/u))) {
    if (m[1] === GCH.id) return { status: 200, body: GCH };
    return m[1] === DM.id ? { status: 200, body: DM } : { status: 404, body: { message: "Unknown Channel", code: 10003 } };
  }
  if (method === "GET" && p === `/guilds/${GUILD.id}`) return { status: 200, body: { id: GUILD.id, name: GUILD.name, roles: [{ id: GUILD.id, name: "@everyone", permissions: "68608", position: 0 }], owner_id: HUMAN.id } };
  if (method === "GET" && p === `/guilds/${GUILD.id}/channels`) return { status: 200, body: [GCH] };
  if (method === "GET" && (m = p.match(/^\/guilds\/\d+\/members\/(\d+)$/u))) return { status: 200, body: { user: m[1] === BOT.id ? BOT : HUMAN, roles: [], joined_at: new Date(0).toISOString() } };
  if (method === "POST" && p === "/users/@me/channels") return { status: 200, body: DM };
  if (method === "POST" && (m = p.match(/^\/channels\/(\d+)\/messages$/u))) {
    const id = String(nextMessage++);
    const content = contentOf(raw, type);
    const msg = { id, channel_id: m[1], type: 0, content: content ?? "", author: BOT, timestamp: new Date().toISOString(), attachments: [], embeds: [], mentions: [], mention_roles: [], pinned: false, tts: false, mention_everyone: false, flags: 0 };
    messages.set(id, msg);
    log({ kind: "bot-send", channel: m[1], id, content });
    return { status: 200, body: msg };
  }
  if (method === "PATCH" && (m = p.match(/^\/channels\/(\d+)\/messages\/(\d+)$/u))) {
    const content = contentOf(raw, type);
    log({ kind: "bot-edit", channel: m[1], id: m[2], content });
    const msg = { ...(messages.get(m[2]) ?? { id: m[2], channel_id: m[1], author: BOT, timestamp: new Date().toISOString() }), content: content ?? "" };
    messages.set(m[2], msg);
    return { status: 200, body: msg };
  }
  if (method === "POST" || method === "PUT" || method === "DELETE" || method === "PATCH") return { status: 204 };
  return { status: 404, body: { message: "Unknown route (mock)", code: 0 } };
}

const server = http.createServer(async (req, res) => {
  const method = req.method ?? "GET";
  const path = req.url ?? "/";
  const raw = await readBody(req);
  if (path === "/__control/dm" && method === "POST") {
    const { content } = JSON.parse(raw);
    const id = String(nextMessage++);
    const msg = { id, channel_id: DM.id, type: 0, content, author: HUMAN, timestamp: new Date().toISOString(), edited_timestamp: null, attachments: [], embeds: [], mentions: [], mention_roles: [], mention_everyone: false, pinned: false, tts: false, flags: 0, nonce: id };
    messages.set(id, msg);
    dispatch("MESSAGE_CREATE", msg);
    log({ kind: "human-dm", id, content, connected: Boolean(socket) });
    res.writeHead(200, { "content-type": "application/json" });
    return res.end(JSON.stringify({ id }));
  }
  if (path === "/__control/guild" && method === "POST") {
    const { content } = JSON.parse(raw);
    const id = String(nextMessage++);
    const msg = { id, channel_id: GCH.id, guild_id: GUILD.id, type: 0, content, author: HUMAN, member: { roles: [], joined_at: new Date(0).toISOString() }, timestamp: new Date().toISOString(), edited_timestamp: null, attachments: [], embeds: [], mentions: [], mention_roles: [], mention_everyone: false, pinned: false, tts: false, flags: 0, nonce: id };
    messages.set(id, msg);
    dispatch("MESSAGE_CREATE", msg);
    log({ kind: "human-guild", id, content, connected: Boolean(socket) });
    res.writeHead(200, { "content-type": "application/json" });
    return res.end(JSON.stringify({ id }));
  }
  if (path === "/__control/state") {
    res.writeHead(200, { "content-type": "application/json" });
    return res.end(JSON.stringify({ connected: Boolean(socket), sequence }));
  }
  const { status, body } = route(method, path, raw, req.headers["content-type"]);
  log({ kind: "rest", method, path: path.replace(/\?.*$/u, ""), status });
  res.writeHead(status, { "content-type": "application/json" });
  res.end(status === 204 ? undefined : JSON.stringify(body ?? {}));
});

const wss = new WebSocketServer({ server });
wss.on("connection", (ws, req) => {
  socket = ws;
  log({ kind: "gateway", event: "connected", url: req.url });
  send({ op: 10, d: { heartbeat_interval: 41250 } });
  ws.on("message", (raw) => {
    const payload = JSON.parse(raw.toString("utf8"));
    if (payload.op === 1) return send({ op: 11 });
    if (payload.op === 2) {
      log({ kind: "gateway", event: "IDENTIFY", intents: payload.d?.intents, token: payload.d?.token ? "<redacted>" : "<none>" });
      dispatch("READY", { v: 10, user: BOT, session_id: "proof-session", resume_gateway_url: `ws://127.0.0.1:${port}`, guilds: [{ id: GUILD.id, unavailable: true }], private_channels: [], application: { id: BOT.id, flags: 0 } });
      dispatch("GUILD_CREATE", { id: GUILD.id, name: GUILD.name, unavailable: false, member_count: 2, roles: [{ id: GUILD.id, name: "@everyone", permissions: "68608", position: 0 }], members: [], voice_states: [], presences: [], channels: [GCH], threads: [], owner_id: HUMAN.id });
      return;
    }
    if (payload.op === 6) {
      log({ kind: "gateway", event: "RESUME" });
      return dispatch("RESUMED", {});
    }
    log({ kind: "gateway", event: `op ${payload.op}` });
  });
  ws.on("close", (code) => {
    if (socket === ws) socket = undefined;
    log({ kind: "gateway", event: "closed", code });
  });
});

server.listen(port, "127.0.0.1", () => log({ kind: "listening", port }));
