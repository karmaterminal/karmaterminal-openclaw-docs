"""EvalBench CSVs → rates and comparisons, and every way a run can fail to be reportable."""
import csv
import json

import pytest
from conftest import MODEL, OTHER_MODEL

from openclaw_evalbench import stats
from openclaw_evalbench.report import build_report, read_job, render

ELIGIBLE, CONTROL = ("e1", "e2", "e3"), ("c1",)
SCENARIOS = [{"id": p, "kind": "eligible", "expected_trajectory": ["openclaw__continue_work"]} for p in ELIGIBLE] + \
            [{"id": p, "kind": "control", "expected_trajectory": []} for p in CONTROL]


def arms(repetitions=5):
    from openclaw_evalbench.arms import load_arms
    declared = load_arms()
    return {"model": MODEL, "repetitions": repetitions, "caps": {"set": {"a.b": 1}}, "arms": {},
            "surfaceCrowding": declared["surfaceCrowding"], "awareness": declared["awareness"],
            "comparisons": [{"id": "visibility", "label": "visibility (all tools direct)", "note": "what it is", "from": "A", "to": "B", "primary": True}]}


def trial(prompt, index, elected, *, status="ok", kind=None, tool="continue_work", surface="verified"):
    scored = status in ("ok", "deadline")
    return {"eval_id": f"{prompt}_trial_{index}", "prompt_id": prompt, "meta": {
        "promptId": prompt, "kind": kind or ("control" if prompt in CONTROL else "eligible"), "status": status,
        "reason": None if scored else "why", "elected": elected if scored else None,
        "elections": [{"tool": tool, "via": "direct", "status": "scheduled"}] if elected else [],
        "gateway": {"caps": {"verdict": "verified", "values": {"a.b": 1}}},
        "usage": {"total": 100}, "metered": {"session": 100, "children": 0}, "modelCalls": 1, "runtime": "openclaw", "model": MODEL, "servedModels": [MODEL], "otherTools": [],
        "surface": {"verdict": surface, "directTools": 31, "deferredTools": 0, "systemPromptHash": "h", "descriptionText": {"continue_work": "match"}}, "scratchPresent": False, "tokenForm": {"continue_work": False, "continue_delegate": False},
        "discovery": {"observable": False, "searches": 0, "searchBeforeElection": False, "queries": []}}}


def job(path, trials, *, scorer=lambda t: t["meta"].get("elected"), arm=None):
    path.mkdir(parents=True)
    arm = arm or path.name[0].upper()
    trials = [{**t, "meta": {**t["meta"], "arm": arm} if t["meta"] else {}} for t in trials]
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


def test_a_top_up_adds_no_weight_to_a_prompt_that_already_has_its_repetitions(tmp_path):
    jobs = {"A": [job(tmp_path / "a", arm_trials({})), job(tmp_path / "a2", [trial("e1", i, True) for i in range(5)])], "B": [job(tmp_path / "b", arm_trials({}))]}
    a = build_report(jobs, arms=arms(), scenarios=SCENARIOS)["arms"]["A"]
    assert (a["eligible"]["elected"], a["eligible"]["scored"], a["extraTrials"]) == (0, 15, 5)


def test_the_same_job_twice_is_refused(tmp_path):
    a, b = job(tmp_path / "a", arm_trials({})), job(tmp_path / "b", arm_trials({}))
    for jobs in ({"A": [a, a], "B": [b]}, {"A": [a], "B": [a]}, {"A": [a, tmp_path / "x" / ".." / "a"], "B": [b]}):
        with pytest.raises(ValueError, match="given twice"):
            build_report(jobs, arms=arms(), scenarios=SCENARIOS)


def test_another_arms_job_is_a_problem(tmp_path):
    report = build_report({"A": [job(tmp_path / "a", arm_trials({}), arm="B")], "B": [job(tmp_path / "b", arm_trials({}))]}, arms=arms(), scenarios=SCENARIOS)
    assert len(report["arms"]["A"]["problems"]) == 20 and "is arm B's, not A's" in report["arms"]["A"]["problems"][0]
    assert report["comparisons"][0]["reading"] == "not reportable"


def test_arms_on_different_runtimes_are_not_compared(tmp_path):
    a = arm_trials({})
    for t in a:
        t["meta"]["runtime"] = "codex"
    report = report_for(tmp_path, a, arm_trials({"e1": 5, "e2": 5, "e3": 5}))
    assert report["comparisons"][0]["reading"] == "not reportable" and "different runtimes" in report["comparisons"][0]["blockers"][0]


def test_one_arm_on_two_runtimes_is_not_compared(tmp_path):
    a = arm_trials({})
    a[0]["meta"]["runtime"] = "codex"
    assert "more than one runtime" in report_for(tmp_path, a, arm_trials({}))["comparisons"][0]["blockers"][0]


def test_an_unreadable_deadline_is_unscored_and_bounded(tmp_path):
    a = arm_trials({"e1": 5, "e2": 5, "e3": 5})
    a[0] = trial("e1", 0, False, status="deadline_unreadable")
    out = report_for(tmp_path, a, arm_trials({}))["arms"]["A"]
    assert (out["eligible"]["elected"], out["eligible"]["scored"], out["unscored"]) == (14, 14, {"deadline_unreadable": 1})
    bound = out["eligibleIfUnreadableDeadlinesDidNotElect"]
    assert (bound["elected"], bound["scored"]) == (14, 15)


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
    path = job(tmp_path / "a3", arm_trials({}))
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
    for piece in ("| A | 31 (crowded) | 2/15 | 13.3 % |", f"{100 * low:.1f}–{100 * high:.1f} %", "| e1 | eligible | continue_work | 2/5 | 5/5 |", "Offline rehearsal",
                  "searched in 20 of 20 trials; before an election in 2. Queries: `later` ×20.", "**B**: not observable", "| A → B: visibility (all tools direct) |", "- **A → B**: what it is",
                  f"**A**: surface: verified 20; description text: match 20; runtime: openclaw 20; served: {MODEL} 20; tools: 31 direct and 0 deferred 20; contradictions: 0; "
                  "caps verified: 20; continuation wakes: 0; treatment limitations: 0 trial(s) (none), elected after one: 0.",
                  "| A | 2,000 | 100 |", "checked between trials, so it is not a ceiling"):
        assert piece in text, piece


@pytest.mark.parametrize("change", [{"servedModels": [OTHER_MODEL]}, {"servedModels": [MODEL, OTHER_MODEL]}, {"servedModels": []}, {"model": OTHER_MODEL}, {"model": None}])
def test_a_trial_fired_for_or_served_by_another_model_is_unscored(tmp_path, change):
    a = arm_trials({"e1": 5})
    a[0]["meta"].update(change)
    report = report_for(tmp_path, a, arm_trials({}))
    out = report["arms"]["A"]
    assert out["unscored"] == {"other_model": 1} and (out["eligible"]["elected"], out["eligible"]["scored"]) == (4, 14)
    assert report["comparisons"][0]["reading"] == "not reportable"


def test_a_run_for_one_model_never_reads_as_a_run_for_another(tmp_path):
    jobs = {"A": [job(tmp_path / "a", arm_trials({}))], "B": [job(tmp_path / "b", arm_trials({"e1": 5}))]}
    report = build_report(jobs, arms={**arms(), "model": OTHER_MODEL}, scenarios=SCENARIOS)
    assert report["model"] == OTHER_MODEL and all(a["unscored"] == {"other_model": 20} for a in report["arms"].values())
    assert all(a["eligible"]["rate"] is None for a in report["arms"].values())


def test_the_report_says_what_the_stop_is_and_what_the_dearest_trial_cost(tmp_path):
    a = arm_trials({})
    a[3]["meta"]["metered"] = {"session": 900, "children": 4_000}
    report = report_for(tmp_path, a, arm_trials({}), manifest={"tokenBudgetPerArm": 35_000_000})
    assert (report["arms"]["A"]["largestTrialTokens"], report["arms"]["A"]["meteredTokens"]) == (4_900, 19 * 100 + 4_900)
    assert "The spend stop (35,000,000 per arm) is checked between trials" in render(report)


def test_arms_d_and_e_are_reported_like_any_arm_and_split_what_they_split(tmp_path):
    from openclaw_evalbench.arms import load_arms
    declared = {**arms(), "comparisons": load_arms()["comparisons"]}
    elected = {"A": {}, "B": {"e1": 1}, "C": {"e1": 5, "e2": 2}, "D": {"e1": 3}, "E": {"e1": 5, "e2": 4, "e3": 1}}
    without = {n: [job(tmp_path / f"{n.lower()}-off", arm_trials(elected[n]))] for n in "ABCE"}
    off = build_report(without, arms=declared, scenarios=SCENARIOS)
    assert [c["id"] for c in off["comparisons"]] == ["visibility", "composite", "settled-wording", "deploy", "settled-deploy"]
    on = build_report({**without, "D": [job(tmp_path / "d", arm_trials(elected["D"]))]}, arms=declared, scenarios=SCENARIOS)
    by_id = {c["id"]: c for c in on["comparisons"]}
    assert list(by_id) == ["visibility", "composite", "wording", "placement", "settled-wording", "deploy", "settled-deploy"]
    assert {i: (c["from"], c["to"], c["primary"]) for i, c in by_id.items()} == {
        "visibility": ("A", "B", True), "composite": ("B", "C", True), "wording": ("B", "D", True), "placement": ("D", "C", True),
        "settled-wording": ("C", "E", True), "deploy": ("A", "C", False), "settled-deploy": ("A", "E", False)}
    assert by_id["wording"]["difference"] + by_id["placement"]["difference"] == pytest.approx(by_id["composite"]["difference"])
    # On the same trials A → E is A → B, B → C and C → E together.
    assert sum(by_id[i]["difference"] for i in ("visibility", "composite", "settled-wording")) == pytest.approx(by_id["settled-deploy"]["difference"])
    assert all(c["blockers"] == [] and c["newcombe95"] and c["bootstrap95"] for c in by_id.values())
    text = render(on)
    for piece in ("| A → B: visibility (all tools direct) |", "| B → C: composite: new text + direct-set narrowing |", "| B → D: wording (all tools direct) |",
                  "| C → E: settled wording (same placement) |", "| A → E: placement + settled wording (descriptive) |",
                  "- **B → C**: not the wording effect.", "| D | 31 (crowded) | 3/15 |", "| E | 31 (crowded) | 10/15 |", "- **D**: surface: verified 20", "- **E**: surface: verified 20"):
        assert piece in text, piece
    assert "wording:" not in text, "no contrast is headlined as the wording effect"


@pytest.mark.parametrize("manifest, shown", [({"offline": True}, True), ({"offline": False}, False), (None, False)])
def test_only_a_rehearsal_says_so(tmp_path, manifest, shown):
    assert ("Offline rehearsal" in render(report_for(tmp_path, arm_trials({}), arm_trials({}), manifest=manifest))) is shown


def test_treatment_limitations_are_counted_and_printed_and_leave_the_rates_alone(tmp_path):
    from openclaw_evalbench.report import render
    a = arm_trials({"e1": 2})
    spawn = {"tool": "sessions_spawn", "settings": ["agents.defaults.subagents.maxChildrenPerAgent"], "status": "forbidden", "call": 0}
    cron = {"tool": "automations", "settings": ["cron.enabled"], "status": "answered with the scheduler off", "call": 1}
    a[0]["meta"].update(limitations=[spawn, cron], electedAfterLimitation=True)   # e1, elected
    a[7]["meta"].update(limitations=[spawn], electedAfterLimitation=False)
    plain = report_for(tmp_path / "plain", arm_trials({"e1": 2}), arm_trials({}))
    out = report_for(tmp_path, a, arm_trials({}))
    assert out["arms"]["A"]["treatmentLimitations"] == {
        "trials": 2, "bySetting": {"agents.defaults.subagents.maxChildrenPerAgent": 2, "cron.enabled": 1}, "electedAfter": 1}
    assert out["arms"]["B"]["treatmentLimitations"] == {"trials": 0, "bySetting": {}, "electedAfter": 0}
    assert out["arms"]["A"]["eligible"] == plain["arms"]["A"]["eligible"], "recorded, never a reason to leave a trial out"
    assert ("treatment limitations: 2 trial(s) (agents.defaults.subagents.maxChildrenPerAgent 2, cron.enabled 1), "
            "elected after one: 1.") in render(out)


# --- direct tools beside every rate -----------------------------------------------------------------------------------------

def direct_tool_gaps(markdown, csv_text, arm_names, crowded_above=30):
    """Every way an arm's rates row lacks its direct-tool count, in the rendered report and in its CSV. Empty when none does.

    A count is the number of direct tools the arm's trials measured (or a range of them), labelled crowded exactly when it is
    past the crowding line.
    """
    gaps = []
    lines = markdown.splitlines()
    header = next((i for i, line in enumerate(lines) if line.startswith("| arm |")), None)
    if header is None or [c.strip() for c in lines[header].split("|")[1:3]] != ["arm", "direct tools"]:
        return ["the rates table has no direct tools column beside the arm"]
    rows = {}
    for line in lines[header + 2:]:
        if not line.startswith("| "):
            break
        cells = [c.strip() for c in line.split("|")[1:-1]]
        rows[cells[0]] = cells[1]
    table = {r["arm"]: r for r in csv.DictReader(csv_text.splitlines())}
    for name in arm_names:
        cell = rows.get(name)
        found = __import__("re").fullmatch(r"(\d+)(?:–(\d+))? ?(\(crowded\))?", cell or "")
        if not found:
            gaps.append(f"arm {name}: rates row has {cell!r} for its direct tools")
        elif bool(found.group(3)) is not (int(found.group(2) or found.group(1)) > crowded_above):
            gaps.append(f"arm {name}: {cell!r} is labelled wrongly against {crowded_above}")
        row = table.get(name) or {}
        if not __import__("re").fullmatch(r"\d+(?:–\d+)?", row.get("direct_tools") or "") or row.get("crowded") not in ("yes", "no"):
            gaps.append(f"arm {name}: CSV row has direct_tools {row.get('direct_tools')!r}, crowded {row.get('crowded')!r}")
    return gaps


def surface_trials(elected, direct, controls=0):
    out = arm_trials(elected, controls)
    for t in out:
        t["meta"]["surface"]["directTools"] = direct
    return out


def test_every_arms_rates_row_carries_its_direct_tool_count(tmp_path):
    from openclaw_evalbench.arms import load_arms
    from openclaw_evalbench.report import render_csv
    declared = {**arms(), "comparisons": load_arms()["comparisons"]}
    counts = {"A": 7, "B": 66, "C": 9, "D": 66, "E": 9}
    report = build_report({n: [job(tmp_path / n.lower(), surface_trials({"e1": i}, d))] for i, (n, d) in enumerate(counts.items())},
                          arms=declared, scenarios=SCENARIOS)
    text, table = render(report), render_csv(report)
    assert direct_tool_gaps(text, table, "ABCDE") == []
    assert {n: (a["directTools"]["values"], a["directTools"]["crowded"]) for n, a in report["arms"].items()} == {
        n: ([d], d > 30) for n, d in counts.items()}
    for piece in ("| A | 7 | 0/15 |", "| B | 66 (crowded) | 1/15 |", "| E | 9 | 4/15 |", "**Crowded** is more than 30", "vendor guidance"):
        assert piece in text, piece
    assert "| B → C: composite: new text + direct-set narrowing |" in text and "| 66 (crowded) → 9 |" in text
    # The check itself fails on a row without its count, in either place.
    dropped = text.replace("| B | 66 (crowded) |", "| B |").replace("| --- | --- | --- | --- | --- | --- | --- | --- | --- |", "| --- |", 1)
    assert direct_tool_gaps(text.replace("| B | 66 (crowded) |", "| B | |"), table, "ABCDE") == ["arm B: rates row has '' for its direct tools"]
    assert direct_tool_gaps(dropped.replace("| arm | direct tools |", "| arm |"), table, "ABCDE") == ["the rates table has no direct tools column beside the arm"]
    assert direct_tool_gaps(text, table.replace("\nB,", "\nB,x,").replace(",66,yes", ",,", 1), "B") != []
    assert direct_tool_gaps(text.replace("| B | 66 (crowded) |", "| B | 66 |"), table, "B") == ["arm B: '66' is labelled wrongly against 30"]


def test_an_arm_whose_trials_measured_two_counts_prints_both_ends(tmp_path):
    trials = surface_trials({}, 9)
    trials[0]["meta"]["surface"]["directTools"] = 8
    arm = report_for(tmp_path, trials, arm_trials({}))["arms"]["A"]
    assert arm["directTools"]["values"] == [8, 9] and "| A | 8–9 |" in render(report_for(tmp_path / "x", trials, arm_trials({})))


def test_a_contrast_that_holds_the_surface_is_not_reportable_when_the_counts_differ(tmp_path):
    from openclaw_evalbench.arms import load_arms
    declared = {**arms(), "comparisons": [c for c in load_arms()["comparisons"] if c["id"] in ("settled-wording", "deploy")]}
    same = build_report({"A": [job(tmp_path / "a", surface_trials({}, 7))], "C": [job(tmp_path / "c", surface_trials({}, 9))],
                         "E": [job(tmp_path / "e", surface_trials({"e1": 5}, 9))]}, arms=declared, scenarios=SCENARIOS)
    assert {c["id"]: c["blockers"] for c in same["comparisons"]} == {"settled-wording": [], "deploy": []}, "A → C may change the count"
    other = build_report({"C": [job(tmp_path / "c2", surface_trials({}, 9))], "E": [job(tmp_path / "e2", surface_trials({"e1": 5}, 10))]},
                         arms=declared, scenarios=SCENARIOS)
    (comparison,) = other["comparisons"]
    assert comparison["reading"] == "not reportable"
    assert comparison["blockers"] == ["it holds the surface fixed, and arm C measured 9 direct tools, arm E 10"]
