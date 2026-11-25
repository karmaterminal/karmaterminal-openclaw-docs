import pathlib
import sys

import pytest

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from openclaw_evalbench.arms import load_arms, load_scenarios  # noqa: E402
from openclaw_evalbench.fake_gateway import FakeGateway, load_turns  # noqa: E402

PROMPT = {s["id"]: s["starting_prompt"] for s in load_scenarios()}


@pytest.fixture
def arms():
    return load_arms()


def rows_of(turn_id, prompt="the prompt", run_id="run-1", provider="openai", model="gpt-5.6-sol"):
    """A fixture turn as chat.history rows, after the user row that started it."""
    from openclaw_evalbench.fake_gateway import _fill
    mapping = {"{{prompt}}": prompt, "{{runId}}": run_id, "{{provider}}": provider, "{{model}}": model}
    user = {"role": "user", "content": [{"type": "text", "text": prompt}], "__openclaw": {"runId": run_id}}
    return [user] + _fill(load_turns()[turn_id]["rows"], mapping)


def fake_gateway(arms, arm_name, plan, **kwargs):
    arm = arms["arms"][arm_name]
    return FakeGateway(arm, model=arms["model"], descriptions=arms["descriptions"][arm["descriptions"]]["tools"], plan=plan, **kwargs)
