/**
 * Isolated proof configs must register the plugin that owns the selected
 * model's agent runtime. Observation is config-derived, never ambient host
 * plugin state and never an expected model/plugin string substitute.
 */

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeId(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function pluginIdList(value) {
  return Array.isArray(value)
    ? value.map(normalizeId).filter(Boolean)
    : [];
}

export function readPrimaryModelRef(config) {
  const model = config?.agents?.defaults?.model;
  if (typeof model === 'string' && model.trim()) return model.trim();
  if (isObject(model) && typeof model.primary === 'string' && model.primary.trim()) {
    return model.primary.trim();
  }
  return null;
}

function explicitAgentRuntimeId(config, modelRef) {
  const defaults = isObject(config?.agents?.defaults) ? config.agents.defaults : {};
  const modelRuntime = modelRef && isObject(defaults.models)
    ? defaults.models[modelRef]?.agentRuntime?.id
    : null;
  const agentRuntime = defaults.agentRuntime?.id;
  const provider = modelRef?.includes('/') ? modelRef.slice(0, modelRef.indexOf('/')) : null;
  const providerRuntime = provider && isObject(config?.models?.providers)
    ? config.models.providers[provider]?.agentRuntime?.id
    : null;
  for (const value of [modelRuntime, agentRuntime, providerRuntime]) {
    const id = normalizeId(value);
    if (id) return id;
  }
  return null;
}

/**
 * Bundled OpenClaw semantics: canonical openai/* agent refs and explicit
 * agentRuntime.id "codex" are owned by the codex plugin. Embedded OpenClaw
 * traffic is opt-in via agentRuntime.id "openclaw".
 */
export function resolveRequiredRuntimePlugin(config) {
  const selectedModelRef = readPrimaryModelRef(config);
  const runtime = explicitAgentRuntimeId(config, selectedModelRef);
  if (runtime === 'openclaw' || runtime === 'auto') {
    return {
      required: false,
      runtime,
      pluginId: null,
      selectedModelRef,
      reason: 'embedded-openclaw-runtime',
    };
  }
  if (runtime === 'codex' || (!runtime && selectedModelRef?.startsWith('openai/'))) {
    return {
      required: true,
      runtime: 'codex',
      pluginId: 'codex',
      selectedModelRef,
      reason: runtime === 'codex' ? 'explicit-codex-runtime' : 'openai-codex-owned-ref',
    };
  }
  if (runtime) {
    return {
      required: true,
      runtime,
      pluginId: runtime,
      selectedModelRef,
      reason: 'explicit-plugin-runtime',
    };
  }
  return {
    required: false,
    runtime: null,
    pluginId: null,
    selectedModelRef,
    reason: 'no-plugin-runtime-required',
  };
}

export function observePluginRegistration(config, pluginId) {
  const id = normalizeId(pluginId);
  const plugins = isObject(config?.plugins) ? config.plugins : null;
  if (!id) {
    return {
      present: false,
      enabled: false,
      allowListed: null,
      denied: false,
      pluginsEnabled: null,
    };
  }
  if (!plugins) {
    return {
      present: false,
      enabled: false,
      allowListed: null,
      denied: false,
      pluginsEnabled: null,
    };
  }
  const pluginsEnabled = plugins.enabled !== false;
  const denied = !pluginsEnabled || pluginIdList(plugins.deny).includes(id);
  const allow = pluginIdList(plugins.allow);
  const allowListed = allow.length === 0 ? null : allow.includes(id);
  const entry = isObject(plugins.entries) ? plugins.entries[id] : null;
  const present = isObject(entry);
  const enabled = pluginsEnabled && !denied && present && entry.enabled === true;
  return {
    present,
    enabled,
    allowListed,
    denied,
    pluginsEnabled,
  };
}

export function evaluateIsolatedRuntimePlugin({
  config,
  configAvailable = true,
  ambientRegistry = null,
} = {}) {
  const required = resolveRequiredRuntimePlugin(configAvailable === true ? config : null);
  const observed = required.pluginId
    ? observePluginRegistration(configAvailable === true ? config : null, required.pluginId)
    : {
      present: false,
      enabled: false,
      allowListed: null,
      denied: false,
      pluginsEnabled: null,
    };
  // Ambient host plugin registries must never satisfy isolated readiness.
  void ambientRegistry;
  let reason = required.reason;
  let sufficient = true;
  if (configAvailable !== true) {
    sufficient = required.required !== true;
    reason = required.required ? 'target-runtime-plugin-unobserved' : required.reason;
  } else if (required.required) {
    if (observed.denied) {
      sufficient = false;
      reason = 'runtime-plugin-denied';
    } else if (observed.allowListed === false) {
      sufficient = false;
      reason = 'runtime-plugin-not-allowlisted';
    } else if (observed.enabled !== true) {
      sufficient = false;
      reason = observed.present ? 'runtime-plugin-disabled' : 'runtime-plugin-unregistered';
    } else if (required.runtime && required.pluginId !== required.runtime) {
      sufficient = false;
      reason = 'runtime-plugin-mismatch';
    } else {
      reason = 'runtime-plugin-observed';
    }
  }
  return {
    required: required.required,
    runtime: required.runtime,
    pluginId: required.pluginId,
    selectedModelRef: required.selectedModelRef,
    present: observed.present,
    enabled: observed.enabled,
    allowListed: observed.allowListed,
    denied: observed.denied,
    sufficient,
    source: 'isolated-target-config',
    reason,
  };
}

export function applyIsolatedRuntimePlugins(config) {
  if (!isObject(config)) {
    throw new Error('base config must be a JSON object');
  }
  const required = resolveRequiredRuntimePlugin(config);
  if (!required.required || !required.pluginId) return config;
  const observed = observePluginRegistration(config, required.pluginId);
  if (observed.denied) {
    throw new Error(
      `isolated proof profile cannot register runtime plugin '${required.pluginId}': denied`,
    );
  }

  const plugins = isObject(config.plugins) ? { ...config.plugins } : {};
  const entries = isObject(plugins.entries) ? { ...plugins.entries } : {};
  const current = isObject(entries[required.pluginId]) ? entries[required.pluginId] : {};
  entries[required.pluginId] = { ...current, enabled: true };
  plugins.entries = entries;
  if (Array.isArray(plugins.allow) && plugins.allow.length > 0) {
    const allow = pluginIdList(plugins.allow);
    if (!allow.includes(required.pluginId)) {
      plugins.allow = [...plugins.allow, required.pluginId];
    }
  }
  return { ...config, plugins };
}

export function publicRuntimePluginReceipt(evaluation) {
  return {
    required: evaluation.required === true,
    runtime: evaluation.runtime,
    pluginId: evaluation.pluginId,
    registered: evaluation.required === true ? evaluation.enabled === true : null,
    allowListed: evaluation.allowListed,
    sufficient: evaluation.sufficient === true,
    source: 'isolated-target-config',
    reason: evaluation.reason,
  };
}
