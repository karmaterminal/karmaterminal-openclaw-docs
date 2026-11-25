"""One turn's facts from chat.history rows.

Pure functions over the rows a gateway returns. The tool-call and tool-result rules are the k6 harness's
(tools/k6-proofs/lib/tool-call-identity.mjs): under Tool Search a call is stored as `dispatch_action` (`tool_call` on
older builds) with arguments {id, args}, and its result is a { tool, result } envelope. tests/test_k6_parity.py runs
both implementations over the same rows.

Two shapes the k6 rows never needed are read here too. Under Code Mode the assistant row says only `exec {code}`, and
the call it made is a `role: "custom"` nested-tool row. And chat.history drops a commentary-phase assistant row that
has no text, with its tool calls, but keeps their results (chat-display-projection.sanitize.ts:692-710).
"""

import json
import re

from .arms import CONTINUATION_TOOLS

DISPATCHERS = ("dispatch_action", "tool_call")
# Tool Search's own controls (openclaw ab5a src/agents/tool-search-protocol.ts:4-5).
DISCOVERY_TOOLS = ("tool_search", "tool_describe")
_CATALOG_ID = re.compile(r"^(?:openclaw|mcp|client):[^:]+:(.+)$")
_CALL_TYPES = ("toolcall", "tooluse")
# One call made inside another tool (Code Mode's exec, or Tool Search's dispatcher), as chat.history projects it:
# content [toolCall, toolResult] (src/sessions/nested-tool-activity.ts:77-90, chat-display-projection.core.ts:572-590).
NESTED_TOOL_ROW = "openclaw.nested-tool.v1"
# The bracket form (src/agents/system-prompt-continuation.ts): the end of the reply. Never counted as an election.
_TOKEN_WORK = re.compile(r"(?:^|\n)\s*CONTINUE_WORK(?::\d+)?\s*$")
_TOKEN_DELEGATE = re.compile(r"\[\[\s*CONTINUE_DELEGATE:")


class TranscriptError(Exception):
    """The rows don't show this turn. Never read as "no election"."""


def _record(value):
    return value if isinstance(value, dict) else None


def _json_record(text):
    if not isinstance(text, str) or not text.strip().startswith("{"):
        return None
    try:
        return _record(json.loads(text))
    except ValueError:
        return None


def role_of(row):
    return str((row or {}).get("role") or "").lower() if isinstance(row, dict) else ""


def text_of(row):
    content = (row or {}).get("content")
    if isinstance(content, str):
        return content
    if not isinstance(content, list):
        return ""
    return "\n".join(p["text"] for p in content
                     if isinstance(p, dict) and p.get("type") == "text" and isinstance(p.get("text"), str))


def _raw_arguments(part):
    for key in ("arguments", "input"):
        value = part.get(key)
        if isinstance(value, dict):
            return value
        if isinstance(value, str):
            return _json_record(value) or {}
    return {}


def is_dispatcher(name):
    return isinstance(name, str) and name.strip().lower() in DISPATCHERS


def call_target(part):
    """The tool a toolCall part invoked: {name, args, dispatched}, or None for anything else."""
    if not isinstance(part, dict) or str(part.get("type") or "").lower().replace("_", "") not in _CALL_TYPES:
        return None
    raw = part.get("name") or part.get("toolName")
    if not isinstance(raw, str) or not raw:
        return None
    args = _raw_arguments(part)
    target = args.get("id").strip() if isinstance(args.get("id"), str) else ""
    if not is_dispatcher(raw) or not target:
        return {"name": raw, "args": args, "dispatched": False}
    match = _CATALOG_ID.match(target)
    inner = args.get("args")
    return {"name": match.group(1) if match else target, "args": inner if isinstance(inner, dict) else {},
            "dispatched": True}


def continuation_tool(name):
    """`name` as a continuation tool, or None. A provider namespace (`<prefix>__<tool>`) is its tool."""
    if not isinstance(name, str):
        return None
    for tool in CONTINUATION_TOOLS:
        if name == tool or name.endswith(f"__{tool}"):
            return tool
    return None


def _structured(result):
    content = (result or {}).get("content")
    if isinstance(content, str):
        parsed = _json_record(content)
        if parsed:
            return parsed
    elif isinstance(content, list):
        for part in content:
            if isinstance(part, dict) and part.get("type") == "text":
                parsed = _json_record(part.get("text"))
                if parsed:
                    return parsed
    return _record((result or {}).get("details"))


def _is_envelope(value):
    return isinstance(value, dict) and isinstance(value.get("tool"), dict) and isinstance(value.get("result"), dict)


def unwrap_result(row, tool):
    """The structured answer a toolResult row gives for a call of `tool`, or None when it can't be read as one."""
    if role_of(row) != "toolresult":
        return None
    name = row.get("toolName")
    dispatched = is_dispatcher(name)
    if not dispatched and isinstance(name, str) and name and name != tool and not name.endswith(f"__{tool}"):
        return None
    outer = _structured(row)
    if outer is None:
        return None
    if not dispatched:
        return None if _is_envelope(outer) else outer
    if not _is_envelope(outer):
        return None
    entry = outer["tool"]
    if entry.get("name") != tool or entry.get("id") != f"openclaw:core:{tool}" or entry.get("source") != "openclaw":
        return None
    inner = _structured(outer["result"])
    return None if inner is None or _is_envelope(inner) else inner


def served_model(row):
    """`provider/model` one assistant row was served by, or None (transcript-only rows name no model)."""
    if role_of(row) != "assistant":
        return None
    provider, model = row.get("provider"), row.get("model")
    response = row.get("responseModel")
    if not isinstance(model, str) or not model or provider == "openclaw":
        return None
    if isinstance(response, str) and response and response != model:
        dated = response.startswith(model) and re.fullmatch(r"-(\d{4}-\d{2}-\d{2}|\d{8})", response[len(model):])
        model = model if dated else response
    if "/" in model:
        return model
    return f"{provider}/{model}" if isinstance(provider, str) and provider else None


def _number(usage, *names):
    for name in names:
        value = usage.get(name)
        if isinstance(value, (int, float)) and not isinstance(value, bool) and value >= 0:
            return int(value)
    return 0


def row_usage(row):
    """{input, output, cacheRead, cacheWrite} of one assistant row (the fields chat.history keeps)."""
    usage = row.get("usage") if isinstance(row, dict) else None
    if not isinstance(usage, dict):
        return None
    return {
        "input": _number(usage, "input", "inputTokens", "input_tokens", "promptTokens", "prompt_tokens"),
        "output": _number(usage, "output", "outputTokens", "output_tokens", "completionTokens", "completion_tokens"),
        "cacheRead": _number(usage, "cacheRead", "cache_read_input_tokens"),
        "cacheWrite": _number(usage, "cacheWrite", "cache_creation_input_tokens"),
    }


def _run_id(row):
    meta = row.get("__openclaw") if isinstance(row, dict) else None
    return meta.get("runId") if isinstance(meta, dict) else None


def _same_text(text, prompt):
    squash = lambda value: " ".join(value.split())
    return squash(prompt) in squash(text)


def turn_rows(rows, prompt, run_id=None):
    """The rows of the turn `prompt` started: from its user row to the next user row, plus later rows of the same run."""
    rows = [r for r in rows if isinstance(r, dict)]
    users = [i for i, r in enumerate(rows) if role_of(r) == "user"]
    anchors = [i for i in users if _same_text(text_of(rows[i]), prompt)]
    if len(anchors) != 1:
        raise TranscriptError(f"{len(anchors)} user rows carry the prompt; expected exactly one")
    if anchors[0] != users[0]:
        raise TranscriptError("the prompt is not the session's first user row: not a fresh session")
    start = anchors[0]
    end = next((i for i in users if i > start), len(rows))
    turn = rows[start + 1:end]
    if run_id:
        turn += [r for r in rows[end:] if role_of(r) != "user" and _run_id(r) == run_id]
    return turn


def read_turn(rows, prompt, run_id=None):
    """Everything the eval records about one turn. Raises TranscriptError when the rows can't show it."""
    turn = turn_rows(rows, prompt, run_id)
    assistants = [r for r in turn if role_of(r) == "assistant"]
    if not any(role_of(r) in ("assistant", "toolresult") or _is_nested(r) for r in turn):
        raise TranscriptError("no assistant row or tool result in the turn")
    if any((r.get("__openclaw") or {}).get("reason") == "oversized" for r in assistants):
        raise TranscriptError("an assistant row was omitted as oversized: its tool calls are unknown")
    results = {}
    for row in turn:
        if role_of(row) == "toolresult" and isinstance(row.get("toolCallId"), str):
            results.setdefault(row["toolCallId"], row)

    calls, reply, usage, models = [], "", {"input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0}, []
    model_calls = 0
    by_id = {}

    def add(call_id, name, args, via, result):
        tool = continuation_tool(name)
        answer = unwrap_result(result, tool) if tool and result is not None else None
        call = {"id": call_id, "name": tool or name, "via": via, "args": args, "answered": result is not None,
                "isError": bool(result and result.get("isError") is True),
                "status": answer.get("status") if answer and isinstance(answer.get("status"), str) else None}
        calls.append(call)
        if call_id:
            by_id[call_id] = call

    for row in turn:
        nested = _nested_call(row)
        if nested is not None:
            parent = by_id.get(nested["parent"])
            # Tool Search writes a nested row for the call its dispatcher row already is: one call, not two.
            if not (parent and parent["via"] == "dispatcher"):
                add(nested["id"], nested["name"], nested["args"], "nested", nested["result"])
            continue
        if role_of(row) != "assistant":
            continue
        content = row.get("content")
        for part in content if isinstance(content, list) else []:
            target = call_target(part)
            if target is not None:
                call_id = part.get("id") if isinstance(part.get("id"), str) else None
                add(call_id, target["name"], target["args"], "dispatcher" if target["dispatched"] else "direct", results.get(call_id))
        text = text_of(row)
        if text.strip():
            reply = text
        row_tokens = row_usage(row)
        if row_tokens and any(row_tokens.values()):
            model_calls += 1
            for key, value in row_tokens.items():
                usage[key] += value
        model = served_model(row)
        if model and model not in models:
            models.append(model)
    # A result whose call row was dropped is still a call.
    for call_id, row in results.items():
        if call_id not in by_id:
            name, via = _result_tool(row)
            if name:
                add(call_id, name, {}, via, row)

    elections = [c for c in calls if c["name"] in CONTINUATION_TOOLS]
    first_election = next((i for i, c in enumerate(calls) if c["name"] in CONTINUATION_TOOLS), None)
    searches = [i for i, c in enumerate(calls) if c["name"] == "tool_search"]
    return {
        "reply": reply,
        "calls": calls,
        "elections": [{"tool": c["name"], "via": c["via"], "status": c["status"],
                       "answered": c["answered"], "isError": c["isError"]} for c in elections],
        "elected": bool(elections),
        "discovery": {
            "searches": len(searches),
            "firstCallIsSearch": bool(calls) and calls[0]["name"] == "tool_search",
            "searchBeforeElection": bool(searches) and first_election is not None and searches[0] < first_election,
            "queries": [q for i in searches for q in _queries(calls[i]["args"])],
        },
        "tokenForm": {"continue_work": bool(_TOKEN_WORK.search(reply)), "continue_delegate": bool(_TOKEN_DELEGATE.search(reply))},
        "otherTools": sorted({c["name"] for c in calls if c["name"] not in CONTINUATION_TOOLS + DISCOVERY_TOOLS}),
        "usage": {**usage, "total": sum(usage.values())},
        "modelCalls": model_calls,
        "servedModels": models,
    }


def _is_nested(row):
    return role_of(row) == "custom" and row.get("customType") == NESTED_TOOL_ROW


def _nested_call(row):
    """{id, parent, name, args, result} of one nested-tool row, or None."""
    if not _is_nested(row):
        return None
    content = row.get("content")
    parts = content if isinstance(content, list) else []
    call = next((p for p in parts if isinstance(p, dict) and p.get("type") == "toolCall"), None)
    result = next((p for p in parts if isinstance(p, dict) and p.get("type") == "toolResult"), None)
    if call is None or not isinstance(call.get("name"), str):
        raise TranscriptError("a nested tool row names no call")
    return {"id": call.get("id"), "parent": call.get("parentToolCallId"), "name": call["name"], "args": _raw_arguments(call),
            "result": {**result, "role": "toolResult", "toolName": call["name"]} if result else None}


def _result_tool(row):
    """(tool, via) of a toolResult row read on its own: its own name, or the tool its dispatcher envelope names."""
    name = row.get("toolName")
    if not is_dispatcher(name):
        return (name if isinstance(name, str) else None), "direct"
    outer = _structured(row)
    tool = outer["tool"].get("name") if _is_envelope(outer) else None
    return (tool if isinstance(tool, str) and unwrap_result(row, tool) is not None else None), "dispatcher"


def _queries(args):
    out = [args["query"]] if isinstance(args.get("query"), str) and args["query"].strip() else []
    batch = args.get("queries")
    for item in batch if isinstance(batch, list) else []:
        if isinstance(item, dict) and isinstance(item.get("query"), str):
            out.append(item["query"])
    return out
