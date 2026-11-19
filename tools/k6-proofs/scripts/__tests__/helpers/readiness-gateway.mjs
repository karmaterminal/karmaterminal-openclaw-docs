import { createHash } from 'node:crypto';
import { HARNESS_CLIENT_IDENTITY } from '../../../lib/gateway-client-identity.mjs';

const NOT_PAIRED = Object.freeze({
  code: 'NOT_PAIRED',
  message: 'device identity required',
  details: { code: 'DEVICE_IDENTITY_REQUIRED' },
});
const TOKEN_MISMATCH = Object.freeze({
  code: 'INVALID_REQUEST',
  message: 'unauthorized: gateway token mismatch',
  details: { code: 'AUTH_TOKEN_MISMATCH', authReason: 'token_mismatch' },
});

/**
 * How openclaw ab5a30ea79b776f149e24b1fccab9e79b0a5d299 answers a device-less operator
 * connect. `locality` 'direct_local' is a loopback socket with no Origin or forwarding
 * headers, which is what Node's WebSocket opens; 'remote' is any other attribution.
 * - auth.mode=none authorizes every connect as method "none", token or not (auth.ts:554-570).
 *   Only a local gateway-client/backend skips self-pairing (handshake-auth-helpers.ts:165-187,
 *   connect-policy.ts:85-87) and keeps its scopes (connect-auth.ts:290-300); any other
 *   device-less operator is NOT_PAIRED "device identity required" (connect-policy.ts:91-97,
 *   connect-auth.ts:323-327).
 * - auth.mode=token needs the shared token (auth.ts:598-608); a device-less connect with a wrong
 *   one is refused as unauthorized (connect-policy.ts:94-96, connect-auth.ts:318-321). A local
 *   backend keeps its scopes through the same skip, a local `cli` through
 *   shouldPreserveLocalCliSharedAuthScopes (handshake-auth-helpers.ts:189-203); a remote
 *   device-less operator is admitted with its scopes cleared (connect-policy.ts:57-67, 91-93).
 * ab5a pins both modes over a real server in src/gateway/server.auth.compat-baseline.test.ts:78-151.
 * readiness-gateway-ab5a-model.test.mjs checks this model against ab5a's own decision functions.
 */
export function ab5aDeviceLessOperatorAdmission({ authMode, token, locality = 'direct_local' }, params) {
  const client = params?.client || {};
  const local = locality === 'direct_local';
  const backend = client.id === HARNESS_CLIENT_IDENTITY.id && client.mode === HARNESS_CLIENT_IDENTITY.mode;
  const cli = client.id === 'cli' && client.mode === 'cli';
  const scopes = Array.isArray(params?.scopes) ? params.scopes : [];
  if (params?.device || params?.role !== 'operator') {
    throw new Error('the readiness fixture models device-less operator connects only');
  }
  if (authMode === 'none') {
    return local && backend
      ? { ok: true, method: 'none', scopes }
      : { ok: false, error: NOT_PAIRED };
  }
  if (authMode !== 'token') throw new Error(`unmodelled auth mode: ${authMode}`);
  if (params?.auth?.token !== token) return { ok: false, error: TOKEN_MISMATCH };
  return { ok: true, method: 'token', scopes: local && (backend || cli) ? scopes : [] };
}

/**
 * A readiness target on `server`. It answers connect with the ab5a admission above and
 * records every connect's public shape in the returned `connects`.
 *
 * `requireClient` (default: the harness identity) answers any other client with an
 * INVALID_REQUEST instead, so a suite that only needs a working target still fails if
 * readiness stops presenting the row scenarios' identity. Pass `null` to see ab5a's own
 * answer to another identity.
 *
 * `methods` answers further RPCs after an admitted connect: `{ [method]: (params) => answer }`,
 * where an answer is `{ ok: true, payload }` or `{ ok: false, error }`, or `{ close: true }` to drop
 * the connection unanswered. An answer may be a promise. Every call is recorded in `calls`, with
 * the scopes its connection was admitted with.
 */
export function attachReadinessGateway(server, {
  token,
  runtimeSha,
  configuredDepth = 5,
  effectiveDepth = configuredDepth,
  authMode = 'token',
  locality = 'direct_local',
  requireClient = HARNESS_CLIENT_IDENTITY,
  methods = {},
} = {}) {
  const connects = [];
  const calls = [];
  const send = (socket, value) => {
    const payload = Buffer.from(JSON.stringify(value));
    let header;
    if (payload.length < 126) {
      header = Buffer.from([0x81, payload.length]);
    } else if (payload.length < 0x10000) {
      header = Buffer.from([0x81, 126, payload.length >> 8, payload.length & 0xff]);
    } else {
      header = Buffer.alloc(10);
      header[0] = 0x81;
      header[1] = 127;
      header.writeBigUInt64BE(BigInt(payload.length), 2);
    }
    socket.write(Buffer.concat([header, payload]));
  };
  const continuation = {
    enabled: true,
    maxChainLength: 3,
    maxDelegatesPerTurn: 3,
    costCapTokens: 1000,
  };

  server.on('upgrade', (request, socket) => {
    const accept = createHash('sha1')
      .update(`${request.headers['sec-websocket-key']}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
      .digest('base64');
    socket.write([
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${accept}`,
      '\r\n',
    ].join('\r\n'));
    send(socket, {
      type: 'event',
      event: 'connect.challenge',
      payload: { nonce: 'readiness-fixture-challenge', ts: Date.now() },
    });
    let buffered = Buffer.alloc(0);
    let admittedScopes = null;
    // A client killed mid-request (a SIGKILLed meter) resets its socket; that is
    // the client's failure to observe, never an uncaught error in the test.
    socket.on('error', () => socket.destroy());
    socket.on('data', (chunk) => {
      buffered = Buffer.concat([buffered, chunk]);
      while (buffered.length >= 2) {
        const opcode = buffered[0] & 0x0f;
        const masked = (buffered[1] & 0x80) !== 0;
        let length = buffered[1] & 0x7f;
        let offset = 2;
        if (length === 126) {
          if (buffered.length < 4) return;
          length = buffered.readUInt16BE(2);
          offset = 4;
        }
        const maskLength = masked ? 4 : 0;
        if (buffered.length < offset + maskLength + length) return;
        const mask = masked ? buffered.subarray(offset, offset + 4) : null;
        offset += maskLength;
        const payload = Buffer.from(buffered.subarray(offset, offset + length));
        buffered = buffered.subarray(offset + length);
        if (opcode === 0x8) {
          socket.end();
          return;
        }
        if (mask) {
          for (let index = 0; index < payload.length; index += 1) {
            payload[index] ^= mask[index % 4];
          }
        }
        const frame = JSON.parse(payload.toString('utf8'));
        if (frame.method === 'connect') {
          const params = frame.params || {};
          connects.push({
            client: { id: params.client?.id, mode: params.client?.mode },
            role: params.role,
            scopes: params.scopes,
            device: params.device !== undefined,
            tokenMatches: params.auth?.token === token,
          });
          const unexpectedClient = requireClient && (
            params.client?.id !== requireClient.id || params.client?.mode !== requireClient.mode
          );
          const admission = unexpectedClient
            ? {
                ok: false,
                error: {
                  code: 'INVALID_REQUEST',
                  message: 'readiness fixture: unexpected client identity',
                  details: { code: 'FIXTURE_UNEXPECTED_CLIENT' },
                },
              }
            : ab5aDeviceLessOperatorAdmission({ authMode, token, locality }, params);
          if (!admission.ok) {
            send(socket, { type: 'res', id: frame.id, ok: false, error: admission.error });
            socket.end(Buffer.from([0x88, 0x02, 0x03, 0xf0]));
            return;
          }
          admittedScopes = admission.scopes;
          send(socket, {
            type: 'res',
            id: frame.id,
            ok: true,
            payload: {
              type: 'hello-ok',
              protocol: 4,
              server: {
                version: '2026.8.1',
                buildId: `2026.8.1-${runtimeSha.slice(0, 12)}-fixture`,
                bootId: 'readiness-fixture-boot',
                connId: 'readiness-fixture-connection',
              },
              features: { methods: ['config.get'], events: ['connect.challenge'] },
              snapshot: {},
              auth: { method: admission.method, role: 'operator', scopes: admission.scopes },
              policy: { maxPayload: 1024, maxBufferedBytes: 2048, tickIntervalMs: 1000 },
            },
          });
        } else if (Object.hasOwn(methods, frame.method)) {
          calls.push({ method: frame.method, params: frame.params ?? null, at: Date.now(), scopes: admittedScopes });
          Promise.resolve()
            .then(() => methods[frame.method](frame.params ?? {}))
            .then((answer) => {
              if (answer?.close) {
                socket.destroy();
                return;
              }
              send(socket, answer?.ok === false
                ? { type: 'res', id: frame.id, ok: false, error: answer.error }
                : { type: 'res', id: frame.id, ok: true, payload: answer?.payload ?? null });
            })
            .catch(() => socket.destroy());
        } else if (frame.method === 'config.get') {
          send(socket, {
            type: 'res',
            id: frame.id,
            ok: true,
            payload: {
              valid: true,
              sourceConfig: {
                agents: {
                  defaults: {
                    subagents: { maxSpawnDepth: configuredDepth },
                    continuation,
                  },
                },
              },
              config: {
                agents: {
                  defaults: {
                    subagents: { maxSpawnDepth: effectiveDepth },
                    continuation,
                  },
                },
              },
              configRevisionHash: 'readiness-fixture-applied',
              appliedConfigHash: 'readiness-fixture-applied',
            },
          });
        }
      }
    });
  });
  return { connects, calls };
}
