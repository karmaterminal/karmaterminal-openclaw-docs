"""A fake OpenClaw gateway: the frames an arm's gateway would send, with scripted turns and no model.

It follows the product's wire shapes at openclaw ab5a30ea79 and is strict where a live gateway is: a method outside
the table, a parameter outside the closed schema, or a missing scope is refused. Turns come from fixtures/turns/*.json,
picked by a plan (prompt -> one fixture per trial). Every value in a fixture is synthetic; none was captured live.
"""

import asyncio
import json
import pathlib
import uuid

from websockets.asyncio.server import serve

from .arms import CONTINUATION_TOOLS, ROOT, apply_overlay, load_scenarios
from .gateway import REQUIRED_METHODS

# Closed parameter schemas, packages/gateway-protocol/src/schema at ab5a30ea79: (allowed, required). Only the
# parameters a client here could plausibly send are listed; an unlisted one is refused, as closedObject refuses it.
PARAMS = {
    "config.get": ((), ()),
    "sessions.create": (("key", "idempotencyKey", "agentId", "label", "displayName", "model", "thinkingLevel", "message", "cwd", "parentSessionKey"), ()),
    "sessions.send": (("key", "agentId", "message", "thinking", "timeoutMs", "idempotencyKey"), ("key", "message")),
    "agent.wait": (("runId", "timeoutMs"), ("runId",)),
    "chat.history": (("sessionKey", "agentId", "cursor", "limit", "maxBytes", "offset", "sessionId", "maxChars", "toolResultMaxChars"), ("sessionKey",)),
    "sessions.describe": (("key", "agentId", "includeDerivedTitles", "includeLastMessage"), ("key",)),
    "sessions.usage": (("key", "agentId", "agentScope", "startDate", "endDate", "mode", "range", "limit", "includeContextWeight"), ()),
    "sessions.usage.timeseries": (("key", "agentId"), ("key",)),
    "sessions.list": (("limit", "offset", "spawnedBy", "agentId", "activeOnly"), ()),
    "sessions.abort": (("key", "runId", "agentId", "clearQueued", "userInitiated"), ()),
    "sessions.patch": (("key", "agentId", "expectedSessionId", "archived", "label"), ("key",)),
    "sessions.delete": (("key", "agentId", "deleteTranscript", "expectedSessionId", "archivedOnly"), ("key",)),
}
READ = {"config.get", "chat.history", "sessions.describe", "sessions.usage", "sessions.usage.timeseries", "sessions.list"}
UNADVERTISED = {"sessions.usage", "sessions.usage.timeseries"}
HISTORY_DEFAULT_LIMIT = 200


def load_turns(path=None):
    turns = {}
    for file in sorted(pathlib.Path(path or ROOT / "fixtures/turns").glob("*.json")):
        turn = json.loads(file.read_text())
        turns[turn["id"]] = turn
    return turns


def load_plan(path=None):
    return json.loads(pathlib.Path(path or ROOT / "fixtures/offline-plan.json").read_text())


def _fill(value, mapping):
    if isinstance(value, str):
        return mapping.get(value, value)
    if isinstance(value, list):
        return [_fill(v, mapping) for v in value]
    if isinstance(value, dict):
        return {k: _fill(v, mapping) for k, v in value.items()}
    return value


class FakeGateway:
    """One arm's fake gateway on 127.0.0.1. Use as an async context manager; `.url` and `.token` are ready inside."""

    def __init__(self, arm, *, model, descriptions, plan, turns=None, scenarios=None, overrides=None, port=0):
        self.arm, self.model, self.descriptions = arm, model, descriptions
        self.plan, self.turns = plan, turns or load_turns()
        self.prompts = {s["starting_prompt"]: s["id"] for s in scenarios or load_scenarios()}
        self.overrides = overrides or {}
        self.port, self.token, self.url = port, f"fake-{uuid.uuid4().hex}", None
        self.sessions, self.runs, self.sends, self.deleted = {}, {}, {}, []
        self.calls, self._server = [], None

    async def __aenter__(self):
        self._server = await serve(self._connection, "127.0.0.1", self.port, max_size=32 * 1024 * 1024)
        self.port = self._server.sockets[0].getsockname()[1]
        self.url = f"ws://127.0.0.1:{self.port}"
        return self

    async def __aexit__(self, *exc):
        self._server.close()
        await self._server.wait_closed()

    # --- connection ---------------------------------------------------------------------------------------------

    async def _connection(self, socket):
        await socket.send(json.dumps({"type": "event", "event": "connect.challenge", "payload": {"nonce": uuid.uuid4().hex, "ts": 0}}))
        scopes = None
        async for raw in socket:
            frame = json.loads(raw)
            if set(frame) - {"type", "id", "method", "params", "traceparent", "expectedProfileId"} or frame.get("type") != "req":
                await self._refuse(socket, frame, "INVALID_REQUEST", "invalid request frame")
                continue
            method, params = frame["method"], frame.get("params") or {}
            if scopes is None:
                if method != "connect" or (params.get("auth") or {}).get("token") != self.token:
                    await self._refuse(socket, frame, "UNAUTHORIZED", "unauthorized")
                    await socket.close()
                    return
                client = params.get("client") or {}
                if (client.get("id"), client.get("mode")) != ("gateway-client", "backend") or params.get("device"):
                    await self._refuse(socket, frame, "NOT_PAIRED", "device identity required")
                    await socket.close()
                    return
                scopes = list(params.get("scopes") or [])
                await self._reply(socket, frame, self._hello(scopes))
                continue
            self.calls.append((method, params))
            try:
                payload = self._dispatch(method, params, scopes)
                if asyncio.iscoroutine(payload):
                    payload = await payload
            except _Refusal as refusal:
                await self._refuse(socket, frame, refusal.code, refusal.message)
                continue
            await self._reply(socket, frame, payload)

    async def _reply(self, socket, frame, payload):
        await socket.send(json.dumps({"type": "res", "id": frame["id"], "ok": True, "payload": payload}))

    async def _refuse(self, socket, frame, code, message):
        await socket.send(json.dumps({"type": "res", "id": frame.get("id"), "ok": False, "error": {"code": code, "message": message}}))

    def _hello(self, scopes):
        sha = self.arm["productSha"]
        server = {"version": "2026.11.0", "connId": uuid.uuid4().hex, "commit": sha[:12], "buildId": f"2026.11.0+{sha[:12]}"}
        methods = [m for m in PARAMS if m not in UNADVERTISED]
        assert not set(REQUIRED_METHODS) - set(methods)
        return {"type": "hello-ok", "protocol": 4, "server": {**server, **self.overrides.get("server", {})},
                "features": {"methods": self.overrides.get("methods", methods), "events": []}, "snapshot": {},
                "auth": {"method": "token", "role": "operator", "scopes": scopes}, "policy": {}}

    # --- methods ------------------------------------------------------------------------------------------------

    def _dispatch(self, method, params, scopes):
        if method not in PARAMS:
            raise _Refusal("INVALID_REQUEST", f"unknown method: {method}")
        if ("operator.read" if method in READ else "operator.write") not in scopes:
            raise _Refusal("FORBIDDEN", "missing scope")
        allowed, required = PARAMS[method]
        extra, missing = set(params) - set(allowed), [k for k in required if not params.get(k)]
        if extra or missing:
            raise _Refusal("INVALID_REQUEST", f"invalid {method} params: {sorted(extra) or missing}")
        refusal = self.overrides.get("refuse", {}).get(method)
        if refusal:
            raise _Refusal(*refusal)
        return getattr(self, "_" + method.replace(".", "_"))(params)

    def _session(self, key):
        if key not in self.sessions:
            raise _Refusal("INVALID_REQUEST", f"session not found: {key}")
        return self.sessions[key]

    def _config_get(self, _params):
        source = {"agents": {"defaults": {"model": {"primary": self.model, "fallbacks": []},
                                          "continuation": {"enabled": True}}},
                  "tools": {}, "plugins": {"entries": {"codex": {"config": {"codexDynamicToolsLoading": "searchable"}}}}}
        source = apply_overlay(self.arm, self.model, source, "/fake/state/gateway.log")
        source.update(self.overrides.get("config", {}))
        return {"valid": True, "sourceConfig": source, "config": source, "configRevisionHash": "fake", "appliedConfigHash": "fake"}

    def _sessions_create(self, params):
        key = params.get("key") or f"fake-{uuid.uuid4().hex}"
        if not key.startswith("agent:"):
            key = f"agent:{params['agentId']}:{key}" if params.get("agentId") else key
        if key in self.sessions:
            raise _Refusal("INVALID_REQUEST", "session exists")
        self.sessions[key] = {"rows": [], "runId": None, "spawnedBy": None, "archived": False, "fixture": None, "settled": False}
        return {"ok": True, "key": key, "sessionId": uuid.uuid4().hex}

    def _sessions_send(self, params):
        session, message = self._session(params["key"]), params["message"]
        prompt_id = self.prompts.get(message)
        if prompt_id is None:
            raise _Refusal("INVALID_REQUEST", "the fake gateway has no turn for this prompt")
        outcomes = self.plan[prompt_id]
        count = self.sends.get(prompt_id, 0)
        self.sends[prompt_id] = count + 1
        turn = self.turns[outcomes[count % len(outcomes)]]
        run_id = params.get("idempotencyKey") or uuid.uuid4().hex
        mapping = {"{{prompt}}": message, "{{runId}}": run_id, "{{provider}}": self.model.split("/")[0], "{{model}}": self.model.split("/")[1]}
        session.update(runId=run_id, fixture=turn)
        session["rows"] = [{"role": "user", "content": [{"type": "text", "text": message}], "__openclaw": {"runId": run_id}}]
        session["rows"] += _fill(turn["rows"], mapping)
        for child in turn.get("children", []):
            link = child.get("link", "spawnedBy")
            self.sessions[f"agent:main:subagent:{uuid.uuid4().hex}"] = {
                "rows": _fill(child.get("rows", []), mapping), "runId": None, "spawnedBy": None, "archived": False, "fixture": None, "settled": True, link: params["key"]}
        self.runs[run_id] = turn.get("wait", {"status": "ok"})
        session["settled"] = self.runs[run_id]["status"] != "never"
        return {"runId": run_id, "status": "started"}

    async def _agent_wait(self, params):
        if params["runId"] not in self.runs:
            return {"runId": params["runId"], "status": "timeout"}
        answer = self.runs[params["runId"]]
        if answer.get("status") == "never":
            await asyncio.sleep(min(params.get("timeoutMs", 30_000) / 1000, 0.2))
            return {"runId": params["runId"], "status": "timeout"}
        return {"runId": params["runId"], **answer}

    def _chat_history(self, params):
        session = self._session(params["sessionKey"])
        limit = min(params.get("limit") or HISTORY_DEFAULT_LIMIT, self.overrides.get("historyPage", 10_000))
        offset, rows = params.get("offset") or 0, session["rows"]
        end = len(rows) - offset
        start = max(0, end - limit)
        page = {"sessionKey": params["sessionKey"], "messages": rows[start:end], "hasMore": start > 0}
        if start > 0:
            page["nextOffset"] = offset + (end - start)
        return page

    def _sessions_describe(self, params):
        session = self._session(params["key"])
        provider, model = self.overrides.get("selectedModel", self.model).split("/")
        return {"session": {"key": params["key"], "modelProvider": provider, "model": model, "spawnedBy": session["spawnedBy"],
                            "agentRuntime": {"id": self.overrides.get("runtime", "openclaw"), "source": "implicit"}}}

    def _sessions_usage(self, params):
        session = self._session(params["key"])
        row = {"key": params["key"], "hasContextWeight": session["settled"]}
        if params.get("includeContextWeight"):
            # Stored only when a turn settles: a run stopped by an abort has none (agent-runner-execute.ts:470-492).
            row["contextWeight"] = self._report() if session["settled"] and not self.overrides.get("noReport") else None
        return {"sessions": [row]}

    def _report(self):
        surface = self.overrides.get("surface", self.arm["surface"])
        entries = [{"name": n, "summaryChars": 10, "summaryHash": "0" * 64, "schemaChars": 10} for n in ("read", "exec", "message", "sessions_yield")]
        deferred = []
        for tool in CONTINUATION_TOOLS:
            if surface == "direct":
                entries.append({"name": tool, "summaryChars": len(self.descriptions[tool]["text"]), "summaryHash": self.descriptions[tool]["sha256"], "schemaChars": 10})
            else:
                deferred.append({"name": tool, "source": "openclaw", "sourceName": "core", "schemaChars": 10})
        # Tool Search's controls are there unless the arm turns it off (A and C); Codex has its own search.
        if self.arm["config"]["set"].get("tools.toolSearch") is not False and self.overrides.get("runtime") != "codex":
            entries += [{"name": n, "summaryChars": 10, "schemaChars": 10} for n in ("tool_search", "tool_describe", "dispatch_action")]
        return {"source": "run", "generatedAt": 0, "systemPrompt": {"chars": 4096, "projectContextChars": 0, "nonProjectContextChars": 4096, "hash": "f" * 64},
                "injectedWorkspaceFiles": [], "skills": {"promptChars": 0, "entries": []},
                "tools": {"listChars": 0, "schemaChars": 10 * len(entries), "entries": entries,
                          **({"deferred": {"schemaChars": 10 * len(deferred), "entries": deferred}} if deferred else {})}}

    def _sessions_usage_timeseries(self, params):
        points = []
        for row in self._session(params["key"])["rows"]:
            usage = row.get("usage")
            if usage:
                points.append({"timestamp": 0, **{k: usage.get(k, 0) for k in ("input", "output", "cacheRead", "cacheWrite", "totalTokens")}})
        if not points:
            raise _Refusal("INVALID_REQUEST", f"No transcript found for session: {params['key']}")
        return {"sessionId": "fake", "points": points}

    def _sessions_list(self, params):
        links = ("spawnedBy", "parentSessionKey", "controlOwnerSessionKey")
        rows = [{"key": k, **{n: s.get(n) for n in links}} for k, s in self.sessions.items() if params.get("spawnedBy") in [s.get(n) for n in links]]
        return {"sessions": rows[: params.get("limit", 50)]}

    def _sessions_abort(self, params):
        session = self._session(params["key"])
        run = self.runs.get(session["runId"])
        if run and run.get("status") == "never":
            self.runs[session["runId"]] = {"status": "timeout", "endedAt": 1, "stopReason": "aborted"}
            session["rows"] += _fill(session["fixture"].get("afterAbort", []), {"{{runId}}": session["runId"]})
            return {"ok": True, "abortedRunId": session["runId"], "status": "aborted"}
        return {"ok": True, "abortedRunId": None, "status": "no-active-run"}

    def _sessions_patch(self, params):
        self._session(params["key"])["archived"] = params.get("archived") is True
        return {"ok": True, "key": params["key"]}

    def _sessions_delete(self, params):
        session = self._session(params["key"])
        if params.get("archivedOnly") is not True:
            raise _Refusal("FORBIDDEN", "missing scope: operator.admin")
        if not session["archived"]:
            raise _Refusal("INVALID_REQUEST", "Session is not archived. Archive it first, then delete it.")
        del self.sessions[params["key"]]
        self.deleted.append(params["key"])
        return {"ok": True, "key": params["key"], "deleted": True, "archived": []}


class _Refusal(Exception):
    def __init__(self, code, message):
        super().__init__(message)
        self.code, self.message = code, message

