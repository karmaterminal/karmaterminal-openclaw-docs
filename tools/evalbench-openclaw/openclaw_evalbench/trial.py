"""One trial: a fresh session on the arm's gateway, one prompt, one turn, and then everything it started is stopped."""

import asyncio
import contextlib
import hashlib
import pathlib
import time
import uuid

from . import arms as arms_module
from .arms import AGENT_ID, ArmMismatch
from .gateway import GatewayClient, GatewayError
from .surface import read_surface, surface_verdict
from .transcript import TranscriptError, read_turn

TURN_DEADLINE_SECONDS = 600.0
WAIT_SLICE_MS = 15_000
HISTORY_PAGE = 200
HISTORY_MAX_PAGES = 20
SURFACE_ATTEMPTS = 6
CLEANUP_ATTEMPTS = 3
CLEANUP_ROUNDS = 3
# Archive and delete wait for a session's work to drain.
CLEANUP_CALL_SECONDS = 90.0
# The prompts name files here that nothing creates. A model that creates one changes what later trials see.
SCRATCH_PATH = pathlib.Path("/tmp/evalprop")
# Scored: the turn's outcome counts. Anything else leaves every denominator.
SCORED = ("ok", "deadline")


class InfraError(Exception):
    """The trial could not be run or read. Never an outcome."""


def _hash12(value):
    return hashlib.sha256(str(value).encode()).hexdigest()[:12]


def _terminal(wait):
    """Whether an agent.wait answer settles the run (openclaw ab5a src/agents/run-wait.ts:216-223)."""
    status = wait.get("status")
    if status in ("ok", "error"):
        return wait.get("pendingError") is not True
    return (status == "timeout" and wait.get("pendingError") is not True
            and (wait.get("endedAt") is not None or bool(wait.get("stopReason")) or bool(wait.get("livenessState"))))


async def preflight(arm_name, arm, model, client):
    """Identity, methods and config. Reads only. Returns the receipt; raises ArmMismatch."""
    identity = arms_module.check_identity(arm, client.hello)
    missing = client.missing_methods()
    if missing:
        raise ArmMismatch(f"gateway does not advertise: {', '.join(missing)}")
    config = arms_module.check_config(arm, model, await client.call("config.get", {}))
    return {"arm": arm_name, "model": model, "identity": identity, **config}


async def run_trial(*, arm_name, arm, descriptions, model, url, token, prompt, prompt_id, kind,
                    verified=None, deadline_seconds=TURN_DEADLINE_SECONDS, sleep=asyncio.sleep):
    """Run one trial and return its record. Never raises for a gateway or product failure: that is a status.

    `verified` is the arm's last verified surface in this run: {"gateway", "surface"}. See _surface_for.
    """
    started = time.monotonic()
    record = {
        "schema": "openclaw.evalbench.trial.v1", "arm": arm_name, "model": model, "promptId": prompt_id, "kind": kind,
        "status": None, "reason": None, "elected": None, "elections": [], "calls": [], "reply": "",
        "usage": None, "metered": None, "scratchPresent": SCRATCH_PATH.exists(), "cleanup": {"ok": None, "reason": None},
    }
    try:
        url = arms_module.check_url(url)
        async with GatewayClient(url, token) as client:
            record["gateway"] = await preflight(arm_name, arm, model, client)
            await _trial_on(client, record, arm, descriptions, model, prompt, verified, deadline_seconds, sleep)
    except ArmMismatch as error:
        record.update(status="arm_mismatch", reason=str(error))
    except (InfraError, TranscriptError) as error:
        record.update(status="infra_error", reason=str(error))
    except GatewayError as error:
        record.update(status="infra_error", reason=f"{error.method} refused: {error.code} {error.message}".strip()[:300])
    except (TimeoutError, OSError) as error:
        record.update(status="infra_error", reason=f"gateway unreachable: {type(error).__name__}")
    except Exception as error:  # a bug or an unexpected frame is never an outcome
        record.update(status="infra_error", reason=f"adapter error: {type(error).__name__}: {error}"[:300])
    if record["status"] not in SCORED:
        # An unscored trial makes no claim about the election, whatever had been read by then.
        record["elected"] = None
    record["seconds"] = round(time.monotonic() - started, 3)
    return record


async def _trial_on(client, record, arm, descriptions, model, prompt, verified, deadline_seconds, sleep):
    created = await client.call("sessions.create", {
        "key": f"evalprop-{record['arm'].lower()}-{uuid.uuid4().hex}", "agentId": AGENT_ID,
        "label": f"evalprop {record['arm']} {uuid.uuid4().hex[:12]}",
    })
    key = created.get("key")
    if not isinstance(key, str) or not key:
        raise InfraError("sessions.create answered without a key")
    record["session"] = _hash12(key)
    try:
        sent = await client.call("sessions.send", {"key": key, "message": prompt, "idempotencyKey": uuid.uuid4().hex})
        run_id = sent.get("runId")
        if not isinstance(run_id, str) or not run_id:
            raise InfraError("sessions.send answered without a runId")
        wait = await _wait(client, run_id, deadline_seconds)
        if wait is None:
            # Stop the turn before reading it, so the history read below is its final state.
            await client.call("sessions.abort", {"key": key, "clearQueued": True})
        failed = wait is not None and wait.get("status") == "error"
        failure = f"the turn failed: {str((wait or {}).get('error') or 'no error text')[:200]}"
        try:
            turn = read_turn(await _history(client, key), prompt, run_id)
        except TranscriptError as error:
            if wait is None:
                # Not an outcome, and not an ordinary failure either: report.py shows these on their own.
                record.update(status="deadline_unreadable", reason=f"stopped at the deadline, and {error}")
                return
            raise InfraError(failure if failed else str(error)) from None
        record.update({k: turn[k] for k in ("elected", "elections", "calls", "reply", "discovery", "tokenForm",
                                           "otherTools", "usage", "modelCalls", "servedModels")})
        described = (await client.call("sessions.describe", {"key": key})).get("session") or {}
        runtime = described.get("agentRuntime") if isinstance(described.get("agentRuntime"), dict) else {}
        record["runtime"] = runtime.get("id")
        surface, verdict, why = await _surface_for(client, key, arm, descriptions, record["gateway"], verified, wait is None, sleep)
        record["surface"] = {"verdict": verdict, "reason": why, **(surface or {})}
        # Codex's native tool search never enters chat history, so its absence there says nothing.
        record["discovery"]["observable"] = bool(surface and surface["toolSearchDirect"]) or turn["discovery"]["searches"] > 0
        if failed:
            raise InfraError(failure)
        if verdict == "mismatch":
            raise ArmMismatch(why)
        if verdict == "unreadable" and wait is None:
            record.update(status="deadline_unreadable", reason="stopped at the deadline, and no earlier trial of this run verified the surface")
            return
        if verdict == "unreadable":
            raise InfraError(why)
        others = [m for m in turn["servedModels"] if m != model]
        if others:
            raise ArmMismatch(f"served by {', '.join(others)}, not {model}")
        if not turn["servedModels"]:
            # A turn of tool calls with no reply can leave no assistant row to read it from, and that is how a turn
            # that only elected looks: dropping it would lower the rate. The arm has no fallbacks, so the session's
            # own selection stands in, and says so.
            selected = f"{described.get('modelProvider')}/{described.get('model')}"
            if selected != model:
                raise InfraError(f"no assistant row names a model, and the session selected {selected}")
            record["servedModels"], record["servedModelSource"] = [selected], "selection"
        record["status"] = "deadline" if wait is None or wait.get("status") == "timeout" else "ok"
    finally:
        record["metered"] = await _meter(client, key)
        record["cleanup"] = await _cleanup(client, key, sleep)


async def _wait(client, run_id, deadline_seconds):
    """The run's terminal agent.wait answer, or None when the deadline passed first."""
    end = time.monotonic() + deadline_seconds
    while (left := end - time.monotonic()) > 0:
        slice_ms = max(1, min(WAIT_SLICE_MS, int(left * 1000)))
        answer = await client.call("agent.wait", {"runId": run_id, "timeoutMs": slice_ms}, timeout=slice_ms / 1000 + 15)
        if _terminal(answer):
            return answer
        if answer.get("status") == "pending":
            await asyncio.sleep(min(1.0, max(0.0, end - time.monotonic())))
    return None


async def _history(client, key):
    """Every row of the session, oldest first. Offset 0 is the newest page."""
    rows, offset = [], 0
    for _ in range(HISTORY_MAX_PAGES):
        params = {"sessionKey": key, "limit": HISTORY_PAGE}
        if offset:
            params["offset"] = offset
        page = await client.call("chat.history", params)
        messages = page.get("messages")
        if not isinstance(messages, list):
            raise InfraError("chat.history answered without messages")
        rows = messages + rows
        if page.get("hasMore") is not True:
            return rows
        following = page.get("nextOffset")
        if not isinstance(following, int) or following <= offset:
            raise InfraError("chat.history paging did not advance")
        offset = following
    raise InfraError("chat.history did not reach the session's first row")


async def _surface_for(client, key, arm, descriptions, gateway, verified, stopped, sleep):
    """(surface, verdict, reason) for this turn.

    The gateway stores the prompt report when a turn settles. A turn stopped at the deadline never settles
    (agent-runner-execute.ts:470-492 returns before finalizeReplyAgentRun), so it has none. Leaving those trials out
    would drop the turns that sat in a polling loop instead of electing. A stopped turn therefore carries the arm's
    surface from an earlier trial of this run, measured on the same gateway process and configuration revision.
    """
    surface = await _surface(client, key, descriptions, sleep, 1 if stopped else SURFACE_ATTEMPTS)
    if surface is None and stopped and verified and verified["gateway"] == gateway:
        return verified["surface"], "carried", None
    return (surface, *surface_verdict(surface, arm["surface"]))


async def _surface(client, key, descriptions, sleep, attempts):
    """The stored prompt report. It is written as the turn settles, so a read right after it may be early."""
    for attempt in range(attempts):
        payload = await client.call("sessions.usage", {"key": key, "limit": 1, "includeContextWeight": True})
        rows = [r for r in payload.get("sessions") or [] if isinstance(r, dict)]
        row = next((r for r in rows if r.get("key") == key), rows[0] if len(rows) == 1 else None)
        surface = read_surface((row or {}).get("contextWeight"), descriptions)
        if surface is not None:
            return surface
        if attempt + 1 < attempts:
            await sleep(0.5 * (attempt + 1))
    return None


async def _meter(client, key):
    """Tokens the gateway recorded for the trial's session and everything spawned under it, read before cleanup.

    sessions.usage.timeseries is the one fresh, cumulative reading (tools/k6-proofs/lib/token-budget.mjs). Best effort:
    an unreadable count is None, and stops.charge never takes that as free.
    """
    out = {"session": None, "children": 0, "childSessions": 0, "unreadableChildren": 0}
    with contextlib.suppress(GatewayError, TimeoutError, OSError):
        out["session"] = await _tokens(client, key)
        children = await _descendants(client, key)
        out["childSessions"] = len(children)
        for child in children:
            tokens = await _tokens(client, child)
            out["children"] += tokens or 0
            out["unreadableChildren"] += tokens is None
    return out


async def _tokens(client, key):
    try:
        payload = await client.call("sessions.usage.timeseries", {"key": key})
    except GatewayError:
        return None
    points = payload.get("points")
    if not isinstance(points, list):
        return None
    total = 0
    for point in points:
        parts = [point.get(n) or 0 for n in ("input", "output", "cacheRead", "cacheWrite")]
        total += max(point.get("totalTokens") or 0, sum(parts))
    return int(total)


async def _cleanup(client, key, sleep):
    """Stop everything the trial started: its session first, then every session spawned under it.

    sessions.delete ends the session's continuations and its subagents (openclaw ab5a session-reset-cleanup.ts:143-170),
    so the session goes before its children: nothing is left to start another. operator.write may delete only an
    archived session (sessions-delete.ts, archivedOnly), so archive comes first.
    """
    try:
        known = await _descendants(client, key)
        await _remove(client, key, sleep)
        for _ in range(CLEANUP_ROUNDS):
            for child in known:
                await _remove(client, child, sleep)
            known = await _descendants(client, key)
            if not known:
                return {"ok": True, "reason": None}
        return {"ok": False, "reason": f"{len(known)} spawned session(s) still listed"}
    except (GatewayError, TimeoutError, OSError) as error:
        return {"ok": False, "reason": str(error)[:200] or type(error).__name__}


async def _descendants(client, key):
    """Sessions spawned under `key`, deepest first."""
    found, frontier = [], [key]
    while frontier and len(found) < 200:
        following = []
        for parent in frontier:
            payload = await client.call("sessions.list", {"spawnedBy": parent, "limit": 100})
            for row in payload.get("sessions") or []:
                child = row.get("key") if isinstance(row, dict) else None
                # The list's filter matches any of these links; each names a session this trial itself made.
                owners = [row.get(n) for n in ("spawnedBy", "parentSessionKey", "controlOwnerSessionKey")] if isinstance(row, dict) else []
                if isinstance(child, str) and child and parent in owners and child != key and child not in found:
                    found.append(child)
                    following.append(child)
        frontier = following
    return list(reversed(found))


async def _remove(client, key, sleep):
    last = None
    for attempt in range(CLEANUP_ATTEMPTS):
        # Best effort: a non-admin caller may not abort a run another connection or the gateway started
        # (chat-abort-authorization.ts:222-227). Archive and delete drain the session's work themselves.
        with contextlib.suppress(GatewayError):
            await client.call("sessions.abort", {"key": key, "clearQueued": True})
        try:
            await client.call("sessions.patch", {"key": key, "archived": True}, timeout=CLEANUP_CALL_SECONDS)
            await client.call("sessions.delete", {"key": key, "archivedOnly": True}, timeout=CLEANUP_CALL_SECONDS)
            return
        except GatewayError as error:
            if "not found" in error.message.lower():
                return
            last = error
            await sleep(1.0 * (attempt + 1))
    raise last
