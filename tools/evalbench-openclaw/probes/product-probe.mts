// The run's caps and admission settings, through the product's own code at one SHA. Reads a product tree; starts nothing.
//
//   cd <product tree at the SHA> && node --import <this dir>/hooks.mjs --import tsx <this dir>/product-probe.mts "$PWD" <arms.json>
//
// Run it with HOME, OPENCLAW_STATE_DIR, OPENCLAW_CONFIG_PATH and TMPDIR in an empty directory of its own: it writes each
// variant's configuration to OPENCLAW_CONFIG_PATH and reads it back the way config.get does. It prints one line,
// "PRODUCT-PROBE <json>". probes/README.md says what each part shows and how the receipts in probes/receipts were made.
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const [root, armsFile] = process.argv.slice(2);
const m = (p: string) => import(`${root}/${p}`);
const src = (p: string) => m(`src/${p}`);
const arms = JSON.parse(readFileSync(armsFile, "utf8"));
const caps: Record<string, unknown> = arms.caps.set;
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const read = (node: any, key: string) => key.split(".").reduce((n: any, p) => (n && typeof n === "object" && p in n ? n[p] : undefined), node);

function withSettings(base: any, set: Record<string, unknown>) {
  const cfg = structuredClone(base);
  for (const [key, value] of Object.entries(set)) {
    let node = cfg;
    const parts = key.split(".");
    const leaf = parts.pop()!;
    for (const p of parts) node = node[p] ??= {};
    node[leaf] = value;
  }
  return cfg;
}

// What overlay writes and the arms share, without the caps: the arm's build as it would run with none.
const base = {
  agents: { defaults: { model: { primary: arms.model, fallbacks: [] }, continuation: { enabled: true }, skipBootstrap: true }, entries: { main: {} } },
  tools: {},
};
const armSettings: Record<string, Record<string, unknown>> = {};
for (const [name, arm] of Object.entries<any>(arms.arms)) armSettings[name] = arm.config.set;
const negatives: Record<string, Record<string, unknown>> = {
  // Each changes what the model is shown, so the comparison below has to see it.
  "tools.swarm.enabled false": { "tools.swarm.enabled": false },
  "subagents.allowAgents []": { "agents.defaults.subagents.allowAgents": [] },
  "tools.deny automations": { "tools.deny": ["automations"] },
};
// The tree's commit is the caller's to name (an archive has no .git); the probe's own bytes are hashed, so a receipt names
// the probe that made it.
const probeSha256 = sha(readFileSync(new URL(import.meta.url)));
const out: any = { productSha: process.env.PROBE_PRODUCT_SHA ?? null, probeSha256, node: process.version, model: arms.model, settings: caps };
const { setRuntimeConfigSnapshot } = await src("config/runtime-snapshot.ts");
const { resolveSkillWorkshopConfig } = await m("extensions/skill-workshop/src/config.ts");

// --- 1. config.get: the file as authored, the runtime configuration, both after redaction -----------------------------
{
  const { readConfigFileSnapshot } = await src("config/config.ts");
  const { redactConfigSnapshot } = await src("config/redact-snapshot.ts");
  const { loadGatewayConfigRedactionHints } = await src("config/runtime-schema.ts");
  const configPath = process.env.OPENCLAW_CONFIG_PATH!;
  const snapshotOf = async (cfg: any) => {
    writeFileSync(configPath, JSON.stringify(cfg, null, 2));
    const snapshot: any = await readConfigFileSnapshot();
    // The redaction hints come from the configuration in force; a gateway that has applied this file has this one.
    if (snapshot.valid) setRuntimeConfigSnapshot(snapshot.config, snapshot.sourceConfig);
    return snapshot;
  };
  const readBack = async (cfg: any) => {
    const snapshot = await snapshotOf(cfg);
    const redacted: any = redactConfigSnapshot(snapshot, loadGatewayConfigRedactionHints());
    const missing = (where: string) => Object.entries(caps).filter(([k, v]) => JSON.stringify(read(redacted[where], k)) !== JSON.stringify(v)).map(([k]) => k);
    return { valid: snapshot.valid, issues: (snapshot.issues ?? []).map((i: any) => `${i.path}: ${i.message}`).slice(0, 5), authoredMissing: missing("sourceConfig"), effectiveMissing: missing("config") };
  };
  out.config = { withCaps: await readBack(withSettings(base, caps)) };
  const typo = await readBack(withSettings(base, { ...caps, "agents.defaults.continuation.maxChainLengths": 1 }));
  out.config.typoIsInvalid = typo.valid === false;
  // Skill Workshop's review reads the runtime configuration, which keeps the plugin's entry only once the Workshop
  // migration is recorded (src/config/skill-workshop-plugin-migration.ts:92-121).
  const review = async (set: Record<string, unknown>) => resolveSkillWorkshopConfig((await snapshotOf(withSettings(base, set))).config).autonomous.mode;
  out.config.skillWorkshopReview = {
    withCaps: await review(caps),
    withoutCaps: await review({}),
    modeWithoutTheMarker: await review(Object.fromEntries(Object.entries(caps).filter(([k]) => k !== "meta.migrations.skillWorkshopPlugin"))),
  };
}

// --- 2. what each setting does, through the code that enforces it --------------------------------------------------------
const cfg: any = withSettings(base, caps);
const plain: any = structuredClone(base);
setRuntimeConfigSnapshot(cfg, cfg);
{
  const { resolveContinuationRuntimeConfig } = await src("auto-reply/continuation/config.ts");
  const { checkContinuationBudget } = await src("auto-reply/continuation/scheduler.ts");
  const rc = resolveContinuationRuntimeConfig(cfg);
  const budget = (count: number, tokens: number) => checkContinuationBudget({ chainState: { currentChainCount: count, chainStartedAt: 0, accumulatedChainTokens: tokens }, config: rc, sessionKey: "s" });
  const { reserveContinueDelegateTurnSlot, resetContinueDelegateTurnBudget } = await src("auto-reply/continuation/delegate-turn-admission.ts");
  const slots = [1, 2].map(() => reserveContinueDelegateTurnSlot("s", rc.maxDelegatesPerTurn).admitted);
  resetContinueDelegateTurnBudget("s");
  const { resolveAgentTimeoutMs } = await src("agents/timeout.ts");
  const { resolveConfiguredSubagentRunTimeoutSeconds } = await src("agents/subagents/spawn/subagent-spawn-plan.ts");
  out.capsBehavior = {
    budget: { firstElectionAfter5kTokens: budget(0, 5000), secondHop: budget(1, 0) },
    delegateCallsAdmittedInOneTurn: slots,
    turnTimeoutMs: resolveAgentTimeoutMs({ cfg }),
    childTimeoutSeconds: { configured: resolveConfiguredSubagentRunTimeoutSeconds({ cfg }), askedFor3600: resolveConfiguredSubagentRunTimeoutSeconds({ cfg, runTimeoutSeconds: 3600 }) },
  };
}
{
  const { resolveGatewayLaneConcurrency, applyGatewayLaneConcurrency } = await src("gateway/server-lanes.ts");
  const { enqueueCommandInLane } = await src("process/command-queue.ts");
  const { resolveChildAdmission } = await src("agents/child-admission.ts");
  const { resolveSwarmConfig } = await src("agents/subagents/swarm/swarm-config.ts");
  const { createLazyGatewayCronState } = await src("gateway/server-cron-lazy.ts");
  const { readUtilityModelSetting } = await src("agents/utility-model-setting.ts");

  // How many of two tasks put in these lanes at once run at the same time: the product's own queue, at the widths the
  // gateway gives its lanes at start (server-lanes.ts). Each task holds its slot until both have been offered.
  const overlap = async (lanes: string[]) => {
    let running = 0, most = 0;
    let open: () => void;
    const gate = new Promise<void>((resolve) => { open = resolve; });
    const tasks = lanes.map((lane) => enqueueCommandInLane(lane, async () => {
      running += 1; most = Math.max(most, running);
      await Promise.race([gate, new Promise((r) => setTimeout(r, 200))]);
      running -= 1;
    }));
    await new Promise((r) => setTimeout(r, 50));
    const startedBeforeAnyEnded = most;
    open!();
    await Promise.all(tasks);
    return startedBeforeAnyEnded;
  };
  const lanesUnder = async (config: any) => {
    const widths = resolveGatewayLaneConcurrency(config);
    applyGatewayLaneConcurrency(widths, { gatewayStart: true });
    return {
      widths,
      twoTurns: await overlap(["main", "main"]),
      twoChildrenOfOneSession: await overlap(["subagent:agent:main:probe", "subagent:agent:main:probe"]),
      twoSwarmGroups: await overlap(["subagent:swarm:g1", "subagent:swarm:g2"]),
      twoAutomationRuns: await overlap(["cron-nested", "cron-nested"]),
    };
  };
  const sub = cfg.agents.defaults.subagents;
  const sw = resolveSwarmConfig(cfg, "main");
  const child = (depth: number, active: number) => {
    const r = resolveChildAdmission({ callerDepth: depth, maxSpawnDepth: sub.maxSpawnDepth, collect: false, activeChildren: active, maxActiveChildren: sub.maxChildrenPerAgent });
    return r.ok ? "admitted" : r.governingCap;
  };
  const collector = (live: number, total: number) => {
    const r = resolveChildAdmission({ callerDepth: 0, maxSpawnDepth: sub.maxSpawnDepth, collect: true, activeChildren: live, maxActiveChildren: sw.maxChildrenPerGroup, totalChildren: total, maxTotalChildren: sw.maxTotalPerGroup });
    return r.ok ? "admitted" : r.governingCap;
  };
  // The gateway reads cron's switch once, when it builds its cron state (server-cron-lazy.ts:23-24); nothing loads until used.
  const cronEnabled = (config: any) => createLazyGatewayCronState({ cfg: config, env: {}, storePath: path.join(process.env.HOME!, "cron"),
    scheduler: {} as any, deps: {} as any, broadcast: () => {} } as any).cronEnabled;
  out.admission = {
    lanes: await lanesUnder(cfg),
    lanesWithoutCaps: await lanesUnder(plain),
    children: { first: child(0, 0), secondWhileFirstRuns: child(0, 1), childOfAChild: child(1, 0) },
    collectors: { firstInAGroup: collector(0, 0), secondInTheSameGroup: collector(0, 1) },
    cronSchedulerEnabled: cronEnabled(cfg),
    cronSchedulerEnabledWithoutCaps: cronEnabled(plain),
    utilityModel: readUtilityModelSetting(cfg, "main").kind,
    utilityModelWithoutCaps: readUtilityModelSetting(plain, "main").kind,
  };
}

// --- 3. what the model is shown, with and without them ---------------------------------------------------------------------
{
  const { OpenClawSchema } = await src("config/zod-schema.ts");
  const { resolveCommandsSystemPromptBundle } = await src("auto-reply/reply/commands-system-prompt.ts");
  const { prepareAttemptSystemPromptAdditions } = await src("agents/embedded-agent-runner/run/attempt-system-prompt-additions.ts");
  const { createOpenClawCodingToolsAsync } = await src("agents/agent-tools.async.ts");
  const { buildInventoryContinuationToolOpts } = await src("agents/tools/continuation-inventory-opts.ts");
  const { createAgentHarnessToolSurfaceRuntimeCore } = await src("agents/harness/tool-surface-bridge.ts");
  const { buildConfiguredAgentSystemPrompt } = await src("agents/system-prompt-config.ts");
  const workspaceDir = mkdtempSync(path.join(tmpdir(), "product-probe-ws-"));
  // A prompt names the workspace and the probe's own home; neither is a setting, so a receipt hashes them away.
  const stable = (text: string) => text.split(workspaceDir).join("<workspace>").split(process.env.HOME!).join("<home>");
  const [provider, ...rest] = String(arms.model).split("/");
  const model = rest.join("/");
  // The firing model as the run sees it: the ChatGPT route, which prefers Code Mode (extensions/openai/openclaw.plugin.json:142).
  const runModel = { api: "openai-chatgpt-responses", compat: { codeMode: "preferred" } };
  // A trial's session key: not the main session, so every per-session addition applies as it would to a trial.
  const sessionKey = "agent:main:evalprop-probe";
  const defsOf = (tools: any[]) => tools.map((t: any) => ({ name: t.name, description: t.description ?? "", parameters: JSON.stringify(t.parameters ?? null) }));
  // (a) The /context path: every tool the product builds for the agent, and its system prompt.
  const contextSurface = async (config: any) => {
    setRuntimeConfigSnapshot(config, config);
    const params: any = {
      ctx: { SessionKey: sessionKey }, cfg: config, command: { channel: "webchat", senderId: "probe" }, directives: {},
      elevated: { enabled: false, allowed: false, failures: [] }, agentId: "main", sessionEntry: { sessionId: "probe-session", updatedAt: 0 },
      sessionKey, workspaceDir, resolvedReasoningLevel: "off", resolvedElevatedLevel: "off", resolvedVerboseLevel: "off",
      provider, model, contextTokens: 0, isGroup: false, defaultGroupActivation: () => "always", resolveDefaultThinkingLevel: async () => undefined,
    };
    const { systemPrompt, tools } = await resolveCommandsSystemPromptBundle(params);
    const additions = await prepareAttemptSystemPromptAdditions({ agentId: "main", config, modelId: model, provider, sessionId: "probe-session", sessionKey });
    return { prompt: stable(`${systemPrompt}\n--additions--\n${additions.extraSystemPrompt ?? ""}`), defs: defsOf(tools) };
  };
  // (b) The attempt's surface: the product's own tool-surface runtime plans the run (Code Mode, Tool Search or every tool
  // direct), builds its controls and compacts the tools into what is sent and what is catalogued; the prompt is built as
  // the attempt builds it, continuation section included (attempt-tool-prepare.ts:132-187,375; attempt-tool-catalog.ts:76-87;
  // harness/tool-surface-bridge.ts:40-236; attempt-system-prompt-prepare.ts:464).
  const attemptSurface = async (config: any) => {
    setRuntimeConfigSnapshot(config, config);
    const runtime = createAgentHarnessToolSurfaceRuntimeCore({ config, agentId: "main", sessionKey, model: runModel, modelProvider: provider,
      modelId: model, modelToolsEnabled: true, isRawModelRun: false, sessionId: "probe-session", runId: "probe-run", contextTokenBudget: 500_000 });
    const plan = runtime.plan;
    const built = await createOpenClawCodingToolsAsync({ config, agentId: "main", workspaceDir, sessionKey, allowGatewaySubagentBinding: true,
      messageProvider: "webchat", modelProvider: provider, modelId: model, includeToolSearchControls: runtime.includeToolSearchControls,
      ...buildInventoryContinuationToolOpts(config) });
    const sent = runtime.compactTools(built).tools;
    const catalog = (runtime.toolSearchCatalogRef?.current?.entries ?? []).map((e: any) => ({ name: e.id, description: e.description ?? "", parameters: JSON.stringify(e.parameters ?? null) }));
    runtime.cleanup();
    const prompt = await buildConfiguredAgentSystemPrompt({ config, agentId: "main", tools: sent, workspaceDir, reasoningLevel: "off",
      codeModeActive: plan.codeModeControlsEnabled, continuationEnabled: config?.agents?.defaults?.continuation?.enabled === true,
      capabilityToolNames: built.map((t: any) => t.name).sort(), promptSurface: "openclaw-main",
      runtimeInfo: { agentId: "main", sessionKey, channel: "webchat", model: arms.model } });
    const mode = plan.codeModeControlsEnabled ? "code mode" : plan.toolSearchControlsEnabled ? "tool search" : "every tool direct";
    return { mode, prompt: stable(String(prompt)), defs: [...defsOf(sent), ...catalog.map((c: any) => ({ ...c, name: `catalog:${c.name}` }))],
             sent: sent.map((t: any) => t.name).sort(), catalogued: catalog.length };
  };
  const compare = (reference: any, seen: any) => {
    const byName = new Map(reference.defs.map((d: any) => [d.name, d]));
    const differing = seen.defs.filter((d: any) => { const r: any = byName.get(d.name); return !r || r.description !== d.description || r.parameters !== d.parameters; }).map((d: any) => d.name);
    const gone = reference.defs.filter((d: any) => !seen.defs.some((s: any) => s.name === d.name)).map((d: any) => d.name);
    return { tools: seen.defs.length, same: JSON.stringify(seen.defs) === JSON.stringify(reference.defs) && seen.prompt === reference.prompt, toolsSame: JSON.stringify(seen.defs) === JSON.stringify(reference.defs), promptSame: seen.prompt === reference.prompt, differing, gone };
  };
  out.surface = {};
  for (const [name, settings] of Object.entries(armSettings)) {
    const armBase = withSettings(base, settings);
    const row: any = { schemaAccepts: OpenClawSchema.safeParse(withSettings(armBase, caps)).success };
    for (const [path_, build] of [["context", contextSurface], ["attempt", attemptSurface]] as const) {
      const reference: any = await build(armBase);
      const part: any = {
        tools: reference.defs.length, toolsHash: sha(JSON.stringify(reference.defs)), promptHash: sha(reference.prompt),
        // A catalogued tool is named by its catalog id, `catalog:openclaw:core:<tool>`.
        continuation: Object.fromEntries(reference.defs.map((d: any) => [d.name.split(":").pop(), d] as const)
          .filter(([n]: any) => ["continue_work", "continue_delegate", "request_compaction"].includes(n)).map(([n, d]: any) => [n, sha(d.description)])),
        withCaps: compare(reference, await build(withSettings(armBase, caps))),
        eachCapAlone: {} as Record<string, boolean>,
        negativeControls: {} as Record<string, any>,
      };
      if (path_ === "attempt") {
        Object.assign(part, { mode: reference.mode, sent: reference.sent, catalogued: reference.catalogued,
          continuationSection: reference.prompt.includes("continue_work") && reference.prompt.includes("continue_delegate") });
      }
      for (const [key, value] of Object.entries(caps)) part.eachCapAlone[key] = compare(reference, await build(withSettings(armBase, { [key]: value }))).same;
      for (const [label, set] of Object.entries(negatives)) part.negativeControls[label] = compare(reference, await build(withSettings(armBase, { ...caps, ...set })));
      row[path_] = part;
    }
    out.surface[name] = row;
  }
}
console.log("PRODUCT-PROBE " + JSON.stringify(out));
process.exit(0);
