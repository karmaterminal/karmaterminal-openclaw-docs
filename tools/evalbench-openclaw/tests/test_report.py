"""EvalBench CSVs → rates and comparisons, and every way a run can fail to be reportable."""
import csv
import json

import pytest

from openclaw_evalbench import stats
from openclaw_evalbench.report import build_report, read_job, render

ELIGIBLE, CONTROL = ("e1", "e2", "e3"), ("c1",)
SCENARIOS = [{"id": p, "kind": "eligible", "expected_trajectory": ["openclaw__continue_work"]} for p in ELIGIBLE] + \
            [{"id": p, "kind": "control", "expected_trajectory": []} for p in CONTROL]


def arms(repetitions=5):
    return {"model": "openai/gpt-5.6-sol", "repetitions": repetitions,
            "comparisons": [{"id": "visibility", "from": "A", "to": "B", "primary": True}]}


def trial(prompt, index, elected, *, status="ok", kind=None, tool="continue_work", surface="verified"):
    scored = status in ("ok", "deadline")
    return {"eval_id": f"{prompt}_trial_{index}", "prompt_id": prompt, "meta": {
        "promptId": prompt, "kind": kind or ("control" if prompt in CONTROL else "eligible"), "status": status,
        "reason": None if scored else "why", "elected": elected if scored else None,
        "elections": [{"tool": tool, "dispatched": False, "status": "scheduled"}] if elected else [],
        "usage": {"total": 100}, "modelCalls": 1, "runtime": "openclaw", "servedModels": ["openai/gpt-5.6-sol"], "otherTools": [],
        "surface": {"verdict": surface, "systemPromptHash": "h"}, "tokenForm": {"continue_work": False, "continue_delegate": False},
        "discovery": {"observable": False, "searches": 0, "searchBeforeElection": False, "queries": []}}}


def job(path, trials, *, scorer=lambda t: t["meta"].get("elected")):
    path.mkdir(parents=True)
    with (path / "evals.csv").open("w", newline="") as handle:
        out = csv.DictWriter(handle, ["eval_id", "prompt_id", "stdout", "generated_error"])
        out.writeheader()
        for t in trials:
            error = "" if t["meta"].get("status") in ("ok", "deadline") else "Agent infrastructure error"
            out.writerow({"eval_id": t["eval_id"], "prompt_id": t["prompt_id"], "stdout": json.dumps({"openclaw": t["meta"]}), "generated_error": error})
    with (path / "scores.csv").open("w", newline="") as handle:
        out = csv.DictWriter(handle, ["id", "comparator", "score", "comparison_error", "comparison_logs"])
        out.writeheader()
        for t in trials:
            out.writerow({"id": t["eval_id"], "comparator": "continuation_election", "score": 100.0 if scorer(t) else 0.0, "comparison_logs": "{}"})
            out.writerow({"id": t["eval_id"], "comparator": "trajectory_matcher", "score": 100.0})
    return path


def arm_trials(elected, controls=0):
    """`elected` maps a prompt to how many of its 5 trials elected."""
    out = [trial(p, i, i < elected.get(p, 0)) for p in ELIGIBLE for i in range(5)]
    return out + [trial("c1", i, i < controls) for i in range(5)]


def report_for(tmp_path, a, b, **kwargs):
    return build_report({"A": [job(tmp_path / "a", a)], "B": [job(tmp_path / "b", b)]}, arms=arms(), scenarios=SCENARIOS, **kwargs)


def test_rates_and_intervals(tmp_path):
    report = report_for(tmp_path, arm_trials({}), arm_trials({"e1": 5, "e2": 5, "e3": 5}, controls=1))
    a, b = report["arms"]["A"], report["arms"]["B"]
    assert (a["eligible"]["elected"], a["eligible"]["scored"]) == (0, 15) and (b["eligible"]["elected"], b["eligible"]["scored"]) == (15, 15)
    assert b["control"] == {"elected": 1, "scored": 5, "rate": 0.2, "wilson95": list(stats.wilson(1, 5))}
    assert b["eligible"]["wilson95"] == list(stats.wilson(15, 15))
    comparison = report["comparisons"][0]
    assert comparison["reading"] == "effect" and comparison["difference"] == 1.0 and comparison["blockers"] == []
    assert comparison["controlRates"] == {"A": 0.0, "B": 0.2}
    assert b["perPrompt"]["e1"]["tools"] == {"continue_work": 5}


def test_controls_never_enter_the_eligible_rate(tmp_path):
    report = report_for(tmp_path, arm_trials({}), arm_trials({}, controls=5))
    assert report["arms"]["B"]["eligible"]["elected"] == 0 and report["comparisons"][0]["reading"] == "no effect shown"


def test_a_difference_carried_by_one_prompt_is_unclear(tmp_path):
    report = report_for(tmp_path, arm_trials({}), arm_trials({"e1": 5}))
    comparison = report["comparisons"][0]
    assert stats.excludes_zero(comparison["newcombe95"]) and not stats.excludes_zero(comparison["bootstrap95"])
    assert comparison["reading"] == "unclear"


def test_a_deadline_is_scored_and_an_unscored_trial_is_in_no_denominator(tmp_path):
    a = arm_trials({"e1": 5, "e2": 5, "e3": 5})
    a[0] = trial("e1", 0, False, status="deadline")
    a[1] = trial("e1", 1, False, status="infra_error")
    report = report_for(tmp_path, a, arm_trials({}))
    out = report["arms"]["A"]
    assert (out["eligible"]["elected"], out["eligible"]["scored"]) == (13, 14)
    assert out["deadline"] == 1 and out["unscored"] == {"infra_error": 1} and out["perPrompt"]["e1"]["unscored"] == 1
    assert report["comparisons"][0]["reading"] == "not reportable"
    assert out["promptsBelowRepetitions"] == ["e1"]


def test_a_top_up_job_completes_the_declared_repetitions(tmp_path):
    a = arm_trials({"e1": 5})
    a[1] = trial("e1", 1, False, status="infra_error")
    jobs = {"A": [job(tmp_path / "a", a), job(tmp_path / "a2", [trial("e1", 0, True)])], "B": [job(tmp_path / "b", arm_trials({}))]}
    report = build_report(jobs, arms=arms(), scenarios=SCENARIOS)
    assert report["arms"]["A"]["promptsBelowRepetitions"] == [] and report["comparisons"][0]["reading"] != "not reportable"


def test_missing_trials_are_noticed(tmp_path):
    # EvalBench swallows an exception in one scenario and drops the ones after it.
    report = report_for(tmp_path, arm_trials({})[:-5], arm_trials({}))
    assert report["arms"]["A"]["promptsBelowRepetitions"] == ["c1"] and report["comparisons"][0]["reading"] == "not reportable"


def test_a_surface_mismatch_blocks_the_comparison(tmp_path):
    a = arm_trials({}) + [trial("e1", 9, False, status="arm_mismatch", surface="mismatch")]
    report = report_for(tmp_path, a, arm_trials({}))
    assert report["arms"]["A"]["surfaceMismatches"] == 1
    assert "surface contradicted" in report["comparisons"][0]["blockers"][0]


def test_a_scorer_that_disagrees_or_did_not_run_blocks_the_comparison(tmp_path):
    disagree = build_report({"A": [job(tmp_path / "a", arm_trials({"e1": 5}), scorer=lambda t: False)], "B": [job(tmp_path / "b", arm_trials({}))]},
                            arms=arms(), scenarios=SCENARIOS)
    assert len(disagree["arms"]["A"]["problems"]) == 5 and disagree["comparisons"][0]["reading"] == "not reportable"
    # `uv` missing: EvalBench's python_scorer answers 0.0 for every trial instead of failing.
    path = job(tmp_path / "c", arm_trials({}))
    text = (path / "scores.csv").read_text().replace("{}", "FAIL: 'uv' command not found in PATH.")
    (path / "scores.csv").write_text(text)
    assert all("continuation_election scored" in t["problem"] for t in read_job(path))


def test_a_row_without_a_trial_record_is_unscored(tmp_path):
    trials = arm_trials({})
    trials[0]["meta"] = {}
    report = report_for(tmp_path, trials, arm_trials({}))
    assert report["arms"]["A"]["unscored"] == {"unanswered": 1} and report["arms"]["A"]["trials"] == 20


def test_a_record_for_another_prompt_is_a_problem(tmp_path):
    trials = arm_trials({})
    trials[0]["meta"]["promptId"] = "e2"
    assert report_for(tmp_path, trials, arm_trials({}))["arms"]["A"]["problems"]


def test_the_rendered_report_prints_rates_intervals_prompts_and_discovery(tmp_path):
    a = arm_trials({"e1": 2})
    for t in a:
        t["meta"]["discovery"] = {"observable": True, "searches": 1, "searchBeforeElection": t["meta"]["elected"], "queries": ["later"]}
    text = render(report_for(tmp_path, a, arm_trials({"e1": 5, "e2": 5, "e3": 5}), manifest={"offline": True}))
    low, high = stats.wilson(2, 15)
    for piece in ("| A | 2/15 | 13.3 % |", f"{100 * low:.1f}–{100 * high:.1f} %", "| e1 | eligible | continue_work | 2/5 | 5/5 |", "Offline rehearsal",
                  "searched in 20 of 20 trials; before an election in 2. Queries: `later` ×20.", "**B**: not observable", "visibility: A → B"):
        assert piece in text, piece


@pytest.mark.parametrize("manifest, shown", [({"offline": True}, True), ({"offline": False}, False), (None, False)])
def test_only_a_rehearsal_says_so(tmp_path, manifest, shown):
    assert ("Offline rehearsal" in render(report_for(tmp_path, arm_trials({}), arm_trials({}), manifest=manifest))) is shown
