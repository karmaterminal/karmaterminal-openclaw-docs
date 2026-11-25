"""What CANARY-PACKET.md and README.md promise, against arms.json, the command line and a shell."""
import re
import shlex
import subprocess

import pytest
from conftest import ROOT

from openclaw_evalbench import __main__ as cli
from openclaw_evalbench.arms import load_arms, load_scenarios
from openclaw_evalbench.trial import TURN_DEADLINE_SECONDS

PACKET, README = ((ROOT / name).read_text() for name in ("CANARY-PACKET.md", "README.md"))
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


def calls(seconds):
    """Calls one lane can spend in this long: one finishing at once, one for each whole call after it, and the one in flight."""
    return 1 + int(seconds // CALL_SECONDS) + 1


def growing(seconds, each=1_000, start=60_000):
    n = seconds // CALL_SECONDS
    return n * start + each * n * (n - 1) // 2


POLL = S["pollSeconds"] + 1 + S["abortSeconds"]            # 1 s to read
BLIND = S["blindSeconds"] + S["abortSeconds"] + 1          # 1 s for the tick and the kill
LANES = S["maxActiveRuns"]
OVER, OVER_BLIND = LANES * calls(POLL) * CALL, LANES * calls(BLIND) * CALL
TRIAL, RUN = S["trialTokens"], S["canary"]["tokens"]
PRODUCT = growing(CAPS["agents.defaults.timeoutSeconds"]) + growing(CAPS["agents.defaults.subagents.runTimeoutSeconds"])


def test_the_limits_are_the_multiples_the_packet_gives():
    assert TRIAL == pytest.approx(1.5 * 6 * 60_000 * 1.3, rel=0.01) and RUN == pytest.approx(1.5 * 1.6 * M)
    assert (POLL, BLIND, calls(POLL), calls(BLIND)) == (4, 12, 2, 4)


def test_160k_a_call_is_the_largest_call_of_a_trial_that_reaches_its_limit():
    context, total = 60_000, 0
    while total + context < TRIAL:
        total, context = total + context, context + 16_000
    assert context == 156_000 <= CALL


@pytest.mark.parametrize("value, shown", [
    (min(PRODUCT, TRIAL) + OVER, "min(7.8 M, 0.70 M) + 0.64 M = **1.34 M**"), (TRIAL + OVER_BLIND, "0.70 M + 1.28 M = 1.98 M"),
    (min(9 * (TRIAL + OVER), RUN + 3 * OVER), "min(9 × 1.34 M, 2.40 M + 3 × 0.64 M) = **4.32 M**"), (RUN + 3 * OVER_BLIND, "2.40 M + 3 × 1.28 M = 6.24 M"),
    (TRIAL + LANES * calls(BLIND) * 375_000, "2 × 4 × 375 k = **3.7 M**"), (RUN + 3 * LANES * calls(BLIND) * 375_000, "2.40 M + 3 × 3.0 M = **11.4 M**"),
])
def test_the_packets_numbers_are_arms_jsons(value, shown):
    printed = float(re.findall(r"([\d.]+) M", shown)[-1]) * M
    assert printed == pytest.approx(value, rel=0.002) and shown in PACKET


def test_the_product_caps_alone_bound_a_trial_at_what_the_packet_says():
    assert PRODUCT == pytest.approx(7.8 * M, rel=0.01) and 9 * PRODUCT == pytest.approx(70 * M, rel=0.01)
    assert "| 7.8 M | **0.70 M** |" in PACKET and "| 70 M | **2.40 M** |" in PACKET


def test_expected_and_enforced_are_separate_columns():
    header = next(line for line in PACKET.splitlines() if line.startswith("| | expected |"))
    assert [c.strip() for c in header.strip("|").split("|")][1:5] == ["expected", "product caps alone", "the supervisor's limit", "**enforced**: limit + one polling interval"]
    assert "**1.34 M** metered tokens for one trial, **4.32 M** for the canary" in PACKET.split("## Commands")[0]


@pytest.mark.parametrize("shown", ["700,000 metered tokens, 480 s", "| 150,000 metered tokens |", "| active runs on one gateway | 2 |",
                                   "| 10 s (it reads every 2 s) |", "2,400,000 and 1800 s unless told otherwise"])
def test_the_readmes_limits_are_arms_jsons(shown):
    assert shown in README
    numbers = {int(n.replace(",", "")) for n in re.findall(r"\d[\d,]*", shown)}
    assert numbers <= {S["trialTokens"], S["trialSeconds"], S["idleTokens"], S["maxActiveRuns"], S["blindSeconds"], S["pollSeconds"], *S["canary"].values()}


def test_every_cap_is_in_both_documents_with_its_value():
    table = {row[0]: row[1] for row in re.findall(r"^\| (`[^|]+`) \| ([^|]+) \| [^|]+\|$", README, re.M)}
    named = {}
    for cell, value in table.items():
        keys = re.findall(r"`([^`]+)`", cell)
        for key, one in zip(keys, value.strip("`").split(", ") if len(keys) > 1 else [value.strip("` ")]):
            named[key if not key.startswith(".") else keys[0].rsplit(".", 1)[0] + key] = one
    assert {k: v for k, v in named.items() if k in CAPS} == {k: ("false" if v is False else str(v)) for k, v in CAPS.items()}
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
