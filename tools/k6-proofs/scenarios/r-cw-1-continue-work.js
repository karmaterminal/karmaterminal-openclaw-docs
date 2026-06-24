import { check, sleep } from 'k6';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js';
import { connectToGateway, RequestTracker, redactEvent } from '../lib/gateway-ws.js';
import { loadManifest } from '../lib/manifest-loader.js';

export const options = {
    vus: 1,
    iterations: 1,
};

// Initialize manifest and artifacts at module level so handleSummary can access them
const { manifest, errors } = loadManifest(__ENV.OPENCLAW_ROW_MANIFEST || 'manifests/r-cw-1.json');
const artifacts = {
    manifest: manifest,
    events: [], // Redacted events
    errors: [],
};

if (errors.length > 0) {
    console.error(`Manifest validation warnings: ${errors.join('; ')}`);
}

export default function () {
    if (errors.length > 0) {
        throw new Error('Manifest validation failed; aborting run.');
    }

    const wsUrl = manifest.gateway.wsEnv;
    const token = manifest.gateway.tokenEnv;
    const sessionKey = manifest.sessionKey;

    if (!wsUrl || !token || !sessionKey) {
        throw new Error('Missing OPENCLAW_GATEWAY_WS, OPENCLAW_GATEWAY_TOKEN, or OPENCLAW_SESSION_KEY environment variables.');
    }

    const tracker = new RequestTracker();
    let isConnected = false;
    let authSuccess = false;
    let continuationScheduled = false;

    const res = connectToGateway(wsUrl, function (socket) {
        tracker.setSocket(socket);

        socket.on('open', () => {
            isConnected = true;
            // 1. Authenticate
            tracker.sendRequest('auth', { token });
        });

        socket.on('message', (data) => {
            const msg = JSON.parse(data);
            artifacts.events.push(redactEvent(msg)); // ONLY push redacted events

            if (msg.type === 'response') {
                const classified = tracker.handleResponse(msg);
                if (classified.method === 'auth' && !classified.error) {
                    authSuccess = true;
                    // 2. Trigger the continuation
                    tracker.sendRequest('session.message', {
                        sessionKey: sessionKey,
                        message: "Use the continue_work tool immediately to schedule a continuation turn with a 5 second delay. Reason: k6 PROOFS R-CW-1 validation.",
                    });
                } else if (classified.method === 'session.message') {
                     if (!classified.error) {
                         continuationScheduled = true;
                     }
                }
                
                if (classified.error) {
                    artifacts.errors.push(`Request ${classified.method} failed: ${JSON.stringify(classified.error)}`);
                }
            } else if (msg.type === 'event' && msg.payload && msg.payload.type === 'tool_call') {
                // Observe tool calls for the continuation
                if (msg.payload.tool === 'continue_work') {
                    continuationScheduled = true;
                }
            }
        });

        socket.on('error', (e) => {
            if (e.error() != "websocket: close 1000 (normal)") {
                artifacts.errors.push(`WebSocket error: ${e.error()}`);
            }
        });

        socket.setTimeout(function () {
            if (authSuccess && continuationScheduled) {
                // Wait briefly for the scheduled turn to be accepted by the gateway before closing
                socket.setTimeout(function() {
                     socket.close();
                }, 2000);
            } else {
               artifacts.errors.push('Scenario timed out before completion.');
               socket.close();
            }
        }, manifest.timeoutSeconds * 1000);
    });

    check(res, {
        'Connected successfully': () => isConnected,
        'Authenticated successfully': () => authSuccess,
        'Continuation scheduled': () => continuationScheduled,
        'No errors encountered': () => artifacts.errors.length === 0,
    });
}

export function handleSummary(data) {
    // Generate the standard text summary for stdout
    const summary = textSummary(data, { indent: ' ', enableColors: true });

    // Validate that no raw events leaked into the artifacts
    if (artifacts.events && artifacts.events.some(e => e.sessionKey || e.childSessionKey)) {
        artifacts.errors.push('FATAL: Evidence payload contains raw unredacted "events" field.');
    }

    // Embed the evidence bundle within the summary string using the markers the post-processor expects
    const evidenceBundle = JSON.stringify(artifacts, null, 2);
    
    // Check if the run achieved PASS-candidate threshold
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
