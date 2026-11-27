"""Arm identity, config and surface checks: what keeps a wrong or live gateway out of the numbers."""
import copy
import hashlib
import json
import pathlib

import pytest
from conftest import MODEL, OTHER_MODEL

from openclaw_evalbench import arms as A
from openclaw_evalbench.surface import read_surface, surface_verdict


LOG = "/home/x/proof-gw/comp-1/state/gateway.log"
CAPS = A.load_arms()["caps"]


def config_for(arm, **changes):
    source = {"agents": {"defaults": {"model": {"primary": MODEL, "fallbacks": []}, "continuation": {"enabled": True}}},
              "tools": {}, "plugins": {"entries": {"codex": {"config": {"codexDynamicToolsLoading": "searchable"}}}}}
    source = A.apply_overlay(arm, MODEL, CAPS, source, LOG)
    source.update(changes)
    return {"valid": True, "sourceConfig": source, "config": copy.deepcopy(source), "configRevisionHash": "h"}


@pytest.mark.parametrize("url", ["ws://127.0.0.1:20846", "ws://localhost:20846", "ws://[::1]:20846"])
def test_loopback_urls_pass(url):
    assert A.check_url(url) == url


@pytest.mark.parametrize("url", [
    None, "", "ws://127.0.0.1:18789", "ws://localhost:18789", "ws://127.0.0.1", "ws://10.0.0.4:20846", "ws://example.com:20846",
    "wss://127.0.0.1:20846", "http://127.0.0.1:20846", "ws://user:secret@127.0.0.1:20846", "ws://127.0.0.1:20846/?token=secret",
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
    # A gateway also derives ports up to its own + 110 (openclaw ab5a docs/gateway/multiple-gateways.md:20,107-113), so the
    # arms stay clear of the live gateway's range and of one another's.
    taken = sorted(ports | {A.LIVE_GATEWAY_PORT})
    assert len(ports) == len(arms["arms"]) and all(b - a >= 120 for a, b in zip(taken, taken[1:])) and taken[0] == A.LIVE_GATEWAY_PORT


def test_descriptions_match_their_pinned_hash_and_differ_between_the_texts(arms):
    for key, version in arms["descriptions"].items():
        assert version["sha"].startswith(key) and list(version["tools"]) == list(A.CONTINUATION_TOOLS)
        for tool in version["tools"].values():
            assert hashlib.sha256(tool["text"].strip().encode()).hexdigest() == tool["sha256"]
    texts = [arms["descriptions"][k]["tools"] for k in ("ab5a30ea", "f9fcd3a5", "de55f350")]
    for tool in A.CONTINUATION_TOOLS:
        assert len({version[tool]["sha256"] for version in texts}) == 3, f"{tool}: each build's text is its own"
    assert {a["descriptions"] for a in arms["arms"].values()} == set(arms["descriptions"]), "every text is an arm's, and no arm's is missing"


def test_the_arms_separate_one_cause_each(arms):
    a, b, c = (arms["arms"][n] for n in "ABC")
    assert a["productSha"] == b["productSha"] != c["productSha"]
    assert a["descriptions"] == b["descriptions"] != c["descriptions"]
    assert (a["surface"], b["surface"], c["surface"]) == ("deferred", "direct", "direct")
    assert b["config"]["set"]["tools.toolSearch"] is False and a["config"]["set"] == c["config"]["set"]
    d = arms["arms"]["D"]
    assert (d["productSha"], d["descriptions"], d["surface"]) == (c["productSha"], c["descriptions"], c["surface"]), "D is C's build and text"
    assert d["config"] == b["config"], "under B's overlay"
    e = arms["arms"]["E"]
    assert e["productSha"] != c["productSha"] and e["descriptions"] not in (a["descriptions"], c["descriptions"])
    assert (e["surface"], e["config"]) == (c["surface"], c["config"]), "E is C's placement and config, with the settled text"
    assert e["unit"] == f"openclaw-proof-comp-{e['productSha'][:8]}" and e["descriptions"] == e["productSha"][:8]


def test_only_arm_d_is_off_by_default(arms):
    assert list(arms["arms"]) == ["A", "B", "C", "D", "E"] and A.default_arms(arms) == ["A", "B", "C", "E"]


def test_the_contrasts_are_named_for_what_they_are(arms):
    named = {(c["from"], c["to"]): c for c in arms["comparisons"]}
    assert named["A", "B"]["label"] == "visibility (all tools direct)"
    assert named["B", "C"]["label"] == "composite: new text + direct-set narrowing" and "not the wording effect" in named["B", "C"]["note"]
    # Wording alone: two builds' text on one surface. D against B with every tool direct, E against C at the fleet default's.
    alone = [pair for pair, c in named.items() if "wording" in c["label"] and not c["label"].startswith("placement")]
    assert alone == [("B", "D"), ("C", "E")] and all(named[pair].get("holdsDirectTools") is True for pair in alone)
    assert named["C", "E"]["label"] == "settled wording (same placement)" and named["C", "E"]["primary"] is True
    assert "Codex harness" in named["C", "E"]["note"], "where it is more than wording, it says so"
    assert named["A", "E"]["label"] == "placement + settled wording" and named["A", "E"]["primary"] is False
    assert [c["id"] for c in arms["comparisons"] if c.get("holdsDirectTools")] == ["wording", "settled-wording"]
    assert all(c["note"] for c in arms["comparisons"] if c["primary"])


def test_the_crowding_line_and_the_awareness_design_are_declared(arms):
    crowding = arms["surfaceCrowding"]
    assert crowding["crowdedAboveDirectTools"] == 30 and crowding["source"].startswith("https://platform.claude.com/docs/")
    assert "vendor guidance" in crowding["rule"] and "not the firing model" in crowding["rule"]
    declared = arms["awareness"]
    assert hashlib.sha256((A.ROOT / declared["prompt"]).read_bytes()).hexdigest() == declared["sha256"], "the judge prompt is the declared one"
    assert (declared["seed"], declared["perPrompt"]) == (1575, 1)


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


@pytest.mark.parametrize("name", "ABCD")
def test_each_arms_own_config_passes(arms, name):
    A.check_config(arms["arms"][name], arms["model"], config_for(arms["arms"][name]))


@pytest.mark.parametrize("config_of, checked_as", [("A", "B"), ("B", "A"), ("B", "C"), ("C", "B"), ("C", "D"), ("D", "C")])
def test_another_arms_config_is_refused(arms, config_of, checked_as):
    with pytest.raises(A.ArmMismatch):
        A.check_config(arms["arms"][checked_as], arms["model"], config_for(arms["arms"][config_of]))


def test_arm_a_refuses_direct_codex_loading(arms):
    payload = config_for(arms["arms"]["A"], plugins={"entries": {"codex": {"config": {"codexDynamicToolsLoading": "direct"}}}})
    with pytest.raises(A.ArmMismatch, match="codexDynamicToolsLoading"):
        A.check_config(arms["arms"]["A"], arms["model"], payload)


@pytest.mark.parametrize("path, value, message", [
    (("agents", "defaults", "continuation", "enabled"), False, "continuation.enabled"),
    (("agents", "defaults", "model", "primary"), OTHER_MODEL, "model.primary"),
    (("agents", "defaults", "model", "fallbacks"), [OTHER_MODEL], "fallbacks"),
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


@pytest.mark.parametrize("path, value", [
    (("agents", "entries", "main", "model"), MODEL), (("agents", "entries", "main", "model"), {"primary": OTHER_MODEL}),
    (("agents", "entries", "main", "tools", "codeMode"), "auto"), (("agents", "entries", "main", "models", MODEL, "codeMode"), True),
    (("agents", "defaults", "models", MODEL, "codeMode"), True),
])
def test_a_setting_that_outranks_the_arm_is_refused_and_the_overlay_clears_it(arms, path, value):
    payload = config_for(arms["arms"]["B"])
    node = payload["sourceConfig"]
    for part in path[:-1]:
        node = node.setdefault(part, {})
    node[path[-1]] = value
    node["kept"] = 1
    with pytest.raises(A.ArmMismatch, match="outranks"):
        A.check_config(arms["arms"]["B"], MODEL, payload)
    payload["sourceConfig"] = A.apply_overlay(arms["arms"]["B"], MODEL, CAPS, payload["sourceConfig"], LOG)
    A.check_config(arms["arms"]["B"], MODEL, payload)
    assert A.read_path(payload["sourceConfig"], (*path[:-1], "kept")) == 1, "and nothing beside it"


def test_another_models_own_entry_is_left_alone(arms):
    payload = config_for(arms["arms"]["A"])
    payload["sourceConfig"]["agents"]["defaults"]["models"] = {OTHER_MODEL: {"codeMode": True}}
    A.check_config(arms["arms"]["A"], MODEL, payload)
    assert A.apply_overlay(arms["arms"]["A"], MODEL, CAPS, payload["sourceConfig"], LOG) == payload["sourceConfig"]


@pytest.mark.parametrize("log_file", [None, "", "gateway.log", "~/proof-gw/x.log", "/tmp/openclaw/openclaw-2026-11-25.log", "/tmp//openclaw/x.log",
                                      "/tmp/x/../openclaw/x.log", str(pathlib.Path("~/.openclaw/logs/x.log").expanduser())])
def test_a_gateway_that_would_share_the_live_gateways_log_is_refused(arms, log_file):
    payload = config_for(arms["arms"]["A"], logging={} if log_file is None else {"file": log_file})
    with pytest.raises(A.ArmMismatch, match="logging.file"):
        A.check_config(arms["arms"]["A"], MODEL, payload)


def test_an_unreadable_config_is_refused(arms):
    for payload in ({}, {"valid": False, "sourceConfig": {}, "config": {}}, {"valid": True, "sourceConfig": None, "config": {}}):
        with pytest.raises(A.ArmMismatch):
            A.check_config(arms["arms"]["A"], arms["model"], payload)


def test_the_overlay_sets_and_clears_only_the_arms_keys(arms):
    before = {"tools": {"toolSearch": True, "codeMode": "auto", "exec": {"x": 1}}, "gateway": {"auth": {"token": "t"}}}
    after = A.apply_overlay(arms["arms"]["A"], MODEL, {"set": {}}, before, LOG)
    assert after == {"tools": {"exec": {"x": 1}}, "gateway": {"auth": {"token": "t"}}, "logging": {"file": LOG},
                     "agents": {"defaults": {"model": {"primary": MODEL, "fallbacks": []}, "skipBootstrap": True}}}
    assert before["tools"]["toolSearch"] is True
    b = A.apply_overlay(arms["arms"]["B"], MODEL, {"set": {}}, before, LOG)
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
