/**
 * The Gateway client identity the k6 harness presents on connect.
 *
 * Row scenarios (lib/gateway-ws.js connectFrame) and target readiness
 * (scripts/target-readiness.mjs) both import it, so readiness checks admission
 * with the identity the rows will actually use. Neither sends a device identity.
 *
 * A Gateway admits this device-less operator from loopback in both auth modes the
 * fleet runs (openclaw ab5a30ea79b776f149e24b1fccab9e79b0a5d299):
 * - auth.mode=none: the connect authorizes as method "none" and the local backend
 *   self-pairing skip applies (src/gateway/server/ws-connection/handshake-auth-helpers.ts:165-187,
 *   connect-policy.ts:85-87). A device-less `cli` client is refused there with
 *   NOT_PAIRED "device identity required" (connect-policy.ts:91-97, connect-auth.ts:323-327).
 * - auth.mode=token: the shared token must match (auth.ts:598-608); then the same skip
 *   applies through sharedAuthOk, and a wrong token is refused (connect-auth.ts:445-452).
 *
 * Shared by k6 scenarios and Node scripts, so it is .mjs (see lib/tool-call-identity.mjs).
 */
export const HARNESS_CLIENT_IDENTITY = Object.freeze({
  id: 'gateway-client',
  mode: 'backend',
});
