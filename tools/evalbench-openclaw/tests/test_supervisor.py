"""The supervisor against gateways that run away. Every fake gateway here is a process of its own, and dies for real."""
import asyncio
import contextlib
import json
import os
import signal
import time

import pytest
from conftest import MODEL, PROMPT, ROOT, fake_gateway
from test_evalbench import rows

from openclaw_evalbench import __main__ as cli
from openclaw_evalbench.adapter import ArmJob
from openclaw_evalbench.arms import load_arms
from openclaw_evalbench.fake_gateway import launch_fakes
from openclaw_evalbench.gateway import GatewayClient, GatewayError
from openclaw_evalbench.meter import GatewayMeter, MeterError
from openclaw_evalbench.supervision import Supervision, SupervisorError, SupervisorStopped, launch_offline, limits_for, make_plan
from openclaw_evalbench.units import process_start

W, C = "w1-file-appears", "c1-arithmetic"
CALL = 60_000  # tokens of one call of the runaway fixtures
# Fast enough for a test, in the same proportions as arms.json.
QUICK = {"pollSeconds": 0.1, "readSeconds": 1.0, "blindSeconds": 2.0, "abortSeconds": 0.3, "silentSeconds": 3.0, "trialSeconds": 30}


def limits(**changes):
    return limits_for(load_arms(), **{"run_tokens": 50_000_000, "run_seconds": 120, **QUICK, **changes})


@contextlib.asynccontextmanager
async def supervised(tmp_path, turns, launch=launch_offline, stop_units=None, **changes):
    """Fake gateway processes and an armed supervisor process over them. `turns` is {arm: {prompt: [fixture, ...]}}."""
    private = cli._private(tmp_path)
    secrets = tmp_path / "secrets"
    secrets.mkdir()
    with launch_fakes(turns, secrets, plans=turns) as fakes:
        path, plan = make_plan(private, offline=True, limits=limits(**changes), urls={n: f["url"] for n, f in fakes.items()},
                               token_files={n: f["tokenFile"] for n, f in fakes.items()}, units={n: {"kind": "fake", "pid": f["pid"]} for n, f in fakes.items()})
        supervision = await Supervision.start(path, plan, launch, **({"stop_units": stop_units} if stop_units else {}))
        try:
            yield supervision, fakes
        finally:
            await supervision.finish()


def job(arms, name, supervision, fakes, deadline=20.0):
    """An arm's job without EvalBench: what it does with one turn request."""
    from openclaw_evalbench.stops import ArmGuard
    from openclaw_evalbench.trial import run_trial
    it = object.__new__(ArmJob)
    it.arm_name, it.arm, it.arms, it._token = name, arms["arms"][name], arms, open(fakes[name]["tokenFile"]).read()
    it.supervision, it.verified, it.trials, it.deadline_seconds, it._runner = supervision, None, 0, deadline, run_trial
    it.trial_log, it.guard = supervision_log(supervision, name), ArmGuard(name, None, supervision.run_stop)
    return it


def supervision_log(supervision, name):
    import pathlib
    return pathlib.Path(supervision.plan["receipt"]).with_name(f"trials-{name}.jsonl")


async def trial(it, fakes, prompt_id=W, kind="eligible"):
    env = {"OPENCLAW_EVAL_ARM": it.arm_name, "OPENCLAW_EVAL_MODEL": MODEL, "OPENCLAW_EVAL_GATEWAY_URL": fakes[it.arm_name]["url"],
           "OPENCLAW_EVAL_PROMPT_ID": prompt_id, "OPENCLAW_EVAL_KIND": kind}
    request = type("Request", (), {"env": env, "resume": False, "prompt": PROMPT[prompt_id], "timeout_seconds": 900.0})()
    return await it._settle(request)


def gone(fake):
    return process_start(fake["pid"]) is None


async def until(condition, seconds=10.0):
    end = time.monotonic() + seconds
    while not condition():
        assert time.monotonic() < end, "it never happened"
        await asyncio.sleep(0.02)


def run_one(tmp_path, turn, *, prompt_id=W, after=None, **changes):
    """One trial of one arm. Returns (record, job, receipt, fake)."""
    async def go():
        arms = load_arms()
        async with supervised(tmp_path, {"C": {prompt_id: [turn]}}, **changes) as (supervision, fakes):
            it = job(arms, "C", supervision, fakes)
            record = await trial(it, fakes, prompt_id)
            if after:
                await after(supervision, fakes)
        return record, it, supervision, fakes["C"]
    return asyncio.run(go())


def stop_of(supervision, arm="C"):
    return supervision.receipt["arms"][arm]["stop"]


# --- a gateway that runs away -----------------------------------------------------------------------------------------

def assert_stopped(record, it, supervision, fake, rule):
    stop = stop_of(supervision)
    assert stop["rule"] == rule, stop
    assert stop["result"]["stopped"] is True and gone(fake), "the gateway's process is ended, whatever it answered"
    assert record["status"] == "supervisor_stopped" and record["elected"] is None and rule in record["reason"]
    # The trial's own cleanup still ran. It could not delete anything: the gateway would not, and then it was gone.
    assert record["cleanup"]["ok"] is False and record["cleanup"]["reason"]
    assert record["metered"] is not None
    # The trial is on record, nothing else starts, and on no arm.
    assert [json.loads(line)["status"] for line in it.trial_log.read_text().splitlines()][0] == "supervisor_stopped"
    assert rule in it.guard.before_trial() and rule in supervision.run_stop.reason
    # The aborts were sent first, and were no more than a courtesy.
    assert stop["abortSeconds"] <= 0.3 + 0.5
    return stop


def test_a_loop_that_ignores_aborts_is_stopped_within_its_cap(tmp_path):
    record, it, supervision, fake = run_one(tmp_path, "runaway-loop")
    stop = assert_stopped(record, it, supervision, fake, "trial-tokens")
    assert set(stop["aborts"].values()) == {"no-active-run"}, "it was asked, and said no"
    cap, rate = 700_000, CALL / 0.05
    overshoot = stop["trial"]["tokens"] - cap
    # One poll, one reading and the calls of that time; the kill's own time is on record beside it.
    assert 0 <= overshoot <= rate * (QUICK["pollSeconds"] + 0.5), stop
    assert stop["seconds"] <= QUICK["abortSeconds"] + 1.5, "breach to dead gateway"
    assert supervision.receipt["arms"]["C"]["tokens"] >= cap


def test_children_that_loop_are_stopped_within_the_trials_cap(tmp_path):
    # The turn itself ends at once and is read; its children then spend through the trial's cleanup.
    record, it, supervision, fake = run_one(tmp_path, "runaway-children")
    stop = stop_of(supervision)
    assert stop["rule"] in ("trial-tokens", "idle-spend") and gone(fake) and stop["result"]["stopped"]
    assert record["status"] == "supervisor_stopped" and record["elected"] is None
    assert record["cleanup"]["ok"] is False
    cap, rate = 700_000, 2 * CALL / 0.1
    assert stop["tokens"] <= cap + rate * (QUICK["pollSeconds"] + 0.5), stop


def test_a_fan_out_is_stopped_before_any_of_its_calls_is_metered(tmp_path):
    record, it, supervision, fake = run_one(tmp_path, "runaway-fan-out")
    stop = assert_stopped(record, it, supervision, fake, "active-runs")
    assert stop["trial"]["tokens"] < CALL and stop["trial"]["seconds"] < 5


def test_a_gateway_that_stops_answering_is_stopped_for_that(tmp_path):
    record, it, supervision, fake = run_one(tmp_path, "runaway-freeze")
    stop = assert_stopped(record, it, supervision, fake, "meter-blind")
    assert QUICK["blindSeconds"] <= stop["secondsSinceReading"] <= QUICK["blindSeconds"] + 1.0, stop
    assert stop["seconds"] <= QUICK["abortSeconds"] + 1.5, "and a frozen gateway does not hold up its own stop"


def test_a_stall_shorter_than_the_blind_limit_stops_nothing_and_counts_nothing_twice(tmp_path):
    async def linger(_supervision, _fakes):
        await asyncio.sleep(1.0)  # long enough to judge the trial's own spend as idle, if it were
    record, it, supervision, _ = run_one(tmp_path, "stall", after=linger, idleTokens=10_000)
    assert record["status"] == "ok" and stop_of(supervision)["rule"] == "run-finished" and it.guard.before_trial() is None
    assert 0.8 <= supervision.receipt["arms"]["C"]["longestGapSeconds"] <= 2.0
    assert supervision.receipt["tokens"] == record["supervised"]["tokens"] == record["metered"]["session"]


def test_a_turn_that_never_ends_is_stopped_by_the_clock(tmp_path):
    record, it, supervision, fake = run_one(tmp_path, "runaway-slow", trialSeconds=1.5)
    stop = assert_stopped(record, it, supervision, fake, "trial-wall-clock")
    assert 1.5 <= stop["trial"]["seconds"] <= 3.0 and stop["trial"]["tokens"] < 700_000


def test_spend_after_a_trial_that_looked_clean_is_stopped(tmp_path):
    async def wait(supervision, _fakes):
        await until(lambda: supervision.signals["C"].reason)
    record, it, supervision, fake = run_one(tmp_path, "runaway-orphan", after=wait)
    assert record["status"] == "ok" and record["cleanup"] == {"ok": True, "reason": None}, "the harness's own cleanup saw nothing"
    stop = stop_of(supervision)
    assert stop["rule"] == "idle-spend" and stop["trial"] is None and gone(fake)
    assert 150_000 <= stop["tokens"] <= 150_000 + 25_235 + 300_000 * (QUICK["pollSeconds"] + 0.5)
    assert "idle-spend" in it.guard.before_trial()


def test_a_gateway_that_dies_is_a_stop_too(tmp_path):
    async def kill(supervision, fakes):
        os.kill(fakes["C"]["pid"], signal.SIGKILL)
        await until(lambda: supervision.signals["C"].reason)
    record, it, supervision, _ = run_one(tmp_path, "election-work", after=kill)
    assert record["status"] == "ok" and stop_of(supervision)["rule"] == "gateway-gone" and it.guard.before_trial()


def test_a_limit_crossed_only_on_the_closing_reading_leaves_the_trial_unscored(tmp_path):
    # The whole turn fits between two readings; the harness's own count is what crosses the limit.
    record, it, supervision, fake = run_one(tmp_path, "election-work", trialTokens=10_000, pollSeconds=30, blindSeconds=60)
    assert record["status"] == "supervisor_stopped" and record["elected"] is None and "trial-tokens" in record["reason"]
    assert record["supervised"]["tokens"] >= 10_000 and gone(fake)


def test_what_only_the_harness_could_meter_is_counted(tmp_path):
    record, _, supervision, _ = run_one(tmp_path, "election-work", pollSeconds=30, blindSeconds=60)
    assert record["status"] == "ok" and record["supervised"]["tokens"] == record["metered"]["session"] > 0
    assert supervision.receipt["tokens"] == record["metered"]["session"]


# --- the run's own limits, and the two processes -------------------------------------------------------------------------

def test_the_runs_total_stops_every_gateway(tmp_path):
    async def go():
        arms = load_arms()
        async with supervised(tmp_path, {"A": {C: ["control-clean"]}, "C": {W: ["runaway-loop"]}}, trialTokens=10_000_000, runTokens=800_000) as (supervision, fakes):
            record = await trial(job(arms, "C", supervision, fakes), fakes)
            await until(lambda: supervision.receipt is not None)
        return record, supervision, fakes
    record, supervision, fakes = asyncio.run(go())
    assert record["status"] == "supervisor_stopped" and supervision.receipt["ended"]["rule"] == "run-tokens"
    assert {n: stop_of(supervision, n)["rule"] for n in "AC"} == {"A": "run-tokens", "C": "run-tokens"} and all(gone(f) for f in fakes.values())
    assert supervision.receipt["tokens"] <= 800_000 + CALL / 0.05 * (QUICK["pollSeconds"] + 0.5)


def test_the_runs_clock_stops_every_gateway_even_with_nothing_running(tmp_path):
    async def go():
        async with supervised(tmp_path, {"A": {}, "B": {}, "C": {}}, run_seconds=1) as (supervision, fakes):
            await until(lambda: supervision.receipt is not None)
            with pytest.raises(SupervisorStopped, match="run-wall-clock"):
                await supervision.begin("A", 1)
        return supervision, fakes
    supervision, fakes = asyncio.run(go())
    assert supervision.receipt["ended"]["rule"] == "run-wall-clock" and all(gone(f) for f in fakes.values())
    assert supervision.receipt["seconds"] < 4


def test_a_clean_run_ends_with_every_gateway_stopped(tmp_path):
    record, it, supervision, fake = run_one(tmp_path, "election-work")
    assert record["status"] == "ok" and record["cleanup"]["ok"] and gone(fake)
    assert stop_of(supervision)["rule"] == "run-finished" and supervision.run_stop.reason is None and it.guard.before_trial() is None
    assert cli._supervision_failures(supervision.summary()) == []


def test_losing_the_runner_stops_every_gateway(tmp_path):
    async def go():
        arms = load_arms()
        async with supervised(tmp_path, {"A": {C: ["control-clean"]}, "C": {W: ["runaway-slow"]}}) as (supervision, fakes):
            running = asyncio.ensure_future(trial(job(arms, "C", supervision, fakes), fakes))
            await asyncio.sleep(0.5)
            supervision._writer.transport.abort()  # what a killed runner's socket does
            await until(lambda: all(gone(f) for f in fakes.values()))
            await running
            await until(lambda: "ended" in open(supervision.plan["events"]).read().splitlines()[-1])
            receipt = json.loads(open(supervision.plan["receipt"]).read())
        return receipt
    receipt = asyncio.run(go())
    assert receipt["ended"]["rule"] == "runner-gone" and all(a["stop"]["result"]["stopped"] for a in receipt["arms"].values())


@pytest.mark.parametrize("sig", [signal.SIGKILL, signal.SIGSTOP])
def test_losing_the_supervisor_makes_the_runner_stop_every_gateway(tmp_path, sig):
    async def go():
        arms = load_arms()
        async with supervised(tmp_path, {"A": {C: ["control-clean"]}, "C": {W: ["runaway-slow"]}}) as (supervision, fakes):
            running = asyncio.ensure_future(trial(job(arms, "C", supervision, fakes), fakes))
            await asyncio.sleep(0.5)
            os.kill(supervision.armed["pid"], sig)
            started = time.monotonic()
            await until(lambda: all(gone(f) for f in fakes.values()))
            took = time.monotonic() - started
            record = await running
            with pytest.raises(SupervisorStopped):
                await supervision.begin("A", 1)
            if sig == signal.SIGSTOP:
                os.kill(supervision.armed["pid"], signal.SIGKILL)
        return record, took, supervision
    record, took, supervision = asyncio.run(go())
    assert record["status"] == "supervisor_stopped" and "supervisor lost" in record["reason"]
    assert took <= (QUICK["silentSeconds"] if sig == signal.SIGSTOP else 0) + 2.0
    summary = supervision.summary()
    assert summary["lost"] and all(r["stopped"] for r in summary["runnerStops"].values())
    assert any("run halted" in f for f in cli._supervision_failures(summary))


def test_a_supervisor_told_to_stop_takes_the_gateways_with_it(tmp_path):
    async def go():
        async with supervised(tmp_path, {"C": {}}) as (supervision, fakes):
            os.kill(supervision.armed["pid"], signal.SIGTERM)
            await until(lambda: gone(fakes["C"]))
        return supervision
    assert asyncio.run(go()).receipt["ended"]["rule"] == "supervisor-stopped"


def test_nothing_starts_unless_the_supervisor_is_armed(tmp_path):
    async def go(tamper):
        tmp_path.joinpath("x").mkdir(exist_ok=True)
        private = cli._private(tmp_path / "x")
        with launch_fakes(["C"], tmp_path / "x", plans={"C": {}}) as fakes:
            fake = fakes["C"]
            plan = dict(offline=True, limits=limits(), urls={"C": fake["url"]}, token_files={"C": fake["tokenFile"]}, units={"C": {"kind": "fake", "pid": fake["pid"]}})
            plan.update(tamper)
            path, plan = make_plan(private, **plan)
            with pytest.raises(SupervisorError) as error:
                await Supervision.start(path, plan, launch_offline)
            assert not gone(fake), "nothing was sent, so nothing is stopped"
            return str(error.value)
    assert "is not a fake gateway" in asyncio.run(go({"units": {"C": {"kind": "fake", "pid": os.getpid()}}}))
    (tmp_path / "x/token-C").unlink()
    assert "cannot stop a 'fake' unit" in asyncio.run(go({"offline": False}))


def test_one_trial_at_a_time(tmp_path):
    async def go():
        async with supervised(tmp_path, {"C": {}}) as (supervision, _):
            await supervision.begin("C", 1)
            with pytest.raises(SupervisorStopped, match="already running"):
                await supervision.begin("C", 2)
    asyncio.run(go())


def test_the_stop_command_needs_neither_process(tmp_path):
    from openclaw_evalbench.supervisor import stop_everything

    async def go():
        async with supervised(tmp_path, {"A": {}, "C": {}}) as (supervision, fakes):
            path = supervision.plan["receipt"].replace("supervisor.json", "supervision-plan.json")
            code = await asyncio.to_thread(cli.main, ["stop", "--plan", path])
            return code, all(gone(f) for f in fakes.values()), stop_everything(supervision.plan)
    code, dead, again = asyncio.run(go())
    assert code == 0 and dead and all(r["stopped"] for r in again.values()), "and stopping twice is harmless"


# --- whole jobs, through EvalBench ---------------------------------------------------------------------------------------

def run_supervised(tmp_path, plans, *, num_trials, scenarios, overrides=None, **changes):
    arms = load_arms()

    async def go():
        with launch_fakes(plans, tmp_path, plans=plans, overrides=overrides) as fakes:
            urls = {n: f["url"] for n, f in fakes.items()}
            configs = cli.build_configs(tmp_path, list(plans), model=arms["model"], gateway_urls=urls, num_trials=num_trials, scenarios=scenarios)
            path, plan = make_plan(cli._private(tmp_path), offline=True, limits=limits(**changes), urls=urls,
                                   token_files={n: f["tokenFile"] for n, f in fakes.items()}, units={n: {"kind": "fake", "pid": f["pid"]} for n, f in fakes.items()})
            return (*await cli._supervised(path, plan, launch_offline, lambda supervision: cli.run_jobs(
                tmp_path, configs, arms=arms, tokens={n: open(f["tokenFile"]).read() for n, f in fakes.items()}, token_budget=None,
                supervision=supervision, deadline_seconds=0.5)), {n: gone(f) for n, f in fakes.items()})
    here = os.getcwd()
    os.chdir(ROOT)
    try:
        results, summary, dead = asyncio.run(go())
        code = cli._finish(tmp_path, results, {"offline": True, "supervision": summary}, arms)
    finally:
        os.chdir(here)
    return results, summary, dead, json.loads((tmp_path / "report.json").read_text()), code


def test_a_runaway_halts_every_arm_and_the_run_still_ends_in_order(tmp_path):
    # Three arms, four trials each. C runs away in its first trial; the others stop after the trial they are in.
    plans = {"A": {W: ["deadline-no-election"]}, "B": {W: ["deadline-no-election"]}, "C": {W: ["runaway-loop"]}}
    results, summary, dead, report, code = run_supervised(tmp_path, plans, num_trials=4, scenarios=[W])
    assert code == 1 and dead == dict.fromkeys("ABC", True)
    assert "trial-tokens" in summary["halted"] and stop_of(type("S", (), {"receipt": summary["receipt"]}))["rule"] == "trial-tokens"
    assert {n: summary["receipt"]["arms"][n]["stop"]["rule"] for n in "AB"} == {"A": "run-finished", "B": "run-finished"}
    assert report["arms"]["C"]["unscored"] == {"supervisor_stopped": 1, "halted": 3}
    for name in "AB":
        assert results[name]["halted"].startswith("run halted: ") and report["arms"][name]["unscored"]["halted"] >= 1
        assert results[name]["trials"] == 4, "EvalBench was answered for every trial"
    manifest = json.loads((tmp_path / "manifest.json").read_text())
    assert any(f.startswith("run halted: supervisor, arm C: trial-tokens") for f in manifest["failures"]), "for itself, not only for the arms it halted"
    assert all((tmp_path / "results" / results[n]["jobId"] / "evals.csv").is_file() for n in "ABC")


def test_caps_that_did_not_take_halt_every_arm_before_a_turn_is_sent(tmp_path):
    plans = {"A": {C: ["control-clean"]}, "B": {C: ["control-clean"]}}
    results, summary, dead, report, code = run_supervised(tmp_path, plans, num_trials=6, scenarios=[C], overrides={"A": {"appliedConfigHash": "another"}})
    assert code == 1 and dead == {"A": True, "B": True}
    assert report["arms"]["A"]["unscored"] == {"caps_mismatch": 1, "halted": 5} and report["arms"]["A"]["meteredTokens"] == 0
    assert "caps not in force: the running gateway has not applied this configuration" in summary["halted"]
    assert results["B"]["halted"].startswith("run halted: arm A: caps not in force")
    assert report["arms"]["B"]["unscored"]["halted"] >= 1


def test_a_clean_supervised_run_is_clean(tmp_path):
    results, summary, dead, report, code = run_supervised(tmp_path, {"A": {C: ["control-clean"]}}, num_trials=2, scenarios=[C])
    assert code == 0 and dead == {"A": True} and summary["halted"] is None and report["arms"]["A"]["control"]["scored"] == 2
    assert summary["receipt"]["tokens"] == report["arms"]["A"]["meteredTokens"] > 0
    meta = json.loads(rows(tmp_path / "results" / results["A"]["jobId"] / "evals.csv")[0]["stdout"])["openclaw"]
    assert meta["supervised"]["tokens"] > 0 and meta["gateway"]["caps"]["verdict"] == "verified"


def test_a_gateway_that_was_not_proved_stopped_fails_the_run():
    stop = {"rule": "run-finished", "result": {"stopped": True}}
    clean = {"halted": None, "lost": None, "receipt": {"arms": {"A": {"stop": stop}}}, "runnerStops": None}
    assert cli._supervision_failures(clean) == []
    for broken in ({"receipt": None}, {"receipt": {"arms": {"A": {"stop": None}}}}, {"receipt": {"arms": {"A": {"stop": {**stop, "result": {"stopped": False}}}}}},
                   {"runnerStops": {"A": {"stopped": False, "problems": ["x"]}}}, {"halted": "x"}):
        assert cli._supervision_failures({**clean, **broken}), broken


# --- the meter ---------------------------------------------------------------------------------------------------------

def meter(plan, work, **kwargs):
    async def go():
        arms = load_arms()
        async with fake_gateway(arms, "C", plan, **kwargs) as fake, GatewayClient(fake.url, fake.token) as client:
            return await work(fake, client, GatewayMeter())
    return asyncio.run(go())


def test_the_meter_counts_from_its_baseline_and_never_goes_down():
    async def work(fake, client, it):
        old = fake._sessions_create({"key": "old", "agentId": "main"})["key"]
        fake.sessions[old]["rows"] = [{"usage": {"input": 5000, "totalTokens": 5000}}]
        await it.baseline(client, 2)
        assert it.tokens == 0
        key = fake._sessions_create({"key": "new", "agentId": "main"})["key"]
        await it.read(client, 2)
        assert it.tokens == 0, "a session with no transcript has spent nothing"
        fake.sessions[key]["rows"] = [{"usage": {"input": 100, "output": 50, "cacheRead": 900, "totalTokens": 10}}]
        await it.read(client, 2)
        assert it.tokens == 1050, "the larger of the total and its parts"
        # Deleted between two readings: its archive still says what it spent after the last one.
        fake.sessions[key]["rows"] += [{"usage": {"input": 2000, "totalTokens": 2000}}]
        fake.sessions[key]["archived"] = True
        fake._sessions_delete({"key": key, "archivedOnly": True})
        await it.read(client, 2)
        assert it.tokens == 3050 and it.keys == [old]
        del fake.sessions[old]
        fake.archive.clear()
        await it.read(client, 2)
        assert it.tokens == 3050, "what was seen stays counted"
    meter({}, work)


def test_the_meter_reads_every_page_and_counts_active_runs():
    async def work(fake, client, it):
        for index in range(7):
            session = fake.sessions[fake._sessions_create({"key": f"s{index}", "agentId": "main"})["key"]]
            session["rows"] = [{"usage": {"totalTokens": 10}}]
            if index < 3:
                session["runId"] = f"r{index}"
                fake.runs[f"r{index}"] = {"status": "never"}
        await it.read(client, 2)
        assert it.tokens == 70 and it.sessions == 7 and it.active == 3
    meter({}, work, overrides={"listPage": 3})


def test_spend_the_session_list_hides_is_counted_from_the_aggregate():
    async def work(fake, client, it):
        fake.overrides["unlistedTokens"] = 1000
        await it.baseline(client, 2)
        fake.overrides["unlistedTokens"] = 91_000  # a cron run: the list never shows one
        await it.read_aggregate(client, 2)
        assert it.tokens == 90_000
        it.credit(-5)
        assert it.tokens == 90_000
    meter({}, work)


@pytest.mark.parametrize("method, answer", [("sessions.list", {}), ("sessions.list", {"sessions": [{"key": ""}]}), ("sessions.usage.timeseries", {"sessionId": "x"}),
                                            ("sessions.list", {"sessions": [], "hasMore": True}), ("sessions.usage", {"sessions": []})])
def test_an_answer_that_is_not_a_reading_is_never_a_zero(method, answer):
    class Client:
        async def call(self, name, _params, timeout=None):
            if name == method:
                return answer
            return {"sessions": [{"key": "agent:main:a", "sessionId": "s"}], "points": [], "totals": {"totalTokens": 0}}
    with pytest.raises(MeterError):
        asyncio.run(GatewayMeter().baseline(Client(), 1))


@pytest.mark.parametrize("method", ["sessions.list", "sessions.usage.timeseries", "sessions.usage"])
def test_a_refused_reading_is_never_a_zero(method):
    async def work(fake, client, it):
        fake._sessions_create({"key": "s", "agentId": "main"})
        with pytest.raises(GatewayError):
            await it.baseline(client, 2)
    meter({}, work, overrides={"refuse": {method: ["UNAVAILABLE", "try later"]}})


# --- the supervisor's own steps, over a gateway in this process --------------------------------------------------------------

class StubUnit:
    """A unit that is verified, alive, and stopped when told; `swept` is what its sweeps answer, in order."""

    def __init__(self, swept=()):
        self.swept, self.stops, self.up = list(swept), 0, True

    def verify(self):
        return {"unit": "stub"}

    def alive(self):
        return self.up

    def sweep(self):
        return self.swept.pop(0) if self.swept else {"clean": True, "units": [], "processes": 0}

    def stop(self):
        self.stops, self.up = self.stops + 1, False
        return {"stopped": True, "problems": [], "durableUnits": [], "strayProcesses": 0, "seconds": 0}

    def mark_stopped(self, _record):
        return None


def steps(tmp_path, monkeypatch, work, unit=None, before=None, **changes):
    """An armed Supervisor with no loops of its own running, its gateway in this process, and what it sent."""
    from openclaw_evalbench import supervisor as module
    unit = unit or StubUnit()
    monkeypatch.setattr(module, "from_spec", lambda *_: unit)

    async def go():
        async with fake_gateway(load_arms(), "C", {}) as fake:
            (tmp_path / "token").write_text(fake.token)
            if before:
                before(fake)
            plan = {"run": "r", "offline": True, "limits": limits(**changes), "events": str(tmp_path / "e"), "receipt": str(tmp_path / "r"),
                    "arms": {"C": {"url": fake.url, "tokenFile": str(tmp_path / "token"), "unit": {}}}}
            it = module.Supervisor(plan)
            sent = []
            it.send = sent.append
            await it.arm()
            arm = it.arms["C"]
            try:
                return await work(it, arm, fake, sent, unit)
            finally:
                await arm.disconnect()
                await asyncio.gather(*it._stops)
    return asyncio.run(go())


def spend(fake, key, tokens):
    if f"agent:main:{key}" not in fake.sessions:
        fake._sessions_create({"key": key, "agentId": "main"})
    fake.sessions[f"agent:main:{key}"]["rows"].append({"usage": {"totalTokens": tokens}})


def delete(fake, key):
    fake.sessions[f"agent:main:{key}"]["archived"] = True
    fake._sessions_delete({"key": f"agent:main:{key}", "archivedOnly": True})


def test_what_a_gateway_spent_before_arming_is_not_the_runs(tmp_path, monkeypatch):
    async def work(it, arm, fake, _sent, _unit):
        await arm.read(1)
        assert arm.spent == 0
        spend(fake, "old", 7)
        await arm.read(1)
        return arm.spent, it.run_tokens()
    assert steps(tmp_path, monkeypatch, work, before=lambda fake: spend(fake, "old", 900_000)) == (7, 7)


def test_a_trial_closes_on_a_fresh_reading_and_is_counted_once(tmp_path, monkeypatch):
    async def work(it, arm, fake, sent, _unit):
        it._begin(arm, {"trial": 1}, 1)
        spend(fake, "t", 5_000)
        await arm.read(1)
        spend(fake, "t", 45_000)   # after the last reading, and gone before the next
        delete(fake, "t")
        await it._end(arm, {"charged": 50_000}, 2)
        await arm.read(1)
        it._begin(arm, {"trial": 2}, 3)
        await it._end(arm, {"charged": 1_000}, 4)   # one that came and went between two readings
        await arm.read(1)
        return [m["trial"]["tokens"] for m in sent if m.get("trial")], arm.spent
    assert steps(tmp_path, monkeypatch, work) == ([50_000, 1_000], 51_000)


def test_only_what_is_spent_after_a_trial_is_idle(tmp_path, monkeypatch):
    async def work(it, arm, fake, _sent, _unit):
        for number in range(3):
            it._begin(arm, {"trial": number}, number)
            spend(fake, f"t{number}", 60_000)
            await it._end(arm, {"charged": 60_000}, number)
        it.judge()
        assert arm.stop is None and arm.spent == 180_000
        spend(fake, "leak", 99_999)
        await arm.read(1)
        it.judge()
        assert arm.stop is None
        spend(fake, "leak", 1)
        await arm.read(1)
        it.judge()
        return arm.stop["rule"]
    assert steps(tmp_path, monkeypatch, work, idleTokens=100_000) == "idle-spend"


def test_the_end_of_a_trial_ends_what_it_left_running(tmp_path, monkeypatch):
    unit = StubUnit([{"clean": True, "units": ["openclaw-proc-1.service"], "processes": 2}])

    async def work(it, arm, _fake, sent, _unit):
        it._begin(arm, {"trial": 1}, 1)
        await it._end(arm, {"charged": 0}, 2)
        return sent[-1]["trial"], arm.stop, it.receipt()["arms"]["C"]["sweptUnits"]
    trial_record, stop, swept = steps(tmp_path, monkeypatch, work, unit=unit)
    assert trial_record["sweptUnits"] == ["openclaw-proc-1.service"] and trial_record["sweptProcesses"] == 2 and stop is None and swept == 1


def test_what_a_trial_left_running_and_cannot_be_ended_stops_the_gateway(tmp_path, monkeypatch):
    async def work(it, arm, _fake, _sent, unit):
        it._begin(arm, {"trial": 1}, 1)
        await it._end(arm, {"charged": 0}, 2)
        await asyncio.gather(*it._stops)
        return arm.stop["rule"], unit.stops
    assert steps(tmp_path, monkeypatch, work, unit=StubUnit([{"clean": False, "units": [], "processes": 0}])) == ("sweep-failed", 1)


def test_a_stopped_arm_begins_nothing(tmp_path, monkeypatch):
    async def work(it, arm, _fake, sent, _unit):
        it.stop_arm(arm, "active-runs", "because")
        it._begin(arm, {"trial": 1}, 9)
        return [m for m in sent if m.get("id") == 9], arm.trial
    assert steps(tmp_path, monkeypatch, work) == ([{"event": "refused", "id": 9, "reason": "active-runs: because"}], None)


def test_the_unit_is_stopped_even_when_the_abort_itself_fails(tmp_path, monkeypatch):
    async def work(it, arm, _fake, _sent, unit):
        async def boom(_arm):
            raise RuntimeError("no")
        it._abort = boom
        it.stop_arm(arm, "trial-tokens", "x")
        await asyncio.gather(*it._stops)
        return unit.stops, arm.stop["aborts"]
    assert steps(tmp_path, monkeypatch, work) == (1, "RuntimeError: no")


def test_an_abort_that_is_never_answered_holds_up_nothing(tmp_path, monkeypatch):
    async def work(it, arm, fake, _sent, unit):
        spend(fake, "t", 5_000)
        await arm.read(1)
        fake._sessions_abort = lambda _params: asyncio.sleep(60)
        started = time.monotonic()
        it.stop_arm(arm, "trial-tokens", "x")
        await asyncio.gather(*it._stops)
        return unit.stops, time.monotonic() - started, [m for m, _ in fake.calls if m == "sessions.abort"]
    stops, took, asked = steps(tmp_path, monkeypatch, work)
    assert stops == 1 and QUICK["abortSeconds"] <= took <= QUICK["abortSeconds"] + 0.5 and asked == ["sessions.abort"]


def test_a_stop_that_fails_is_tried_again_until_it_is_proved(tmp_path, monkeypatch):
    class Stubborn(StubUnit):
        def stop(self):
            result = super().stop()
            return result if self.stops == 3 else {**result, "stopped": False, "problems": ["still there"]}

    async def work(it, arm, _fake, sent, unit):
        it.stop_arm(arm, "trial-tokens", "x")
        await asyncio.gather(*it._stops)
        return unit.stops, sum(m["event"] == "stop-failed" for m in sent), arm.stop["result"]["stopped"]
    assert steps(tmp_path, monkeypatch, work, unit=Stubborn()) == (3, 2, True)


def test_a_signalled_trial_aborts_its_own_turn_at_once(arms):
    # The run belongs to this connection, so its abort is the one a gateway cannot refuse.
    from openclaw_evalbench.supervision import StopSignal
    from openclaw_evalbench.trial import run_trial

    async def go():
        async with fake_gateway(arms, "C", {W: ["deadline-no-election"]}) as fake:
            signal_ = StopSignal()
            running = asyncio.ensure_future(run_trial(arm_name="C", arm=arms["arms"]["C"], model=arms["model"], caps=arms["caps"], url=fake.url, token=fake.token,
                                                      descriptions=arms["descriptions"]["f9fcd3a5"]["tools"], prompt=PROMPT[W], prompt_id=W, kind="eligible", stop=signal_))
            await until(lambda: any(m == "agent.wait" for m, _ in fake.calls))
            signal_.set("trial-tokens: x")
            return await asyncio.wait_for(running, 5), fake
    record, fake = asyncio.run(go())
    methods = [m for m, _ in fake.calls]
    assert record["status"] == "supervisor_stopped" and record["reason"] == "trial-tokens: x" and record["elected"] is None
    after_wait = methods[max(i for i, m in enumerate(methods) if m == "agent.wait") + 1:]
    assert after_wait[0] == "sessions.abort" and "chat.history" not in methods and fake.sessions == {}, "and a gateway still there is cleaned up"


# --- what the packet states ----------------------------------------------------------------------------------------------

def test_the_limits_are_in_the_order_the_stop_needs():
    s = load_arms()["supervision"]
    from openclaw_evalbench.trial import TURN_DEADLINE_SECONDS
    caps = load_arms()["caps"]["set"]
    assert s["pollSeconds"] < s["blindSeconds"] < s["silentSeconds"] and s["readSeconds"] < s["blindSeconds"]
    assert TURN_DEADLINE_SECONDS < caps["agents.defaults.timeoutSeconds"] < s["trialSeconds"]
    assert s["idleTokens"] < s["trialTokens"] < s["canary"]["tokens"]
    # Three trials of one arm, all of them at their own limit, still end before the canary's clock.
    assert 3 * s["trialSeconds"] <= s["canary"]["seconds"]
