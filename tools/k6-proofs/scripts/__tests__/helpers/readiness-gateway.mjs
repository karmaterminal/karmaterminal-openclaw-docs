import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

export function attachReadinessGateway(server, {
  token,
  runtimeSha,
  configuredDepth = 5,
  effectiveDepth = configuredDepth,
} = {}) {
  const send = (socket, value) => {
    const payload = Buffer.from(JSON.stringify(value));
    const header = payload.length < 126
      ? Buffer.from([0x81, payload.length])
      : Buffer.from([0x81, 126, payload.length >> 8, payload.length & 0xff]);
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
          assert.equal(frame.params.client.id, 'cli');
          assert.equal(frame.params.client.mode, 'cli');
          assert.equal(frame.params.auth.token, token);
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
              auth: { role: 'operator', scopes: ['operator.read'] },
              policy: { maxPayload: 1024, maxBufferedBytes: 2048, tickIntervalMs: 1000 },
            },
          });
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
              configRevisionHash: 'readiness-fixture-revision',
              appliedConfigHash: 'readiness-fixture-applied',
            },
          });
        }
      }
    });
  });
}
