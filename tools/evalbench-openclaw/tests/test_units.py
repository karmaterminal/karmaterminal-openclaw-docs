"""Stopping a real systemd user unit, and what outlives it. No OpenClaw here: the units run fakes, under names of their own.

These need a reachable systemd user manager, as a proof gateway does. Without one they are skipped, and say so.
"""
import asyncio
import hashlib
import json
import os
import pathlib
import secrets
import socket
import subprocess
import sys
import time

import pytest
from test_supervisor import W, limits, trial
from test_supervisor import job as arm_job

from openclaw_evalbench import supervision as S
from openclaw_evalbench import units as U
from openclaw_evalbench.arms import load_arms
from openclaw_evalbench.supervisor import stop_everything

MANAGER = U.systemctl("show", "--property=Version").returncode == 0
needs_manager = pytest.mark.skipif(not MANAGER, reason="no systemd user manager")


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def run_unit(name, *argv, setenv=None, properties=(), scope=False):
    done = subprocess.run(["systemd-run", "--user", "--quiet", "--no-ask-password", f"--unit={name}", *(["--scope"] if scope else []),
                           *(f"--property={p}" for p in properties), *(f"--setenv={k}={v}" for k, v in (setenv or {}).items()), "--", *argv],
                          capture_output=True, text=True, timeout=20, check=False)
    assert done.returncode == 0, done.stderr


def active(name):
    return U.systemctl("is-active", "--quiet", name).returncode == 0


# A gateway's shape: it listens, ignores SIGTERM, and has a child that tried to get away from it.
GATEWAY = """
import os, signal, socket, subprocess, sys, time
signal.signal(signal.SIGTERM, signal.SIG_IGN)
s = socket.socket(); s.bind(("127.0.0.1", int(sys.argv[1]))); s.listen()
subprocess.Popen(["setsid", "nohup", "sleep", "3600"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(3600)
"""


class Proof:
    """An isolated gateway's units and directory, all of them this test's own."""

    def __init__(self, tmp_path):
        self.unit = f"openclaw-proof-comp-{secrets.token_hex(4)}"
        self.directory = tmp_path / "proof-gw" / self.unit.removeprefix("openclaw-proof-")
        (self.directory / "state/processes").mkdir(parents=True)
        self.port, self.started = free_port(), []
        self.environment = {"OPENCLAW_STATE_DIR": self.directory / "state", "OPENCLAW_CONFIG_PATH": self.directory / "openclaw.json"}

    def start(self, argv=None, *, environment=None, properties=("Restart=no", "TimeoutStopSec=330"), listen=True):
        self.started.append(f"{self.unit}.service")
        run_unit(self.unit, *(argv or [sys.executable, "-c", GATEWAY, str(self.port)]), setenv=self.environment if environment is None else environment, properties=properties)
        end = time.monotonic() + 10
        while listen and time.monotonic() < end:
            with socket.socket() as s:
                if s.connect_ex(("127.0.0.1", self.port)) == 0:
                    return self
            time.sleep(0.02)
        return self

    def durable(self, directory=None):
        """A durable exec as the product launches one (openclaw ab5a30ea src/agents/bash-process-systemd.ts:119-152)."""
        name = f"openclaw-proc-{hashlib.sha256(os.urandom(16)).hexdigest()}.service"
        self.started.append(name)
        log = (directory or self.directory) / "state/processes" / f"{secrets.token_hex(4)}.log"
        log.parent.mkdir(parents=True, exist_ok=True)
        run_unit(name, "sleep", "3600", properties=("Type=exec", "ExitType=cgroup", "RemainAfterExit=yes", "KillMode=control-group", "TimeoutStopSec=10s",
                                                    "StandardInput=null", f"StandardOutput=append:{log}", "StandardError=inherit"))
        return name

    def of(self):
        return U.SystemdUnit(self.unit, self.port, self.directory)

    def close(self):
        for name in self.started:
            U.systemctl("kill", "--signal=SIGKILL", name)
            U.systemctl("stop", name)
            U.systemctl("reset-failed", name)


@pytest.fixture
def proof(tmp_path):
    it = Proof(tmp_path)
    yield it
    it.close()


@needs_manager
def test_a_proof_gateways_unit_is_verified(proof):
    receipt = proof.start().of().verify()
    assert receipt["unit"] == proof.unit and receipt["mainPid"] > 0 and receipt["port"] == proof.port


@needs_manager
@pytest.mark.parametrize("change, message", [
    ({"environment": {}}, "its OPENCLAW_STATE_DIR is not"),
    ({"properties": ("Restart=on-failure",)}, "it would restart"),
    ({"properties": ("Restart=no", "KillMode=process")}, "a stop would not end its whole cgroup"),
    ({"argv": ["sleep", "3600"], "listen": False}, "no process of it listens"),
])
def test_a_unit_a_stop_would_not_end_is_refused(proof, change, message):
    proof.start(**change)
    with pytest.raises(U.UnitRefused, match=message):
        proof.of().verify()


@needs_manager
def test_a_unit_that_is_not_running_or_already_owns_something_is_refused(proof):
    with pytest.raises(U.UnitRefused, match="is not running"):
        proof.of().verify()
    name = proof.start().durable()
    with pytest.raises(U.UnitRefused, match=name):
        proof.of().verify()


@pytest.mark.parametrize("unit", ["openclaw-gateway", "openclaw-proof-comp-ab5a30ea.service", "openclaw-proof-comp-ab5a30e", "openclaw-proof-comp-ab5a30ea-login", "", None, "x"])
def test_only_a_proof_gateways_name_is_a_target(unit):
    with pytest.raises(U.UnitRefused, match="not a proof gateway's unit name"):
        U.SystemdUnit(unit, 1)


def test_the_live_gateways_state_is_never_a_target():
    for directory in ("~/.openclaw", "~/.openclaw/state", "relative"):
        with pytest.raises(U.UnitRefused, match="not an isolated gateway's directory"):
            U.SystemdUnit("openclaw-proof-comp-ab5a30ea", 1, pathlib.Path(directory).expanduser())


def test_a_live_plan_names_each_arms_own_unit_as_the_launcher_derives_it():
    arms = load_arms()
    urls = {n: f"ws://127.0.0.1:{a['gatewayPort']}" for n, a in arms["arms"].items()}
    seen = S.systemd_units(arms, urls)
    label = lambda text: hashlib.sha1(text.encode()).hexdigest()[:8]
    a, c = arms["arms"]["A"]["productSha"], arms["arms"]["C"]["productSha"]
    short = {"A": a[:8], "B": label(f"openclaw#1575 arm B of {a}"), "C": c[:8], "D": label(f"openclaw#1575 arm D of {c}")}
    for name, spec in seen.items():
        assert spec == {"kind": "systemd", "unit": f"openclaw-proof-comp-{short[name]}", "port": arms["arms"][name]["gatewayPort"],
                        "directory": str(pathlib.Path("~/proof-gw").expanduser() / f"comp-{short[name]}")}
        U.SystemdUnit(spec["unit"], spec["port"], spec["directory"])


@needs_manager
def test_a_stop_ends_the_cgroup_and_the_durable_exec_that_outlives_it(proof, tmp_path):
    unit = proof.start().of()
    unit.verify()
    pids = unit.processes()
    durable = [proof.durable(), proof.durable()]
    bystander = proof.durable(tmp_path / "proof-gw/comp-00000000")
    # Commands a turn moved out of the cgroup: one that names the gateway's directory, one that names its unit, a scope that
    # does (as process.childScope makes them, without the binding that would end it), and a process in no unit of its own.
    stray, named, scope = (f"openclaw-evaltest-{secrets.token_hex(4)}.{kind}" for kind in ("service", "service", "scope"))
    proof.started += [stray, named, scope]
    run_unit(stray, "sleep", "3600", setenv=proof.environment)
    run_unit(named, "sleep", "3600", setenv={"OPENCLAW_SYSTEMD_UNIT": f"{proof.unit}.service"})
    subprocess.Popen(["systemd-run", "--user", "--quiet", "--scope", f"--unit={scope}", f"--property=After={proof.unit}.service", "--", "sleep", "3600"])
    loose = subprocess.Popen(["sleep", "3600"], env={**os.environ, **{k: str(v) for k, v in proof.environment.items()}})
    other = subprocess.Popen(["sleep", "3600"], env={**os.environ, "OPENCLAW_STATE_DIR": f"{proof.environment['OPENCLAW_STATE_DIR']}-2"})
    end = time.monotonic() + 5
    while not active(scope) and time.monotonic() < end:
        time.sleep(0.02)
    assert len(pids) >= 2 and all(active(n) for n in (*durable, bystander, stray, named, scope))
    # The trap: stopping the gateway's own unit leaves the durable exec running.
    U.systemctl("kill", "--signal=SIGKILL", f"{proof.unit}.service")
    end = time.monotonic() + 5
    while active(f"{proof.unit}.service") and time.monotonic() < end:
        time.sleep(0.02)
    assert not active(f"{proof.unit}.service") and all(active(n) for n in durable)
    result = unit.stop()
    assert result["stopped"] is True and result["problems"] == [] and set(durable) <= set(result["durableUnits"]), result
    assert not any(active(n) for n in (*durable, stray, named, scope)) and all(U.process_start(p) is None for p in pids)
    assert loose.wait(5) == -9 and result["strayProcesses"] >= 1
    assert active(bystander) and other.poll() is None, "another gateway's durable exec, and process, are not touched"
    other.kill()
    other.wait()


@needs_manager
def test_a_stop_is_quick_for_a_gateway_that_ignores_sigterm(proof):
    unit = proof.start().of()
    unit.verify()
    durable, started = proof.durable(), time.monotonic()
    result = unit.stop()
    assert result["stopped"] and result["killSeconds"] < 1.0 and result["goneSeconds"] < 2.0 and time.monotonic() - started < 6.0, result
    assert not active(f"{proof.unit}.service") and not active(durable) and not unit.alive()
    assert unit.stop()["stopped"] is True, "stopping twice is harmless"


@needs_manager
def test_a_trials_end_sweeps_its_durable_exec_and_leaves_the_gateway_running(proof):
    unit = proof.start().of()
    unit.verify()
    durable, pids = proof.durable(), unit.processes()
    swept = unit.sweep()
    assert swept == {"clean": True, "units": [durable], "processes": swept["processes"]} and not active(durable)
    assert unit.alive() and unit.processes() == pids and active(f"{proof.unit}.service")


@needs_manager
def test_a_gateway_a_supervisor_stopped_is_never_verified_again(proof):
    unit = proof.start().of()
    unit.verify()
    assert unit.mark_stopped({"rule": "trial-tokens"}) is None
    with pytest.raises(U.UnitRefused, match="a supervisor stopped it before"):
        proof.of().verify()
    assert S.stopped_before({"A": {"kind": "systemd", "directory": str(proof.directory)}}) == [str(proof.directory)]


# --- the whole arrangement, as `run` launches it ---------------------------------------------------------------------------

def live_fake(proof, turns):
    """A fake gateway inside a proof gateway's unit, where a stop is systemd's."""
    spec = proof.directory / "fake.json"
    answer = proof.directory / "answer.json"
    spec.write_text(json.dumps({"arm": "C", "tokenFile": str(proof.directory / "gateway.token"), "plan": turns, "overrides": None, "arms": None, "answerFile": str(answer)}))
    environment = {**proof.environment, "PYTHONPATH": os.environ["PYTHONPATH"], "PYTHONDONTWRITEBYTECODE": "1"}
    proof.start([sys.executable, "-m", "openclaw_evalbench.fake_gateway", str(spec)], environment=environment, listen=False)
    end = time.monotonic() + 15
    while not answer.exists() and time.monotonic() < end:
        time.sleep(0.02)
    time.sleep(0.05)
    return json.loads(answer.read_text())["url"]


def live_plan(proof, tmp_path, url, **changes):
    private = tmp_path / "private"
    private.mkdir(mode=0o700)
    return S.make_plan(private, offline=False, limits=limits(**changes), urls={"C": url}, token_files={"C": proof.directory / "gateway.token"},
                       units={"C": {"kind": "systemd", "unit": proof.unit, "port": int(url.rsplit(":", 1)[1]), "directory": str(proof.directory)}})


@pytest.fixture
def live(proof, monkeypatch):
    """launch_live, allowed for this test's own units, and cleaned up after."""
    started = []

    def systemd_run(argv):
        started.extend(a.removeprefix("--unit=") for a in argv if a.startswith("--unit="))
        done = subprocess.run(argv, capture_output=True, text=True, timeout=30, check=False)
        if done.returncode:
            raise S.SupervisorError(done.stderr)
    monkeypatch.setattr(S, "_systemd_run", systemd_run)
    yield started
    for name in started:
        U.systemctl("stop", f"{name}.timer", f"{name}.service")


@needs_manager
def test_the_supervisor_stops_a_runaway_unit_and_its_durable_exec(proof, live, tmp_path):
    url = live_fake(proof, {W: ["runaway-loop"]})
    path, plan = live_plan(proof, tmp_path, url)

    async def go():
        it = await S.Supervision.start(path, plan, S.launch_live)
        fakes = {"C": {"url": url, "tokenFile": plan["arms"]["C"]["tokenFile"]}}
        work = arm_job(load_arms(), "C", it, fakes)
        # Started by the turn, once the trial runs: arming refuses a gateway that already owns one.
        running = asyncio.ensure_future(trial(work, fakes))
        await asyncio.sleep(0.1)
        durable = await asyncio.to_thread(proof.durable)
        record = await running
        return record, durable, await it.finish()
    record, durable, summary = asyncio.run(go())
    stop = summary["receipt"]["arms"]["C"]["stop"]
    assert stop["rule"] == "trial-tokens" and stop["result"]["stopped"] is True and stop["result"]["durableUnits"] == [durable], stop
    assert record["status"] == "supervisor_stopped" and record["cleanup"]["ok"] is False
    assert not active(f"{proof.unit}.service") and not active(durable)
    marker = json.loads((proof.directory / U.STOP_MARKER).read_text())
    assert marker["rule"] == "trial-tokens" and "agent:" not in json.dumps(marker)
    assert not active(f"{plan['deadman']}.timer"), "every unit is stopped, so the timer is too"
    # Neither half of the arrangement ran in this process's own cgroup.
    assert [n.rsplit("-", 1)[0] for n in live] == ["openclaw-evalprop-deadman", "openclaw-evalprop-supervisor"]


@needs_manager
def test_the_timer_stops_the_unit_when_both_processes_are_dead(proof, live, tmp_path, monkeypatch):
    monkeypatch.setattr(S, "DEADMAN_MARGIN_SECONDS", 3)
    url = live_fake(proof, {W: ["runaway-slow"]})
    path, plan = live_plan(proof, tmp_path, url, run_seconds=1)
    S.launch_live(path, plan)
    supervisor = next(n for n in live if "supervisor" in n)
    U.systemctl("kill", "--signal=SIGKILL", f"{supervisor}.service")
    durable = proof.durable()
    assert active(f"{proof.unit}.service")
    end = time.monotonic() + 15
    while (active(f"{proof.unit}.service") or active(durable)) and time.monotonic() < end:
        time.sleep(0.05)
    assert not active(f"{proof.unit}.service") and not active(durable), "the timer needs no one"
    S.remove_socket(plan)


@needs_manager
def test_a_refusal_to_arm_leaves_no_timer_behind(proof, live, tmp_path):
    url = live_fake(proof, {})
    proof.durable()
    path, plan = live_plan(proof, tmp_path, url)
    with pytest.raises(S.SupervisorError, match="it already owns"):
        asyncio.run(S.Supervision.start(path, plan, S.launch_live))
    assert active(f"{proof.unit}.service") and not active(f"{plan['deadman']}.timer")


@needs_manager
def test_stop_everything_stops_a_real_unit(proof, tmp_path):
    url = live_fake(proof, {})
    durable = proof.durable()
    _, plan = live_plan(proof, tmp_path, url)
    assert stop_everything(plan)["C"]["stopped"] is True
    assert not active(f"{proof.unit}.service") and not active(durable)
    S.remove_socket(plan)


def test_the_plan_and_the_units_environment_hold_no_token(tmp_path, monkeypatch):
    from openclaw_evalbench.supervisor import systemd_environment
    (tmp_path / "token").write_text("s3cret")
    monkeypatch.setenv("OPENCLAW_EVAL_TOKEN_FILE_C", str(tmp_path / "token"))
    monkeypatch.setenv("GH_TOKEN", "s3cret")
    _, plan = S.make_plan(tmp_path, offline=False, limits=limits(), urls={"C": "ws://127.0.0.1:1"}, token_files={"C": tmp_path / "token"}, units={"C": {}})
    assert "s3cret" not in json.dumps(plan) + json.dumps(systemd_environment()) and (tmp_path / "supervision-plan.json").stat().st_mode & 0o777 == 0o600
    S.remove_socket(plan)
