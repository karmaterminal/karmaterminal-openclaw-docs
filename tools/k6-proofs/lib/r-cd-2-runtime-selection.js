export const R_CD_2_REQUIRED_RUNTIME_ID = 'openclaw';

function normalizedText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function rcd2ModelRef(entry) {
  const provider = normalizedText(entry?.provider);
  const id = normalizedText(entry?.id);
  return provider && id ? `${provider}/${id}` : null;
}

export function findRcd2ModelMetadata(models, provider, model) {
  const expectedProvider = normalizedText(provider);
  const expectedModel = normalizedText(model);
  if (!Array.isArray(models) || !expectedProvider || !expectedModel) return null;
  return models.find((entry) =>
    normalizedText(entry?.provider) === expectedProvider &&
    normalizedText(entry?.id) === expectedModel) || null;
}

export function resolveRcd2ExecutionRuntime(entry) {
  const runtimeId = normalizedText(entry?.agentRuntime?.id).toLowerCase();
  const source = normalizedText(entry?.agentRuntime?.source) || null;
  if (runtimeId === R_CD_2_REQUIRED_RUNTIME_ID && source) {
    return {
      id: R_CD_2_REQUIRED_RUNTIME_ID,
      source,
      builtIn: true,
    };
  }
  return {
    id: runtimeId || null,
    source,
    builtIn: false,
  };
}

export function isRcd2OpenclawRuntime(entry) {
  return resolveRcd2ExecutionRuntime(entry).builtIn;
}

export function selectRcd2ExecutionModel(models, options = {}) {
  if (!Array.isArray(models)) return null;
  const candidates = models
    .filter((entry) =>
      entry?.available === true &&
      isRcd2OpenclawRuntime(entry) &&
      rcd2ModelRef(entry))
    .sort((left, right) => String(rcd2ModelRef(left)).localeCompare(String(rcd2ModelRef(right))));

  const requestedModel = normalizedText(options.requestedModel);
  if (!requestedModel) return candidates[0] || null;

  const separator = requestedModel.indexOf('/');
  if (separator <= 0 || separator === requestedModel.length - 1) return null;
  const requested = findRcd2ModelMetadata(
    candidates,
    requestedModel.slice(0, separator),
    requestedModel.slice(separator + 1),
  );
  return requested || null;
}

export function findRcd2Session(sessions, key) {
  const expectedKey = normalizedText(key);
  if (!Array.isArray(sessions) || !expectedKey) return null;
  return sessions.find((entry) => normalizedText(entry?.key) === expectedKey) || null;
}

export function verifyRcd2SessionCreateResponse(payload, key, selectedModel) {
  const selectedRef = rcd2ModelRef(selectedModel);
  const sessionId = normalizedText(payload?.sessionId);
  if (!payload || !selectedRef || normalizedText(payload.key) !== normalizedText(key) ||
      !sessionId || normalizedText(payload?.entry?.sessionId) !== sessionId) {
    return false;
  }
  return normalizedText(payload?.resolved?.modelProvider) === normalizedText(selectedModel.provider) &&
    normalizedText(payload?.resolved?.model) === normalizedText(selectedModel.id);
}

export function verifyRcd2ListedSession(session, key, sessionId, selectedModel) {
  const selectedRef = rcd2ModelRef(selectedModel);
  if (!session || !selectedRef || normalizedText(session.key) !== normalizedText(key) ||
      normalizedText(session.sessionId) !== normalizedText(sessionId)) {
    return false;
  }
  const selectedRuntime = resolveRcd2ExecutionRuntime(selectedModel);
  const sessionRuntime = resolveRcd2ExecutionRuntime(session);
  const bound = Boolean(session.channelId || session.channel || session.deliveryChannel);
  return !bound &&
    normalizedText(session.modelProvider) === normalizedText(selectedModel.provider) &&
    normalizedText(session.model) === normalizedText(selectedModel.id) &&
    selectedRuntime.builtIn &&
    sessionRuntime.builtIn &&
    sessionRuntime.id === selectedRuntime.id &&
    sessionRuntime.source === selectedRuntime.source;
}
