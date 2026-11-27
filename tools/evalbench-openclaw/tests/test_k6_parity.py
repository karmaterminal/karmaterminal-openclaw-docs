"""The Python readers against the k6 harness's own, over the same rows: two implementations, one rule."""
import copy
import json
import pathlib
import shutil
import subprocess

import pytest
from conftest import MODEL, MODEL_ID, PROVIDER, rows_of

from openclaw_evalbench.arms import CONTINUATION_TOOLS
from openclaw_evalbench.fake_gateway import load_turns
from openclaw_evalbench.transcript import call_target, served_model, unwrap_result

SCRIPT = pathlib.Path(__file__).with_name("k6_parity.mjs")


def k6(rows):
    node = shutil.which("node")
    assert node, "node is needed for the parity check"
    done = subprocess.run([node, str(SCRIPT)], input=json.dumps(rows), capture_output=True, text=True, check=False)
    assert done.returncode == 0, done.stderr
    return json.loads(done.stdout)


def ours(rows):
    return [{"targets": [call_target(p) for p in r["content"]] if isinstance(r.get("content"), list) else [],
             "results": [unwrap_result(r, t) for t in CONTINUATION_TOOLS], "served": served_model(r)} for r in rows if r["role"] != "custom"]


@pytest.mark.parametrize("turn_id", sorted(load_turns()))
def test_fixture_turns_read_the_same(turn_id):
    # The k6 rows never had nested-tool rows; transcript.py reads those on its own.
    rows = [r for r in rows_of(turn_id) if r["role"] != "custom"]
    assert ours(rows) == k6(rows)


def test_hostile_rows_read_the_same():
    base = rows_of("search-then-work")
    call = next(p for r in base if r["role"] == "assistant" for p in r["content"] if p.get("name") == "dispatch_action")
    result = next(r for r in base if r.get("toolName") == "dispatch_action")
    parts = [
        {**call, "name": "tool_call"}, {**call, "name": " Dispatch_Action "}, {**call, "arguments": {"args": {}}},
        {**call, "arguments": {"id": "   "}}, {**call, "arguments": json.dumps(call["arguments"])}, {**call, "arguments": "not json"},
        {**call, "arguments": {"id": "mcp:server:continue_work", "args": {}}}, {**call, "arguments": {"id": "continue_work", "args": "x"}},
        {"type": "toolCall", "toolName": "continue_work", "input": {"reason": "r"}}, {"type": "toolCall"}, {"type": "text", "text": "continue_work"},
    ]
    rows = [{"role": "assistant", "provider": PROVIDER, "model": MODEL_ID, "content": parts}]
    envelope = json.loads(result["content"][0]["text"])
    def variant(change):
        value = copy.deepcopy(envelope)
        change(value)
        return {**result, "content": [{"type": "text", "text": json.dumps(value)}]}
    rows += [
        variant(lambda e: e["tool"].update(name="sessions_spawn")), variant(lambda e: e["tool"].update(id="openclaw:plugin:continue_work")),
        variant(lambda e: e["tool"].update(source="mcp")), variant(lambda e: e.update(result={"content": []})),
        variant(lambda e: e.update(result={"content": [{"type": "text", "text": json.dumps(envelope)}]})),
        {**result, "toolName": "continue_work"}, {**result, "toolName": "exec"}, {**result, "toolName": None},
        {**result, "content": [{"type": "text", "text": "plain words"}]}, {**result, "content": "plain words"},
        {**result, "content": [], "details": {"status": "scheduled"}},
        {"role": "toolResult", "toolCallId": "x", "toolName": "continue_work", "content": json.dumps({"status": "scheduled"})},
        {"role": "toolResult", "toolCallId": "x", "toolName": "ns__continue_work", "content": [], "details": {"status": "scheduled"}},
        {"role": "assistant", "provider": PROVIDER, "model": MODEL_ID, "responseModel": f"{MODEL_ID}-20260801", "content": []},
        {"role": "assistant", "provider": PROVIDER, "model": MODEL_ID, "responseModel": f"{MODEL_ID}-mini", "content": []},
        {"role": "assistant", "model": MODEL_ID, "content": []}, {"role": "assistant", "model": MODEL, "content": []},
    ]
    assert ours(rows) == k6(rows)
