// The OTel service name a row's continuation spans are queried under. The
// collector (scripts/collect-continuation-trace.mjs) and the R-CD-2
// acquisition-receipt validator must derive it identically, or a receipt from
// an isolated gateway with its own service name can never validate.
// Default: the fleet convention `<prince>-prince`, from the seat name.
// Override: OPENCLAW_PROOFS_SERVICE_NAME (docs #560), for isolated gateways.

export function escapeTraceqlString(value) {
  const text = String(value ?? '');
  if (!/^[A-Za-z0-9._:/-]+$/.test(text)) throw new Error(`unsafe TraceQL value: ${text}`);
  return text;
}

export function proofsServiceName({ seat, override } = {}) {
  if (override) return escapeTraceqlString(override);
  return `${escapeTraceqlString(String(seat).split('-')[0])}-prince`;
}
