"""What CANARY-PACKET.md and README.md promise, against arms.json, the command line and a shell."""
import re
import shlex
import subprocess

import pytest
from conftest import ROOT

from openclaw_evalbench import __main__ as cli
from openclaw_evalbench.arms import load_arms, load_scenarios
from openclaw_evalbench.trial import TURN_DEADLINE_SECONDS

PACKET, README, REPORT = ((ROOT / name).read_text() for name in ("CANARY-PACKET.md", "README.md", "REPORT.md"))
ARMS = load_arms()
S, CAPS = ARMS["supervision"], ARMS["caps"]["set"]


def blocks(text):
    return re.findall(r"^ *```bash\n(.*?)^ *```", text, re.S | re.M)


def commands(text, name):
    """Every `./run.sh <name> …` command of a document's shell blocks, split into words."""
    joined = re.sub(r"\$\([^)]*\)", "NOW", "\n".join(blocks(text)).replace("\\\n", " "))
    return [shlex.split(line.strip())[2:] for line in joined.splitlines() if line.strip().startswith(f"./run.sh {name} ")]


# --- the arithmetic -----------------------------------------------------------------------------------------------------------

M = 1_000_000
CALL_SECONDS, CALL = 5, 160_000
# The most one call carries on this route: the 500 k budget its input is checked against (by an estimate), and the model's
# 128 k of output, which no request limits (CANARY-PACKET.md, What nothing here bounds).
ROUTE_CALL = 500_000 + 128_000
# The most the provider itself takes in one call, if the product's estimate were off that far: the model's window, and its output.
PROVIDER_CALL = 1_050_000 + 128_000


def calls(seconds, call_seconds=CALL_SECONDS):
    """Calls one lane can spend in this long: one finishing at once, one for each whole call after it, and the one in flight."""
    return 1 + int(seconds // call_seconds) + 1


# From the last sample under the limit to the kill: the rest of that reading, the pause, the whole next reading, the aborts.
POLL = 2 * S["readSeconds"] + S["pollSeconds"] + S["abortSeconds"]
BLIND = S["readSeconds"] + S["blindSeconds"] + S["abortSeconds"] + 0.5     # 0.5 s for the tick and the kill
# The turn and its one child: what the product's admission leaves a trial (probes/receipts). The supervisor stops a third.
LANES = ARMS["caps"]["set"]["agents.defaults.maxConcurrent"] + ARMS["caps"]["set"]["agents.defaults.subagents.maxChildrenPerAgent"]
TRIAL, RUN, ARMS_IN_CANARY = S["trialTokens"], S["canary"]["tokens"], 3


def trial(call, call_seconds=CALL_SECONDS, window=BLIND):
    return TRIAL + LANES * calls(window, call_seconds) * call


def canary(call, call_seconds=CALL_SECONDS, window=BLIND):
    return min(9 * trial(call, call_seconds, window), RUN + ARMS_IN_CANARY * LANES * calls(window, call_seconds) * call)


def lane(call, call_seconds):
    return calls(BLIND, call_seconds) * call


def test_the_limits_are_the_multiples_the_packet_gives():
    assert TRIAL == pytest.approx(1.5 * 6 * 60_000 * 1.3, rel=0.01) and RUN == pytest.approx(1.5 * 1.6 * M)
    assert (POLL, BLIND, calls(POLL), calls(BLIND)) == (4.5, 12.5, 2, 4)
    flat = " ".join(PACKET.split())
    assert "within 12.5 s of the last reading under it, whatever the readings do; 4.5 s while every reading is on time" in flat


def test_the_admission_leaves_a_trial_two_lanes_and_the_supervisor_stops_a_third():
    assert LANES == 2 == S["maxActiveRuns"]


def test_160k_a_call_is_the_largest_call_of_a_trial_that_reaches_its_limit_one_tool_result_at_a_time():
    context, total = 60_000, 0
    while total + context < TRIAL:
        total, context = total + context, context + 16_000
    assert context == 156_000 <= CALL


@pytest.mark.parametrize("value_trial, value_canary, row", [
    (trial(CALL), canary(CALL), "| 5 s and 160 k a call (the packet at `d78d1614`) | 1.98 M | 6.24 M |"),
    (trial(375_000), canary(375_000), "| 3.7 M | 11.4 M |"),
    (trial(ROUTE_CALL), canary(ROUTE_CALL), "| **5.7 M** | **17.5 M** |"),
    (trial(ROUTE_CALL, 2), canary(ROUTE_CALL, 2), "| the same at 2 s a call | 10.7 M | 32.5 M |"),
    (trial(ROUTE_CALL, 1), canary(ROUTE_CALL, 1), "| the same at 1 s a call | **18.3 M** | **55 M** |"),
    (trial(ROUTE_CALL, window=POLL), canary(ROUTE_CALL, window=POLL), "| 3.2 M | 9.9 M |"),
    (trial(PROVIDER_CALL), canary(PROVIDER_CALL), "if the product's estimate is off that far | 10.1 M | 30.7 M |"),
    (trial(PROVIDER_CALL, 1), canary(PROVIDER_CALL, 1), "| the same at 1 s a call | **33.7 M** | **101 M** |"),
])
def test_the_conditional_numbers_are_arms_jsons_on_their_assumptions(value_trial, value_canary, row):
    shown = [float(n) * M for n in re.findall(r"([\d.]+) M", row)]
    assert shown == [pytest.approx(value_trial, abs=0.05 * M), pytest.approx(value_canary, abs=0.5 * M)] and row in PACKET


def test_each_lane_a_turn_opens_adds_what_the_packet_says():
    assert [round(lane(ROUTE_CALL, s) / M, 1) for s in (5, 2, 1)] == [2.5, 5.0, 8.8]
    assert "+ 2.5 M at 5 s, 5.0 M at 2 s, 8.8 M at 1 s" in PACKET and "adds 2.5–8.8 M to its trial" in PACKET
    residual = PACKET.split("### The residual")[1].split("\n### ")[0]
    assert "5.7–18.3 M for one trial and 17.5–55 M for the" in " ".join(residual.split())


def test_no_number_of_tokens_is_called_enforced():
    top = PACKET.split("## Commands")[0]
    row = next(line for line in top.splitlines() if line.startswith("| enforced, whatever the provider or model does |"))
    assert "**No number of tokens.**" in row and not re.search(r"\d M\b", row)
    assert "| conditional: estimates, each on a named assumption |" in top and "**nothing bounds how many it opens**" in top
    enforced = PACKET.split("### Enforced")[1].split("\n### ")[0]
    bounds = [line.split("|")[2] for line in enforced.splitlines() if line.startswith("| ") and not line.startswith(("| what |", "| --- |"))]
    assert len(bounds) == 10 and not [b for b in bounds if re.search(r"\d M\b|tokens", b)]
    assert "No number of tokens is enforced." in PACKET and "**No number of tokens is enforced, for a trial or for the canary.**" in REPORT
    for text in (PACKET, README, REPORT):
        flat = " ".join(text.split())
        assert "whatever its readings do" not in flat and "bounded by something that runs" not in flat


def test_the_provider_window_case_is_in_the_headline_and_the_residual():
    for text in (PACKET.split("## Commands")[0], PACKET.split("### The residual")[1]):
        assert "10.1–33.7 M" in " ".join(text.split()) and "30.7–101 M" in " ".join(text.split())
    assert "1,050,000 in (`extensions/openai/openclaw.plugin.json:124`)" in " ".join(PACKET.split())


def test_the_old_most_context_case_is_reconciled():
    flat = " ".join(PACKET.split())
    assert "The 3.7 M and 11.4 M were too low for this route." in flat and "So 628 k replaces 375 k." in flat
    assert ROUTE_CALL == 628_000 and "128,000 (`extensions/openai/openclaw.plugin.json:126`)" in flat
    assert "500,000 (`extensions/openai/model-route-contract.ts:2`)" in flat


@pytest.mark.parametrize("shown", ["700,000 metered tokens, 480 s", "| 150,000 metered tokens |", "| active or queued runs on one gateway | 2 |",
                                   "| 10 s (it reads every 1 s, and a reading has 1.5 s) |", "4 times in a row, 30 s apart", "2,400,000 and 1800 s unless told otherwise"])
def test_the_readmes_limits_are_arms_jsons(shown):
    assert shown in README
    numbers = {float(n.replace(",", "")) for n in re.findall(r"\d[\d,]*(?:\.\d+)?", shown)}
    assert numbers <= {float(v) for v in (*(S[k] for k in S if k != "canary"), *S["canary"].values())}


def test_every_cap_is_in_both_documents_with_its_value():
    table = {row[0]: row[1] for row in re.findall(r"^\| (`[^|]+`) \| ([^|]+) \| [^|]+\|$", README, re.M)}
    named = {}
    for cell, value in table.items():
        keys = re.findall(r"`([^`]+)`", cell)
        for key, one in zip(keys, value.strip("`").split(", ") if len(keys) > 1 else [value.strip("` ")]):
            named[key if not key.startswith(".") else keys[0].rsplit(".", 1)[0] + key] = one
    shown = lambda v: "false" if v is False else "true" if v is True else '""' if v == "" else str(v)
    assert {k: v for k, v in named.items() if k in CAPS} == {k: shown(v) for k, v in CAPS.items()}
    section = PACKET.split("### Product caps")[1].split("\n## ")[0]
    assert all(key.rsplit(".", 1)[1] in section for key in CAPS)


def test_the_documents_name_the_turn_deadline():
    assert TURN_DEADLINE_SECONDS == 300 and "| one trial | 300 s, then `sessions.abort` |" in README and "The harness stops it at 300 s" in PACKET


# --- the commands ---------------------------------------------------------------------------------------------------------------

@pytest.mark.parametrize("name", ["CANARY-PACKET.md", "README.md", "REPORT.md"])
def test_every_shell_block_parses(name):
    for block in blocks((ROOT / name).read_text()):
        block = re.sub(r"<[a-z][^<>\n]*>", "PLACEHOLDER", block)
        done = subprocess.run(["bash", "-n"], input=block, capture_output=True, text=True, check=False)
        assert done.returncode == 0, (done.stderr, block[:200])


def parsed(words, monkeypatch, command="cmd_run"):
    seen = []
    monkeypatch.setattr(cli, command, lambda args: seen.append(args) or 0)
    assert cli.main(words) == 0
    return seen[0]


def test_the_packets_run_is_nine_trials_at_the_canarys_limits(monkeypatch):
    (words,) = commands(PACKET, "run")
    args = parsed(["run", *words], monkeypatch)
    assert (args.run_token_cap, args.run_seconds, args.token_budget) == (RUN, S["canary"]["seconds"], 800_000)
    assert args.arms == ["A", "B", "C"] and args.num_trials == 1 and len(args.scenarios) == 3
    kinds = {s["id"]: s["kind"] for s in load_scenarios()}
    assert sorted(kinds[s] for s in args.scenarios) == ["control", "eligible", "eligible"]


def test_a_run_told_nothing_has_the_canarys_limits_and_the_fires_are_said(monkeypatch):
    canary, fire = (parsed(["run", *w], monkeypatch) for w in commands(README, "run")[:2])
    assert (canary.run_token_cap, canary.run_seconds) == (RUN, S["canary"]["seconds"])
    assert (fire.run_token_cap, fire.run_seconds) == (cli.FULL_RUN_TOKENS, cli.FULL_RUN_SECONDS)
    silent = parsed(["run", "--out", "x"], monkeypatch)
    assert (silent.run_token_cap, silent.run_seconds) == (RUN, S["canary"]["seconds"])


def test_the_emergency_stop_names_every_default_arms_unit():
    block = next(b for b in blocks(PACKET) if "kill --signal=SIGKILL" in b)
    for name in "ABC":
        assert ARMS["arms"][name]["unit"] in block and ARMS["arms"][name]["unit"].rsplit("-", 1)[1] in block.split("\n", 1)[1]


LAUNCHER = """#!/usr/bin/env bash
echo "$PORT $1 ${2:0:8}" >> "$HOME/launcher.log"
d=$HOME/proof-gw/comp-${2:0:8}
[ "$1" != shred ] || rm -rf "$d/state" "$d/gateway.token"
"""


def test_step_6_removes_a_gateway_the_supervisor_stopped_and_keeps_its_receipts(tmp_path):
    block = next(b for b in blocks(PACKET) if b.lstrip().startswith("finish()"))
    function = block[:block.index("\n}\n") + 3]
    for name in ("ab5a30ea", "706a2c56"):
        (tmp_path / f"proof-gw/comp-{name}/receipts").mkdir(parents=True)
        (tmp_path / f"proof-gw/comp-{name}/state").mkdir()
        (tmp_path / f"proof-gw/comp-{name}/receipts/identity.json").write_text("{}")
        (tmp_path / f"proof-gw/comp-{name}/receipts/login.log").write_text("a device code")
    (tmp_path / "proof-gw/comp-ab5a30ea/supervisor-stop.json").write_text('{"rule": "trial-tokens"}')
    (tmp_path / "L").write_text(LAUNCHER)
    (tmp_path / "rec").mkdir()
    script = function + 'finish A 20846 ab5a30ea x; finish B 20966 706a2c56 x; finish C 21086 f9fcd3a5 x\n'
    done = subprocess.run(["bash"], input=script, capture_output=True, text=True, check=False, env={"PATH": "/usr/bin:/bin", "HOME": str(tmp_path), "REC": str(tmp_path / "rec"), "L": str(tmp_path / "L")})
    assert done.stdout.splitlines() == ["A: removed", "B: removed", "C: no gateway"], done.stderr
    assert not (tmp_path / "proof-gw/comp-ab5a30ea").exists() and not (tmp_path / "proof-gw/comp-706a2c56").exists()
    assert (tmp_path / "rec/supervisor-stop-A.json").exists() and not (tmp_path / "rec/supervisor-stop-B.json").exists()
    assert (tmp_path / "rec/receipts-A/identity.json").exists() and not (tmp_path / "rec/receipts-A/login.log").exists()
    assert (tmp_path / "launcher.log").read_text().splitlines() == ["20846 stop ab5a30ea", "20846 shred ab5a30ea", "20966 stop 706a2c56", "20966 shred 706a2c56"]


# --- the hand-off ------------------------------------------------------------------------------------------------------------------

def test_the_ci_hand_off_links_the_receipts_and_waits_on_the_cut():
    section = PACKET.split("## CI handoff")[1]
    for run in ("45606214935", "45658851673", "45686079091"):
        assert f"[{run}](https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/{run})" in section
    assert "issuecomment-7170483613" in section and ARMS["arms"]["C"]["productSha"] in section
    assert "waits on 🌊's cut decision" in section and not re.search(r"\b(green|passed|clean|no reds|0 candidate)\b", section, re.I)
