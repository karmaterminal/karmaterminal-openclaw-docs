"""The firing model is one value, arms.json's `model`: launch, preflight, configs, scoring and report all follow it."""
import asyncio
import copy
import json
import re
import subprocess

import pytest
from conftest import MODEL, OTHER_MODEL, ROOT
from test_evalbench import rows, run_offline

from openclaw_evalbench import __main__ as cli
from openclaw_evalbench.adapter import ArmJob
from openclaw_evalbench.arms import load_arms

LITERAL = re.compile(r"gpt-\d[\w.-]*")


def tracked(*patterns):
    done = subprocess.run(["git", "-C", str(ROOT), "ls-files", "--cached", "--others", "--exclude-standard", "--", *patterns],
                          capture_output=True, text=True, check=True)
    files = [ROOT / name for name in done.stdout.split()]
    assert files
    return files


def test_no_code_config_fixture_or_test_names_a_model():
    # The archived rehearsals and the probe's receipts record arms.json's model: they are what it printed.
    files = tracked("*.py", "*.yaml", "*.json", "*.mjs", "*.mts", "*.sh", ":!artifacts", ":!probes/receipts", ":!arms.json")
    hits = {str(f.relative_to(ROOT)): found for f in files if f.name != "test_model.py" and (found := LITERAL.findall(f.read_text()))}
    assert hits == {}
    assert LITERAL.findall((ROOT / "arms.json").read_text()) == [MODEL.split("/")[1]], "arms.json names it once"


def test_the_model_it_replaced_is_named_nowhere():
    old = "gpt-5." + "6-sol"
    assert [str(f.relative_to(ROOT)) for f in tracked(".") if old in f.read_text()] == []


def test_the_launch_takes_the_model_from_the_parameter(capsys):
    assert cli.main(["model"]) == 0
    assert capsys.readouterr().out == f"{MODEL}\n"
    for name in ("README.md", "CANARY-PACKET.md"):
        launch = re.findall(r'PROOF_PRIMARY_MODEL=("[^"]*"|\S+)', (ROOT / name).read_text())
        assert launch and set(launch) == {'"$(./run.sh model)"'}, name


@pytest.mark.parametrize("name", ["README.md", "REPORT.md", "CANARY-PACKET.md"])
def test_the_documents_name_the_parameters_model(name):
    assert f"`{MODEL}`" in (ROOT / name).read_text()


def test_every_arms_config_carries_it_into_configs_csv(tmp_path):
    c = "c1-arithmetic"
    plans = {n: {c: ["control-clean"]} for n in "ABCDE"}
    results, left, _, report, code = run_offline(tmp_path, plans, num_trials=1, scenarios=[c])
    assert code == 0 and left == dict.fromkeys("ABCDE", 0) and report["model"] == MODEL
    for name in "ABCDE":
        recorded = {r["config"]: r["value"] for r in rows(tmp_path / "results" / results[name]["jobId"] / "configs.csv")}
        assert MODEL in "".join(v for k, v in recorded.items() if k.endswith("OPENCLAW_EVAL_MODEL")), name
        assert report["arms"][name]["servedModels"] == {MODEL: 1}
    shapes = {n: report["arms"][n]["surfaceShapes"] for n in "ABCDE"}
    # Under the direct-tools overlay the fake reports every tool the product sends at that build (probes/receipts).
    assert shapes == {"A": {"7 direct and 5 deferred": 1}, "B": {"66 direct and 0 deferred": 1}, "C": {"10 direct and 2 deferred": 1},
                      "D": {"66 direct and 0 deferred": 1}, "E": {"10 direct and 2 deferred": 1}}


def test_changing_the_parameter_alone_moves_the_whole_run(tmp_path):
    c = "c1-arithmetic"
    arms = {**load_arms(), "model": OTHER_MODEL}
    results, _, _, report, code = run_offline(tmp_path, {"C": {c: ["control-clean"]}}, num_trials=1, scenarios=[c], arms=arms)
    assert code == 0 and report["model"] == OTHER_MODEL and report["arms"]["C"]["servedModels"] == {OTHER_MODEL: 1}
    assert MODEL not in "".join(p.read_text() for p in (tmp_path / "results" / results["C"]["jobId"]).iterdir())


def settle(arms, env):
    job = object.__new__(ArmJob)
    job.arm_name, job.arm, job.arms, job.verified, job._token, job.deadline_seconds, job.supervision = "A", arms["arms"]["A"], arms, None, "t", 1.0, None

    async def runner(**_kwargs):
        return {"status": "ran"}
    job._runner = runner
    request = type("Request", (), {"env": env, "resume": False, "prompt": "p", "timeout_seconds": 900.0})()
    return asyncio.run(job._answer(request, {"promptId": "p", "kind": "control"}))


@pytest.mark.parametrize("named", [None, "", OTHER_MODEL])
def test_a_job_configured_for_another_model_never_reaches_a_gateway(arms, named):
    env = {"OPENCLAW_EVAL_ARM": "A", **({} if named is None else {"OPENCLAW_EVAL_MODEL": named})}
    record = settle(arms, env)
    assert record["status"] == "arm_mismatch" and MODEL in record["reason"]
    assert settle(arms, {**env, "OPENCLAW_EVAL_MODEL": MODEL}) == {"status": "ran"}


def test_a_gateway_set_up_for_another_model_halts_its_arm(tmp_path):
    c = "c1-arithmetic"
    arms = load_arms()
    config = {"agents": {"defaults": {"model": {"primary": OTHER_MODEL, "fallbacks": []}, "continuation": {"enabled": True}, "skipBootstrap": True}}}
    results, _, _, report, code = run_offline(tmp_path, {"A": {c: ["control-clean"]}}, num_trials=2, scenarios=[c], overrides={"A": {"config": config}})
    assert code == 1 and "agents.defaults.model.primary must be " + arms["model"] in results["A"]["halted"]
    assert report["arms"]["A"]["control"]["scored"] == 0 and report["arms"]["A"]["unscored"] == {"arm_mismatch": 1, "halted": 1}


def test_a_turn_another_model_served_is_unscored_and_halts_its_arm(tmp_path):
    c = "c1-arithmetic"
    results, _, _, report, code = run_offline(tmp_path, {"C": {c: ["control-clean", "wrong-model", "control-clean"]}}, num_trials=3, scenarios=[c])
    assert code == 1 and f"served by {OTHER_MODEL}, not {MODEL}" in results["C"]["halted"]
    assert report["arms"]["C"]["control"]["scored"] == 1 and report["arms"]["C"]["unscored"] == {"arm_mismatch": 1, "halted": 1}


def test_the_manifest_records_the_model_and_the_stops_rule(arms):
    args = type("Args", (), {"go": None, "arms": ["A"], "num_trials": 1, "scenarios": None, "token_budget": 5})()
    manifest = cli._manifest(args, arms, None, offline=True)
    assert manifest["model"] == MODEL and manifest["tokenBudgetPerArm"] == 5
    assert "checked between trials; not a ceiling" in manifest["tokenBudgetRule"]


def test_the_documents_never_state_the_stop_without_its_rule():
    stated = re.compile(r"--token-budget|(?=.*\bstop)(?=.*\b(35|2) M\b)", re.S)
    for name in ("README.md", "REPORT.md", "CANARY-PACKET.md"):
        blocks = re.split(r"\n\s*\n|\n(?=\|)|\n(?=- )|\n(?=\d+\. )", (ROOT / name).read_text())
        stops = [b for b in blocks if stated.search(b) and "```" not in b and not b.startswith("./run.sh")]
        assert stops, name
        assert [b for b in stops if "between trials" not in b] == [], name
