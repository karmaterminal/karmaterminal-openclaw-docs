// The readiness fixture answers connect with a hand-written model of openclaw ab5a30ea
// (helpers/readiness-gateway.mjs, ab5aDeviceLessOperatorAdmission). Checking that model
// against itself proves nothing, so this runs ab5a's own decision functions, from byte-exact
// excerpts (fixtures/ab5a-connect-admission.json) with their types stripped, composed as
// connect-auth.ts composes them, and compares the two answers for every case the model covers.
//
// Still modelled, as transcribed inputs: what authorizeGatewayConnectCore returns per auth mode
// (auth.ts:554-570, 598-608), the shared-auth probe and auth method (auth-context.ts:90-117),
// the credential flags (connect-auth.ts:130-132), and the order connect-auth.ts applies the
// decision in (265-337, then the !authOk refusal at 445-452; for a device-less connect
// resolveConnectAuthDecision leaves the result unchanged, auth-context.ts:190 and 240).
// Pairing locality is an input too, as it is to the model.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';
import { ab5aDeviceLessOperatorAdmission } from './helpers/readiness-gateway.mjs';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/ab5a-connect-admission.json', import.meta.url), 'utf8'));
const TOKEN = 'ab5a-model-gateway-token';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

// Evaluates only the committed excerpts, and only while each still matches its pinned digest.
function ab5aFunctions() {
  assert.equal(typeof stripTypeScriptTypes, 'function', 'needs Node >= 22.13 (node:module stripTypeScriptTypes)');
  for (const excerpt of fixture.excerpts) {
    assert.equal(sha256(excerpt.source), excerpt.sha256, `${excerpt.path}:${excerpt.start}-${excerpt.end}`);
  }
  const typescript = fixture.excerpts.map((excerpt) => excerpt.source).join('\n');
  const javascript = stripTypeScriptTypes(typescript, { mode: 'strip' }).replace(/^export\s+/gmu, '');
  return new Function(`${javascript}
return {
  GATEWAY_CLIENT_IDS,
  GATEWAY_CLIENT_MODES,
  evaluateMissingDeviceIdentity,
  shouldClearUnboundScopesForMissingDeviceIdentity,
  shouldPreserveLocalCliSharedAuthScopes,
  shouldSkipLocalBackendSelfPairing,
};`)();
}

/** A device-less operator connect through ab5a's decision functions, in connect-auth.ts order. */
function ab5aConnect(ab5a, { authMode, token, locality }, params) {
  // authorizeGatewayConnectCore: none authorizes everything (auth.ts:554-570); token compares
  // the shared secret (auth.ts:598-608).
  const provided = params.auth?.token;
  const authResult = authMode === 'none'
    ? { ok: true, method: 'none' }
    : provided === token
      ? { ok: true, method: 'token' }
      : { ok: false, reason: 'token_mismatch' };
  // auth-context.ts:105-108 (no trusted proxy) and 116-117; connect-auth.ts:130-132.
  const sharedAuthOk = authResult.ok && authResult.method === 'token';
  const authMethod = authResult.method ?? 'token';
  const hasSharedAuth = Boolean(provided);
  const context = { connectParams: params, locality, hasBrowserOriginHeader: false, sharedAuthOk, authMethod };
  const skip = ab5a.shouldSkipLocalBackendSelfPairing(context);
  const preserve = ab5a.shouldPreserveLocalCliSharedAuthScopes(context);
  const decision = ab5a.evaluateMissingDeviceIdentity({
    hasDeviceIdentity: false,
    role: params.role,
    isControlUi: false,
    trustedProxyAuthOk: false,
    localBackendSelfPairingOk: skip,
    sharedAuthOk,
    authOk: authResult.ok,
    hasSharedAuth,
  });
  // connect-auth.ts:290-300: scopes clear unless a local backend or local cli path keeps them.
  const clear = !skip && !preserve &&
    ab5a.shouldClearUnboundScopesForMissingDeviceIdentity({ decision, authMethod });
  if (decision.kind === 'allow') {
    // An admitted connect whose credential failed is still refused (connect-auth.ts:445-452).
    if (!authResult.ok) {
      return { ok: false, error: { code: 'INVALID_REQUEST', detail: 'AUTH_TOKEN_MISMATCH' } };
    }
    // hello-ok auth.method is authMethod (connect-hello.ts:304-305).
    return { ok: true, method: authMethod, scopes: clear ? [] : params.scopes };
  }
  if (decision.kind === 'reject-unauthorized') {
    // rejectUnauthorized(authResult): INVALID_REQUEST, detail AUTH_TOKEN_MISMATCH (connect-auth.ts:318-321).
    return { ok: false, error: { code: 'INVALID_REQUEST', detail: 'AUTH_TOKEN_MISMATCH' } };
  }
  // reject-device-required (connect-auth.ts:323-327).
  return { ok: false, error: { code: 'NOT_PAIRED', detail: 'DEVICE_IDENTITY_REQUIRED' } };
}

function modelConnect(target, params) {
  const result = ab5aDeviceLessOperatorAdmission(target, params);
  return result.ok
    ? { ok: true, method: result.method, scopes: result.scopes }
    : { ok: false, error: { code: result.error.code, detail: result.error.details?.code } };
}

test('the ab5a excerpts are the pinned bytes', () => {
  assert.equal(fixture.sha, 'ab5a30ea79b776f149e24b1fccab9e79b0a5d299');
  for (const excerpt of fixture.excerpts) {
    const label = `${excerpt.path}:${excerpt.start}-${excerpt.end}`;
    assert.equal(sha256(excerpt.source), excerpt.sha256, label);
    assert.equal(excerpt.source.split('\n').length - 1, excerpt.end - excerpt.start + 1, label);
    assert.match(excerpt.blob, /^[0-9a-f]{40}$/u, label);
  }
});

test('the fixture model answers every device-less operator connect as ab5a\'s own decision functions do', () => {
  const ab5a = ab5aFunctions();
  const { GATEWAY_CLIENT_IDS: ids, GATEWAY_CLIENT_MODES: modes } = ab5a;
  // The harness identity is the product's backend client, and v2's was its cli client.
  assert.equal(ids.GATEWAY_CLIENT, 'gateway-client');
  assert.equal(modes.BACKEND, 'backend');
  assert.equal(ids.CLI, 'cli');
  assert.equal(modes.CLI, 'cli');
  const clients = [
    { id: ids.GATEWAY_CLIENT, mode: modes.BACKEND },
    { id: ids.CLI, mode: modes.CLI },
    { id: ids.GATEWAY_CLIENT, mode: modes.CLI },
    { id: ids.CLI, mode: modes.BACKEND },
    { id: ids.WEBCHAT, mode: modes.WEBCHAT },
  ];
  // Readiness always sends a token (inspectTarget stops at gateway-token-missing first).
  let cases = 0;
  for (const authMode of ['none', 'token']) {
    for (const locality of ['direct_local', 'remote']) {
      for (const client of clients) {
        for (const sent of [TOKEN, 'another-token']) {
          const target = { authMode, token: TOKEN, locality };
          const params = { client, role: 'operator', scopes: ['operator.read'], auth: { token: sent } };
          assert.deepEqual(
            modelConnect(target, params),
            ab5aConnect(ab5a, target, params),
            JSON.stringify({ authMode, locality, client, tokenMatches: sent === TOKEN }),
          );
          cases += 1;
        }
      }
    }
  }
  assert.equal(cases, 40);
});

test('through ab5a\'s functions: auth.mode=none admits only the local backend identity, token mode both', () => {
  const ab5a = ab5aFunctions();
  const connect = (authMode, client, token = TOKEN) => ab5aConnect(
    ab5a,
    { authMode, token: TOKEN, locality: 'direct_local' },
    { client, role: 'operator', scopes: ['operator.read'], auth: { token } },
  );
  const backend = { id: 'gateway-client', mode: 'backend' };
  const cli = { id: 'cli', mode: 'cli' };
  assert.deepEqual(connect('none', cli).error, { code: 'NOT_PAIRED', detail: 'DEVICE_IDENTITY_REQUIRED' });
  assert.deepEqual(connect('none', backend), { ok: true, method: 'none', scopes: ['operator.read'] });
  assert.deepEqual(connect('none', backend, 'any-token'), { ok: true, method: 'none', scopes: ['operator.read'] });
  assert.deepEqual(connect('token', cli), { ok: true, method: 'token', scopes: ['operator.read'] });
  assert.deepEqual(connect('token', backend), { ok: true, method: 'token', scopes: ['operator.read'] });
  assert.deepEqual(connect('token', backend, 'wrong').error, { code: 'INVALID_REQUEST', detail: 'AUTH_TOKEN_MISMATCH' });
});
