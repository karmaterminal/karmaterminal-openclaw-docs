/**
 * k6 PROOFS — Preflight Scenario
 * Issue #101: Verify gateway connectivity + tool surface before any mutating row fires.
 */

import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';

// Config — override via env vars
const GATEWAY_HOST = __ENV.GATEWAY_HOST || '127.0.0.1';
const GATEWAY_PORT = __ENV.GATEWAY_PORT || '18789';
const GATEWAY_BASE = `http://${GATEWAY_HOST}:${GATEWAY_PORT}`;
const GATEWAY_URL = __ENV.GATEWAY_URL || `ws://${GATEWAY_HOST}:${GATEWAY_PORT}`;
const GATEWAY_TOKEN = __ENV.GATEWAY_TOKEN || '';

const preflightPass = new Counter('preflight_pass');
const preflightFail = new Counter('preflight_fail');

export const options = {
  scenarios: {
    preflight: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '60s',
    },
  },
  thresholds: {
    'preflight_pass': ['count >= 5'],  // 4 HTTP + 1 WS must pass
    'preflight_fail': ['count == 0'],
  },
};

export default function () {
  const healthRes = http.get(`${GATEWAY_BASE}/health`);
  const healthOk = check(healthRes, { 'gateway health responds': (r) => r.status === 200 });
  if (healthOk) preflightPass.add(1); else preflightFail.add(1);

  let healthBody = null;
  try { healthBody = JSON.parse(healthRes.body); } catch (e) {}
  const healthJsonOk = check(healthBody, {
    'health returns ok:true': (b) => b && b.ok === true,
    'health returns status:live': (b) => b && b.status === 'live',
  });
  if (healthJsonOk) preflightPass.add(1); else preflightFail.add(1);

  const rootRes = http.get(`${GATEWAY_BASE}/`);
  const rootOk = check(rootRes, { 'gateway root serves content': (r) => r.status === 200 && r.body.includes('html') });
  if (rootOk) preflightPass.add(1); else preflightFail.add(1);

  const portOk = check(healthRes, { 'gateway port reachable': (r) => r.status !== 0 });
  if (portOk) preflightPass.add(1); else preflightFail.add(1);

  console.log(`Preflight HTTP checks complete: gateway at ${GATEWAY_BASE}`);

  // 5. WebSocket connection + tools.effective check
  const wsUrl = GATEWAY_URL;
  const wsParams = GATEWAY_TOKEN ? { headers: { Authorization: `Bearer ${GATEWAY_TOKEN}` } } : {};
  let wsPass = false;

  const res = ws.connect(wsUrl, wsParams, function (socket) {
    socket.on('open', () => {
      console.log(`[WS] Connected to ${wsUrl}. Waiting for connect.challenge...`);
    });

    socket.on('message', (msg) => {
      try {
        const data = JSON.parse(msg);
        
        if (data.type === 'event' && data.event === 'connect.challenge') {
           console.log(`[WS] Received connect.challenge. Sending handshake...`);
           const connectFrame = {
             type: 'req',
             id: 'connect-1',
             method: 'connect',
             params: {
               minProtocol: 1,
               maxProtocol: 4,
               client: {
                 id: 'gateway-client',
                 displayName: 'k6 PROOFS preflight probe',
                 version: '0.0.0',
                 platform: 'linux',
                 mode: 'backend'
               },
               role: 'operator',
               scopes: ['operator.read', 'operator.write']
             }
           };
           if (GATEWAY_TOKEN) {
              connectFrame.params.auth = { token: GATEWAY_TOKEN };
           }
           socket.send(JSON.stringify(connectFrame));
        }

        if (data.id === 'connect-1' && data.ok) {
           console.log(`[WS] Handshake successful. Requesting tools.effective for main session...`);
           socket.send(JSON.stringify({
             type: 'req',
             id: 'tools-effective-1',
             method: 'tools.effective',
             params: { sessionKey: 'main' }
           }));
        }
        
        if (data.id === 'tools-effective-1') {
           let hasWork = false;
           let hasDelegate = false;
           let hasCompact = false;
           
           if (data.ok && data.payload && data.payload.groups) {
             for (const group of data.payload.groups) {
               for (const tool of group.tools) {
                 if (tool.name === 'continue_work') hasWork = true;
                 if (tool.name === 'continue_delegate') hasDelegate = true;
                 if (tool.name === 'request_compaction') hasCompact = true;
               }
             }
           }
           
           wsPass = check(data, {
             'tools.effective returned ok': (d) => d.ok === true,
             'continue_work is visible': () => hasWork,
             'continue_delegate is visible': () => hasDelegate,
             'request_compaction is visible': () => hasCompact,
           });
           
           if (wsPass) {
             console.log(`[WS] Continuation tools verified`);
             preflightPass.add(1);
           } else {
             console.log(`[WS] Tool verification failed. Groups returned: ${JSON.stringify(data.payload ? data.payload.groups : [])}`);
             preflightFail.add(1);
           }
           socket.close();
        }
        
        if (data.error) {
           console.error(`[WS] Gateway error: ${data.error.message || JSON.stringify(data.error)}`);
           if (data.id === 'connect-1' || data.id === 'tools-effective-1') {
              socket.close();
           }
        }
      } catch (e) {
        // ignore raw parsing errors
      }
    });
    
    socket.on('error', (e) => {
      if (e.error() != 'websocket: close sent') console.error(`[WS] Socket error: ${e.error()}`);
    });
    socket.on('close', () => { console.log(`[WS] Connection closed`); });
  });
  
  const connectionCheck = check(res, { 'websocket connection check': (r) => r && r.status === 101 });
  if (!connectionCheck) preflightFail.add(1);
}
