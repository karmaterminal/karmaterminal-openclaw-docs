"""One turn's facts from recorded-shape rows, with the mistakes each rule exists to prevent as controls."""
import copy

import pytest
from conftest import rows_of

from openclaw_evalbench.transcript import TranscriptError, read_turn


def read(turn_id):
    return read_turn(rows_of(turn_id), "the prompt", "run-1")


def test_a_direct_election():
    turn = read("election-work")
    assert turn["elected"] is True
    assert turn["elections"] == [{"tool": "continue_work", "dispatched": False, "status": "scheduled", "answered": True, "isError": False}]
    assert turn["reply"].startswith("It isn't there yet. I'll look again")
    assert turn["discovery"] == {"searches": 0, "firstCallIsSearch": False, "searchBeforeElection": False, "queries": []}


def test_tool_search_then_election_through_the_dispatcher():
    turn = read("search-then-work")
    assert [e["tool"] for e in turn["elections"]] == ["continue_work"]
    assert turn["elections"][0]["dispatched"] is True
    assert turn["elections"][0]["status"] == "scheduled"  # read out of the { tool, result } envelope
    assert turn["discovery"] == {"searches": 1, "firstCallIsSearch": True, "searchBeforeElection": True,
                                 "queries": ["schedule my own follow-up turn later"]}


def test_control_a_raw_name_reader_misses_a_dispatched_election():
    raw = [p["name"] for r in rows_of("search-then-work") if r["role"] == "assistant" for p in r["content"] if p["type"] == "toolCall"]
    assert "continue_work" not in raw


def test_batch_search_queries_and_a_bare_name_dispatch():
    turn = read("search-then-delegate")
    assert turn["discovery"]["queries"] == ["run work in another session", "delay a task"]
    assert turn["elections"][0]["tool"] == "continue_delegate" and turn["elections"][0]["status"] == "scheduled"


@pytest.mark.parametrize("turn_id", ["no-election", "exec-no-election", "spawn-no-election", "search-no-election", "control-clean"])
def test_no_election(turn_id):
    turn = read(turn_id)
    assert turn["elected"] is False and turn["elections"] == []


def test_a_promise_in_the_reply_is_not_an_election():
    assert "I'll keep an eye on it" in read("no-election")["reply"]


def test_a_search_without_an_election_is_not_a_search_before_one():
    assert read("search-no-election")["discovery"] == {"searches": 1, "firstCallIsSearch": True, "searchBeforeElection": False, "queries": ["reminder"]}


def test_control_false_election():
    turn = read("control-false-election")
    assert turn["elected"] is True and turn["elections"][0]["status"] == "scheduled"


def test_the_bracket_form_is_recorded_and_not_counted():
    turn = read("token-form")
    assert turn["elected"] is False
    assert turn["tokenForm"] == {"continue_work": True, "continue_delegate": False}


def test_a_refused_call_is_an_election_the_product_did_not_accept():
    turn = read("election-refused")
    assert turn["elected"] is True and turn["elections"][0]["status"] == "rejected"


def test_a_later_turns_call_is_not_this_turns():
    rows = rows_of("woke-before-read")
    assert read_turn(rows, "the prompt", "run-1")["elected"] is False
    # Control: the same rows without the wake boundary do carry an election.
    assert read_turn([r for i, r in enumerate(rows) if i == 0 or r["role"] != "user"], "the prompt", "run-1")["elected"] is True


def test_a_row_of_the_same_run_after_a_steering_row_still_counts():
    rows = rows_of("no-election")
    rows.append({"role": "user", "content": "a note injected mid-run"})
    rows += rows_of("election-work")[1:]  # same run id
    assert read_turn(rows, "the prompt", "run-1")["elected"] is True


def test_a_namespaced_tool_name_is_its_tool():
    rows = rows_of("election-work")
    rows[1]["content"][1]["name"] = "openclaw_direct__continue_work"
    rows[2]["toolName"] = "openclaw_direct__continue_work"
    turn = read_turn(rows, "the prompt", "run-1")
    assert turn["elections"] == [{"tool": "continue_work", "dispatched": False, "status": "scheduled", "answered": True, "isError": False}]


@pytest.mark.parametrize("name", ["continue_work_later", "my_continue_work", "dispatch_action"])
def test_a_lookalike_is_not_a_continuation_tool(name):
    rows = rows_of("election-work")
    rows[1]["content"][1]["name"] = name
    assert read_turn(rows, "the prompt", "run-1")["elected"] is False


def test_an_envelope_for_another_tool_gives_no_status_but_the_call_stands():
    rows = rows_of("search-then-work")
    row = next(r for r in rows if r.get("toolName") == "dispatch_action")
    row["content"][0]["text"] = row["content"][0]["text"].replace("openclaw:core:continue_work", "mcp:x:continue_work")
    turn = read_turn(rows, "the prompt", "run-1")
    assert turn["elected"] is True and turn["elections"][0]["status"] is None


def test_usage_sums_every_assistant_row_and_counts_cache_reads():
    turn = read("election-work")
    assert turn["usage"] == {"input": 1400, "output": 120, "cacheRead": 49200, "cacheWrite": 0, "total": 50720}
    assert turn["modelCalls"] == 2 and turn["servedModels"] == ["openai/gpt-5.6-sol"]


def test_served_model_reads_a_fallback_and_a_dated_snapshot():
    rows = rows_of("control-clean")
    rows[1]["responseModel"] = "gpt-5.6-sol-2026-08-01"
    assert read_turn(rows, "the prompt")["servedModels"] == ["openai/gpt-5.6-sol"]
    rows[1]["responseModel"] = "gpt-5.6-terra"
    assert read_turn(rows, "the prompt")["servedModels"] == ["openai/gpt-5.6-terra"]


def test_a_transcript_only_row_serves_no_model():
    rows = rows_of("control-clean")
    rows.append({"role": "assistant", "provider": "openclaw", "model": "delivery-mirror", "content": [{"type": "text", "text": "391"}]})
    assert read_turn(rows, "the prompt")["servedModels"] == ["openai/gpt-5.6-sol"]


@pytest.mark.parametrize("change, message", [
    (lambda rows: [], "0 user rows"),
    (lambda rows: rows[:1], "no assistant row"),
    (lambda rows: rows + [copy.deepcopy(rows[0])], "2 user rows"),
    (lambda rows: [{"role": "user", "content": "someone was here before"}] + rows, "not a fresh session"),
])
def test_rows_that_cannot_show_the_turn_are_refused_not_read_as_no_election(change, message):
    with pytest.raises(TranscriptError, match=message):
        read_turn(change(rows_of("control-clean")), "the prompt", "run-1")


def test_an_omitted_assistant_row_is_refused():
    rows = rows_of("no-election")
    rows[1]["__openclaw"] = {"truncated": True, "reason": "oversized"}
    with pytest.raises(TranscriptError, match="oversized"):
        read_turn(rows, "the prompt", "run-1")
