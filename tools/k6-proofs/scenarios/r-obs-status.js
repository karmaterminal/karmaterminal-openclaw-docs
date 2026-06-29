import { buildRequest, connectFrame, RequestTracker } from '../lib/gateway-ws.js';
import { check, sleep } from 'k6';
import ws from 'k6/ws';

const ROW_ID = 'R-OBS-status';

export function setup() {
  const wsUrl = __ENV.GATEWAY_URL || 'ws://127.0.0.1:4000/api/v1/gateway';
  return { wsUrl, token: __ENV.GATEWAY_TOKEN || 'openclaw-local-testing-token' };
}

export default function(data) {
  let statusOk = false;
  let statusResponse = null;
  let wsError = null;
  let connectAck = null;
  let rawConnectAck = null;
  let connectionFrames = [];

  const res = ws.connect(data.wsUrl, {}, function(socket) {
    const tracker = new RequestTracker();
    
    socket.on('open', () => {
      // Send the connect frame explicitly including the target scopes since 
      // lib/gateway-ws.js connectFrame hardcodes the older structure
      const connectPayload = {
        type: 'req',
        id: 'conn-1',
        method: 'connect',
        params: {
          minProtocol: 3,
          maxProtocol: 4,
          client: {
            id: 'gateway-client',
            version: '0.2.0',
            platform: 'linux',
            mode: 'backend'
          },
          role: 'operator',
          scopes: ['operator.read', 'operator.write', 'session.control'],
          caps: [],
          commands: [],
          permissions: {},
          auth: { token: data.token },
          userAgent: 'k6-proof-harness/0.2.0'
        }
      };
      socket.send(JSON.stringify(connectPayload));
    });
    
    socket.on('message', (msg) => {
      let parsed;
      try { parsed = JSON.parse(msg); } catch (e) { return; }
      
      const classified = tracker.classify(parsed);
      connectionFrames.push(parsed);
      
      if (parsed.id === 'conn-1') {
        connectAck = parsed;
        rawConnectAck = msg;
        if (!parsed.error) {
           tracker.send(socket, 'status', {});
        } else {
           socket.close();
        }
      } else if (classified.kind === 'response' && classified.method === 'status') {
        statusResponse = classified.payload || parsed;
        statusOk = classified.ok;
        socket.close();
      }
    });
    
    socket.on('error', (e) => {
      wsError = e.error();
      console.log('WS error observed:', wsError);
    });
    
    socket.setTimeout(function() {
      socket.close();
    }, 10000);
  });
  
  check(res, { 'status is 101': (r) => r && r.status === 101 });
  check(connectAck, { 'connect ack received and ok': (r) => r && !r.error });
  check(statusResponse, { 'status response received': (r) => r !== null });
  check(statusOk, { 'status ok': (r) => r === true });
  
  const statusEvidence = statusOk ? "PASS-CANDIDATE" : "FAIL";
  
  const out = {
    rowId: ROW_ID,
    capture_sha: __ENV.TARGET_COMMIT_SHA || 'unknown',
    seat: __ENV.K6_SEAT || 'emeric',
    transport: 'ws',
    mutates: false,
    observed: {
      wsError: wsError,
      connectAck: connectAck,
      rawConnectAck: rawConnectAck,
      statusResponse: statusResponse,
      status_call_ok: statusOk,
      allFrames: connectionFrames,
      tempoTraceId: statusResponse && statusResponse.traceparent ? statusResponse.traceparent.split('-')[1] : null
    },
    redacted_events: [],
    status: statusEvidence
  };
  
  console.log(`\n=== K6-PROOF-EVIDENCE ===\n${JSON.stringify(out, null, 2)}\n=== END-EVIDENCE ===\n`);
}
