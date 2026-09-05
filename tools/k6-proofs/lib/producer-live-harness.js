/**
 * Shared live-producer helpers for restored missing-row k6 scenarios.
 * Static corpus validators must not import this module as a substitute fire.
 */
export const HARNESS_MARKER = '[k6-proof-harness]';

export function boolEnv(name) {
  return (__ENV[name] || '').toLowerCase() === 'true';
}

export function requireGatewayToken() {
  const token = __ENV.OPENCLAW_GATEWAY_TOKEN;
  if (!token) {
    console.error('OPENCLAW_GATEWAY_TOKEN is required for a live producer');
    return null;
  }
  return token;
}

export function disposableSessionKey(rowId, rowNonce) {
  return `${rowId.toLowerCase()}-${rowNonce}`.replace(/[^a-z0-9-]/g, '-');
}

export function eventText(classified) {
  return JSON.stringify(classified.data || classified.payload || {});
}

export function ignoreHarnessEcho(classified) {
  return eventText(classified).includes(HARNESS_MARKER);
}
