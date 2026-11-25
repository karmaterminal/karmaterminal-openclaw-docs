"""Arm identity, config and surface checks: what keeps a wrong or live gateway out of the numbers."""
import copy
import hashlib
import json

import pytest

from openclaw_evalbench import arms as A
from openclaw_evalbench.surface import read_surface, surface_verdict


def config_for(arm, **changes):
    source = {"agents": {"defaults": {"model": {"primary": "openai/gpt-5.6-sol", "fallbacks": []}, "continuation": {"enabled": True}}},
              "tools": {}, "plugins": {"entries": {"codex": {"config": {"codexDynamicToolsLoading": "searchable"}}}}}
    source = A.apply_overlay(arm, source)
    source.update(changes)
    return {"valid": True, "sourceConfig": source, "config": copy.deepcopy(source), "configRevisionHash": "h"}


@pytest.mark.parametrize("url", ["ws://127.0.0.1:18846", "ws://localhost:18846", "ws://[::1]:18846"])
def test_loopback_urls_pass(url):
    assert A.check_url(url) == url


@pytest.mark.parametrize("url", [
    None, "", "ws://127.0.0.1:18789", "ws://localhost:18789", "ws://127.0.0.1", "ws://10.0.0.4:18846", "ws://example.com:18846",
    "wss://127.0.0.1:18846", "http://127.0.0.1:18846", "ws://user:secret@127.0.0.1:18846", "ws://127.0.0.1:18846/?token=secret",
])
def test_every_other_url_is_refused(url):
    with pytest.raises(A.ArmMismatch):
        A.check_url(url)


def test_the_model_configs_name_their_own_arm_and_port_and_no_secret(arms):
    import yaml
    ports = set()
    for name, arm in arms["arms"].items():
        config = yaml.safe_load((A.ROOT / f"configs/model_arm_{name.lower()}.yaml").read_text())
        assert config["env"] == {"OPENCLAW_EVAL_ARM": name, "OPENCLAW_EVAL_GATEWAY_URL": f"ws://127.0.0.1:{arm['gatewayPort']}"}
        A.check_url(config["env"]["OPENCLAW_EVAL_GATEWAY_URL"])
        ports.add(arm["gatewayPort"])
        # The adapter must answer before EvalBench stops waiting, or silence becomes a scored failure.
        from openclaw_evalbench.adapter import ANSWER_MARGIN_SECONDS
        from openclaw_evalbench.trial import TURN_DEADLINE_SECONDS
        assert config["timeout_seconds"] - ANSWER_MARGIN_SECONDS >= TURN_DEADLINE_SECONDS
    assert len(ports) == 3


def test_descriptions_match_their_pinned_hash_and_differ_between_the_texts(arms):
    for version in arms["descriptions"].values():
        for tool in version["tools"].values():
            assert hashlib.sha256(tool["text"].strip().encode()).hexdigest() == tool["sha256"]
    old, new = (arms["descriptions"][k]["tools"] for k in ("ab5a30ea", "f9fcd3a5"))
    assert all(old[t]["sha256"] != new[t]["sha256"] for t in A.CONTINUATION_TOOLS)


def test_the_arms_separate_one_cause_each(arms):
    a, b, c = (arms["arms"][n] for n in "ABC")
    assert a["productSha"] == b["productSha"] != c["productSha"]
    assert a["descriptions"] == b["descriptions"] != c["descriptions"]
    assert (a["surface"], b["surface"], c["surface"]) == ("deferred", "direct", "direct")
    assert b["config"]["set"]["tools.toolSearch"] is False and a["config"]["set"] == c["config"]["set"]


@pytest.mark.parametrize("server, ok", [
    ({"commit": "ab5a30ea79b7"}, True), ({"buildId": "2026.11.0+ab5a30ea79b7"}, True),
    ({"commit": "ab5a30ea79b776f149e24b1fccab9e79b0a5d299", "buildId": "x"}, True),
    ({}, False), ({"commit": "ab5a"}, False), ({"commit": "f9fcd3a5dd9c"}, False), ({"buildId": "2026.11.0+f9fcd3a5dd9c"}, False),
    ({"commit": "f9fcd3a5dd9c", "buildId": "2026.11.0+ab5a30ea79b7"}, False),
])
def test_identity(arms, server, ok):
    arm = arms["arms"]["A"]
    if ok:
        A.check_identity(arm, {"server": server})
    else:
        with pytest.raises(A.ArmMismatch):
            A.check_identity(arm, {"server": server})


@pytest.mark.parametrize("name", "ABC")
def test_each_arms_own_config_passes(arms, name):
    A.check_config(arms["arms"][name], arms["model"], config_for(arms["arms"][name]))


@pytest.mark.parametrize("config_of, checked_as", [("A", "B"), ("B", "A"), ("B", "C"), ("C", "B")])
def test_another_arms_config_is_refused(arms, config_of, checked_as):
    with pytest.raises(A.ArmMismatch):
        A.check_config(arms["arms"][checked_as], arms["model"], config_for(arms["arms"][config_of]))


def test_arm_a_refuses_direct_codex_loading(arms):
    payload = config_for(arms["arms"]["A"], plugins={"entries": {"codex": {"config": {"codexDynamicToolsLoading": "direct"}}}})
    with pytest.raises(A.ArmMismatch, match="codexDynamicToolsLoading"):
        A.check_config(arms["arms"]["A"], arms["model"], payload)


@pytest.mark.parametrize("path, value, message", [
    (("agents", "defaults", "continuation", "enabled"), False, "continuation.enabled"),
    (("agents", "defaults", "model", "primary"), "openai/gpt-6-sol", "model.primary"),
    (("agents", "defaults", "model", "fallbacks"), ["openai/gpt-5.6-terra"], "fallbacks"),
    (("agents", "defaults", "skipBootstrap"), False, "skipBootstrap"),
    (("channels",), {"discord": {"enabled": True}}, "not an isolated proof gateway"),
])
def test_a_wrong_or_live_config_is_refused(arms, path, value, message):
    payload = config_for(arms["arms"]["C"])
    for config in (payload["sourceConfig"], payload["config"]):
        node = config
        for part in path[:-1]:
            node = node[part]
        node[path[-1]] = value
    with pytest.raises(A.ArmMismatch, match=message):
        A.check_config(arms["arms"]["C"], arms["model"], payload)


def test_an_unreadable_config_is_refused(arms):
    for payload in ({}, {"valid": False, "sourceConfig": {}, "config": {}}, {"valid": True, "sourceConfig": None, "config": {}}):
        with pytest.raises(A.ArmMismatch):
            A.check_config(arms["arms"]["A"], arms["model"], payload)


def test_the_overlay_sets_and_clears_only_the_arms_keys(arms):
    before = {"tools": {"toolSearch": True, "codeMode": "auto", "exec": {"x": 1}}, "gateway": {"auth": {"token": "t"}}}
    after = A.apply_overlay(arms["arms"]["A"], before)
    assert after == {"tools": {"exec": {"x": 1}}, "gateway": {"auth": {"token": "t"}}, "agents": {"defaults": {"skipBootstrap": True}}}
    assert before["tools"]["toolSearch"] is True
    b = A.apply_overlay(arms["arms"]["B"], before)
    assert b["tools"] == {"toolSearch": False, "codeMode": False, "exec": {"x": 1}}
    assert b["plugins"]["entries"]["codex"]["config"] == {"codexDynamicToolsLoading": "direct"}


def report(direct=(), deferred=(), **text):
    return {"systemPrompt": {"chars": 1, "hash": "h"}, "tools": {
        "entries": [{"name": n, "summaryHash": text.get(n)} for n in direct], "deferred": {"entries": [{"name": n} for n in deferred]}}}


def test_surface_verdicts(arms):
    tools = arms["descriptions"]["ab5a30ea"]["tools"]
    hashes = {t: tools[t]["sha256"] for t in tools}
    direct = read_surface(report(direct=A.CONTINUATION_TOOLS, **hashes), tools)
    deferred = read_surface(report(direct=("tool_search",), deferred=A.CONTINUATION_TOOLS), tools)
    assert surface_verdict(direct, "direct") == ("verified", None)
    assert surface_verdict(deferred, "deferred") == ("verified", None)
    assert surface_verdict(direct, "deferred")[0] == surface_verdict(deferred, "direct")[0] == "mismatch"
    assert set(direct["descriptionText"].values()) == {"match"}
    other = read_surface(report(direct=A.CONTINUATION_TOOLS, **hashes), arms["descriptions"]["f9fcd3a5"]["tools"])
    assert set(other["descriptionText"].values()) == {"differs"}
    assert deferred["toolSearchDirect"] is True and direct["toolSearchDirect"] is False


def test_a_surface_that_lost_a_tool_or_was_never_reported_is_not_verified(arms):
    tools = arms["descriptions"]["ab5a30ea"]["tools"]
    assert surface_verdict(read_surface(report(direct=("continue_work", "request_compaction")), tools), "direct")[0] == "mismatch"
    assert surface_verdict(read_surface(report(direct=("continue_work", "continue_delegate")), tools), "direct")[0] == "verified"
    for nothing in (None, {}, {"tools": None}, {"tools": {"entries": None}}):
        assert surface_verdict(read_surface(nothing, tools), "direct")[0] == "unreadable"
