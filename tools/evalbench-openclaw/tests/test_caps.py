"""The product's own spend caps: the same on every arm, written by the overlay, and read back before anything counts."""
import asyncio
import copy
import json

import pytest
from conftest import MODEL, PROMPT, fake_gateway
from test_arms import CAPS, LOG, config_for
from test_report import arm_trials, report_for
from test_trial import W, trial

from openclaw_evalbench import arms as A
from openclaw_evalbench.stops import ArmGuard, RunStop
from openclaw_evalbench.trial import run_trial

SET = CAPS["set"]


def payload(arm, **changes):
    return {**config_for(arm), "appliedConfigHash": "h", **changes}


def put(config, key, value):
    node = config
    *parents, leaf = key.split(".")
    for part in parents:
        node = node[part]
    if value is None:
        node.pop(leaf)
    else:
        node[leaf] = value


def test_the_caps_bound_every_way_a_trial_can_go_on():
    assert SET["agents.defaults.continuation.maxChainLength"] == SET["agents.defaults.continuation.costCapTokens"] == 1
    assert SET["agents.defaults.continuation.maxDelegatesPerTurn"] == 1
    assert {SET[f"agents.defaults.subagents.{k}"] for k in ("maxSpawnDepth", "maxChildrenPerAgent", "maxConcurrent")} == {1}
    assert {SET[f"tools.swarm.{k}"] for k in ("maxConcurrent", "maxChildrenPerGroup", "maxTotalPerGroup")} == {1}
    assert SET["agents.defaults.timeoutSeconds"] < 600
    # Automations are the tool an eligible turn might take instead, and switching cron off shows in what it answers.
    assert not [key for key in SET if key.startswith("cron")]


def test_every_arm_gets_the_same_caps_and_no_arm_sets_one_of_its_own(arms):
    written = {}
    for name, arm in arms["arms"].items():
        config = A.apply_overlay(arm, MODEL, CAPS, {"agents": {"defaults": {"timeoutSeconds": 9, "subagents": {"model": "kept"}}}}, LOG)
        written[name] = {key: A.read_path(config, key) for key in SET}
        assert config["agents"]["defaults"]["subagents"]["model"] == "kept", "and nothing beside them"
        for moved in ("set", "absent", "forbid"):
            assert not set(arm["config"].get(moved, ())) & set(SET), f"arm {name} {moved}"
    assert set(map(json.dumps, written.values())) == {json.dumps(SET)}


@pytest.mark.parametrize("name", "ABCD")
def test_caps_in_force_are_verified(arms, name):
    receipt = A.check_caps(CAPS, payload(arms["arms"][name]))
    assert receipt == {"verdict": "verified", "configRevisionHash": "h", "values": SET}


@pytest.mark.parametrize("where", ["sourceConfig", "config"])
@pytest.mark.parametrize("key", list(SET))
def test_a_cap_that_is_missing_or_different_is_not_in_force(arms, key, where):
    for value in (None, 7):
        broken = payload(arms["arms"]["C"])
        put(broken[where], key, value)
        with pytest.raises(A.CapsMismatch, match=f"{'authored' if where == 'sourceConfig' else 'effective'} {key} is {'unset' if value is None else 7}, not "):
            A.check_caps(CAPS, broken)


def test_true_is_not_one(arms):
    broken = payload(arms["arms"]["C"])
    put(broken["sourceConfig"], "agents.defaults.continuation.maxChainLength", True)
    with pytest.raises(A.CapsMismatch):
        A.check_caps(CAPS, broken)


@pytest.mark.parametrize("applied", [None, "", "another"])
def test_a_file_the_running_gateway_has_not_applied_is_not_in_force(arms, applied):
    with pytest.raises(A.CapsMismatch, match="has not applied this configuration"):
        A.check_caps(CAPS, payload(arms["arms"]["A"], appliedConfigHash=applied))


@pytest.mark.parametrize("broken", [None, {}, {"valid": False, "sourceConfig": {}, "config": {}}, {"valid": True, "sourceConfig": {}, "config": None}])
def test_an_unreadable_config_is_never_capped(broken):
    with pytest.raises(A.CapsMismatch):
        A.check_caps(CAPS, broken)


def test_the_agents_own_swarm_limits_outrank_the_caps_so_they_are_refused_and_cleared(arms):
    arm = arms["arms"]["B"]
    broken = payload(arm)
    broken["sourceConfig"]["agents"]["entries"] = {"main": {"tools": {"swarm": {"enabled": False, "maxTotalPerGroup": 200}}}}
    with pytest.raises(A.CapsMismatch, match="agents.entries.main.tools.swarm.maxTotalPerGroup must be unset"):
        A.check_caps(CAPS, broken)
    fixed = A.apply_overlay(arm, MODEL, CAPS, broken["sourceConfig"], LOG)
    assert fixed["agents"]["entries"]["main"]["tools"]["swarm"] == {"enabled": False}, "the seat's switch is its surface"


@pytest.mark.parametrize("switch", [True, False])
def test_a_bare_swarm_switch_keeps_its_meaning(arms, switch):
    out = A.apply_overlay(arms["arms"]["A"], MODEL, CAPS, {"tools": {"swarm": switch}}, LOG)
    assert out["tools"]["swarm"] == {"enabled": switch, "maxConcurrent": 1, "maxChildrenPerGroup": 1, "maxTotalPerGroup": 1}


# --- a trial ---------------------------------------------------------------------------------------------------------------

def test_a_trial_records_the_caps_it_ran_under(arms):
    record, _ = trial(arms, "C", "election-work")
    assert record["status"] == "ok" and record["gateway"]["caps"]["values"] == SET and record["continuationWakes"] == 0


def test_a_gateway_without_the_caps_is_sent_no_turn(arms):
    record, fake = trial(arms, "C", "election-work", overrides={"appliedConfigHash": "another"})
    assert (record["status"], record["elected"]) == ("caps_mismatch", None) and "has not applied" in record["reason"]
    assert [m for m, _ in fake.calls if m != "config.get"] == [] and record["metered"] is None


@pytest.mark.parametrize("change", [{"config": {"agents": {"defaults": {}}}}, {"appliedConfigHash": "another"},
                                    # The caps still stand, and something else about the gateway does not.
                                    {"configRevisionHash": "another", "appliedConfigHash": "another"}])
def test_caps_a_turn_changed_leave_its_trial_unscored(arms, change):
    # A turn may hold the tool that edits its own gateway's configuration.
    async def go():
        async with fake_gateway(arms, "C", {W: ["election-work"]}) as fake:
            send = fake._sessions_send

            def and_edit(params):
                fake.overrides.update(copy.deepcopy(change))
                return send(params)
            fake._sessions_send = and_edit
            return await run_trial(arm_name="C", arm=arms["arms"]["C"], model=arms["model"], caps=arms["caps"], url=fake.url, token=fake.token,
                                   descriptions=arms["descriptions"]["f9fcd3a5"]["tools"], prompt=PROMPT[W], prompt_id=W, kind="eligible")
    record = asyncio.run(go())
    assert (record["status"], record["elected"]) == ("caps_mismatch", None) and "caps not in force" in record["reason"]
    assert record["cleanup"]["ok"] is True, "its sessions are still stopped and deleted"


def test_a_continuation_wake_means_the_caps_did_not_hold(arms):
    record, _ = trial(arms, "C", "woke-before-read")
    assert (record["status"], record["elected"], record["continuationWakes"]) == ("caps_mismatch", None, 1)
    assert "1 continuation wake(s) ran" in record["reason"] and record["metered"]["session"] > 0, "unscored, and still charged"


# --- what it halts ------------------------------------------------------------------------------------------------------------

@pytest.mark.parametrize("status", ["caps_mismatch", "supervisor_stopped"])
def test_either_halts_every_arm_of_the_run(status):
    run = RunStop()
    first, second = ArmGuard("A", None, run), ArmGuard("B", None, run)
    assert second.before_trial() is None
    first.after_trial({"status": status, "reason": "why", "usage": None, "cleanup": {"ok": True}})
    assert "why" in first.before_trial() and second.before_trial() == "run halted: arm A: why"
    second.after_trial({"status": "supervisor_stopped", "reason": "later", "usage": None, "cleanup": {"ok": True}})
    assert run.reason == "arm A: why", "the first reason stands"


def test_an_arm_mismatch_still_halts_only_its_own_arm():
    run = RunStop()
    first, second = ArmGuard("A", None, run), ArmGuard("B", None, run)
    first.after_trial({"status": "arm_mismatch", "reason": "x", "usage": None, "cleanup": {"ok": True}})
    assert first.before_trial() and second.before_trial() is None and run.reason is None


# --- the report ---------------------------------------------------------------------------------------------------------------

@pytest.mark.parametrize("gateway", [None, {}, {"caps": {"verdict": "verified", "values": {"a.b": 2}}}, {"caps": {"values": {"a.b": 1}}}])
def test_the_report_counts_no_trial_whose_caps_were_not_read_back(tmp_path, gateway):
    a = arm_trials({"e1": 5})
    a[0]["meta"]["gateway"] = gateway
    out = report_for(tmp_path, a, arm_trials({}))
    assert out["arms"]["A"]["unscored"] == {"caps_unverified": 1} and out["arms"]["A"]["eligible"]["scored"] == 14
    assert out["arms"]["B"]["capsVerified"] == 20 and out["comparisons"][0]["reading"] == "not reportable"


def test_the_report_shows_what_the_supervisor_did(tmp_path):
    from openclaw_evalbench.report import render
    stop = {"rule": "trial-tokens", "result": {"stopped": True, "durableUnits": ["openclaw-proc-1.service"]}}
    arm = {"tokens": 712_000, "trials": 1, "largestTrialTokens": 712_000, "longestTrialSeconds": 9.5, "sweptUnits": 2, "readings": 5, "longestGapSeconds": 2.1, "stop": stop}
    limits = {"trialTokens": 700_000, "trialSeconds": 480, "idleTokens": 150_000, "runTokens": 2_400_000, "runSeconds": 1800, "maxActiveRuns": 2, "blindSeconds": 10, "pollSeconds": 2}
    summary = {"limits": limits, "halted": "supervisor, arm A: trial-tokens: …", "lost": None, "runnerStops": None,
               "receipt": {"tokens": 712_000, "seconds": 31.0, "ended": {"rule": "run-finished"}, "arms": {"A": arm, "B": {**arm, "stop": None}}}}
    text = render(report_for(tmp_path, arm_trials({}), arm_trials({}), manifest={"supervision": summary}))
    assert "Limits: 700,000 metered tokens and 480 s per trial" in text and "halted: supervisor, arm A: trial-tokens" in text
    assert "| A | 712,000 | 1 | 712,000 | 9.5 s | 5 | 2.1 s | trial-tokens | yes | 3 |" in text and "| nothing | NO | 2 |" in text
    assert "## Supervision" not in render(report_for(tmp_path / "x", arm_trials({}), arm_trials({})))
