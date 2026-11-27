"""What the model could see in one turn, from the prompt report the gateway stores for it.

sessions.usage {key, includeContextWeight: true} returns the session's systemPromptReport as `contextWeight`
(openclaw ab5a src/gateway/server-methods/usage-session-selection.ts:588). Its tools.entries are the direct tools, each
with summaryHash = sha256 of the trimmed description (src/agents/system-prompt-report.ts:96-118), and
tools.deferred.entries are the ones behind a search. The embedded runtime and the Codex harness
(extensions/codex/src/app-server/attempt-context.ts:150-215) both write it.
"""

import hashlib
import json

from .arms import CONTINUATION_TOOLS


def read_surface(report, descriptions):
    """The continuation tools' place on the surface, and whether each direct description is the arm's own text."""
    tools = (report or {}).get("tools") if isinstance(report, dict) else None
    entries = tools.get("entries") if isinstance(tools, dict) else None
    if not isinstance(entries, list):
        return None
    direct = {e.get("name"): e for e in entries if isinstance(e, dict)}
    deferred_report = tools.get("deferred")
    deferred = {e.get("name") for e in (deferred_report or {}).get("entries", []) if isinstance(e, dict)}
    placement, text = {}, {}
    for tool in CONTINUATION_TOOLS:
        placement[tool] = "direct" if tool in direct else "deferred" if tool in deferred else "absent"
        if tool in direct:
            got, want = direct[tool].get("summaryHash"), descriptions[tool]["sha256"]
            text[tool] = "unreported" if not got else "match" if got == want else "differs"
    prompt = report.get("systemPrompt") if isinstance(report.get("systemPrompt"), dict) else {}
    return {
        "placement": placement,
        "descriptionText": text,
        "directTools": len(direct),
        # Which tools those are, so a contrast that holds the surface can tell two sets of one size apart.
        "directToolNamesSha256": hashlib.sha256(json.dumps(sorted(map(str, direct))).encode()).hexdigest()[:16],
        "deferredTools": len(deferred),
        "toolSearchDirect": "tool_search" in direct,
        "codeModeControls": "exec" in direct and "wait" in direct and "tool_search" not in direct,
        "systemPromptChars": prompt.get("chars"),
        "systemPromptHash": prompt.get("hash"),
    }


def surface_verdict(surface, expected):
    """("verified" | "mismatch" | "unreadable", reason). `expected` is "direct" or "deferred" for all three tools."""
    if surface is None:
        return "unreadable", "the gateway returned no prompt report for this turn"
    # request_compaction registers only where the runtime supplies its callbacks, so its absence contradicts no arm.
    wrong = [f"{tool} is {place}" for tool, place in surface["placement"].items()
             if place != expected and not (tool == "request_compaction" and place == "absent")]
    wrong += [f"{tool}'s description is not the arm's text" for tool, text in surface["descriptionText"].items() if text == "differs"]
    if wrong:
        return "mismatch", f"expected every continuation tool {expected}, with the arm's own text: " + ", ".join(wrong)
    return "verified", None
