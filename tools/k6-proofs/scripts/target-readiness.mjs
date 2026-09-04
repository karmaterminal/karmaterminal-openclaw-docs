import { createHash } from 'node:crypto';

export const fingerprint = (value) => {
  try {
    const url = new URL(value);
    if (!['ws:', 'wss:'].includes(url.protocol) || url.username || url.password) return null;
    url.hostname = url.hostname.toLowerCase(); url.pathname = url.pathname.replace(/\/+$/, '') || '/'; url.search = ''; url.hash = '';
    return createHash('sha256').update(url.toString()).digest('hex');
  } catch { return null; }
};
export const configuredDepth = (payload) => {
  const value = payload?.config?.agents?.defaults?.subagents?.maxSpawnDepth;
  return Number.isInteger(value) && value > 0 ? value : null;
};

/** Public authenticated reads on the supplied target. Never consults runner config. */
export async function inspectTarget(wsUrl, token) {
  if (typeof WebSocket !== 'function') return { reachable: false, config: null };
  return new Promise((resolve) => {
    const ws = new WebSocket(wsUrl); const pending = new Map(); let serial = 0; let settled = false;
    const finish = (value) => { if (settled) return; settled = true; clearTimeout(timer); ws.close(); resolve(value); };
    const timer = setTimeout(() => finish({ reachable: false, config: null }), 3500);
    const call = (method, params = {}) => new Promise((res, rej) => { const id = `readiness-${++serial}`; pending.set(id, { res, rej }); ws.send(JSON.stringify({ type: 'req', id, method, params })); });
    ws.onopen = async () => { try {
      await call('connect', { minProtocol: 3, maxProtocol: 4, client: { id: 'k6-proof-readiness', version: '1.0.0', platform: 'node', mode: 'operator' }, role: 'operator', scopes: ['operator.read'], caps: [], commands: [], permissions: {}, auth: { token }, userAgent: 'k6-proof-readiness' });
      const config = await call('config.get'); finish({ reachable: true, config });
    } catch { finish({ reachable: false, config: null }); } };
    ws.onerror = () => finish({ reachable: false, config: null });
    ws.onmessage = (event) => { try { const message = JSON.parse(String(event.data)); const entry = pending.get(message.id); if (!entry) return; pending.delete(message.id); (message.ok === false || message.error) ? entry.rej(new Error('rejected')) : entry.res(message.payload); } catch { finish({ reachable: false, config: null }); } };
  });
}

export function evaluateTarget({ wsUrl, expectedFingerprint, observedDepth, requiredDepth, expectedDepth, rpcReachable }) {
  const actualFingerprint = fingerprint(wsUrl); const notes = [];
  if (!actualFingerprint) notes.push('gateway-url-invalid');
  if (!expectedFingerprint) notes.push('gateway-fingerprint-missing');
  else if (expectedFingerprint !== actualFingerprint) notes.push('gateway-fingerprint-mismatch');
  if (!rpcReachable) notes.push('target-rpc-unreachable');
  if (!Number.isInteger(observedDepth) || observedDepth < 1) notes.push('configured-depth-unknown');
  if (!Number.isInteger(requiredDepth) || requiredDepth < 1 || !Number.isInteger(expectedDepth) || expectedDepth < 1) notes.push('depth-requirement-invalid');
  if (Number.isInteger(observedDepth) && Number.isInteger(requiredDepth) && observedDepth < requiredDepth) notes.push('configured-depth-insufficient');
  if (Number.isInteger(observedDepth) && Number.isInteger(expectedDepth) && observedDepth !== expectedDepth) notes.push('configured-depth-unexpected');
  return { pass: notes.length === 0, notes, actualFingerprint, observedDepth: Number.isInteger(observedDepth) ? observedDepth : null };
}
