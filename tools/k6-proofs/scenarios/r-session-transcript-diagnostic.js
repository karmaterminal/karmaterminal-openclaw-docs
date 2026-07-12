/**
 * Read-only diagnostic for disposable Project 81 proof sessions.
 *
 * Logs only nonce-correlated transcript text from an explicitly selected
 * scratch session so a failed event detector can be classified safely.
 */
import ws from 'k6/ws';
import { check } from 'k6';
import { Counter } from 'k6/metrics';
import { connectFrame, RequestTracker } from '../lib/gateway-ws.js';
import { loadManifestFromEnv } from '../lib/manifest-loader.js';

export const options = {
  scenarios: {
    r_session_transcript_diagnostic: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '60s',
    },
  },
  thresholds: {
    proof_failures: ['count==0'],
  },
};

const failures = new Counter('proof_failures');
const manifest = loadManifestFromEnv();

function textParts(value, out = []) {
  if (typeof value === 'string') {
    out.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) textParts(item, out);
  } else if (value && typeof value === 'object') {
    if (typeof value.text === 'string') out.push(value.text);
    if (typeof value.content === 'string') out.push(value.content);
    if (Array.isArray(value.content)) textParts(value.content, out);
    if (value.arguments) out.push(JSON.stringify(value.arguments));
  }
  return out;
}

function messageText(message) {
  return textParts(message?.content).join('\n');
}

function sanitize(text) {
  return text
    .replace(/https?:\/\/\S+/g, '[url]')
    .replace(/\b\d{17,20}\b/g, '[snowflake]')
    .slice(0, 800);
}

function nonceFromSessionKey(sessionKey) {
  const match = String(sessionKey).match(/r-cd-2-(\d+-[a-z0-9]+)$/i);
  return match ? `R-CD-2-${match[1]}` : '';
}

export default function () {
  const url = __ENV.OPENCLAW_GATEWAY_WS || 'ws://127.0.0.1:18789';
  const token = __ENV.OPENCLAW_GATEWAY_TOKEN;
  const sessionKey = manifest?.sessionKey || __ENV.OPENCLAW_SESSION_KEY;
  const targetNonce = __ENV.OPENCLAW_DIAGNOSTIC_NONCE || nonceFromSessionKey(sessionKey);
  let received = false;
  let summary = [];

  if (!token || !sessionKey || !targetNonce) {
    console.error('Gateway token, session key, and a diagnostic nonce are required');
    failures.add(1);
    return;
  }

  const res = ws.connect(url, {}, (socket) => {
    const tracker = new RequestTracker();

    socket.on('open', () => {
      socket.send(connectFrame(token));
      socket.setTimeout(() => {
        tracker.send(socket, 'sessions.get', { key: sessionKey, limit: 200 });
      }, 300);
      socket.setTimeout(() => socket.close(), 15000);
    });

    socket.on('message', (raw) => {
      try {
        const classified = tracker.classify(JSON.parse(raw));
        if (classified.kind !== 'response' || classified.method !== 'sessions.get') return;
        if (!classified.ok) {
          console.error(`sessions.get failed: ${JSON.stringify(classified.error)}`);
          failures.add(1);
          socket.close();
          return;
        }

        const messages = Array.isArray(classified.payload?.messages)
          ? classified.payload.messages
          : [];
        summary = messages.map((message, index) => {
          const text = messageText(message);
          const correlated = text.includes(targetNonce);
          return {
            index,
            role: message?.role || null,
            contentTypes: Array.isArray(message?.content)
              ? message.content.map((item) => item?.type || typeof item)
              : [typeof message?.content],
            correlated,
            hasHarnessMarker: text.includes('[k6-proof-harness]'),
            hasContinuationWake: text.includes('[continuation:wake]'),
            hasChannel: text.toLowerCase().includes('channel'),
            hasDeliver: text.toLowerCase().includes('deliver'),
            text: correlated ? sanitize(text) : null,
          };
        });
        received = true;
        console.log(`SESSION_TRANSCRIPT_DIAGNOSTIC ${JSON.stringify({
          sessionKey,
          targetNonce,
          messageCount: messages.length,
          messages: summary,
        })}`);
        socket.close();
      } catch (error) {
        console.warn(`parse error: ${error}`);
      }
    });

    socket.on('error', (error) => {
      console.error(`ws error: ${error && error.error ? error.error() : error}`);
      failures.add(1);
    });
  });

  check(res, { 'websocket connected': (response) => response?.status === 101 });
  check(null, {
    'sessions.get response received': () => received,
    'nonce-correlated message found': () => summary.some((message) => message.correlated),
  });
  if (!received || !summary.some((message) => message.correlated)) failures.add(1);
}

export function handleSummary(data) {
  const passed = data.metrics.proof_failures?.values?.count === 0;
  return {
    stdout: `\n[R-SESSION-DIAG] Summary: ${passed ? 'PASS-diagnostic' : 'FAIL-diagnostic'}\n`,
    'r-session-transcript-diagnostic-summary.json': JSON.stringify({
      row: 'R-SESSION-DIAG',
      verdict: passed ? 'PASS-diagnostic' : 'FAIL-diagnostic',
      timestamp: new Date().toISOString(),
    }, null, 2),
  };
}
