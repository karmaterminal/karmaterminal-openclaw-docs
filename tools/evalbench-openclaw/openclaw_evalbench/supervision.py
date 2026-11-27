"""The runner's side of the supervisor: launching it, telling it where trials begin and end, and stopping when it says so.

Neither process survives the other. The supervisor stops every gateway when this one's connection ends. When the
supervisor's does, or when it goes quiet, this side halts the run and stops the gateways itself. A third thing needs
neither: a systemd timer, set before the first trial, that stops the same units.
"""

import asyncio
import contextlib
import json
import os
import pathlib
import shlex
import subprocess
import sys
import tempfile
import time
import uuid
from urllib.parse import urlsplit

from .arms import ROOT
from .stops import RunStop
from .supervisor import SCHEMA, disarm_deadman, remove_socket, stop_everything, systemd_environment, write_private
from .units import OWN_UNITS, STOP_MARKER, proof_directory

ARM_SECONDS = 90.0
ANSWER_SECONDS = 20.0
FINISH_SECONDS = 60.0
# How far past the run's own wall-clock limit the timer is set.
DEADMAN_MARGIN_SECONDS = 60
LIMIT_KEYS = ("pollSeconds", "readSeconds", "blindSeconds", "abortSeconds", "silentSeconds", "aggregateSeconds", "aggregateFailures", "trialTokens", "trialSeconds", "idleTokens", "maxActiveRuns")
# One turn of this process's loop. A loop that was blocked has the supervisor's pulses still to read.
CATCH_UP_SECONDS = 0.5


class SupervisorError(Exception):
    """The supervisor could not be armed, or is gone."""


class SupervisorStopped(Exception):
    """The supervisor stopped this arm."""


class StopSignal:
    """Set once, when an arm is being stopped. A trial in flight waits on it."""

    def __init__(self):
        self.event = asyncio.Event()
        self.reason = None

    def set(self, reason):
        if self.reason is None:
            self.reason = reason
            self.event.set()


def limits_for(arms, *, run_tokens, run_seconds, **changes):
    """The limits of one run: the per-trial ones from arms.json, and the run's own totals."""
    limits = {key: arms["supervision"][key] for key in LIMIT_KEYS}
    return {**limits, "runTokens": run_tokens, "runSeconds": run_seconds, **changes}


def systemd_units(arms, urls):
    """What a live plan stops: each arm's proof gateway, on the port its trials use."""
    out = {}
    for name, url in urls.items():
        unit = arms["arms"][name]["unit"]
        out[name] = {"kind": "systemd", "unit": unit, "port": urlsplit(url).port, "directory": str(proof_directory(unit))}
    return out


def stopped_before(units):
    """Gateways a supervisor stopped in an earlier run. They are shredded, never restarted."""
    return [u["directory"] for u in units.values() if u["kind"] == "systemd" and (pathlib.Path(u["directory"]) / STOP_MARKER).exists()]


def make_plan(private, *, offline, limits, urls, token_files, units):
    """Write the supervision plan. It names token files, and holds no token."""
    run = uuid.uuid4().hex[:12]
    base = os.environ.get("XDG_RUNTIME_DIR") or tempfile.gettempdir()
    plan = {
        "schema": SCHEMA, "run": run, "offline": offline, "limits": limits,
        # A Unix socket path has to be short; the run's own directory may not be.
        "socket": str(pathlib.Path(tempfile.mkdtemp(prefix="evalprop-", dir=base)) / "s"),
        "receipt": str(private / "supervisor.json"), "events": str(private / "supervisor-events.jsonl"),
        "log": str(private / "supervisor.log"), "deadman": None if offline else f"{OWN_UNITS}deadman-{run}",
        "arms": {n: {"url": urls[n], "tokenFile": str(token_files[n]), "unit": units[n]} for n in urls},
    }
    path = private / "supervision-plan.json"
    write_private(path, json.dumps(plan, indent=2) + "\n")
    return path, plan


def _module(*args):
    return [sys.executable, "-m", "openclaw_evalbench", *args]


def launch_offline(path, plan):
    """The supervisor as an ordinary process in its own session."""
    write_private(plan["log"], "")
    with open(plan["log"], "a") as log:
        subprocess.Popen(_module("supervise", "--plan", str(path)), cwd=ROOT, stdin=subprocess.DEVNULL, stdout=log, stderr=log, start_new_session=True)


def launch_live(path, plan):
    """The timer first, then the supervisor, each in a transient user unit of its own: neither ends with this terminal."""
    write_private(plan["log"], "")
    environment = [f"--setenv={key}={value}" for key, value in systemd_environment().items()]
    common = ["systemd-run", "--user", "--quiet", "--collect", "--no-ask-password", "--property=Restart=no", f"--working-directory={ROOT}", *environment]
    units = [arm["unit"] for arm in plan["arms"].values()]
    # The gateways themselves by the shell and systemctl alone, marked as they go, so that this half needs no Python; then
    # what they own. If this timer is left to fire, nobody can say what they were doing.
    mark = "; ".join(f"[ ! -d {shlex.quote(u['directory'])} ] || echo '{{\"rule\": \"deadman\"}}' > {shlex.quote(u['directory'] + '/' + STOP_MARKER)}" for u in units)
    kill = f"{mark}; systemctl --user kill --signal=SIGKILL " + " ".join(f"{u['unit']}.service" for u in units)
    stop = shlex.join(_module("stop", "--plan", str(path)))
    after = int(plan["limits"]["runSeconds"]) + DEADMAN_MARGIN_SECONDS
    _systemd_run([*common, f"--unit={plan['deadman']}", f"--on-active={after}s", "--timer-property=AccuracySec=1s", "/bin/sh", "-c", f"{kill}; exec {stop}"])
    try:
        _systemd_run([*common, f"--unit={OWN_UNITS}supervisor-{plan['run']}", f"--property=StandardOutput=append:{plan['log']}", "--property=StandardError=inherit",
                      *_module("supervise", "--plan", str(path))])
    except SupervisorError:
        disarm_deadman(plan)
        raise


def _systemd_run(argv):
    try:
        done = subprocess.run(argv, capture_output=True, text=True, timeout=30, check=False, stdin=subprocess.DEVNULL)
    except (subprocess.TimeoutExpired, OSError) as error:
        raise SupervisorError(f"systemd-run: {type(error).__name__}: {error}") from None
    if done.returncode != 0:
        raise SupervisorError(f"systemd-run: {done.stderr.strip()[:300] or done.returncode}")


class Supervision:
    """A connection to an armed supervisor. Use start(), then begin()/end() around each trial, then finish()."""

    def __init__(self, plan, *, stop_units=stop_everything):
        self.plan, self._stop_units = plan, stop_units
        self.run_stop = RunStop()
        self.signals = {name: StopSignal() for name in plan["arms"]}
        self.armed = None
        self.receipt = None
        self.runner_stops = None
        self.lost = None
        self._reader = self._writer = None
        self._waiting, self._number = {}, 0
        self._heard = None
        self._answered = None
        self._finished = None
        self._tasks = []

    @classmethod
    async def start(cls, path, plan, launch, **kwargs):
        """Launch, connect and arm. Raises SupervisorError when the supervisor refuses, and then no trial may start."""
        self = cls(plan, **kwargs)
        self._answered, self._finished = asyncio.get_running_loop().create_future(), asyncio.Event()
        try:
            await self._open(launch, path)
        except BaseException:
            # Nothing was sent, so nothing needs stopping; but the timer may be set.
            disarm_deadman(plan)
            remove_socket(plan)
            raise
        return self

    async def _open(self, launch, path):
        plan = self.plan
        launching = asyncio.ensure_future(asyncio.to_thread(launch, path, plan))
        try:
            await asyncio.shield(launching)
        except asyncio.CancelledError:
            # A thread is not cancelled: what it is about to start has to exist before it can be taken back.
            await asyncio.gather(launching, return_exceptions=True)
            raise
        end = time.monotonic() + ARM_SECONDS
        while True:
            try:
                self._reader, self._writer = await asyncio.open_unix_connection(plan["socket"], limit=1 << 20)
                break
            except (FileNotFoundError, ConnectionRefusedError):
                if time.monotonic() >= end:
                    raise SupervisorError("the supervisor did not open its socket") from None
                await asyncio.sleep(0.05)
        self._tasks = [asyncio.ensure_future(self._listen())]
        try:
            answer = await asyncio.wait_for(asyncio.shield(self._answered), ARM_SECONDS)
        except TimeoutError:
            answer = {"event": "refused", "reason": "the supervisor did not arm in time"}
        if answer["event"] != "armed":
            await self._close()
            raise SupervisorError(answer["reason"])
        self.armed = answer
        self._heard = time.monotonic()
        self._tasks.append(asyncio.ensure_future(self._watch()))

    # --- trials ---------------------------------------------------------------------------------------------------

    async def begin(self, arm, trial):
        signal = self.signals[arm]
        if signal.reason:
            raise SupervisorStopped(signal.reason)
        answer = await self._ask({"type": "begin", "arm": arm, "trial": trial})
        if answer.get("event") != "ok":
            reason = answer.get("reason") or "refused"
            self.run_stop.halt(f"supervisor, arm {arm}: {reason}")
            raise SupervisorStopped(reason)

    async def end(self, arm, charged):
        """Close the trial, with the tokens this side charged it. What the supervisor counted, or None when it is gone."""
        answer = await self._ask({"type": "end", "arm": arm, "charged": charged})
        if answer.get("stopped"):
            self.signals[arm].set(answer["stopped"])
        return answer.get("trial")

    async def _ask(self, message):
        if self.lost or self._finished.is_set():
            return {"event": "refused", "reason": self.lost or self.run_stop.reason or "the supervisor has finished"}
        self._number += 1
        number, future = self._number, asyncio.get_running_loop().create_future()
        self._waiting[number] = future
        try:
            self._writer.write((json.dumps({**message, "id": number}) + "\n").encode())
            await self._writer.drain()
            return await asyncio.wait_for(future, ANSWER_SECONDS)
        except (TimeoutError, ConnectionError) as error:
            return {"event": "refused", "reason": f"the supervisor did not answer ({type(error).__name__})"}
        finally:
            self._waiting.pop(number, None)

    # --- listening --------------------------------------------------------------------------------------------------

    async def _listen(self):
        with contextlib.suppress(ConnectionError, OSError, ValueError):
            while line := await self._reader.readline():
                self._heard = time.monotonic()
                self._take(json.loads(line))
        if not self._answered.done():
            self._answered.set_result({"event": "refused", "reason": "the supervisor closed its connection before arming"})
        elif self.armed is not None and not self._finished.is_set():
            await self._lose("the supervisor closed its connection")

    def _take(self, message):
        event = message["event"]
        if event in ("armed", "refused") and "id" not in message:
            if not self._answered.done():
                self._answered.set_result(message)
        elif event in ("ok", "refused"):
            future = self._waiting.get(message["id"])
            if future is not None and not future.done():
                future.set_result(message)
        elif event in ("stopping", "stopped"):
            reason = f"{message['rule']}: {message['detail']}"
            self.signals[message["arm"]].set(reason)
            if message["rule"] != "run-finished":
                self.run_stop.halt(f"supervisor, arm {message['arm']}: {reason}")
        elif event == "stop-failed":
            print(f"SUPERVISOR COULD NOT STOP arm {message['arm']}: {message['problems']}; it is trying again", file=sys.stderr, flush=True)
        elif event == "finished":
            self.receipt = message["receipt"]
            self._finished.set()
            self._settle_waiting("the supervisor has finished")

    async def _watch(self):
        """A supervisor that has gone quiet watches nothing."""
        limit = self.plan["limits"]["silentSeconds"]
        while not self._finished.is_set() and self.lost is None:
            if time.monotonic() - self._heard >= limit:
                await asyncio.sleep(CATCH_UP_SECONDS)
                quiet = time.monotonic() - self._heard
                if quiet >= limit:
                    await self._lose(f"nothing heard from the supervisor for {quiet:.1f} s")
                    return
            with contextlib.suppress(TimeoutError):
                await asyncio.wait_for(self._finished.wait(), min(1.0, limit / 4))

    async def _lose(self, reason):
        """The second stop: this process ends every gateway itself."""
        if self.lost is not None:
            return
        self.lost = reason
        self.run_stop.halt(f"supervisor lost: {reason}")
        for signal in self.signals.values():
            signal.set(f"supervisor lost: {reason}")
        self._settle_waiting(reason)
        self.runner_stops = await asyncio.to_thread(self._stop_units, self.plan, f"the runner: {reason}")

    def _settle_waiting(self, reason):
        for future in self._waiting.values():
            if not future.done():
                future.set_result({"event": "refused", "reason": reason})

    # --- the end ------------------------------------------------------------------------------------------------------

    def interrupt(self, reason):
        """Have every gateway stopped now. The run then ends in order: what is in flight is cut off, and nothing else starts."""
        self.run_stop.halt(f"interrupted: {reason}")
        if self.lost is None and not self._finished.is_set():
            with contextlib.suppress(Exception):
                self._writer.write((json.dumps({"type": "stop", "reason": reason}) + "\n").encode())

    async def finish(self):
        """Have every gateway stopped, and return the supervisor's receipt. A gateway is never left running."""
        if self.lost is None:
            with contextlib.suppress(ConnectionError):
                self._writer.write((json.dumps({"type": "finish"}) + "\n").encode())
                await self._writer.drain()
            with contextlib.suppress(TimeoutError):
                await asyncio.wait_for(self._finished.wait(), FINISH_SECONDS)
            if not self._finished.is_set():
                await self._lose("no receipt after the run finished")
        while self.lost is not None and self.runner_stops is None:
            await asyncio.sleep(0.05)
        await self._close()
        return self.summary()

    async def _close(self):
        for task in self._tasks:
            if task is not asyncio.current_task():
                task.cancel()
        await asyncio.gather(*self._tasks, return_exceptions=True)
        self._writer.close()
        remove_socket(self.plan)

    def summary(self):
        """For the manifest. The supervisor's own receipt, and this side's stops when it had to make them."""
        return {"limits": self.plan["limits"], "halted": self.run_stop.reason, "lost": self.lost, "receipt": self.receipt, "runnerStops": self.runner_stops}
