// Loopback mock of the Telegram Bot API for the openclaw#124337 Telegram proof.
// Serves /bot<token>/<method> for the shipped grammY client (long-poll getUpdates) and logs
// every call to a JSONL file. A control API injects the human's updates:
//   POST /__control/text     {"text": "..."}               a private-chat text message
//   POST /__control/keyboard {"text": "...", "data": "..."} a bot message carrying one inline button
//   POST /__control/press    {"message_id": n}             a callback_query on that message's button
//   GET  /__control/state                                  polling state and keyboard bookkeeping
// Usage: node mock-telegram.mjs <port> <log.jsonl>
import http from "node:http";
import fs from "node:fs";

const port = Number(process.argv[2]);
const logPath = process.argv[3];
const BOT = { id: 7000000001, is_bot: true, first_name: "ProofBot", username: "proof_124337_bot" };
const HUMAN = { id: 5000000001, is_bot: false, first_name: "Human", username: "proof_human" };
const CHAT = { id: 5000000001, type: "private", first_name: "Human", username: "proof_human" };
const log = (o) => fs.appendFileSync(logPath, JSON.stringify({ t: new Date().toISOString(), ...o }) + "\n");

let updateId = 900000;
let messageId = 100;
let callbackSeq = 0;
const pending = [];
const waiters = [];
const messages = new Map(); // message_id -> current bot message (with reply_markup)
let polls = 0;
let lastPollAt = null;

const now = () => Math.floor(Date.now() / 1000);
const push = (update) => {
  pending.push(update);
  log({ kind: "inject", update_id: update.update_id, update });
  while (waiters.length) waiters.shift()();
};

async function readBody(req) {
  let raw = "";
  for await (const c of req) raw += c;
  if (!raw) return {};
  const type = req.headers["content-type"] ?? "";
  if (type.includes("application/json")) return JSON.parse(raw);
  if (type.includes("application/x-www-form-urlencoded")) {
    const o = {};
    for (const [k, v] of new URLSearchParams(raw)) o[k] = v;
    return o;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return { raw: raw.slice(0, 200) };
  }
}

const parseMarkup = (m) => (typeof m === "string" ? JSON.parse(m) : m);

function botMessage(params, text) {
  const id = ++messageId;
  const msg = { message_id: id, from: BOT, chat: CHAT, date: now(), text: text ?? params.text ?? "" };
  if (params.reply_markup) msg.reply_markup = parseMarkup(params.reply_markup);
  messages.set(id, msg);
  return msg;
}

async function api(method, params, res) {
  const ok = (result) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, result }));
  };
  switch (method) {
    case "getMe":
      return ok({ ...BOT, can_join_groups: true, can_read_all_group_messages: false, supports_inline_queries: false });
    case "getUpdates": {
      polls += 1;
      lastPollAt = new Date().toISOString();
      const offset = Number(params.offset ?? 0);
      // Updates below the offset are confirmed by the client and dropped.
      while (pending.length && pending[0].update_id < offset) pending.shift();
      const timeout = Math.min(Number(params.timeout ?? 0), 20) * 1000;
      if (!pending.length && timeout > 0) {
        await new Promise((resolve) => {
          const t = setTimeout(resolve, timeout);
          waiters.push(() => {
            clearTimeout(t);
            resolve();
          });
        });
      }
      const out = pending.filter((u) => u.update_id >= offset);
      if (out.length) log({ kind: "deliver", offset, update_ids: out.map((u) => u.update_id) });
      return ok(out);
    }
    case "sendMessage": {
      const msg = botMessage(params);
      log({ kind: "bot-send", method, message_id: msg.message_id, text: msg.text, reply_markup: msg.reply_markup ?? null });
      return ok(msg);
    }
    case "editMessageReplyMarkup": {
      const id = Number(params.message_id);
      const markup = params.reply_markup ? parseMarkup(params.reply_markup) : null;
      const msg = messages.get(id);
      if (msg) {
        if (markup && markup.inline_keyboard?.length) msg.reply_markup = markup;
        else delete msg.reply_markup;
      }
      log({ kind: "bot-edit-markup", message_id: id, reply_markup: markup });
      return ok(msg ?? true);
    }
    case "editMessageText": {
      const id = Number(params.message_id);
      const msg = messages.get(id);
      if (msg) {
        msg.text = params.text;
        if (params.reply_markup) msg.reply_markup = parseMarkup(params.reply_markup);
      }
      log({ kind: "bot-edit-text", message_id: id, text: params.text, reply_markup: params.reply_markup ? parseMarkup(params.reply_markup) : null });
      return ok(msg ?? true);
    }
    case "answerCallbackQuery":
      log({ kind: "bot-answer-callback", callback_query_id: params.callback_query_id, text: params.text ?? null });
      return ok(true);
    case "getMyCommands":
      return ok([]);
    case "getWebhookInfo":
      return ok({ url: "", has_custom_certificate: false, pending_update_count: pending.length });
    case "getChat":
      return ok(CHAT);
    default:
      log({ kind: "bot-call", method, params: Object.keys(params) });
      return ok(true);
  }
}

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    try {
      if (url.pathname.startsWith("/__control/")) {
        const body = req.method === "POST" ? await readBody(req) : {};
        const what = url.pathname.slice("/__control/".length);
        const reply = (o) => {
          res.writeHead(200, { "content-type": "application/json" });
          res.end(JSON.stringify(o));
        };
        if (what === "state") {
          return reply({ polls, lastPollAt, pending: pending.map((u) => u.update_id), keyboards: [...messages.values()].filter((m) => m.reply_markup).map((m) => m.message_id) });
        }
        if (what === "text") {
          const msg = { message_id: ++messageId, from: HUMAN, chat: CHAT, date: now(), text: body.text };
          if (body.text.startsWith("/")) msg.entities = [{ type: "bot_command", offset: 0, length: body.text.split(/\s/u)[0].length }];
          const u = { update_id: ++updateId, message: msg };
          push(u);
          return reply({ update_id: u.update_id, message_id: msg.message_id });
        }
        if (what === "keyboard") {
          const msg = botMessage({ reply_markup: { inline_keyboard: [[{ text: "Approve", callback_data: body.data }]] } }, body.text);
          log({ kind: "seed-keyboard", message_id: msg.message_id, text: msg.text, reply_markup: msg.reply_markup });
          return reply({ message_id: msg.message_id });
        }
        if (what === "press") {
          const msg = messages.get(Number(body.message_id));
          if (!msg?.reply_markup) return reply({ error: "no keyboard on that message" });
          const button = msg.reply_markup.inline_keyboard[0][0];
          const cb = { id: `cbq-${++callbackSeq}`, from: HUMAN, chat_instance: "proof-chat-instance", message: structuredClone(msg), data: button.callback_data };
          const u = { update_id: ++updateId, callback_query: cb };
          push(u);
          return reply({ update_id: u.update_id, callback_query_id: cb.id });
        }
        res.writeHead(404).end();
        return;
      }
      const m = url.pathname.match(/^\/bot[^/]+\/([A-Za-z]+)$/u);
      if (!m) {
        log({ kind: "unknown-path", path: url.pathname.replace(/bot[^/]+/u, "bot<token>") });
        res.writeHead(404).end();
        return;
      }
      const params = { ...Object.fromEntries(url.searchParams), ...(req.method === "POST" ? await readBody(req) : {}) };
      await api(m[1], params, res);
    } catch (err) {
      log({ kind: "error", error: String(err) });
      res.writeHead(500).end(JSON.stringify({ ok: false, description: String(err) }));
    }
  })
  .listen(port, "127.0.0.1", () => log({ kind: "listening", port }));
