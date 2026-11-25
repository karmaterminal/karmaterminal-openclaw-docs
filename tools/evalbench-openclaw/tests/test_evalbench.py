"""Against EvalBench's own code at the pin: the traps its stock pieces set, and that this harness is out of them."""
import asyncio
import csv
import json
import pathlib
import subprocess
import sys

import pytest
from conftest import ROOT, fake_gateway

from evalproto import eval_agent_pb2
from generators.models.agent_grpc_proxy import AGENT_GRPC_PROXY_QUEUES, AgentGrpcProxyGenerator
from openclaw_evalbench.__main__ import _finish, build_configs, run_jobs
from openclaw_evalbench.adapter import turn_response
from openclaw_evalbench.arms import load_arms, load_scenarios
from openclaw_evalbench.generator import META_TOOL, UNSCORED, OpenClawProxyGenerator
from scorers.tokenconsumption import TokenConsumption
from scorers.trajectorymatcher import TrajectoryMatcher

CONFIG = {"env": {"OPENCLAW_EVAL_ARM": "A"}, "timeout_seconds": 0.05}


def record(**changes):
    base = {"schema": "openclaw.evalbench.trial.v1", "arm": "A", "promptId": "p", "kind": "eligible", "status": "ok", "reason": None,
            "elected": True, "elections": [{"tool": "continue_work", "dispatched": True, "status": "scheduled", "answered": True, "isError": False}],
            "calls": [{"id": "c1", "name": "exec", "dispatched": False, "args": {"command": "true"}, "answered": True, "isError": False, "status": None},
                      {"id": "c2", "name": "continue_work", "dispatched": True, "args": {"reason": "r"}, "answered": True, "isError": False, "status": "scheduled"}],
            "reply": "done", "usage": {"input": 100, "output": 20, "cacheRead": 900, "cacheWrite": 0, "total": 1020},
            "servedModels": ["openai/gpt-5.6-sol"]}
    return {**base, **changes}


def process(generator_class, response):
    return generator_class(dict(CONFIG))._turn_response_to_process(response, "s")


def match(expected, actual, config=None):
    return TrajectoryMatcher(config or {}).compare("", "", "", expected, "", "", "", actual, "", None)[0]


# --- trajectory_matcher ---------------------------------------------------------------------------------------------

def test_trap_bare_tool_names_score_100_whether_or_not_the_model_elected():
    assert match(["continue_work"], []) == 100.0
    assert match(["continue_work"], ["continue_work"]) == 100.0
    assert match([], ["continue_work"]) == 100.0


def test_canonical_names_make_the_matcher_compare_elections_only():
    names = [c.tool_name for c in turn_response(1, record()).tool_calls if c.tool_name != META_TOOL]
    assert names == ["exec", "openclaw__continue_work"]
    assert match(["openclaw__continue_work"], names) == 100.0
    assert match(["openclaw__continue_work"], ["exec", "tool_search"]) == 0.0
    assert match(["openclaw__continue_work"], ["openclaw__continue_delegate"]) == 0.0
    assert match([], ["exec"]) == 100.0
    assert match([], ["exec", "openclaw__continue_work"]) == 0.0


def test_the_run_config_leaves_the_matchers_filter_on():
    import yaml
    scorers = yaml.safe_load((ROOT / "configs/run_config.yaml").read_text())["scorers"]
    assert scorers["trajectory_matcher"] == {} and TrajectoryMatcher(scorers["trajectory_matcher"]).filter_native_tools is True
    assert set(scorers) == {"trajectory_matcher", "token_consumption", "continuation_election"}


# --- tokens ---------------------------------------------------------------------------------------------------------

def tokens(result):
    history = json.dumps([{"user": "p", "agent": result.stdout}])
    return TokenConsumption({}).compare("", "", "", [], "", "", "", [], history, None)[0]


def test_trap_the_stock_generator_always_reports_zero_tokens():
    assert tokens(process(AgentGrpcProxyGenerator, turn_response(1, record()))) == 0.0


def test_the_subclass_reports_fresh_input_plus_output():
    assert tokens(process(OpenClawProxyGenerator, turn_response(1, record()))) == 120.0


# --- the trial record, and unscored trials ----------------------------------------------------------------------------

def test_the_record_travels_in_the_envelope_and_never_as_a_tool():
    result = process(OpenClawProxyGenerator, turn_response(1, record()))
    envelope = json.loads(result.stdout)
    assert envelope["openclaw"]["elections"][0]["tool"] == "continue_work" and "calls" not in envelope["openclaw"]
    assert OpenClawProxyGenerator(dict(CONFIG)).extract_tools(result.stdout) == ["exec", "openclaw__continue_work"]
    assert META_TOOL not in json.dumps(envelope["tool_calls"]) + json.dumps(envelope["stats"])
    assert result.returncode == 0


@pytest.mark.parametrize("status", ["infra_error", "arm_mismatch", "halted"])
def test_an_unscored_trial_is_an_infrastructure_error_to_evalbench(status):
    from evaluator.agentevaluator import _infra_error
    response = turn_response(1, record(status=status, reason="why", elected=None))
    ours = process(OpenClawProxyGenerator, response)
    assert "why" in _infra_error(OpenClawProxyGenerator(dict(CONFIG)), ours)
    # Trap: the stock generator scores the same failure.
    assert _infra_error(AgentGrpcProxyGenerator(dict(CONFIG)), process(AgentGrpcProxyGenerator, response)) is None


@pytest.mark.parametrize("status", ["ok", "deadline"])
def test_a_scored_trial_is_not(status):
    from evaluator.agentevaluator import _infra_error
    ours = process(OpenClawProxyGenerator, turn_response(1, record(status=status)))
    assert _infra_error(OpenClawProxyGenerator(dict(CONFIG)), ours) is None


def silent(generator_class):
    import queue
    generator = generator_class(dict(CONFIG))
    AGENT_GRPC_PROXY_QUEUES["silent"] = ({}, queue.Queue())
    try:
        return generator, generator.safe_generate(generator.create_command("", "p", session_id="silent"))
    finally:
        AGENT_GRPC_PROXY_QUEUES.pop("silent")


def test_trap_an_adapter_that_never_answers_is_scored_and_a_control_passes():
    from evaluator.agentevaluator import _infra_error
    generator, result = silent(AgentGrpcProxyGenerator)
    assert result.returncode == 124 and _infra_error(generator, result) is None
    assert match([], generator.extract_tools(result.stdout)) == 100.0


def test_with_the_subclass_it_is_unscored():
    from evaluator.agentevaluator import _infra_error
    generator, result = silent(OpenClawProxyGenerator)
    assert result.returncode == 1 and result.stderr.startswith(UNSCORED)
    assert "Timed out" in _infra_error(generator, result)


def test_the_model_configs_load_the_subclass_through_evalbenchs_hook():
    import threading
    from generators.models import get_generator
    generator = get_generator({"lock": threading.Lock(), "registered_models": {}}, str(ROOT / "configs/model_arm_b.yaml"))
    assert type(generator).__name__ == "OpenClawProxyGenerator" and generator.version == "openclaw-arm-B"


# --- the election scorer ----------------------------------------------------------------------------------------------

def run_scorer(data):
    done = subprocess.run([sys.executable, str(ROOT / "scorers/continuation_election.py")], input=json.dumps(data), capture_output=True, text=True, check=False)
    return done.returncode, json.loads(done.stdout) if done.returncode == 0 else None


@pytest.mark.parametrize("meta, score", [({"elected": True, "elections": [{"tool": "continue_work"}], "kind": "control"}, 100.0),
                                         ({"elected": False, "elections": [], "kind": "eligible"}, 0.0)])
def test_the_election_scorer(meta, score):
    code, out = run_scorer({"generated_error": None, "generated_eval_result": {"stdout": json.dumps({"openclaw": meta})}})
    assert code == 0 and out["score"] == score


def test_the_election_scorer_marks_an_unscored_row_and_fails_on_no_record():
    code, out = run_scorer({"generated_error": "Agent infrastructure error", "generated_eval_result": {}})
    assert code == 0 and out == {"score": 0.0, "reason": "UNSCORED: Agent infrastructure error"}
    assert run_scorer({"generated_error": None, "generated_eval_result": {"stdout": "{}"}})[0] != 0


# --- whole jobs ---------------------------------------------------------------------------------------------------------

def run_offline(tmp_path, plans, *, num_trials, scenarios, deadline=0.5, budget=None, overrides=None):
    arms = load_arms()

    async def go():
        fakes = {n: fake_gateway(arms, n, plan, overrides=(overrides or {}).get(n)) for n, plan in plans.items()}
        for fake in fakes.values():
            await fake.__aenter__()
        try:
            configs = build_configs(tmp_path, list(plans), gateway_urls={n: f.url for n, f in fakes.items()}, num_trials=num_trials, scenarios=scenarios)
            results = await run_jobs(tmp_path, configs, arms=arms, tokens={n: f.token for n, f in fakes.items()}, token_budget=budget, deadline_seconds=deadline)
            return results, {n: len(f.sessions) for n, f in fakes.items()}, {n: f.token for n, f in fakes.items()}
        finally:
            for fake in fakes.values():
                await fake.__aexit__(None, None, None)

    import os
    here = os.getcwd()
    os.chdir(ROOT)
    try:
        results, left, secrets = asyncio.run(go())
        manifest = {"offline": True}
        code = _finish(tmp_path, results, manifest, arms)
    finally:
        os.chdir(here)
    return results, left, secrets, json.loads((tmp_path / "report.json").read_text()), code


def rows(path):
    with path.open(newline="") as handle:
        return list(csv.DictReader(handle))


def test_three_arms_end_to_end(tmp_path):
    w, d, c = "w1-file-appears", "d1-second-pair-of-eyes", "c5-nothing-to-do"
    plans = {
        "A": {w: ["search-then-work", "exec-no-election"], d: ["spawn-no-election", "search-then-delegate"], c: ["control-clean"]},
        "B": {w: ["election-work", "no-election"], d: ["election-refused", "election-work"], c: ["control-clean"]},
        "C": {w: ["election-work"], d: ["election-delegate"], c: ["control-false-election", "deadline-no-election"]},
    }
    results, left, secrets, report, code = run_offline(tmp_path, plans, num_trials=2, scenarios=[w, d, c])
    assert code == 0 and left == {"A": 0, "B": 0, "C": 0}
    arms = report["arms"]
    assert list(arms) == ["A", "B", "C"]
    assert [(arms[n]["eligible"]["elected"], arms[n]["eligible"]["scored"]) for n in "ABC"] == [(2, 4), (3, 4), (4, 4)]
    assert [(arms[n]["control"]["elected"], arms[n]["control"]["scored"]) for n in "ABC"] == [(0, 2), (0, 2), (1, 2)]
    assert arms["A"]["electedDispatched"] == 2 and arms["A"]["electedDirect"] == 0
    # B: one fitting continue_work, one refused continue_delegate, one continue_work on a continue_delegate prompt.
    assert arms["B"]["electedDispatched"] == 0 and arms["B"]["electedAccepted"] == 2 and arms["B"]["electedExpectedTool"] == 2
    assert arms["A"]["discovery"]["searchBeforeElection"] == 2 and arms["A"]["discovery"]["observableTrials"] == 6
    assert arms["C"]["deadline"] == 1 and all(a["problems"] == [] for a in arms.values())
    # EvalBench's own CSVs say the same, and hold no credential.
    for name in "ABC":
        job = tmp_path / "results" / results[name]["jobId"]
        elected = [r for r in rows(job / "scores.csv") if r["comparator"] == "continuation_election" and float(r["score"]) == 100.0]
        assert len(elected) == arms[name]["eligible"]["elected"] + arms[name]["control"]["elected"]
        text = "".join(p.read_text() for p in job.iterdir())
        assert secrets[name] not in text and "agent:main:" not in text
    assert all(c["reading"] == "not reportable" for c in report["comparisons"]), "two trials are fewer than declared"


def test_unscored_trials_leave_every_denominator_evalbenchs_own_included(tmp_path):
    c = "c1-arithmetic"
    results, left, _, report, code = run_offline(tmp_path, {"A": {c: ["control-clean", "provider-error", "control-clean"]}}, num_trials=3, scenarios=[c])
    assert code == 0 and left == {"A": 0}
    assert report["arms"]["A"]["control"] == {"elected": 0, "scored": 2, "rate": 0.0, "wilson95": report["arms"]["A"]["control"]["wilson95"]}
    assert report["arms"]["A"]["unscored"] == {"infra_error": 1}
    summary = {r["metric_name"]: r for r in rows(tmp_path / "results" / results["A"]["jobId"] / "summary.csv")}
    assert float(summary["trajectory_matcher"]["total_results_count"]) == 2
    assert float(summary["continuation_election"]["total_results_count"]) == 2


def test_a_halted_arm_stops_spending_and_fails_the_run(tmp_path):
    c = "c1-arithmetic"
    results, _, _, report, code = run_offline(tmp_path, {"A": {c: ["provider-quota", "control-clean"]}, "B": {c: ["control-clean"]}}, num_trials=4, scenarios=[c])
    assert code == 1 and "provider refused" in results["A"]["halted"] and results["B"]["halted"] is None
    assert report["arms"]["A"]["unscored"] == {"infra_error": 1, "halted": 3} and report["arms"]["A"]["control"]["scored"] == 0
    assert report["arms"]["B"]["control"]["scored"] == 4


def test_the_token_budget_stops_an_arm_between_trials(tmp_path):
    c = "c1-arithmetic"
    results, _, _, report, code = run_offline(tmp_path, {"A": {c: ["control-clean"]}}, num_trials=4, scenarios=[c], budget=50_000)
    assert code == 1 and "token budget reached" in results["A"]["halted"]
    assert report["arms"]["A"]["control"]["scored"] == 2 and report["arms"]["A"]["unscored"] == {"halted": 2}


def test_an_arm_on_the_wrong_surface_is_never_counted(tmp_path):
    w = "w1-file-appears"
    results, _, _, report, code = run_offline(tmp_path, {"B": {w: ["election-work"]}}, num_trials=2, scenarios=[w], overrides={"B": {"surface": "deferred"}})
    assert code == 1 and "arm mismatch" in results["B"]["halted"]
    assert report["arms"]["B"]["eligible"]["scored"] == 0 and report["arms"]["B"]["surfaceMismatches"] == 1


def test_an_adapter_bug_halts_its_arm_and_is_reported(tmp_path, monkeypatch):
    from openclaw_evalbench import adapter

    async def boom(self, _request, _base):
        raise RuntimeError("a bug")
    monkeypatch.setattr(adapter.ArmJob, "_answer", boom)
    results, _, _, report, code = run_offline(tmp_path, {"A": {}}, num_trials=3, scenarios=["c1-arithmetic"])
    assert code == 1 and results["A"]["halted"] == "adapter bug: RuntimeError: a bug"
    assert report["arms"]["A"]["unscored"] == {"infra_error": 1, "halted": 2}


def test_a_job_evalbench_ends_without_a_result_is_a_failure(tmp_path):
    results, _, _, _, code = run_offline_expecting_no_report(tmp_path)
    assert code == 1 and "EvalBench ended arm A's stream" in results["A"]["error"]


def run_offline_expecting_no_report(tmp_path):
    arms = load_arms()

    async def go():
        async with fake_gateway(arms, "A", {}) as fake:
            configs = build_configs(tmp_path, ["A"], gateway_urls={"A": fake.url}, num_trials=1, scenarios=["no-such-scenario"])
            return await run_jobs(tmp_path, configs, arms=arms, tokens={"A": fake.token}, token_budget=None)
    import os
    here = os.getcwd()
    os.chdir(ROOT)
    try:
        results = asyncio.run(go())
        return results, None, None, None, _finish(tmp_path, results, {}, arms)
    finally:
        os.chdir(here)


def test_a_record_is_scrubbed_of_tokens_and_session_keys():
    from openclaw_evalbench.adapter import scrub
    dirty = {"reply": "my key is agent:main:evalprop-a-1 and the token is s3cret", "calls": [{"args": {"targetSessionKey": "agent:main:other"}}], "n": 1, "x": None}
    assert scrub(dirty, "s3cret") == {"reply": "my key is agent:<key> and the token is <token>", "calls": [{"args": {"targetSessionKey": "agent:<key>"}}], "n": 1, "x": None}


def test_the_session_outlives_evalbenchs_three_hour_default():
    from openclaw_evalbench.__main__ import SESSION_TTL_SECONDS
    from util import get_SessionManager
    assert get_SessionManager().get_ttl() in (10800, SESSION_TTL_SECONDS)
    # 90 trials of one arm at the 600 s deadline is 15 hours.
    assert SESSION_TTL_SECONDS > 90 * 600 * 2


def test_the_install_is_at_the_pin():
    import os
    src = os.environ["OPENCLAW_EVALBENCH_SRC"]
    head = subprocess.run(["git", "-C", src, "rev-parse", "HEAD"], capture_output=True, text=True, check=True).stdout.strip()
    assert head == (ROOT / "EVALBENCH_PIN").read_text().strip()
    assert hasattr(eval_agent_pb2, "ReportingContext"), "bootstrap.sh regenerates the stale stubs"
