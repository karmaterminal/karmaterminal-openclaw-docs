/**
 * Scenario 0: Preflight inventory.
 *
 * Proves the harness can authenticate and that the target session
 * exposes expected continuation tools.
 */
import ws from 'k6/ws';
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { connectFrame, RequestTracker, redactEvent } from '../lib/gateway-ws.js';
import { loadManifestFromEnv, validateManifest } from '../lib/manifest-loader.js';

// Manifest-driven (non-blocking — preflight uses minimal config)
const manifest = loadManifestFromEnv();

export const options = {
  scenarios: {
    preflight: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '45s',
    },
  },
  thresholds: {
    proof_failures: ['count==0'],
  },
};

const failures = new Counter('proof_failures');
const duration = new Trend('preflight_duration');

function publicSessionScope(key) {
  if (!key) return 'unspecified';
  if (key === 'main' || key === 'agent:main:main') return 'main';
  if (key.startsWith('agent:main:')) return 'main-agent-session';
  if (key.startsWith('agent:')) return 'agent-session';
  return 'configured-session';
}

export default function () {
  const url = __ENV.OPENCLAW_GATEWAY_WS || 'ws://127.0.0.1:18789';
  const token = __ENV.OPENCLAW_GATEWAY_TOKEN;
  const sessionKey = manifest?.sessionKey || __ENV.OPENCLAW_SESSION_KEY || 'main';
  const seat = manifest?.seat || __ENV.OPENCLAW_SEAT_NAME || 'unknown-seat';

  if (!token) {
    console.error('OPENCLAW_GATEWAY_TOKEN is required');
    failures.add(1);
    return;
  }

  if (manifest) {
    const errors = validateManifest(manifest);
    if (errors.length > 0) {
      console.warn(`Manifest validation warnings: ${errors.join('; ')}`);
    }
  }

  const started = Date.now();
  const evidence = {
    row: 'preflight',
    issue: 101,
    manifest_loaded: !!manifest,
    seat,
    session_scope: publicSessionScope(sessionKey),
    candidateSha: manifest?.candidateSha || __ENV.OPENCLAW_CANDIDATE_SHA || 'unset',
    started: new Date().toISOString(),
    health_received: false,
    sessions_received: false,
    target_session_seen: false,
    tools_received: false,
    tool_count: 0,
    required_tools: ['continue_work', 'continue_delegate', 'request_compaction'],
    missing_tools: [],
    redacted_events: [],
  };

  const results = { health: null, tools: null, sessions: null };

  const res = ws.connect(url, {}, (socket) => {
    const tracker = new RequestTracker();

    socket.on('open', () => {
      socket.send(connectFrame(token));
      socket.setTimeout(() => tracker.send(socket, 'health'), 300);
      socket.setTimeout(() => tracker.send(socket, 'sessions.list'), 600);
      socket.setTimeout(() => tracker.send(socket, 'tools.effective', { sessionKey }), 900);
      socket.setTimeout(() => socket.close(), Number(manifest?.timeoutSeconds || 30) * 1000);
    });

    socket.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw);
        const classified = tracker.classify(msg);

        evidence.redacted_events.push({
          ts: Date.now(),
          kind: classified.kind,
          method: classified.method || null,
          event: classified.event || null,
          ok: classified.ok !== undefined ? classified.ok : null,
          data: classified.payload ? redactEvent(classified.payload) : null,
        });

        if (classified.kind === 'response') {
          if (classified.error) {
            console.error(`Request ${classified.method} failed: ${JSON.stringify(classified.error)}`);
            failures.add(1);
          }
          switch (classified.method) {
            case 'health':
              results.health = classified.payload;
              evidence.health_received = classified.ok && !!classified.payload;
              break;
            case 'sessions.list': {
              results.sessions = classified.payload?.sessions || classified.payload;
              evidence.sessions_received = classified.ok && !!results.sessions;
              const sessions = Array.isArray(results.sessions) ? results.sessions : [];
              evidence.target_session_seen = sessions.some((s) => {
                const key = s.sessionKey || s.key || s.id;
                return key === sessionKey || (sessionKey === 'main' && key === 'agent:main:main');
              });
              break;
            }
            case 'tools.effective': {
              // Response shape: { agentId, profile, groups: [{ tools: [{ id, ... }] }] }
              const groups = classified.payload?.groups || [];
              const allTools = Array.isArray(groups)
                ? groups.flatMap((g) => g.tools || [])
                : [];
              results.tools = allTools;
              evidence.tools_received = classified.ok && allTools.length > 0;
              evidence.tool_count = allTools.length;
              break;
            }
          }
        }
      } catch (e) {
        console.warn(`parse error: ${e}`);
      }
    });

    socket.on('error', (e) => {
      console.error(`ws error: ${e && e.error ? e.error() : e}`);
      failures.add(1);
    });
  });

  check(res, { 'websocket connected': (r) => r && r.status === 101 });

  evidence.ended = new Date().toISOString();
  evidence.duration_ms = Date.now() - started;
  duration.add(evidence.duration_ms);

  // Verify expected tools are visible
  if (results.tools && results.tools.length > 0) {
    // Tools use 'id' field, not 'name'
    const toolIds = results.tools.map((t) => t.id || t.name || t);

    const hasCW = toolIds.includes('continue_work');
    const hasCD = toolIds.includes('continue_delegate');
    const hasRC = toolIds.includes('request_compaction');
    evidence.missing_tools = evidence.required_tools.filter((tool) => !toolIds.includes(tool));

    check(null, {
      'continue_work visible': () => hasCW,
      'continue_delegate visible': () => hasCD,
      'request_compaction visible': () => hasRC,
    });

    if (!hasCW || !hasCD) {
      console.error(`Missing expected tools. Found ${toolIds.length} tools total.`);
      failures.add(1);
    } else {
      console.log(`Tools inventory: ${toolIds.length} tools, continuation tools present.`);
    }
  } else {
    console.error('No tools response received');
    failures.add(1);
  }

  if (!evidence.health_received || !evidence.sessions_received || !evidence.tools_received) {
    failures.add(1);
  }

  console.log(`Preflight complete. Health: ${JSON.stringify(results.health)}`);
  console.log(`\n--- PREFLIGHT EVIDENCE SUMMARY ---`);
  console.log(JSON.stringify(evidence, null, 2));
  console.log(`--- END EVIDENCE ---\n`);
}
