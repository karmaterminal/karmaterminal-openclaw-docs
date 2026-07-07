#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

function usage() {
  console.error(`Usage: node tools/k6-proofs/scripts/recover-session-receipts.mjs \\
  --row R-CW-1 --session-key <key> --nonce <nonce> --out <artifact.json> [--limit 200]`);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) throw new Error(`unexpected argument: ${arg}`);
    const key = arg.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) throw new Error(`missing value for --${key}`);
    out[key] = value;
    i += 1;
  }
  return out;
}

function connectFrame(token) {
  return {
    type: 'req',
    id: 'connect',
    method: 'connect',
    params: {
      minProtocol: 3,
      maxProtocol: 4,
      client: {
        id: 'gateway-client',
        version: '0.2.0',
        platform: 'linux',
        mode: 'backend',
      },
      role: 'operator',
      scopes: ['operator.read', 'session.control'],
      caps: [],
      commands: [],
      permissions: {},
      auth: { token },
      userAgent: 'k6-proof-session-receipt-recover/0.1.0',
    },
  };
}

function getTextParts(value, into = []) {
  if (typeof value === 'string') {
    into.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) getTextParts(item, into);
  } else if (value && typeof value === 'object') {
    if (typeof value.text === 'string') into.push(value.text);
    if (typeof value.content === 'string') into.push(value.content);
    if (Array.isArray(value.content)) getTextParts(value.content, into);
    if (value.arguments) into.push(JSON.stringify(value.arguments));
  }
  return into;
}

function messageText(message) {
  return getTextParts(message.content).join('\n');
}

function toolCalls(message) {
  const calls = [];
  if (Array.isArray(message.content)) {
    for (const item of message.content) {
      if (item?.type === 'toolCall' || item?.name) {
        calls.push({ name: item.name, arguments: item.arguments || {}, raw: item });
      }
    }
  }
  return calls;
}

function safeJsonFromText(text) {
  const match = String(text || '').match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

function toolResultObject(message) {
  if (message.role !== 'toolResult') return null;
  const text = messageText(message);
  return safeJsonFromText(text);
}

function receipt(name, required, status, extra = {}) {
  return { name, required, status, ...extra };
}

function hasContinuationWake(messages, nonce, hop) {
  return messages.some((m) => {
    const text = messageText(m);
    return m.role === 'user' && text.includes('[continuation:wake]') && text.includes(nonce) &&
      (hop === undefined || text.includes(`hop ${hop}/200`));
  });
}

function evaluate(row, nonce, messages) {
  const allText = messages.map(messageText).join('\n');
  const cwToolCalls = messages.flatMap(toolCalls).filter((c) => c.name === 'continue_work');
  const scheduledToolResults = messages
    .map(toolResultObject)
    .filter((obj) => obj && obj.status === 'scheduled');

  if (row === 'R-CONFIG-defaults') {
    const configToolCalls = messages.flatMap(toolCalls).filter((c) => c.name === 'gateway');
    const configToolResults = messages
      .map(toolResultObject)
      .filter((obj) => obj?.ok === true && obj?.result?.path === 'agents.defaults.continuation');
    const sentinel = String(allText).match(new RegExp('CONFIG-DEFAULTS ' + nonce + ' ENABLED (true|false) MAXCHAIN (\\d+) MAXDELEGATES (\\d+) COSTCAP (\\d+)'));
    return [
      receipt('config-read-tool-call', true,
        configToolCalls.some((c) => c.arguments?.action === 'config.get' && c.arguments?.path === 'agents.defaults.continuation') ? 'present' : 'missing'),
      receipt('config-read-tool-result', true,
        configToolResults.length > 0 ? 'present' : 'missing',
        configToolResults[0]?.result?.config ? {
          enabled: configToolResults[0].result.config.enabled,
          maxChainLength: configToolResults[0].result.config.maxChainLength,
          maxDelegatesPerTurn: configToolResults[0].result.config.maxDelegatesPerTurn,
          costCapTokens: configToolResults[0].result.config.costCapTokens,
        } : {}),
      receipt('config-defaults-sentinel', true,
        sentinel ? 'present' : 'missing',
        sentinel ? {
          enabled: sentinel[1] === 'true',
          maxChainLength: Number(sentinel[2]),
          maxDelegatesPerTurn: Number(sentinel[3]),
          costCapTokens: Number(sentinel[4]),
        } : {}),
    ];
  }

  if (row === 'R-CW-1') {
    return [
      receipt('tool-invoke-accepted', true, cwToolCalls.some((c) => JSON.stringify(c).includes(nonce)) ? 'present' : 'missing'),
      receipt('continue-work-tool-result-scheduled', true,
        scheduledToolResults.length > 0 && allText.includes(`CW-SCHEDULED ${nonce}`) ? 'present' : 'missing',
        scheduledToolResults[0] ? { delaySeconds: scheduledToolResults[0].delaySeconds } : {}),
      receipt('work-woke-event', true,
        hasContinuationWake(messages, nonce, 1) && allText.includes(`CW-WOKE ${nonce}`) ? 'present' : 'missing'),
    ];
  }

  if (row === 'R-CW-4') {
    return [
      receipt('dispatch-accepted', true, messages.some((m) => m.role === 'user' && messageText(m).includes('[k6-proof-harness]') && messageText(m).includes(nonce)) ? 'present' : 'missing'),
      receipt('hop1-scheduled', true, allText.includes(`CW4-HOP1-SCHEDULED ${nonce}`) ? 'present' : 'missing'),
      receipt('hop2-scheduled', true, allText.includes(`CW4-HOP2-SCHEDULED ${nonce}`) ? 'present' : 'missing'),
      receipt('hop3-scheduled', true, allText.includes(`CW4-HOP3-SCHEDULED ${nonce}`) ? 'present' : 'missing'),
      receipt('wake-hop-1', true, hasContinuationWake(messages, nonce, 1) ? 'present' : 'missing'),
      receipt('wake-hop-2', true, hasContinuationWake(messages, nonce, 2) ? 'present' : 'missing'),
      receipt('wake-hop-3', true, hasContinuationWake(messages, nonce, 3) ? 'present' : 'missing'),
      receipt('final-done', true, allText.includes(`CW4-DONE ${nonce}`) ? 'present' : 'missing'),
    ];
  }

  if (row === 'R-CW-TOKEN') {
    return [
      receipt('parent-dispatch-accepted', true, messages.some((m) => m.role === 'user' && messageText(m).includes('[k6-proof-harness]') && messageText(m).includes(nonce)) ? 'present' : 'missing'),
      receipt('subagent-spawn-accepted', true, allText.includes(`PARENT-SPAWNED ${nonce}`) || allText.includes('sessions_spawn') ? 'present' : 'missing'),
      receipt('token-emitted-or-stripped', true, allText.includes(`TOKEN-HOP1 ${nonce}`) || allText.includes('CONTINUE_WORK') ? 'present' : 'missing'),
      receipt('hop-2-executed', true, allText.includes(`TOKEN-HOP2-DONE ${nonce}`) ? 'present' : 'missing'),
      receipt('parent-return', true, allText.includes(`TOKEN-HOP2-DONE ${nonce}`) ? 'present' : 'missing'),
    ];
  }

  throw new Error(`unsupported row for receipt recovery: ${row}`);
}

async function gatewayRequest({ url, token, method, params }) {
  const ws = new WebSocket(url);
  const pending = new Map();
  let nextId = 0;

  function send(methodName, methodParams) {
    const id = `req-${++nextId}`;
    ws.send(JSON.stringify({ type: 'req', id, method: methodName, params: methodParams }));
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (pending.has(id)) {
          pending.delete(id);
          reject(new Error(`${methodName} timed out`));
        }
      }, 15000);
    });
  }

  return await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('websocket timed out')), 20000);
    ws.onopen = () => ws.send(JSON.stringify(connectFrame(token)));
    ws.onerror = (event) => reject(new Error(`websocket error: ${event.message || 'unknown'}`));
    ws.onmessage = async (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type !== 'res') return;
      if (msg.id === 'connect') {
        if (msg.error || msg.ok === false) {
          clearTimeout(timeout);
          ws.close();
          reject(new Error(`connect failed: ${JSON.stringify(msg.error)}`));
          return;
        }
        try {
          const response = await send(method, params);
          clearTimeout(timeout);
          ws.close();
          resolve(response);
        } catch (error) {
          clearTimeout(timeout);
          ws.close();
          reject(error);
        }
        return;
      }
      const p = pending.get(msg.id);
      if (!p) return;
      pending.delete(msg.id);
      if (msg.error || msg.ok === false) p.reject(new Error(JSON.stringify(msg.error)));
      else p.resolve(msg.payload || {});
    };
  });
}

async function main() {
  let args;
  try { args = parseArgs(process.argv); } catch (error) { usage(); throw error; }
  const row = args.row;
  const sessionKey = args['session-key'];
  const nonce = args.nonce;
  const out = args.out;
  const limit = Number(args.limit || 200);
  if (!row || !sessionKey || !nonce || !out) {
    usage();
    process.exitCode = 2;
    return;
  }
  const token = process.env.OPENCLAW_GATEWAY_TOKEN;
  if (!token) throw new Error('OPENCLAW_GATEWAY_TOKEN is required');
  const url = process.env.OPENCLAW_GATEWAY_WS || 'ws://127.0.0.1:18789';
  const payload = await gatewayRequest({ url, token, method: 'sessions.get', params: { key: sessionKey, limit } });
  const messages = Array.isArray(payload.messages) ? payload.messages : [];
  const receipts = evaluate(row, nonce, messages);
  const result = {
    schema: 'openclaw.k6.session-receipt-recovery.v1',
    row,
    sessionKey,
    nonce,
    recoveredAt: new Date().toISOString(),
    messageCount: messages.length,
    receipts,
    outcome: receipts.every((r) => !r.required || r.status === 'present') ? 'PASS-candidate' : 'PARTIAL-candidate',
    notes: 'Supplemental post-run receipt from gateway sessions.get. Use only with the original k6 stdout/summary preserved; this can upgrade a live-window PARTIAL/rc=99 to PASS-candidate when all required receipts are present, but it never folds final proof verdicts automatically.',
  };
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
});
