"""A fake OpenClaw gateway: the frames an arm's gateway would send, with scripted turns and no model.

It follows the product's wire shapes at openclaw ab5a30ea79 and is strict where a live gateway is: a method outside
the table, a parameter outside the closed schema, or a missing scope is refused. Turns come from fixtures/turns/*.json,
picked by a plan (prompt -> one fixture per trial). Every value in a fixture is synthetic; none was captured live.

A turn may also run away: its "runaway" entry says how fast the session and its children spend, and which of abort,
delete and answering at all the gateway no longer does (_Burn). It can run as a process of its own, which the supervisor
can kill as it would a real gateway's.
"""

import asyncio
import contextlib
import json
import os
import pathlib
import subprocess
import sys
import time
import uuid

from websockets.asyncio.server import serve

from .arms import AGENT_ID, CONTINUATION_TOOLS, ROOT, apply_overlay, load_arms, load_scenarios
from .gateway import REQUIRED_METHODS
from .meter import timeseries_tokens

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
    "sessions.list": (("limit", "offset", "spawnedBy", "agentId", "activeOnly", "archived"), ()),
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


class _Burn:
    """A session that spends by itself: one call of callTokens every callSeconds, from `delaySeconds` on, until it is ended."""

    def __init__(self, spec):
        self.tokens, self.seconds = spec["callTokens"], spec["callSeconds"]
        self.started, self.ended = time.monotonic() + spec.get("delaySeconds", 0), None

    def spent(self):
        until = time.monotonic() if self.ended is None else self.ended
        return self.tokens * max(0, int((until - self.started) / self.seconds))

    @property
    def running(self):
        return self.ended is None and time.monotonic() >= self.started

    def end(self):
        if self.ended is None:
            self.ended = time.monotonic()


class FakeGateway:
    """One arm's fake gateway on 127.0.0.1. Use as an async context manager; `.url` and `.token` are ready inside."""

    def __init__(self, arm, *, model, descriptions, plan, caps=None, turns=None, scenarios=None, overrides=None, port=0):
        self.arm, self.model, self.descriptions = arm, model, descriptions
        self.caps = caps or load_arms()["caps"]
        self.plan, self.turns = plan, turns or load_turns()
        self.prompts = {s["starting_prompt"]: s["id"] for s in scenarios or load_scenarios()}
        self.overrides = overrides or {}
        self.port, self.token, self.url = port, f"fake-{uuid.uuid4().hex}", None
        self.sessions, self.runs, self.sends, self.deleted, self.archive = {}, {}, {}, [], {}
        self.frozen_at, self.thaws_at = None, float("inf")
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
            if self.frozen_at is not None and time.monotonic() >= self.frozen_at:
                # It still holds the socket open, and answers nothing until it thaws, if it does.
                await asyncio.sleep(max(0.0, self.thaws_at - time.monotonic()))
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
        source = apply_overlay(self.arm, self.model, self.caps, source, "/fake/state/gateway.log")
        source.update(self.overrides.get("config", {}))
        return {"valid": True, "sourceConfig": source, "config": source, "configRevisionHash": self.overrides.get("configRevisionHash", "fake"),
                "appliedConfigHash": self.overrides.get("appliedConfigHash", "fake")}

    def _new_session(self, **fields):
        return {"rows": [], "runId": None, "spawnedBy": None, "archived": False, "fixture": None, "settled": False, "burn": None, "sessionId": uuid.uuid4().hex, **fields}

    def _sessions_create(self, params):
        key = params.get("key") or f"fake-{uuid.uuid4().hex}"
        if not key.startswith("agent:"):
            key = f"agent:{params['agentId']}:{key}" if params.get("agentId") else key
        if key in self.sessions:
            raise _Refusal("INVALID_REQUEST", "session exists")
        self.sessions[key] = self._new_session()
        return {"ok": True, "key": key, "sessionId": self.sessions[key]["sessionId"]}

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
            self.sessions[f"agent:main:subagent:{uuid.uuid4().hex}"] = self._new_session(rows=_fill(child.get("rows", []), mapping), settled=True, **{link: params["key"]})
        if turn.get("runaway"):
            self._run_away(session, params["key"], turn["runaway"])
        self.runs[run_id] = turn.get("wait", {"status": "ok"})
        session["settled"] = self.runs[run_id]["status"] != "never"
        return {"runId": run_id, "status": "started"}

    def _run_away(self, session, key, spec):
        session["burn"] = _Burn(spec) if spec.get("callTokens") else None
        for _ in range(spec.get("children", 0)):
            # A child with no link to the trial is one the harness's own cleanup never finds.
            link = {} if spec.get("orphans") else {"spawnedBy": key}
            self.sessions[f"agent:main:subagent:{uuid.uuid4().hex}"] = self._new_session(settled=True, burn=_Burn({**spec, **spec.get("child", {})}), **link)
        if "freezeSeconds" in spec:
            self.frozen_at = time.monotonic() + spec["freezeSeconds"]
            self.thaws_at = self.frozen_at + spec.get("frozenSeconds", 1e6)

    def _stubborn(self, session, what):
        runaway = (session["fixture"] or {}).get("runaway") or next(
            (s["fixture"]["runaway"] for s in self.sessions.values() if (s["fixture"] or {}).get("runaway")), {})
        return what in runaway.get("ignores", ())

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
        if "key" not in params:
            live = sum(self._tokens(s) for s in self.sessions.values())
            return {"sessions": [], "totals": {"totalTokens": live + sum(self.archive.values()) + self.overrides.get("unlistedTokens", 0)}}
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
        # The rest of the tool list: direct under the direct-tools overlay, behind a search otherwise.
        every_tool_direct = self.arm["config"]["set"].get("tools.toolSearch") is False
        for tool in ("sessions_spawn", "automations"):
            if every_tool_direct:
                entries.append({"name": tool, "summaryChars": 10, "summaryHash": "0" * 64, "schemaChars": 10})
            else:
                deferred.append({"name": tool, "source": "openclaw", "sourceName": "core", "schemaChars": 10})
        for tool in CONTINUATION_TOOLS:
            if surface == "direct":
                entries.append({"name": tool, "summaryChars": len(self.descriptions[tool]["text"]), "summaryHash": self.descriptions[tool]["sha256"], "schemaChars": 10})
            else:
                deferred.append({"name": tool, "source": "openclaw", "sourceName": "core", "schemaChars": 10})
        # Tool Search's controls are there unless the arm turns it off (A and C); Codex has its own search.
        if not every_tool_direct and self.overrides.get("runtime") != "codex":
            entries += [{"name": n, "summaryChars": 10, "schemaChars": 10} for n in ("tool_search", "tool_describe", "dispatch_action")]
        return {"source": "run", "generatedAt": 0, "systemPrompt": {"chars": 4096, "projectContextChars": 0, "nonProjectContextChars": 4096, "hash": "f" * 64},
                "injectedWorkspaceFiles": [], "skills": {"promptChars": 0, "entries": []},
                "tools": {"listChars": 0, "schemaChars": 10 * len(entries), "entries": entries,
                          **({"deferred": {"schemaChars": 10 * len(deferred), "entries": deferred}} if deferred else {})}}

    def _points(self, session):
        points = []
        for row in session["rows"]:
            usage = row.get("usage")
            if usage:
                points.append({"timestamp": 0, **{k: usage.get(k, 0) for k in ("input", "output", "cacheRead", "cacheWrite", "totalTokens")}})
        if session["burn"] is not None and (spent := session["burn"].spent()):
            points.append({"timestamp": 0, "input": spent, "output": 0, "cacheRead": 0, "cacheWrite": 0, "totalTokens": spent})
        return points

    def _tokens(self, session):
        return timeseries_tokens({"points": self._points(session)})

    def _sessions_usage_timeseries(self, params):
        key = params["key"]
        if key not in self.sessions and key in self.archive:
            return {"sessionId": "fake", "points": [{"timestamp": 0, "input": self.archive[key], "totalTokens": self.archive[key]}]}
        points = self._points(self.sessions[key]) if key in self.sessions else []
        if not points:
            raise _Refusal("INVALID_REQUEST", f"No transcript found for session: {key}")
        return {"sessionId": "fake", "points": points}

    def _active(self, session):
        burning = session["burn"] is not None and session["burn"].running
        return burning or (self.runs.get(session["runId"]) or {}).get("status") == "never"

    def _sessions_list(self, params):
        links = ("spawnedBy", "parentSessionKey", "controlOwnerSessionKey")
        chosen = {k: s for k, s in self.sessions.items() if "spawnedBy" not in params or params["spawnedBy"] in [s.get(n) for n in links]}
        if params.get("archived") != "all":
            chosen = {k: s for k, s in chosen.items() if not s["archived"]}
        rows = [{"key": k, "sessionId": s["sessionId"], "hasActiveRun": self._active(s), **{n: s.get(n) for n in links}} for k, s in chosen.items()]
        offset, limit = params.get("offset", 0), min(params.get("limit", 50), self.overrides.get("listPage", 10_000))
        page = {"sessions": rows[offset:offset + limit], "hasMore": offset + limit < len(rows)}
        if page["hasMore"]:
            page["nextOffset"] = offset + limit
        return page

    def _sessions_abort(self, params):
        session = self._session(params["key"])
        if self._stubborn(session, "abort"):
            return {"ok": True, "abortedRunId": None, "status": "no-active-run"}
        if session["burn"] is not None:
            session["burn"].end()
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
        if self._stubborn(session, "delete"):
            raise _Refusal("UNAVAILABLE", "still active")
        if session["burn"] is not None:
            session["burn"].end()
        self.archive[f"agent:{AGENT_ID}:{session['sessionId']}"] = self._tokens(session)
        del self.sessions[params["key"]]
        self.deleted.append(params["key"])
        return {"ok": True, "key": params["key"], "deleted": True, "archived": []}


class _Refusal(Exception):
    def __init__(self, code, message):
        super().__init__(message)
        self.code, self.message = code, message



@contextlib.contextmanager
def launch_fakes(arm_names, secrets, *, plans=None, overrides=None, arms=None):
    """One fake gateway process per arm. Yields {arm: {"url", "pid", "tokenFile"}}; their tokens are only in the files.

    Each ends when its standard input does, so none outlives this process.
    """
    processes, fakes = {}, {}
    try:
        for name in arm_names:
            token_file = pathlib.Path(secrets) / f"token-{name}"
            spec = {"arm": name, "tokenFile": str(token_file), "plan": (plans or {}).get(name), "overrides": (overrides or {}).get(name), "arms": arms}
            processes[name] = subprocess.Popen([sys.executable, "-m", "openclaw_evalbench.fake_gateway"], cwd=ROOT, stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True)
            processes[name].stdin.write(json.dumps(spec) + "\n")
            processes[name].stdin.flush()
            fakes[name] = {**json.loads(processes[name].stdout.readline()), "tokenFile": str(token_file)}
        yield fakes
    finally:
        for process in processes.values():
            process.kill()
            process.wait()
            process.stdin.close()
            process.stdout.close()


async def _serve_one(spec):
    arms = spec["arms"] or load_arms()
    arm = arms["arms"][spec["arm"]]
    plan = spec["plan"] if spec["plan"] is not None else load_plan()["arms"][spec["arm"]]
    async with FakeGateway(arm, model=arms["model"], descriptions=arms["descriptions"][arm["descriptions"]]["tools"], plan=plan,
                           caps=arms["caps"], overrides=spec["overrides"] or {}) as fake:
        with open(os.open(spec["tokenFile"], os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600), "w") as handle:
            handle.write(fake.token)
        answer = json.dumps({"url": fake.url, "pid": os.getpid()})
        if "answerFile" in spec:  # a unit's, with no standard input to end it
            pathlib.Path(spec["answerFile"]).write_text(answer)
            await asyncio.Event().wait()
        print(answer, flush=True)
        await asyncio.get_running_loop().run_in_executor(None, sys.stdin.read)


if __name__ == "__main__":
    asyncio.run(_serve_one(json.loads(pathlib.Path(sys.argv[1]).read_text() if len(sys.argv) > 1 else sys.stdin.readline())))
