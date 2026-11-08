// Scripted OpenAI Responses provider for the openclaw#124337 Gateway proof (shape from #178102's proof-gw/provider.mjs).
// Reads the latest user message only. A message carrying HOLD-<n> keeps its turn busy: the model answers with
// exec_command "sleep STEP" until ROUNDS tool outputs follow that message, then replies. Any other message
// gets a one-line reply naming the marker it carried (MSG-...), so every Discord send maps to one input.
// Usage: node provider.mjs <port> <log.jsonl> [rounds=16] [stepSeconds=25]
import http from "node:http";
import fs from "node:fs";
const port = Number(process.argv[2]);
const logPath = process.argv[3];
const ROUNDS = Number(process.argv[4] ?? 16);
const STEP = Number(process.argv[5] ?? 25);
let n = 0;
const ev = (type, fields) => `event: ${type}\ndata: ${JSON.stringify({ type, ...fields })}\n\n`;
const log = (o) => fs.appendFileSync(logPath, JSON.stringify({ t: new Date().toISOString(), ...o }) + "\n");
const textOf = (item) =>
  Array.isArray(item?.content) ? item.content.map((c) => c?.text ?? "").join("\n") : typeof item?.content === "string" ? item.content : "";

http
  .createServer(async (req, res) => {
    if (req.url !== "/v1/responses") return res.writeHead(404).end();
    if (req.method === "GET") return res.writeHead(426).end();
    let raw = "";
    for await (const c of req) raw += c;
    const body = JSON.parse(raw);
    const id = `response-${++n}`;
    const input = Array.isArray(body.input) ? body.input : [];
    let lastUser = -1;
    input.forEach((item, i) => {
      if (item?.role === "user" && /HOLD-\d+|MSG-[A-Z0-9-]+/u.test(textOf(item))) lastUser = i;
    });
    const userText = lastUser >= 0 ? textOf(input[lastUser]) : "";
    const markers = userText.match(/HOLD-\d+|MSG-[A-Z0-9-]+/gu) ?? [];
    const toolOutputs = input.slice(lastUser + 1).filter((i) => /_call_output$/u.test(String(i?.type))).length;
    const finalizer = raw.includes("Earlier conversation may be omitted; do not infer missing earlier facts.");
    let phase, item;
    if (!finalizer && markers.some((m) => m.startsWith("HOLD-")) && toolOutputs < ROUNDS) {
      phase = `hold-sleep ${toolOutputs + 1}/${ROUNDS}`;
      item = { type: "function_call", call_id: `hold-${n}`, name: "exec_command", arguments: JSON.stringify({ cmd: `sleep ${STEP}; echo slept`, shell: "/bin/sh", login: false, yield_time_ms: (STEP + 5) * 1000, max_output_tokens: 200 }) };
    } else {
      phase = finalizer ? "finalizer" : "reply";
      const text = markers.length ? `ack ${[...new Set(markers)].join(" ")}` : "ack (no marker)";
      item = { type: "message", role: "assistant", id: `answer-${n}`, content: [{ type: "output_text", text }] };
    }
    log({ n, phase, markers, toolOutputs, model: body.model });
    res.writeHead(200, { "Content-Type": "text/event-stream" });
    res.end(ev("response.created", { response: { id } }) + ev("response.output_item.done", { item }) + ev("response.completed", { response: { id, usage: { input_tokens: 10, output_tokens: 2, total_tokens: 12 } } }));
  })
  .listen(port, "127.0.0.1", () => log({ phase: "listening", port, ROUNDS, STEP }));
