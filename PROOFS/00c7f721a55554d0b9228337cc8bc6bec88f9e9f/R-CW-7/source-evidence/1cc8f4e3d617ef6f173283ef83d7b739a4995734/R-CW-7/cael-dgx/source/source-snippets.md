# R-CW-7 source snippets — exact 1cc8f4e traceparent behavior

Source checkout:

```text
1cc8f4e3d617ef6f173283ef83d7b739a4995734
1cc8f4e3d617ef6f173283ef83d7b739a4995734
Merge upstream/main clean drift into assembly
2026-07-05T12:58:44-07:00
```

## Public model-facing continue_delegate schema intentionally omits traceparent

```ts
  it("pins continue_delegate descriptor to mode enum and no boolean compatibility fields", () => {
    const tools = createOpenClawTools({
      config,
      agentSessionKey: "main",
    });
    const tool = tools.find((candidate) => candidate.name === "continue_delegate");
    if (!tool) {
      throw new Error("continue_delegate tool not registered");
    }

    const params = tool.parameters as {
      type?: string;
      properties?: Record<string, unknown>;
      required?: string[];
    };
    expect(params.type).toBe("object");
    const properties = params.properties ?? {};

    // Closed-set assertion: exactly these advertised keys, no more, no less.
    const expectedKeys = [
      "task",
      "delaySeconds",
      "mode",
      "targetSessionKey",
      "targetSessionKeys",
      "fanoutMode",
      "model",
    ].toSorted();
    const actualKeys = Object.keys(properties).toSorted();
    expect(
      actualKeys,
      `continue_delegate descriptor must advertise exactly [task, delaySeconds, mode, targetSessionKey, targetSessionKeys, fanoutMode, model]; got [${actualKeys.join(", ")}]`,
    ).toEqual(expectedKeys);

```

```ts
  it("does not expose diagnostic traceparent as a model-facing parameter", () => {
    const tool = createContinueDelegateTool({ agentSessionKey: "test-session" });

    expect(JSON.stringify(tool.parameters)).not.toContain("traceparent");
  });
```

## continue_delegate auto-picks active runtime trace context

```ts
  it("auto-picks the active runtime trace context when traceparent is omitted", async () => {
    const tool = createContinueDelegateTool({ agentSessionKey: "test-session" });

    const result = await runWithDiagnosticTraceContext(ACTIVE_TRACE_CONTEXT, () =>
      executeTool(tool, 0, {
        task: "continue active traced chain",
      }),
    );

    expect(result).toMatchObject({
      status: "scheduled",
    });
    expect(result).not.toHaveProperty("traceparent");
    expect(consumePendingDelegates("test-session")).toEqual([
      expect.objectContaining({
        task: "continue active traced chain",
        traceparent: ACTIVE_TRACEPARENT,
      }),
    ]);
  });

  it("falls back to the active runtime trace context when a hidden traceparent is invalid", async () => {
    const tool = createContinueDelegateTool({ agentSessionKey: "test-session" });

    const result = await runWithDiagnosticTraceContext(ACTIVE_TRACE_CONTEXT, () =>
      executeTool(tool, 0, {
        task: "ignore malformed hidden traceparent",
        traceparent: "not-a-traceparent",
      }),
    );

    expect(result).toMatchObject({
      status: "scheduled",
    });
    expect(result).not.toHaveProperty("traceparent");
    expect(consumePendingDelegates("test-session")).toEqual([
      expect.objectContaining({
        task: "ignore malformed hidden traceparent",
        traceparent: ACTIVE_TRACEPARENT,
      }),
    ]);
  });

  it("omits traceparent when the carrier is absent", async () => {
    const tool = createContinueDelegateTool({ agentSessionKey: "test-session" });

    await executeTool(tool, 0, { task: "continue untraced chain" });

    const delegates = consumePendingDelegates("test-session");
    expect(delegates).toHaveLength(1);
    expect(delegates[0].traceparent).toBeUndefined();
```

## pending delegates dispatch with persisted traceparent

```ts
  it("threads persisted traceparent into spawned continuation runs", async () => {
    const sessionKey = "session-delegate-traceparent";
    const traceparent = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01";
    enqueuePendingDelegate(sessionKey, {
      task: "continue traced work",
      traceparent,
    });

    await dispatchToolDelegates({
      sessionKey,
      chainState: { currentChainCount: 0, chainStartedAt: Date.now(), accumulatedChainTokens: 0 },
      ctx: { sessionKey },
      maxChainLength: 10,
    });

    expect(spawnSubagentDirectMock).toHaveBeenCalledWith(
      expect.objectContaining({
        task: expect.stringContaining("continue traced work"),
        traceparent,
      }),
      expect.objectContaining({
        agentSessionKey: sessionKey,
      }),
    );
  });

```

## spawned child run receives and persists inherited traceparent

```ts
  it("forwards inherited traceparent to the child agent run", async () => {
    const traceparent = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01";
    const calls: Array<{ method?: string; params?: unknown }> = [];
    hoisted.callGatewayMock.mockImplementation(
      async (request: { method?: string; params?: unknown }) => {
        calls.push(request);
        if (request.method === "agent") {
          return { runId: "run-traceparent", status: "accepted", acceptedAt: 1000 };
        }
        if (request.method?.startsWith("sessions.")) {
          return { ok: true };
        }
        return {};
      },
    );
    let persistedTraceparent: unknown;
    installSessionStoreCaptureMock(hoisted.updateSessionStoreMock, {
      onStore: (store) => {
        persistedTraceparent ??= Object.values(store).find(
          (entry) => entry.continuationTraceparent,
        )?.continuationTraceparent;
      },
    });

    const result = await spawnSubagentDirect(
      {
        task: "verify traceparent forwarding",
        traceparent,
      },
      {
        agentSessionKey: "agent:main:main",
        agentChannel: "discord",
      },
    );

    expect(result.status).toBe("accepted");
    const agentCall = calls.find((call) => call.method === "agent");
    const params = requireRecord(agentCall?.params);
    expect(params.traceparent).toBe(traceparent);
    expect(
      consumeSubagentTraceparentHandoff({
        idempotencyKey: params.idempotencyKey as string,
        sessionKey: params.sessionKey as string,
      })?.traceparent,
    ).toBe(traceparent);
    expect(persistedTraceparent).toBe(traceparent);
    const registerInput = requireRecord(hoisted.registerSubagentRunMock.mock.calls[0]?.[0]);
    expect(registerInput.traceparent).toBe(traceparent);
  });
```

## Agent protocol schema marks traceparent internal and strips it from public schema

```ts
    >;

    expect(properties.continuationTrigger?.["x-openclaw-internal"]).toBe(true);
    expect(properties.drainsContinuationDelegateQueue?.["x-openclaw-internal"]).toBe(true);
    expect(properties.traceparent?.["x-openclaw-internal"]).toBe(true);
  });

  it("omits runner-only knobs from public generated schema copies", () => {
    const publicSchema = stripInternalProtocolFields(AgentParamsSchema);

    expect(publicSchema).not.toBe(AgentParamsSchema);
    if (!publicSchema) {
      throw new Error("expected public AgentParams schema");
    }
    expect(publicSchema.properties).not.toHaveProperty("continuationTrigger");
    expect(publicSchema.properties).not.toHaveProperty("drainsContinuationDelegateQueue");
    expect(publicSchema.properties).not.toHaveProperty("traceparent");
    expect(AgentParamsSchema.properties).toHaveProperty("continuationTrigger");
    expect(AgentParamsSchema.properties).toHaveProperty("drainsContinuationDelegateQueue");
    expect(AgentParamsSchema.properties).toHaveProperty("traceparent");
```
