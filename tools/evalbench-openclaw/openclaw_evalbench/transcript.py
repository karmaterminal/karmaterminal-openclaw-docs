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
# What a refusal looks like in a tool's structured answer: the product's own words for it (openclaw ab5a30ea
# src/agents/subagents/spawn/subagent-spawn-request.ts:308-314 "forbidden", src/agents/tools/continue-delegate-tool.ts:377-380
# "rejected" with its guard).
_REFUSED = ("forbidden", "rejected", "refused", "error", "denied")
# Tools whose every answer comes from a service a setting switched off: (tool, setting, value, what the record says).
_SWITCHED_OFF = (("automations", "cron.enabled", False, "answered with the scheduler off"),
                 ("skill_workshop", "plugins.entries.skill-workshop.config.autonomous.mode", "off", "answered with its review off"))
# Setting names too common to be read as the reason for a refusal on their own: only their whole path counts.
_GENERIC_LEAVES = ("enabled", "maxConcurrent", "timeoutSeconds", "runTimeoutSeconds")


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


def continuation_wakes(rows):
    """Turns a continuation started: the wake's own row says so (openclaw ab5a30ea src/auto-reply/continuation/work-wake-text.ts:58-59)."""
    return sum(role_of(r) == "user" and text_of(r).lstrip().startswith("[continuation:wake]") for r in rows)


def _shown(result):
    """What one tool result showed the model: its text, and its structured answer."""
    if not isinstance(result, dict):
        return "", None
    structured = _structured(result)
    if _is_envelope(structured):
        # Tool Search's dispatcher: the answer is the dispatched tool's.
        structured = _structured(structured["result"]) or structured
    return "\n".join(filter(None, [text_of(result), json.dumps(structured, sort_keys=True) if structured else ""])), structured


def _limitation(name, result, settings):
    """The run's settings that a refusal in this result names, or None when it is no such refusal."""
    text, structured = _shown(result)
    status = structured.get("status") if structured else None
    # A guarded refusal says "rejected" too (continue-delegate-tool.ts:378-380, request-compaction-tool.ts:218-255).
    refused = bool(result and result.get("isError") is True) or (isinstance(status, str) and status.lower() in _REFUSED)
    named = sorted(key for key in settings
                   if key in text or (key.rsplit(".", 1)[-1] not in _GENERIC_LEAVES and key.rsplit(".", 1)[-1] in text))
    if not (refused and named):
        return None
    return {"tool": name, "settings": named, "status": status if isinstance(status, str) else "error"}


def treatment_limitations(calls, results, settings):
    """What the run's caps and admission settings showed this turn's model, in call order (README.md, Spend caps and admission).

    A setting limits what runs, not what the model is shown, but a refusal on its account reaches the model as the
    tool's answer. So does every answer of a tool whose service a setting switched off: `automations` with cron's scheduler
    off (its jobs never fire by themselves, and `status` says so), and `skill_workshop` with its review off (`list` says
    so, extensions/skill-workshop/src/workshop-list.ts:32). Recorded per trial as a treatment limitation, never hidden and
    never a reason to leave a trial out.
    """
    switched_off = {tool: (key, status) for tool, key, value, status in _SWITCHED_OFF if settings.get(key) == value}
    out = []
    for index, call in enumerate(calls):
        result = results.get(call["id"]) if call["id"] else None
        found = _limitation(call["name"], result, settings) if result is not None else None
        if found is None and call["name"] in switched_off:
            key, status = switched_off[call["name"]]
            found = {"tool": call["name"], "settings": [key], "status": status}
        if found is not None:
            out.append({**found, "call": index})
    return out


def read_turn(rows, prompt, run_id=None, settings=None):
    """Everything the eval records about one turn. Raises TranscriptError when the rows can't show it.

    `settings` are the run's caps and admission settings (arms.json caps.set): what they showed the model is
    `limitations`.
    """
    turn = turn_rows(rows, prompt, run_id)
    assistants = [r for r in turn if role_of(r) == "assistant"]
    if not any(role_of(r) in ("assistant", "toolresult") or _is_nested(r) for r in turn):
        raise TranscriptError("no assistant row or tool result in the turn")
    if any((r.get("__openclaw") or {}).get("reason") == "oversized" for r in assistants):
        raise TranscriptError("an assistant row was omitted as oversized: its tool calls are unknown")
    results, result_at = {}, {}
    for index, row in enumerate(turn):
        if role_of(row) == "toolresult" and isinstance(row.get("toolCallId"), str):
            results.setdefault(row["toolCallId"], row)
            result_at.setdefault(row["toolCallId"], index)

    calls, reply, texts, usage, models = [], "", [], {"input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0}, []
    model_calls = 0
    by_id, index_of, answers = {}, {}, {}
    # For each call, the row of the response that decided it, and the row at which its answer reached the model.
    decided, seen = [], []

    def add(call_id, name, args, via, result, decided_at, seen_at):
        tool = continuation_tool(name)
        answer = unwrap_result(result, tool) if tool and result is not None else None
        call = {"id": call_id, "name": tool or name, "via": via, "args": args, "answered": result is not None,
                "isError": bool(result and result.get("isError") is True),
                "status": answer.get("status") if answer and isinstance(answer.get("status"), str) else None}
        calls.append(call)
        decided.append(decided_at)
        seen.append(seen_at)
        if call_id:
            by_id[call_id] = call
            index_of[call_id] = len(calls) - 1
            if result is not None:
                answers[call_id] = result

    for position, row in enumerate(turn):
        nested = _nested_call(row)
        if nested is not None:
            parent = by_id.get(nested["parent"])
            # Tool Search writes a nested row for the call its dispatcher row already is: one call, not two.
            if not (parent and parent["via"] == "dispatcher"):
                # A call made inside another (Code Mode's exec) was decided with it, and its answer reached the model
                # with the outer call's result.
                outer = index_of.get(nested["parent"])
                add(nested["id"], nested["name"], nested["args"], "nested", nested["result"],
                    decided[outer] if outer is not None else position, result_at.get(nested["parent"], position))
            continue
        if role_of(row) != "assistant":
            continue
        content = row.get("content")
        for part in content if isinstance(content, list) else []:
            target = call_target(part)
            if target is not None:
                call_id = part.get("id") if isinstance(part.get("id"), str) else None
                add(call_id, target["name"], target["args"], "dispatcher" if target["dispatched"] else "direct", results.get(call_id),
                    position, result_at.get(call_id, position))
        text = text_of(row)
        if text.strip():
            reply = text
            texts.append(text)
        row_tokens = row_usage(row)
        if row_tokens and any(row_tokens.values()):
            model_calls += 1
            for key, value in row_tokens.items():
                usage[key] += value
        model = served_model(row)
        if model and model not in models:
            models.append(model)
    # A result whose call row was dropped is still a call. Its response is the one whose results it sits among.
    orphans = {call_id for call_id in results if call_id not in by_id}
    for call_id, row in results.items():
        if call_id in orphans:
            name, via = _result_tool(row)
            if name:
                add(call_id, name, {}, via, row, _response_of(turn, result_at[call_id], orphans), result_at[call_id])

    elections = [c for c in calls if c["name"] in CONTINUATION_TOOLS]
    first_election = next((i for i, c in enumerate(calls) if c["name"] in CONTINUATION_TOOLS), None)
    limitations = treatment_limitations(calls, answers, settings or {})
    # An election decided in a later response than the one a limitation was answered to may answer it.
    shown = min((seen[found["call"]] for found in limitations), default=None)
    elected_after = shown is not None and any(decided[i] > shown for i, c in enumerate(calls) if c["name"] in CONTINUATION_TOOLS)
    searches = [i for i, c in enumerate(calls) if c["name"] == "tool_search"]
    return {
        "reply": reply,
        # Every text the turn's assistant rows hold, in order: the reply is the last, and what came before a call is there too.
        "assistantTexts": texts,
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
        "limitations": limitations,
        # An election the model decided after something the settings showed it may answer it: the trial says so.
        "electedAfterLimitation": elected_after,
    }


def _response_of(turn, index, orphans):
    """Where a response whose row is gone was decided: just before the run of results of calls that no row shows.

    A result of a call a present row does show belongs to that row's response, which did not make this call: this one came
    after it.
    """
    while index > 0 and role_of(turn[index - 1]) == "toolresult" and turn[index - 1].get("toolCallId") in orphans:
        index -= 1
    return index - 0.5


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
