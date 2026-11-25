"""EvalBench's CSVs -> election rates per arm, with intervals, and the pre-declared comparisons.

EvalBench at the pin has no local per-arm rate with an interval: its A/B comparison is a BigQuery report or a viewer
page written by Gemini. So this reads the CSVs each job wrote. The trial record is in evals.csv (the `stdout`
envelope's `openclaw`); scores.csv's continuation_election is only checked against it.
"""

import csv
import json
import pathlib
import sys
from collections import Counter, defaultdict

from . import stats
from .arms import load_arms, load_scenarios
from .stops import charge
from .trial import SCORED

REPORT_SCHEMA = "openclaw.evalbench.propensity-report.v1"


def _rows(path):
    csv.field_size_limit(sys.maxsize)
    with path.open(newline="") as handle:
        return list(csv.DictReader(handle))


def read_job(job_dir, arm_name=None, model=None, caps=None):
    """The trials of one EvalBench job, in the order they ran. Every evals.csv row becomes one trial; none is dropped.

    With `model`, a trial that was fired for, or served by, any other model is unscored. With `caps`, so is one whose
    gateway was not read back with exactly those spend caps in force.
    """
    job_dir = pathlib.Path(job_dir)
    scores = {}
    for row in _rows(job_dir / "scores.csv"):
        if row.get("comparator") == "continuation_election":
            scores[row["id"]] = row
    trials = []
    for row in _rows(job_dir / "evals.csv"):
        prompt_id = row.get("prompt_id") or row["eval_id"]
        try:
            envelope = json.loads(row.get("stdout") or "{}")
        except ValueError:
            envelope = {}
        meta = envelope.get("openclaw") or {}
        error = row.get("generated_error") or ""
        scored = not error and meta.get("status") in SCORED and isinstance(meta.get("elected"), bool)
        status, reason = meta.get("status") or "unanswered", meta.get("reason") or error or None
        served = set(meta.get("servedModels") or [])
        if scored and model is not None and (meta.get("model") != model or served != {model}):
            scored, status = False, "other_model"
            reason = f"fired for {meta.get('model')}, served by {', '.join(sorted(served)) or 'no named model'}; the firing model is {model}"
        read_back = (meta.get("gateway") or {}).get("caps") or {}
        if scored and caps is not None and (read_back.get("verdict") != "verified" or read_back.get("values") != caps["set"]):
            scored, status, reason = False, "caps_unverified", "its gateway was not read back with this run's spend caps in force"
        problem = None
        if meta and meta.get("promptId") != prompt_id:
            problem = f"{row['eval_id']}: the trial record is for prompt {meta.get('promptId')}"
        if meta and arm_name and meta.get("arm") != arm_name:
            problem = f"{row['eval_id']}: the trial record is arm {meta.get('arm')}'s, not {arm_name}'s"
        score_row = scores.get(row["eval_id"])
        if scored:
            if score_row is None or score_row.get("comparison_error"):
                problem = f"{row['eval_id']}: continuation_election did not run"
            elif (float(score_row["score"]) == 100.0) != meta["elected"] or "FAIL" in (score_row.get("comparison_logs") or ""):
                problem = f"{row['eval_id']}: continuation_election scored {score_row['score']}, the trial says {meta['elected']}"
        trials.append({"evalId": row["eval_id"], "promptId": prompt_id, "scored": scored, "status": status,
                       "reason": reason, "meta": meta, "problem": problem})
    return trials


def _rate(elected, n):
    ci = stats.wilson(elected, n)
    return {"elected": elected, "scored": n, "rate": elected / n if n else None, "wilson95": list(ci) if ci else None}


def _first_repetitions(trials, repetitions):
    """Each prompt's first `repetitions` scored trials count; a top-up's extra ones don't weight their prompt.

    Returns the trials with `extra` set on the surplus.
    """
    seen = Counter()
    out = []
    for trial in trials:
        extra = trial["scored"] and seen[trial["promptId"]] >= repetitions
        seen[trial["promptId"]] += trial["scored"]
        out.append({**trial, "extra": extra})
    return out


def _arm(trials, scenarios, repetitions):
    kinds = {s["id"]: s["kind"] for s in scenarios}
    per_prompt = {s["id"]: {"kind": s["kind"], "expected": [t.split("__")[-1] for t in s["expected_trajectory"]],
                            "elected": 0, "scored": 0, "unscored": 0, "tools": Counter()} for s in scenarios}
    totals, tools, token_form, unscored = defaultdict(lambda: [0, 0]), Counter(), Counter(), Counter()
    expected_tool = searched = searched_first = observable = deadline = unreadable_eligible = extra = scratch = 0
    via, surfaces, text, shapes = Counter(), Counter(), Counter(), Counter()
    queries, runtimes, others, served, prompts_hash = Counter(), Counter(), Counter(), Counter(), set()
    tokens, largest, calls, accepted, problems, mismatches, capped, wakes = 0, 0, 0, 0, [], 0, 0, 0
    for trial in trials:
        meta, prompt = trial["meta"], trial["promptId"]
        if trial["problem"]:
            problems.append(trial["problem"])
        if prompt not in per_prompt:
            problems.append(f"{trial['evalId']}: not a prompt of this evalset")
            continue
        charged = charge(meta) if meta else 0
        tokens, largest = tokens + charged, max(largest, charged)
        scratch += bool(meta.get("scratchPresent"))
        calls += meta.get("modelCalls") or 0
        wakes += meta.get("continuationWakes") or 0
        if (meta.get("surface") or {}).get("verdict") == "mismatch":
            mismatches += 1
        if not trial["scored"]:
            per_prompt[prompt]["unscored"] += 1
            unscored[trial["status"]] += 1
            unreadable_eligible += trial["status"] == "deadline_unreadable" and kinds[prompt] == "eligible"
            continue
        if trial["extra"]:
            extra += 1
            continue
        kind = kinds[prompt]
        names = [e["tool"] for e in meta["elections"]]
        entry = per_prompt[prompt]
        entry["scored"] += 1
        totals[kind][1] += 1
        capped += ((meta.get("gateway") or {}).get("caps") or {}).get("verdict") == "verified"
        deadline += meta["status"] == "deadline"
        runtimes[str(meta.get("runtime"))] += 1
        served.update(meta.get("servedModels") or [])
        others.update(meta.get("otherTools") or [])
        surface = meta.get("surface") or {}
        surfaces[str(surface.get("verdict"))] += 1
        text.update((surface.get("descriptionText") or {}).values())
        if surface.get("directTools") is not None:
            shapes[f"{surface['directTools']} direct and {surface['deferredTools']} deferred"
                   f"{', Code Mode' if surface.get('codeModeControls') else ''}"] += 1
        prompts_hash.add(surface.get("systemPromptHash"))
        for form, seen in (meta.get("tokenForm") or {}).items():
            token_form[form] += bool(seen)
        discovery = meta.get("discovery") or {}
        if discovery.get("observable"):
            observable += 1
            searched += bool(discovery.get("searches"))
            searched_first += bool(discovery.get("searchBeforeElection"))
            queries.update(discovery.get("queries") or [])
        if meta["elected"]:
            entry["elected"] += 1
            totals[kind][0] += 1
            entry["tools"].update(set(names))
            tools.update(set(names))
            if entry["expected"] and set(entry["expected"]) & set(names):
                expected_tool += 1
            via.update({e["via"] for e in meta["elections"]})
            accepted += any(e["status"] in ("scheduled", "queued-for-compaction", "compaction_requested") for e in meta["elections"])
    short = [p for p, e in per_prompt.items() if e["scored"] < repetitions]
    return {
        "eligible": _rate(*totals["eligible"]), "control": _rate(*totals["control"]),
        "trials": len(trials), "scored": sum(e["scored"] for e in per_prompt.values()),
        "unscored": dict(unscored), "deadline": deadline, "promptsBelowRepetitions": short,
        "surfaceMismatches": mismatches, "problems": problems,
        "electedTool": dict(tools), "electedExpectedTool": expected_tool, "electedAccepted": accepted,
        "electedVia": dict(via), "extraTrials": extra, "surfaces": dict(surfaces), "descriptionText": dict(text),
        "surfaceShapes": dict(shapes),
        "scratchPresent": scratch, "capsVerified": capped, "continuationWakes": wakes,
        # Turns stopped at the deadline whose history could not be read: the eligible rate if none of them elected.
        "eligibleIfUnreadableDeadlinesDidNotElect": _rate(totals["eligible"][0], totals["eligible"][1] + unreadable_eligible),
        "discovery": {"observableTrials": observable, "searched": searched, "searchBeforeElection": searched_first,
                      "queries": dict(queries.most_common())},
        "tokenForm": dict(token_form), "otherTools": dict(others.most_common()), "runtimes": dict(runtimes),
        "servedModels": dict(served), "distinctSystemPrompts": len(prompts_hash - {None}),
        "meteredTokens": tokens, "largestTrialTokens": largest, "modelCalls": calls,
        "perPrompt": {p: {**e, "tools": dict(e["tools"])} for p, e in per_prompt.items()},
    }


def _compare(arms_out, spec):
    a, b = arms_out[spec["from"]], arms_out[spec["to"]]
    ea, eb = a["eligible"], b["eligible"]
    counts = lambda arm: {p: (e["elected"], e["scored"]) for p, e in arm["perPrompt"].items() if e["kind"] == "eligible"}
    newcombe = stats.newcombe(ea["elected"], ea["scored"], eb["elected"], eb["scored"])
    bootstrap = stats.prompt_bootstrap(counts(a), counts(b))
    blockers = []
    for name, arm in ((spec["from"], a), (spec["to"], b)):
        if arm["promptsBelowRepetitions"]:
            blockers.append(f"arm {name}: {len(arm['promptsBelowRepetitions'])} prompt(s) below the declared repetitions")
        if arm["surfaceMismatches"]:
            blockers.append(f"arm {name}: {arm['surfaceMismatches']} trial(s) whose surface contradicted the arm")
        if arm["problems"]:
            blockers.append(f"arm {name}: {len(arm['problems'])} record problem(s)")
        if len(arm["runtimes"]) > 1:
            blockers.append(f"arm {name}: trials ran on more than one runtime ({', '.join(sorted(arm['runtimes']))})")
    if len(a["runtimes"]) == 1 and len(b["runtimes"]) == 1 and set(a["runtimes"]) != set(b["runtimes"]):
        blockers.append(f"arms {spec['from']} and {spec['to']} ran on different runtimes")
    return {**spec, "difference": None if newcombe is None else eb["rate"] - ea["rate"],
            "newcombe95": list(newcombe) if newcombe else None, "bootstrap95": list(bootstrap) if bootstrap else None,
            "reading": "not reportable" if blockers else stats.effect(newcombe, bootstrap), "blockers": blockers,
            "controlRates": {spec["from"]: a["control"]["rate"], spec["to"]: b["control"]["rate"]}}


def build_report(jobs, *, arms=None, scenarios=None, manifest=None):
    """`jobs` maps arm name -> list of EvalBench job directories (a top-up job adds to the same arm)."""
    arms, scenarios = arms or load_arms(), scenarios or load_scenarios()
    out = {}
    used = {}
    for name, dirs in jobs.items():
        for directory in dirs:
            path = pathlib.Path(directory).resolve()
            if path in used:
                raise ValueError(f"job {path.name} was given twice (arm {used[path]} and arm {name})")
            used[path] = name
        trials = [t for d in dirs for t in read_job(d, name, arms["model"], arms.get("caps"))]
        out[name] = _arm(_first_repetitions(trials, arms["repetitions"]), scenarios, arms["repetitions"])
    comparisons = [_compare(out, c) for c in arms["comparisons"] if c["from"] in out and c["to"] in out]
    return {"schema": REPORT_SCHEMA, "repetitions": arms["repetitions"], "model": arms["model"],
            "manifest": manifest, "arms": out, "comparisons": comparisons}


def _pct(value):
    return "n/a" if value is None else f"{100 * value:.1f} %"


def _interval(ci, points=False):
    if ci is None:
        return "n/a"
    return f"{100 * ci[0]:+.1f} to {100 * ci[1]:+.1f} pp" if points else f"{100 * ci[0]:.1f}–{100 * ci[1]:.1f} %"


def _counts(counter):
    return ", ".join(f"{k} {v}" for k, v in counter.items()) or "none"


def _supervision(summary):
    """What the supervisor saw and did, from its own receipt."""
    if not summary:
        return []
    limits, receipt = summary["limits"], summary["receipt"] or {"arms": {}, "tokens": 0, "seconds": None, "ended": None}
    lines = ["", "## Supervision", "",
             f"Limits: {limits['trialTokens']:,} metered tokens and {limits['trialSeconds']} s per trial, {limits['idleTokens']:,} tokens outside a trial, "
             f"{limits['runTokens']:,} tokens and {limits['runSeconds']} s for the run, {limits['maxActiveRuns']} active runs per gateway, "
             f"{limits['blindSeconds']} s without a reading, a reading every {limits['pollSeconds']} s.", "",
             f"Run: {receipt['tokens']:,} metered tokens in {receipt['seconds']} s; ended by {(receipt['ended'] or {}).get('rule')}; "
             f"halted: {summary['halted'] or 'no'}; supervisor lost: {summary['lost'] or 'no'}.", "",
             "| arm | metered tokens | trials | largest trial | longest trial | readings | longest gap | stopped by | proved stopped | durable units ended |",
             "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |"]
    for name, arm in receipt["arms"].items():
        stop = arm["stop"] or {"rule": "nothing", "result": None}
        result = stop["result"] or {"stopped": False, "durableUnits": []}
        lines.append(f"| {name} | {arm['tokens']:,} | {arm['trials']} | {arm['largestTrialTokens']:,} | {arm['longestTrialSeconds']} s | {arm['readings']} | "
                     f"{arm['longestGapSeconds']} s | {stop['rule']} | {'yes' if result['stopped'] else 'NO'} | {len(result['durableUnits']) + arm['sweptUnits']} |")
    return lines


def render(report):
    lines = ["# Continuation propensity", ""]
    manifest = report.get("manifest") or {}
    if manifest.get("offline"):
        lines += ["**Offline rehearsal against the fake gateway. Every number below is scripted; none is about a model.**", ""]
    lines += [f"Model `{report['model']}`, no fallbacks; a trial any other model served is unscored. "
              f"{report['repetitions']} repetitions per prompt and arm. "
              "Rates are trials whose turn called a continuation tool, over scored trials.", "",
              "| arm | eligible: elected | rate | Wilson 95 % | control: elected | rate | Wilson 95 % | unscored |",
              "| --- | --- | --- | --- | --- | --- | --- | --- |"]
    for name, arm in report["arms"].items():
        e, c = arm["eligible"], arm["control"]
        lines.append(f"| {name} | {e['elected']}/{e['scored']} | {_pct(e['rate'])} | {_interval(e['wilson95'])} | "
                     f"{c['elected']}/{c['scored']} | {_pct(c['rate'])} | {_interval(c['wilson95'])} | {_counts(arm['unscored'])} |")
    lines += ["", "## Comparisons (eligible election rate)", "",
              "| comparison | difference | Newcombe 95 % | prompt bootstrap 95 % | reading |", "| --- | --- | --- | --- | --- |"]
    for c in report["comparisons"]:
        label = f"{c['from']} → {c['to']}: {c['label']}" + ("" if c["primary"] else " (descriptive)")
        diff = "n/a" if c["difference"] is None else f"{100 * c['difference']:+.1f} pp"
        lines.append(f"| {label} | {diff} | {_interval(c['newcombe95'], True)} | {_interval(c['bootstrap95'], True)} | {c['reading']} |")
    notes = [f"- **{c['from']} → {c['to']}**: {c['note']}" for c in report["comparisons"] if c.get("note")]
    if notes:
        lines += ["", "What each comparison is:", ""] + notes
    blocked = [f"- {c['from']} → {c['to']}: {b}" for c in report["comparisons"] for b in c["blockers"]]
    if blocked:
        lines += ["", "Not reportable because:", ""] + blocked
    lines += ["", "## Surface", ""]
    for name, arm in report["arms"].items():
        lines.append(f"- **{name}**: surface: {_counts(arm['surfaces'])}; description text: {_counts(arm['descriptionText'])}; "
                     f"runtime: {_counts(arm['runtimes'])}; served: {_counts(arm['servedModels'])}; "
                     f"tools: {_counts(arm['surfaceShapes'])}; contradictions: {arm['surfaceMismatches']}; "
                     f"caps verified: {arm['capsVerified']}; continuation wakes: {arm['continuationWakes']}.")
    lines += ["", "## What was elected, and how", "",
              "| arm | tools elected (trials) | fitting tool | accepted | how it was called | bracket form (not counted) | deadline | eligible rate if unreadable deadlines did not elect |",
              "| --- | --- | --- | --- | --- | --- | --- | --- |"]
    for name, arm in report["arms"].items():
        bound = arm["eligibleIfUnreadableDeadlinesDidNotElect"]
        lines.append(f"| {name} | {_counts(arm['electedTool'])} | {arm['electedExpectedTool']} | {arm['electedAccepted']} | "
                     f"{_counts(arm['electedVia'])} | {_counts(arm['tokenForm'])} | {arm['deadline']} | {_pct(bound['rate'])} ({bound['elected']}/{bound['scored']}) |")
    lines += ["", "## Discovery (`tool_search`)", ""]
    for name, arm in report["arms"].items():
        d = arm["discovery"]
        if d["observableTrials"] == 0:
            lines.append(f"- **{name}**: not observable on this surface.")
            continue
        queries = "; ".join(f"`{q}` ×{n}" for q, n in d["queries"].items()) or "none"
        lines.append(f"- **{name}**: searched in {d['searched']} of {d['observableTrials']} trials; before an election in "
                     f"{d['searchBeforeElection']}. Queries: {queries}.")
    lines += ["", "## Per prompt (elected / scored)", "",
              "| prompt | kind | fitting tool | " + " | ".join(report["arms"]) + " |",
              "| --- | --- | --- | " + " | ".join("---" for _ in report["arms"]) + " |"]
    first = next(iter(report["arms"].values()))
    for prompt, entry in first["perPrompt"].items():
        cells = " | ".join(f"{a['perPrompt'][prompt]['elected']}/{a['perPrompt'][prompt]['scored']}" for a in report["arms"].values())
        lines.append(f"| {prompt} | {entry['kind']} | {', '.join(entry['expected']) or '—'} | {cells} |")
    lines += ["", "## Cost and integrity", "", "| arm | metered tokens | largest trial | model calls seen | distinct system prompts | extra trials not counted | scratch path present | record problems |",
              "| --- | --- | --- | --- | --- | --- | --- | --- |"]
    for name, arm in report["arms"].items():
        lines.append(f"| {name} | {arm['meteredTokens']:,} | {arm['largestTrialTokens']:,} | {arm['modelCalls']} | {arm['distinctSystemPrompts']} | {arm['extraTrials']} | {arm['scratchPresent']} | {len(arm['problems'])} |")
    budget = manifest.get("tokenBudgetPerArm")
    lines += ["", f"Metered tokens include cache reads. The spend stop{f' ({budget:,} per arm)' if budget else ''} is checked between trials, "
              "so it is not a ceiling: what ends a trial that is running is the supervisor."]
    lines += _supervision(manifest.get("supervision"))
    problems = [f"- {name}: {p}" for name, arm in report["arms"].items() for p in arm["problems"]]
    if problems:
        lines += [""] + problems
    return "\n".join(lines) + "\n"
