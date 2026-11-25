"""One trial against the fake gateway: the frames, the outcome, and stopping what it started."""
import asyncio
import json

import pytest
from conftest import PROMPT, fake_gateway

from openclaw_evalbench.arms import load_arms
from openclaw_evalbench.stops import ASSUMED_TRIAL_TOKENS, MAX_CONSECUTIVE_INFRA_ERRORS, ArmGuard, charge
from openclaw_evalbench.trial import run_trial

W, C = "w1-file-appears", "c1-arithmetic"


async def no_sleep(_seconds):
    return None


def trial(arms, arm_name, turn, *, prompt_id=W, kind="eligible", deadline=5.0, token=None, url=None, prompt=None, model=None, verified=None, **gateway):
    async def go():
        async with fake_gateway(arms, arm_name, {prompt_id: [turn]}, **gateway) as fake:
            record = await run_trial(
                arm_name=arm_name, arm=arms["arms"][arm_name], model=model or arms["model"],
                descriptions=arms["descriptions"][arms["arms"][arm_name]["descriptions"]]["tools"], url=url or fake.url,
                token=fake.token if token is None else token, prompt=prompt or PROMPT[prompt_id], prompt_id=prompt_id, kind=kind,
                verified=verified(record_gateway(fake)) if verified else None, deadline_seconds=deadline, sleep=no_sleep)
            return record, fake
    return asyncio.run(go())


def record_gateway(fake):
    """The gateway receipt a trial on this fake records."""
    server = fake._hello([])["server"]
    return {"arm": next(n for n, a in A_ARMS.items() if a == fake.arm), "identity": {k: server.get(k) for k in ("commit", "buildId", "version", "bootId")},
            "configRevisionHash": "fake"}


A_ARMS = load_arms()["arms"]
SURFACE = {"placement": {"continue_work": "direct"}, "toolSearchDirect": False, "systemPromptHash": "h", "descriptionText": {}}


def carried(gateway):
    return {"gateway": gateway, "surface": SURFACE}


def test_an_election(arms):
    record, fake = trial(arms, "C", "election-work")
    assert (record["status"], record["elected"], record["elections"][0]["tool"]) == ("ok", True, "continue_work")
    assert record["surface"]["verdict"] == "verified" and set(record["surface"]["descriptionText"].values()) == {"match"}
    assert record["runtime"] == "openclaw" and record["servedModels"] == ["openai/gpt-5.6-sol"]
    assert record["cleanup"] == {"ok": True, "reason": None} and fake.sessions == {}


def test_tool_search_then_election(arms):
    record, _ = trial(arms, "A", "search-then-work")
    assert (record["status"], record["elected"], record["elections"][0]["via"]) == ("ok", True, "dispatcher")
    assert record["discovery"]["searchBeforeElection"] is True and record["discovery"]["observable"] is True


def test_no_election(arms):
    record, _ = trial(arms, "B", "no-election")
    assert (record["status"], record["elected"], record["elections"]) == ("ok", False, [])


def test_a_control_false_election(arms):
    record, _ = trial(arms, "C", "control-false-election", prompt_id="c5-nothing-to-do", kind="control")
    assert (record["status"], record["elected"], record["kind"]) == ("ok", True, "control")


def test_discovery_is_not_observable_where_codex_owns_the_search(arms):
    record, _ = trial(arms, "A", "no-election", overrides={"runtime": "codex"})
    assert record["status"] == "ok" and record["runtime"] == "codex" and record["discovery"]["observable"] is False


def test_every_trial_is_a_fresh_session_with_the_exact_prompt(arms):
    _, first = trial(arms, "C", "control-clean", prompt_id=C, kind="control")
    creates = [p for m, p in first.calls if m == "sessions.create"]
    sends = [p for m, p in first.calls if m == "sessions.send"]
    assert len(creates) == len(sends) == 1
    assert creates[0]["agentId"] == "main" and "message" not in creates[0] and sends[0]["message"] == PROMPT[C]
    _, second = trial(arms, "C", "control-clean", prompt_id=C, kind="control")
    assert [p for m, p in second.calls if m == "sessions.create"][0]["key"] != creates[0]["key"]


def test_the_session_and_its_children_are_stopped_and_deleted(arms):
    record, fake = trial(arms, "C", "spawn-no-election")
    assert record["status"] == "ok" and record["elected"] is False and "sessions_spawn" in record["otherTools"]
    assert fake.sessions == {} and len(fake.deleted) == 2
    order = [m for m, p in fake.calls if m.startswith("sessions.") and p.get("key") == fake.deleted[0]]
    assert order[-3:] == ["sessions.abort", "sessions.patch", "sessions.delete"]
    assert not fake.deleted[0].startswith("agent:main:subagent:"), "the session goes before its children"


def test_only_this_trials_sessions_are_touched(arms):
    async def go():
        async with fake_gateway(arms, "C", {C: ["control-clean"]}) as fake:
            bystander = {"rows": [], "runId": None, "spawnedBy": "agent:main:main", "archived": False, "fixture": None}
            fake.sessions["agent:main:main"] = dict(bystander, spawnedBy=None)
            fake.sessions["agent:main:other"] = bystander
            await run_trial(arm_name="C", arm=arms["arms"]["C"], model=arms["model"], url=fake.url, token=fake.token,
                            descriptions=arms["descriptions"]["f9fcd3a5"]["tools"], prompt=PROMPT[C], prompt_id=C, kind="control")
            return fake
    assert set(asyncio.run(go()).sessions) == {"agent:main:main", "agent:main:other"}


def test_a_turn_at_the_deadline_is_stopped_and_scored_by_its_history(arms):
    record, fake = trial(arms, "C", "deadline-no-election", deadline=0.5, verified=carried)
    assert (record["status"], record["elected"]) == ("deadline", False)
    # A turn stopped by an abort stores no prompt report; the arm's verified surface stands in.
    assert record["surface"]["verdict"] == "carried" and record["surface"]["placement"] == SURFACE["placement"]
    methods = [m for m, _ in fake.calls]
    assert methods.index("sessions.abort") < methods.index("chat.history"), "the turn is stopped before it is read"
    assert fake.sessions == {}


def test_a_stopped_turn_with_an_election_is_scored_as_one(arms):
    record, _ = trial(arms, "C", "deadline-after-election", deadline=0.5, verified=carried)
    assert (record["status"], record["elected"]) == ("deadline", True)


@pytest.mark.parametrize("verified", [None, lambda g: carried({**g, "configRevisionHash": "another"}),
                                      lambda g: carried({**g, "identity": {**g["identity"], "bootId": "another"}})])
def test_a_surface_is_carried_only_from_the_same_gateway_process_and_config(arms, verified):
    record, _ = trial(arms, "C", "deadline-no-election", deadline=0.5, verified=verified)
    assert (record["status"], record["elected"]) == ("deadline_unreadable", None)


def test_only_a_stopped_turn_may_carry_a_surface(arms):
    record, _ = trial(arms, "C", "election-work", verified=carried, overrides={"noReport": True})
    assert record["status"] == "infra_error" and "no prompt report" in record["reason"]


def test_a_stopped_turn_with_no_rows_is_unscored_on_its_own_status(arms):
    record, _ = trial(arms, "C", "deadline-no-rows", deadline=0.5, verified=carried)
    assert (record["status"], record["elected"]) == ("deadline_unreadable", None)


def test_a_code_mode_election_is_seen(arms):
    record, _ = trial(arms, "A", "code-mode-work")
    assert record["status"] == "ok" and record["elections"] == [
        {"tool": "continue_work", "via": "nested", "status": "scheduled", "answered": True, "isError": False}]


def test_a_turn_that_only_elected_and_left_no_reply_is_scored(arms):
    record, _ = trial(arms, "C", "election-no-assistant-row")
    assert (record["status"], record["elected"]) == ("ok", True)
    assert record["servedModels"] == ["openai/gpt-5.6-sol"] and record["servedModelSource"] == "selection"


def test_a_description_that_is_not_the_arms_text_contradicts_the_arm(arms):
    wrong = json.loads(json.dumps(arms))
    wrong["descriptions"]["f9fcd3a5"]["tools"]["continue_work"]["sha256"] = "1" * 64

    async def go():
        async with fake_gateway(arms, "C", {W: ["election-work"]}) as fake:
            return await run_trial(arm_name="C", arm=arms["arms"]["C"], model=arms["model"], url=fake.url, token=fake.token,
                                   descriptions=wrong["descriptions"]["f9fcd3a5"]["tools"], prompt=PROMPT[W], prompt_id=W, kind="eligible")
    record = asyncio.run(go())
    assert record["status"] == "arm_mismatch" and "continue_work's description is not the arm's text" in record["reason"]


@pytest.mark.parametrize("link", ["spawnedBy", "parentSessionKey", "controlOwnerSessionKey"])
def test_a_child_is_found_by_any_link_to_the_trial(arms, link):
    from openclaw_evalbench.fake_gateway import load_turns
    turns = load_turns()
    turns["spawn-no-election"]["children"][0]["link"] = link
    record, fake = trial(arms, "C", "spawn-no-election", turns=turns)
    assert record["cleanup"]["ok"] is True and fake.sessions == {} and record["metered"]["childSessions"] == 1


def test_children_and_later_turns_are_metered(arms):
    record, _ = trial(arms, "C", "spawn-no-election")
    assert record["metered"] == {"session": 50_880, "children": 7_000, "childSessions": 1, "unreadableChildren": 0}
    assert charge(record) == 57_880
    woke, _ = trial(arms, "C", "woke-before-read")
    assert woke["usage"]["total"] < woke["metered"]["session"] == charge(woke), "the wake's turn is spent too"


def test_a_turn_with_no_reported_usage_is_charged_an_assumed_amount():
    sent = {"metered": {"session": None, "children": 0}, "usage": {"total": 0}}
    assert charge(sent) == ASSUMED_TRIAL_TOKENS and charge({**sent, "usage": None}) == ASSUMED_TRIAL_TOKENS
    assert charge({"metered": None, "usage": None}) == 0, "nothing was sent"


def test_paged_history_is_read_to_its_first_row(arms):
    record, fake = trial(arms, "A", "search-then-work", overrides={"historyPage": 2})
    assert record["status"] == "ok" and record["elected"] is True
    assert len([m for m, _ in fake.calls if m == "chat.history"]) == 3


@pytest.mark.parametrize("turn, kwargs, status, reason", [
    ("provider-error", {}, "infra_error", "the turn failed: provider overloaded"),
    ("provider-quota", {}, "infra_error", "429 usage limit"),
    ("wrong-model", {}, "arm_mismatch", "served by openai/gpt-5.6-terra"),
    ("election-work", {"overrides": {"surface": "deferred"}}, "arm_mismatch", "expected every continuation tool direct"),
    ("election-work", {"overrides": {"noReport": True}}, "infra_error", "no prompt report"),
    ("election-work", {"overrides": {"server": {"commit": "ab5a30ea79b7"}}}, "arm_mismatch", "is not the arm's"),
    ("election-work", {"overrides": {"server": {"commit": None, "buildId": None}}}, "arm_mismatch", "does not identify itself"),
    ("election-work", {"overrides": {"methods": ["config.get"]}}, "arm_mismatch", "does not advertise"),
    ("election-work", {"overrides": {"config": {"channels": {"discord": {}}}}}, "arm_mismatch", "not an isolated proof gateway"),
    ("election-work", {"overrides": {"refuse": {"chat.history": ["UNAVAILABLE", "try later"]}}}, "infra_error", "chat.history refused"),
    ("election-work", {"overrides": {"refuse": {"sessions.create": ["FORBIDDEN", "missing scope"]}}}, "infra_error", "sessions.create refused"),
    ("election-work", {"token": "wrong"}, "infra_error", "connect"),
    ("election-work", {"url": "ws://127.0.0.1:18789"}, "arm_mismatch", "live gateway's port"),
    ("election-work", {"url": "ws://127.0.0.1:9"}, "infra_error", "unreachable"),
])
def test_anything_but_a_clean_turn_is_unscored(arms, turn, kwargs, status, reason):
    record, fake = trial(arms, "C", turn, **kwargs)
    assert record["status"] == status and reason in record["reason"], record["reason"]
    assert record["elected"] is None, "an unscored trial must not claim an outcome"
    assert fake.sessions == {}, "and must leave nothing running"


def test_a_failed_turn_never_leaves_an_election_behind(arms):
    # The surface contradicts the arm *after* the history showed an election: still no claim.
    record, _ = trial(arms, "A", "election-work", overrides={"surface": "direct"})
    assert record["status"] == "arm_mismatch" and record["elected"] is None and record["usage"]["total"] > 0


def test_a_refused_abort_does_not_stop_the_cleanup(arms):
    record, fake = trial(arms, "C", "spawn-no-election", overrides={"refuse": {"sessions.abort": ["FORBIDDEN", "not your run"]}})
    assert record["status"] == "ok" and record["cleanup"]["ok"] is True and fake.sessions == {}


def test_a_failed_cleanup_is_reported(arms):
    record, _ = trial(arms, "C", "election-work", overrides={"refuse": {"sessions.delete": ["UNAVAILABLE", "still active"]}})
    assert record["status"] == "ok" and record["cleanup"]["ok"] is False and "still active" in record["cleanup"]["reason"]


def test_the_token_and_session_key_never_reach_the_record(arms):
    record, fake = trial(arms, "C", "election-work")
    text = json.dumps(record)
    assert fake.token not in text
    assert all(key not in text for key in fake.deleted)


def test_the_fake_gateway_refuses_what_a_closed_schema_refuses(arms):
    from openclaw_evalbench.gateway import GatewayClient, GatewayError

    async def go():
        async with fake_gateway(arms, "C", {}) as fake, GatewayClient(fake.url, fake.token) as client:
            for method, params in (("sessions.create", {"key": "k", "surprise": 1}), ("sessions.send", {"key": "k"}),
                                   ("sessions.nonsense", {}), ("sessions.delete", {"key": "k"})):
                with pytest.raises(GatewayError):
                    await client.call(method, params)
    asyncio.run(go())


def test_a_dropped_socket_fails_the_call_instead_of_hanging():
    from openclaw_evalbench.gateway import GatewayClient, GatewayError
    from websockets.asyncio.server import serve

    async def answer_connect_then_drop(socket):
        await socket.send(json.dumps({"type": "event", "event": "connect.challenge", "payload": {"nonce": "n"}}))
        frame = json.loads(await socket.recv())
        await socket.send(json.dumps({"type": "res", "id": frame["id"], "ok": True, "payload": {"type": "hello-ok"}}))
        await socket.recv()
        await socket.close()

    async def go():
        async with serve(answer_connect_then_drop, "127.0.0.1", 0) as server:
            port = server.sockets[0].getsockname()[1]
            async with GatewayClient(f"ws://127.0.0.1:{port}", "t") as client:
                with pytest.raises(GatewayError, match="closed"):
                    await asyncio.wait_for(client.call("agent.wait", {"runId": "x"}, timeout=30), 5)
    asyncio.run(go())


def guard_after(*records, budget=None):
    guard = ArmGuard("A", budget)
    for record in records:
        guard.after_trial({"reason": None, "usage": None, "cleanup": {"ok": True}, **record})
    return guard.before_trial()


def test_stop_rules():
    infra = {"status": "infra_error", "reason": "gateway unreachable"}
    assert guard_after({"status": "ok"}, {"status": "deadline"}) is None
    assert "arm mismatch" in guard_after({"status": "arm_mismatch", "reason": "x"})
    assert guard_after(*[infra] * (MAX_CONSECUTIVE_INFRA_ERRORS - 1)) is None
    assert guard_after(*[infra] * (MAX_CONSECUTIVE_INFRA_ERRORS - 1), {"status": "ok"}, infra) is None
    assert "in a row" in guard_after(*[infra] * MAX_CONSECUTIVE_INFRA_ERRORS)
    assert "cleanup failed" in guard_after({"status": "ok", "cleanup": {"ok": False, "reason": "still active"}})


@pytest.mark.parametrize("text", ["429 usage limit reached", "HTTP 401", "insufficient_quota", "rate limit exceeded", "token expired", "authentication failed"])
def test_a_provider_refusal_stops_the_arm_at_once(text):
    assert "provider refused" in guard_after({"status": "infra_error", "reason": f"the turn failed: {text}"})


def test_the_token_budget_is_checked_between_trials():
    spent = {"status": "ok", "usage": {"total": 600}, "metered": {"session": 600, "children": 0}}
    assert guard_after(spent, budget=1000) is None
    assert "token budget reached: 1200 of 1000" in guard_after(spent, spent, budget=1000)
    # A trial that failed after spending still counts.
    assert guard_after({"status": "infra_error", "reason": "x", "usage": {"total": 1000}, "metered": {"session": None, "children": 0}}, budget=1000)
