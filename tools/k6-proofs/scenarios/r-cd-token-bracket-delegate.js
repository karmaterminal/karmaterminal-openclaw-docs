import { check, sleep } from 'k6';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js';
import { connectFrame, RequestTracker, redactEvent } from '../lib/gateway-ws.js';
import { loadManifestFromEnv } from '../lib/manifest-loader.js';

export const options = {
    vus: 1,
    iterations: 1,
};

const { manifest, errors } = loadManifestFromEnv(__ENV.OPENCLAW_ROW_MANIFEST || 'manifests/r-cd-token.json');
const artifacts = {
    manifest: manifest,
    events: [],
    errors: [],
};

if (errors.length > 0) {
    console.error(`Manifest validation warnings: ${errors.join('; ')}`);
}

export default function () {
    if (errors.length > 0) {
        throw new Error('Manifest validation failed; aborting run.');
    }

    const wsUrl = __ENV[manifest.gateway.wsEnv];
    const token = __ENV[manifest.gateway.tokenEnv];
    const sessionKey = manifest.sessionKey;

    if (!wsUrl || !token || !sessionKey) {
        throw new Error('Missing OPENCLAW_GATEWAY_WS, OPENCLAW_GATEWAY_TOKEN, or OPENCLAW_SESSION_KEY environment variables.');
    }

    const tracker = new RequestTracker();
    let isConnected = false;
    let authSuccess = false;
    let delegateScheduled = false;
    let delegateReturned = false;
    let noTypedToolCall = true;

    const res = connectFrame(wsUrl, function (socket) {
        tracker.setSocket(socket);

        socket.on('open', () => {
            isConnected = true;
            tracker.sendRequest('auth', { token });
        });

        socket.on('message', (data) => {
            const msg = JSON.parse(data);
            artifacts.events.push(redactEvent(msg));

            if (msg.type === 'response') {
                const classified = tracker.handleResponse(msg);
                if (classified.method === 'auth' && !classified.error) {
                    authSuccess = true;
                    // Trigger the delegate using bracket syntax
                    tracker.sendRequest('session.message', {
                        sessionKey: sessionKey,
                        message: "Do not use any tools. Simply reply with the following exact text at the very end of your message: [[CONTINUE_DELEGATE: Return the exact string R-CD-TOKEN-SUCCESS silently | silent ]]",
                    });
                } else if (classified.method === 'session.message') {
                     if (!classified.error) {
                         delegateScheduled = true;
                     }
                }
                
                if (classified.error) {
                    artifacts.errors.push(`Request ${classified.method} failed: ${JSON.stringify(classified.error)}`);
                }
            } else if (msg.type === 'event' && msg.payload && msg.payload.type === 'tool_call') {
                if (msg.payload.tool === 'continue_delegate') {
                    noTypedToolCall = false; // The bracket syntax should be used, not the tool
                }
            } else if (msg.type === 'event' && msg.payload && msg.payload.type === 'message' && msg.payload.role === 'user') {
                // Detect the silent return payload
                if (msg.payload.text && msg.payload.text.includes('R-CD-TOKEN-SUCCESS')) {
                    delegateReturned = true;
                    socket.close(); 
                }
            }
        });

        socket.on('error', (e) => {
            if (e.error() != "websocket: close 1000 (normal)") {
                artifacts.errors.push(`WebSocket error: ${e.error()}`);
            }
        });

        socket.setTimeout(function () {
            if (!delegateReturned) {
               artifacts.errors.push('Scenario timed out before delegate returned.');
               socket.close();
            }
        }, manifest.timeoutSeconds * 1000);
    });

    check(res, {
        'Connected successfully': () => isConnected,
        'Authenticated successfully': () => authSuccess,
        'Delegate scheduled via bracket': () => delegateScheduled,
        'No typed continue_delegate tool call used': () => noTypedToolCall,
        'Delegate returned': () => delegateReturned,
        'No errors encountered': () => artifacts.errors.length === 0,
    });
}

export function handleSummary(data) {
    const summary = textSummary(data, { indent: ' ', enableColors: true });

    if (artifacts.events && artifacts.events.some(e => e.sessionKey || e.childSessionKey)) {
        artifacts.errors.push('FATAL: Evidence payload contains raw unredacted "events" field.');
    }

    const evidenceBundle = JSON.stringify(artifacts, null, 2);
    const isPass = artifacts.errors.length === 0 && data.metrics.checks && data.metrics.checks.fails === 0;

    const fullOutput = summary + 
        `\n\n--- PREFLIGHT EVIDENCE SUMMARY ---\n` +
        evidenceBundle +
        `\n--- END EVIDENCE ---\n` +
        `\nOutcome: ${isPass ? 'PASS-candidate' : 'FAIL-candidate'}\n`;

    return {
        'stdout': fullOutput,
        'k6-summary.json': JSON.stringify(data, null, 2)
    };
}
