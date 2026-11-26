"""The product probe's receipts (probes/receipts) are of these caps, this probe and both SHAs, and say what the documents say."""
import hashlib
import json

import pytest
from conftest import MODEL, ROOT

from openclaw_evalbench.arms import load_arms

ARMS = load_arms()
CAPS = ARMS["caps"]["set"]
SHAS = sorted({arm["productSha"] for arm in ARMS["arms"].values()})
RECEIPTS = {sha: json.loads((ROOT / "probes" / "receipts" / f"{sha[:8]}.json").read_text()) for sha in SHAS}
each_sha = pytest.mark.parametrize("sha", SHAS)


def test_there_is_a_receipt_for_each_build_and_no_other():
    assert len(SHAS) == 2 and sorted(p.stem for p in (ROOT / "probes" / "receipts").glob("*.json")) == [s[:8] for s in SHAS]


@each_sha
def test_a_receipt_is_of_this_sha_these_caps_and_this_probe(sha):
    receipt = RECEIPTS[sha]
    assert receipt["productSha"] == sha and receipt["model"] == MODEL and receipt["settings"] == CAPS
    probe = hashlib.sha256((ROOT / "probes" / "product-probe.mts").read_bytes()).hexdigest()
    assert receipt["probeSha256"] == probe, "the probe changed: run it again at both SHAs (probes/README.md)"


@each_sha
def test_the_caps_are_valid_and_config_get_reads_every_one_back(sha):
    config = RECEIPTS[sha]["config"]
    assert config["withCaps"] == {"valid": True, "issues": [], "authoredMissing": [], "effectiveMissing": []}
    assert config["typoIsInvalid"] is True, "a misspelt key is refused, so a valid file is not a vacuous one"


@each_sha
def test_nothing_the_model_is_shown_changes_with_them_on_any_arm(sha):
    surface = RECEIPTS[sha]["surface"]
    assert set(surface) == set(ARMS["arms"])
    for name, arm in ARMS["arms"].items():
        row = surface[name]
        assert row["schemaAccepts"] is True and row["tools"] > 0
        assert row["withCaps"] == {"tools": row["tools"], "same": True, "toolsSame": True, "promptSame": True, "differing": [], "gone": []}
        assert row["eachCapAlone"] == dict.fromkeys(CAPS, True)
        # The descriptions the arm is scored against are the ones this build shows.
        if ARMS["descriptions"][arm["descriptions"]]["sha"] == sha:
            assert row["continuation"] == {t: d["sha256"] for t, d in ARMS["descriptions"][arm["descriptions"]]["tools"].items()}


@each_sha
def test_the_comparison_sees_a_setting_that_does_change_the_surface(sha):
    for row in RECEIPTS[sha]["surface"].values():
        controls = row["negativeControls"]
        assert {k: v["same"] for k, v in controls.items()} == dict.fromkeys(controls, False) and len(controls) == 3
        assert controls["tools.swarm.enabled false"]["gone"] == ["agents_wait"] and "sessions_spawn" in controls["tools.swarm.enabled false"]["differing"]
        assert controls["subagents.allowAgents []"]["differing"] == ["sessions_spawn"]
        assert controls["tools.deny automations"]["gone"] == ["automations"]


@each_sha
def test_what_the_caps_and_admission_do_through_the_products_code(sha):
    behavior, admission = RECEIPTS[sha]["capsBehavior"], RECEIPTS[sha]["admission"]
    assert behavior == {"budget": {"firstElectionAfter5kTokens": "cost-capped", "secondHop": "chain-capped"},
                        "delegateCallsAdmittedInOneTurn": [True, False], "turnTimeoutMs": CAPS["agents.defaults.timeoutSeconds"] * 1000,
                        "childTimeoutSeconds": {"configured": CAPS["agents.defaults.subagents.runTimeoutSeconds"], "askedFor3600": 3600}}
    lanes = admission["lanes"]
    assert lanes["widths"]["main"] == 1 and lanes["widths"]["subagent"] == 1 and lanes["widths"]["hookDispatch"] == 0
    assert (lanes["twoTurns"], lanes["twoChildrenOfOneSession"]) == (1, 1), "admitted one at a time: the second waits in the queue"
    assert admission["lanesWithoutCaps"]["twoTurns"] == 2, "control: without the caps two turns run at once"
    # The residual: these lanes are not one wide, and no setting that leaves the surface alone makes them so.
    assert (lanes["twoSwarmGroups"], lanes["twoAutomationRuns"], lanes["widths"]["cron"]) == (2, 2, 8)
    assert admission["children"] == {"first": "admitted", "secondWhileFirstRuns": "subagents.maxChildrenPerAgent", "childOfAChild": "subagents.maxSpawnDepth"}
    assert admission["collectors"] == {"firstInAGroup": "admitted", "secondInTheSameGroup": "tools.swarm.maxTotalPerGroup", "firstInEveryOtherGroup": "admitted"}
    assert (admission["cronSchedulerEnabled"], admission["cronSchedulerEnabledWithoutCaps"]) == (False, True)
    assert (admission["utilityModel"], admission["utilityModelWithoutCaps"]) == ("disabled", "auto")
