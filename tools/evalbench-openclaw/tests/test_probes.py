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
    # Skill Workshop's review is off only with the migration marker beside its setting: without it the runtime drops the entry.
    assert config["skillWorkshopReview"] == {"withCaps": "off", "withoutCaps": "auto", "modeWithoutTheMarker": "auto"}


PATHS = ("context", "attempt")
# Each arm as the run plans it on the firing model: Code Mode for the fleet default (A, C), every tool direct under the
# direct-tools overlay (B, D).
MODE = {"A": "code mode", "B": "every tool direct", "C": "code mode", "D": "every tool direct"}


def name(tool):
    return tool.split(":")[-1]


@each_sha
@pytest.mark.parametrize("path", PATHS)
def test_nothing_the_model_is_shown_changes_with_them_on_any_arm(sha, path):
    surface = RECEIPTS[sha]["surface"]
    assert set(surface) == set(ARMS["arms"])
    for arm_name, arm in ARMS["arms"].items():
        row = surface[arm_name][path]
        assert surface[arm_name]["schemaAccepts"] is True and row["tools"] > 0
        assert row["withCaps"] == {"tools": row["tools"], "same": True, "toolsSame": True, "promptSame": True, "differing": [], "gone": []}
        assert row["eachCapAlone"] == dict.fromkeys(CAPS, True)
        # The descriptions the arm is scored against are the ones this build shows.
        if ARMS["descriptions"][arm["descriptions"]]["sha"] == sha:
            assert row["continuation"] == {t: d["sha256"] for t, d in ARMS["descriptions"][arm["descriptions"]]["tools"].items()}


@each_sha
def test_the_attempt_path_is_each_arms_own_surface(sha):
    continuation = {"continue_work", "continue_delegate", "request_compaction"}
    for arm_name, row in RECEIPTS[sha]["surface"].items():
        attempt = row["attempt"]
        assert attempt["mode"] == MODE[arm_name] and attempt["continuationSection"] is True
        sent = set(attempt["sent"])
        if MODE[arm_name] == "every tool direct":
            assert attempt["catalogued"] == 0 and continuation <= sent
        else:
            # Code Mode sends its controls and keeps the rest behind them; f9fcd3a5 keeps the continuation tools direct.
            assert {"exec", "wait"} <= sent and attempt["catalogued"] > 40
            assert (continuation <= sent) is (sha == ARMS["descriptions"]["f9fcd3a5"]["sha"]) and not (continuation & sent and not continuation <= sent)
    assert RECEIPTS[sha]["surface"]["A"]["attempt"]["promptHash"] != RECEIPTS[sha]["surface"]["B"]["attempt"]["promptHash"], "the paths see the arms differ"


@each_sha
@pytest.mark.parametrize("path", PATHS)
def test_the_comparison_sees_a_setting_that_does_change_the_surface(sha, path):
    for row in RECEIPTS[sha]["surface"].values():
        controls = row[path]["negativeControls"]
        assert {k: v["same"] for k, v in controls.items()} == dict.fromkeys(controls, False) and len(controls) == 3
        swarm, allow, deny = (controls[k] for k in ("tools.swarm.enabled false", "subagents.allowAgents []", "tools.deny automations"))
        assert [name(t) for t in swarm["gone"]] == ["agents_wait"] and "sessions_spawn" in map(name, swarm["differing"])
        assert [name(t) for t in allow["differing"]] == ["sessions_spawn"]
        assert [name(t) for t in deny["gone"]] == ["automations"]


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
    assert admission["collectors"] == {"firstInAGroup": "admitted", "secondInTheSameGroup": "tools.swarm.maxTotalPerGroup"}
    assert (admission["cronSchedulerEnabled"], admission["cronSchedulerEnabledWithoutCaps"]) == (False, True)
    assert (admission["utilityModel"], admission["utilityModelWithoutCaps"]) == ("disabled", "auto")
