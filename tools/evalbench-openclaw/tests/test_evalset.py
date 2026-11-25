"""The turn set: counts, wording rules, and EvalBench's own loader."""
import collections
import json
import re

from conftest import ROOT

from openclaw_evalbench.arms import CANONICAL_SERVER, CONTINUATION_TOOLS, load_arms, load_scenarios

# The prompts must not name the tools or hint at them by word.
BANNED = re.compile(r"continu|delegat|compact|\bwake|\bwoke|spawn|sub-?agent|tool_?search|\byield|next turn", re.I)


def ngrams(text, n=4):
    words = re.findall(r"[a-z0-9']+", text.lower())
    return {tuple(words[i:i + n]) for i in range(len(words) - n + 1)}


def test_counts_and_kinds():
    kinds = collections.Counter(s["kind"] for s in load_scenarios())
    assert kinds == {"eligible": 12, "control": 6}
    assert load_arms()["repetitions"] >= 5


def test_prompts_are_unique_and_carry_their_own_identity():
    scenarios = load_scenarios()
    assert len({s["id"] for s in scenarios}) == len({s["starting_prompt"] for s in scenarios}) == len(scenarios)
    for s in scenarios:
        assert s["env"] == {"OPENCLAW_EVAL_PROMPT_ID": s["id"], "OPENCLAW_EVAL_KIND": s["kind"]}
        assert s["max_turns"] == 1


def test_expected_trajectories():
    for s in load_scenarios():
        tools = [t.removeprefix(f"{CANONICAL_SERVER}__") for t in s["expected_trajectory"]]
        if s["kind"] == "control":
            assert tools == []
        else:
            assert len(tools) == 1 and tools[0] in CONTINUATION_TOOLS
            assert s["expected_trajectory"][0].startswith(f"{CANONICAL_SERVER}__")


def test_no_prompt_names_or_hints_at_a_tool():
    hits = {s["id"]: BANNED.findall(s["starting_prompt"]) for s in load_scenarios() if BANNED.search(s["starting_prompt"])}
    assert hits == {}


def test_the_word_rule_catches_what_it_should():
    for text in ("please continue tomorrow", "delegate this", "Wake me", "spawn a subagent", "your next turn"):
        assert BANNED.search(text), text


def test_no_prompt_shares_a_four_word_run_with_either_arms_descriptions():
    described = set()
    for version in load_arms()["descriptions"].values():
        for tool in version["tools"].values():
            described |= ngrams(tool["text"])
    shared = {s["id"]: ngrams(s["starting_prompt"]) & described for s in load_scenarios()}
    assert {k: v for k, v in shared.items() if v} == {}


def test_no_prompt_holds_an_evalbench_placeholder():
    # EvalBench expands ${VAR} anywhere in the evalset and fails the run on an unset one.
    assert "${" not in (ROOT / "datasets/continuation-propensity.evalset.json").read_text()


def test_evalbench_loads_the_evalset():
    from dataset.dataset import load_dataset_from_json
    loaded = load_dataset_from_json(str(ROOT / "datasets/continuation-propensity.evalset.json"), {"dataset_format": "agent-format"})
    items = [i for group in loaded.values() for i in group]
    assert len(items) == 1
    assert [s["id"] for s in json.loads(items[0].payload)["scenarios"]] == [s["id"] for s in load_scenarios()]
