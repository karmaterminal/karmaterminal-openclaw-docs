"""The spend supervisor: a process of its own that watches the isolated gateways and stops them.

It does not trust the product and does not need it. It reads each gateway's usage on its own connection, keeps its own
clock, and ends a gateway by killing the unit it runs in (units.py). sessions.abort comes first, as a courtesy with a
time limit: a caller that did not start a run may be refused (chat-abort-authorization.ts:222-227), and nothing here
waits on the answer.

It speaks newline-delimited JSON over a private Unix socket to the one process that runs the trials. Losing that
process is itself a reason to stop everything; so is losing sight of a gateway's usage.
"""

import asyncio
import concurrent.futures
import contextlib
import datetime
import json
import os
import pathlib
import signal
import socket
import struct
import time

from .arms import check_url
from .gateway import GatewayClient
from .meter import GatewayMeter
from .units import UnitRefused, from_spec, systemctl

SCHEMA = "openclaw.evalbench.supervision.v1"
TICK_SECONDS = 0.25
CONNECT_SECONDS = 30.0
# Arming may take its time: nothing has been sent yet.
ARM_READ_SECONDS = 10.0
AGGREGATE_CALL_SECONDS = 10.0
_UNKNOWN = object()


async def _close(client):
    with contextlib.suppress(Exception):
        await asyncio.wait_for(client.__aexit__(None, None, None), 2.0)


def now_utc():
    return datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="milliseconds")


def systemd_environment():
    """What a transient unit of this harness needs to run the same code. No token, and no token file."""
    return {key: os.environ[key] for key in ("HOME", "PATH", "PYTHONPATH", "PYTHONDONTWRITEBYTECODE") if os.environ.get(key)}


def write_private(path, text):
    """Whole or not at all: a receipt is read while its writer may be killed."""
    temporary = f"{path}.new"
    with open(os.open(temporary, os.O_CREAT | os.O_WRONLY | os.O_TRUNC, 0o600), "w") as handle:
        handle.write(text)
    os.replace(temporary, path)


class ArmWatch:
    """One gateway: its unit, its meter, the trial it is running, and why it was stopped."""

    def __init__(self, name, spec, unit, token):
        self.name, self.url, self.unit, self._token = name, check_url(spec["url"]), unit, token
        self.meter = GatewayMeter()
        self.client = None
        self._closing = None
        self.identity = None
        self.boot = _UNKNOWN
        self.lock = asyncio.Lock()
        self.last_reading = None
        self.last_error = None
        self.readings = 0
        self.aggregates = 0
        self.aggregate_failures = 0
        self.longest_gap = 0.0
        self.trial = None
        self.trials = []
        self.idle_base = 0
        self.stop = None
        self.stopping = None

    @property
    def spent(self):
        return self.meter.tokens

    async def connect(self, timeout):
        client = GatewayClient(self.url, self._token, connect_timeout=timeout)
        await client.__aenter__()
        boot = (client.hello.get("server") or {}).get("bootId")
        if self.boot is not _UNKNOWN and boot != self.boot:
            await client.__aexit__(None, None, None)
            raise UnitRefused("the gateway is another process than at arming")
        self.client, self.boot = client, boot

    def drop(self):
        """Let go of the connection now. Closing it waits on the other side too, so that is not waited for."""
        client, self.client = self.client, None
        if client is not None:
            self._closing = asyncio.ensure_future(_close(client))

    async def disconnect(self):
        self.drop()
        if self._closing is not None:
            await self._closing

    async def read(self, limit):
        """One whole reading within the limit, or an exception. A lost connection, or one that hung, is opened again."""
        async with self.lock:
            try:
                await asyncio.wait_for(self._read(limit), limit)
            except Exception as error:
                self.last_error = f"{type(error).__name__}: {error}"[:200]
                self.drop()
                raise
            now = time.monotonic()
            if self.last_reading is not None:
                self.longest_gap = max(self.longest_gap, now - self.last_reading)
            self.last_reading, self.last_error = now, None
            self.readings += 1

    async def _read(self, limit):
        if self.client is None:
            await self.connect(limit)
        await self.meter.read(self.client, limit)


class Supervisor:
    def __init__(self, plan):
        self.plan, self.limits, self.offline = plan, plan["limits"], plan["offline"]
        self.arms = {}
        self.armed_at = None
        self.done = asyncio.Event()
        self.ended = None
        self._writer = None
        self._tasks = []
        self._stops = set()
        self._events = pathlib.Path(plan["events"])
        self.unwritten = 0

    # --- records ------------------------------------------------------------------------------------------------

    def event(self, event, **fields):
        """One line of the record. Nothing that stops a gateway may depend on it: a full disk is not a reason to go on."""
        try:
            line = json.dumps({"at": now_utc(), "event": event, **fields})
            with open(os.open(self._events, os.O_CREAT | os.O_WRONLY | os.O_APPEND, 0o600), "a") as handle:
                handle.write(line + "\n")
        except Exception:
            self.unwritten += 1

    def receipt(self):
        started = self.armed_at
        return {"schema": SCHEMA, "run": self.plan["run"], "offline": self.offline, "limits": self.limits, "ended": self.ended,
                "seconds": None if started is None else round(time.monotonic() - started, 3), "tokens": self.run_tokens(), "unwrittenRecords": self.unwritten,
                "arms": {name: {"identity": arm.identity, "tokens": arm.spent, "sessions": arm.meter.sessions, "readings": arm.readings, "aggregateReadings": arm.aggregates, "aggregateFailures": arm.aggregate_failures,
                                "longestGapSeconds": round(arm.longest_gap, 3), "trials": len(arm.trials),
                                "largestTrialTokens": max((t["tokens"] for t in arm.trials), default=0),
                                "longestTrialSeconds": max((t["seconds"] for t in arm.trials), default=0),
                                "sweptUnits": sum(len(t["sweptUnits"]) for t in arm.trials),
                                "stop": arm.stop} for name, arm in self.arms.items()}}

    def save(self):
        try:
            write_private(self.plan["receipt"], json.dumps(self.receipt(), indent=2) + "\n")
        except Exception:
            self.unwritten += 1

    def run_tokens(self):
        return sum(arm.spent for arm in self.arms.values())

    # --- arming -------------------------------------------------------------------------------------------------

    async def arm(self):
        """Prove every unit and read every baseline. Nothing is stopped if this fails: nothing has been sent yet."""
        for name, spec in self.plan["arms"].items():
            token = pathlib.Path(spec["tokenFile"]).expanduser().read_text().strip()
            self.arms[name] = ArmWatch(name, spec, from_spec(spec["unit"], self.offline), token)
        for arm in self.arms.values():
            arm.identity = await asyncio.to_thread(arm.unit.verify)
            await arm.connect(ARM_READ_SECONDS)
            await arm.meter.baseline(arm.client, ARM_READ_SECONDS)
            # The first reading at the run's own pace, so that a gateway too slow for it is refused and not stopped.
            await arm.read(self.limits["readSeconds"])
        if self.done.is_set():
            raise UnitRefused("the supervisor was told to stop while it was arming")
        self.armed_at = time.monotonic()
        for arm in self.arms.values():
            arm.last_reading = self.armed_at
        self.event("armed", arms={n: a.identity for n, a in self.arms.items()}, limits=self.limits)

    # --- the rules ----------------------------------------------------------------------------------------------

    def breach(self, arm, now):
        """The rule this arm has broken, or None. Spending rules use the last reading; the clocks use now."""
        limits, trial = self.limits, arm.trial
        if not arm.unit.alive():
            return "gateway-gone", "the gateway's process ended by itself or is another one"
        if now - arm.last_reading >= limits["blindSeconds"]:
            return "meter-blind", f"no complete reading for {now - arm.last_reading:.1f} s ({arm.last_error})"
        if trial is not None:
            tokens, seconds = arm.spent - trial["base"], now - trial["started"]
            if tokens >= limits["trialTokens"]:
                return "trial-tokens", f"{tokens} metered tokens in trial {trial['number']}, limit {limits['trialTokens']}"
            if seconds >= limits["trialSeconds"]:
                return "trial-wall-clock", f"trial {trial['number']} has run {seconds:.1f} s, limit {limits['trialSeconds']}"
        elif arm.spent - arm.idle_base >= limits["idleTokens"]:
            return "idle-spend", f"{arm.spent - arm.idle_base} metered tokens outside a trial, limit {limits['idleTokens']}"
        if arm.meter.active > limits["maxActiveRuns"]:
            return "active-runs", f"{arm.meter.active} sessions have an active run, limit {limits['maxActiveRuns']}"
        if arm.aggregate_failures >= limits["aggregateFailures"]:
            return "aggregate-blind", f"the usage total could not be read {arm.aggregate_failures} times in a row"
        return None

    def run_breach(self, now):
        if now - self.armed_at >= self.limits["runSeconds"]:
            return "run-wall-clock", f"{now - self.armed_at:.1f} s, limit {self.limits['runSeconds']}"
        if self.run_tokens() >= self.limits["runTokens"]:
            return "run-tokens", f"{self.run_tokens()} metered tokens on every arm together, limit {self.limits['runTokens']}"
        return None

    async def _poll(self, arm):
        """Read this gateway again and again, and apply the spending rules to each reading at once."""
        while not self.done.is_set() and arm.stop is None:
            with contextlib.suppress(Exception):
                await arm.read(self.limits["readSeconds"])
            self.judge()
            await self._pause(self.limits["pollSeconds"])

    async def _aggregate(self, arm):
        """The total that also sees what the list hides. Slow and cached, so it runs beside the readings."""
        while not self.done.is_set() and arm.stop is None:
            await self._pause(self.limits["aggregateSeconds"])
            if self.done.is_set() or arm.stop is not None:
                return
            try:
                if arm.client is None:
                    raise ConnectionError("between connections")
                await arm.meter.read_aggregate(arm.client, AGGREGATE_CALL_SECONDS)
                arm.aggregates, arm.aggregate_failures = arm.aggregates + 1, 0
            except Exception:
                arm.aggregate_failures += 1
            self.judge()

    async def _tick(self):
        """The clocks. They run beside the readings, so a gateway that does not answer delays nothing."""
        while not self.done.is_set():
            self.judge()
            if self._writer is not None:
                self.send({"event": "pulse", "tokens": self.run_tokens()})
            await self._pause(TICK_SECONDS)

    async def _pause(self, seconds):
        with contextlib.suppress(TimeoutError):
            await asyncio.wait_for(self.done.wait(), seconds)

    def judge(self):
        if self.armed_at is None or self.done.is_set():
            return
        now = time.monotonic()
        broken = self.run_breach(now)
        if broken:
            self.end(*broken)
            return
        for arm in self.arms.values():
            if arm.stop is None and (rule := self.breach(arm, now)):
                self.stop_arm(arm, *rule)

    # --- stopping -----------------------------------------------------------------------------------------------

    def stop_arm(self, arm, rule, detail):
        """Begin stopping one arm. Idempotent; the first reason stands."""
        if arm.stop is not None:
            return
        trial, now = arm.trial, time.monotonic()
        arm.stop = {"at": now_utc(), "rule": rule, "detail": detail, "tokens": arm.spent,
                    "trial": None if trial is None else {"number": trial["number"], "tokens": arm.spent - trial["base"], "seconds": round(now - trial["started"], 3)},
                    "secondsSinceReading": None if arm.last_reading is None else round(now - arm.last_reading, 3), "aborts": None, "result": None}
        arm.stopping = asyncio.ensure_future(self._stop(arm))
        self._stops.add(arm.stopping)

    async def _stop(self, arm):
        """Abort, kill, prove. The steps that could fail can fail, and the kill still comes; it is tried again until it is proved."""
        stop, started = arm.stop, time.monotonic()
        self.event("stopping", arm=arm.name, **{k: stop[k] for k in ("rule", "detail", "tokens", "trial", "secondsSinceReading")})
        self.send({"event": "stopping", "arm": arm.name, "rule": stop["rule"], "detail": stop["detail"]})
        if stop["rule"] != "run-finished":
            try:
                stop["aborts"] = await self._abort(arm)
            except Exception as error:
                stop["aborts"] = f"{type(error).__name__}: {error}"[:200]
        stop["abortSeconds"] = round(time.monotonic() - started, 3)
        while True:
            try:
                stop["result"] = await asyncio.to_thread(arm.unit.stop)
            except Exception as error:
                stop["result"] = {"stopped": False, "problems": [f"{type(error).__name__}: {error}"[:200]]}
            if stop["result"]["stopped"]:
                break
            self.event("stop-failed", arm=arm.name, problems=stop["result"]["problems"])
            self.send({"event": "stop-failed", "arm": arm.name, "problems": stop["result"]["problems"]})
            await asyncio.sleep(1.0)
        stop["seconds"] = round(time.monotonic() - started, 3)
        if stop["rule"] != "run-finished" or stop["trial"] is not None:
            # It was in the middle of something, or stopped for a reason. Started again, it could go on with it.
            problem = await asyncio.to_thread(arm.unit.mark_stopped, {k: stop[k] for k in ("at", "rule", "detail", "tokens", "trial")})
            if problem:
                self.event("marker-failed", arm=arm.name, problem=problem)
        await arm.disconnect()
        self.event("stopped", arm=arm.name, seconds=stop["seconds"], result=stop["result"])
        self.send({"event": "stopped", "arm": arm.name, "rule": stop["rule"], "detail": stop["detail"]})
        self.save()

    async def _abort(self, arm):
        """sessions.abort for what the last reading listed, within the time limit. The answers are only recorded."""
        answers = {}
        if arm.client is None:
            return answers

        async def one(index, key):
            try:
                answer = await arm.client.call("sessions.abort", {"key": key, "clearQueued": True})
                answers[index] = str(answer.get("status") or "answered")
            except Exception as error:
                answers[index] = f"{type(error).__name__}: {error}"[:120]
        with contextlib.suppress(TimeoutError):
            await asyncio.wait_for(asyncio.gather(*(one(i, k) for i, k in enumerate(arm.meter.keys[:20]))), self.limits["abortSeconds"])
        return answers

    def end(self, rule, detail):
        """Stop every arm and finish. Before it is armed there is nothing to stop: nothing has been sent."""
        try:
            if self.ended is None:
                self.ended = {"at": now_utc(), "rule": rule, "detail": detail}
                self.event("ending", rule=rule, detail=detail)
            for arm in self.arms.values() if self.armed_at is not None else ():
                self.stop_arm(arm, rule, detail)
        finally:
            self.done.set()

    # --- the runner's side ----------------------------------------------------------------------------------------

    def send(self, message):
        if self._writer is None or self._writer.is_closing():
            return
        with contextlib.suppress(Exception):
            self._writer.write((json.dumps(message) + "\n").encode())

    async def _serve(self, reader):
        """Answer the runner until it finishes or its connection ends."""
        while line := await self._line(reader):
            message = json.loads(line)
            kind, number = message.get("type"), message.get("id")
            if kind == "finish":
                self.end("run-finished", "the runner finished")
                return
            if kind == "stop":
                self.end("interrupted", str(message.get("reason")))
                return
            arm = self.arms.get(message.get("arm"))
            if arm is None:
                self.send({"event": "refused", "id": number, "reason": "no such arm"})
            elif kind == "begin":
                self._begin(arm, message, number)
            elif kind == "end":
                # On its own, so a gateway that answers slowly holds up no other arm.
                task = asyncio.ensure_future(self._end(arm, message, number))
                self._tasks.append(task)
                task.add_done_callback(self._task_ended)
            else:
                self.send({"event": "refused", "id": number, "reason": f"unknown request {kind}"})
        if not self.done.is_set():
            self.end("runner-gone", "the process that runs the trials closed its connection")

    @staticmethod
    async def _line(reader):
        try:
            return await reader.readline()
        except (ConnectionError, OSError):
            return b""

    def _begin(self, arm, message, number):
        self.judge()
        if arm.stop is not None or self.done.is_set():
            stop = arm.stop or self.ended
            self.send({"event": "refused", "id": number, "reason": f"{stop['rule']}: {stop['detail']}"})
        elif arm.trial is not None:
            self.send({"event": "refused", "id": number, "reason": "a trial of this arm is already running"})
        else:
            arm.trial = {"number": message.get("trial"), "started": time.monotonic(), "base": arm.spent}
            self.event("begin", arm=arm.name, trial=message.get("trial"), tokens=arm.spent)
            self.send({"event": "ok", "id": number})

    async def _end(self, arm, message, number):
        """Close a trial on a fresh reading, and end what a durable exec left running, so the next trial starts clean."""
        swept, fresh = {"clean": True, "units": [], "processes": 0}, False
        # Until it succeeds: the clocks stop the arm if it cannot. Nothing may be credited on an old reading.
        while arm.stop is None and not fresh:
            with contextlib.suppress(Exception):
                await arm.read(self.limits["readSeconds"])
                fresh = True
            if not fresh:
                await self._pause(TICK_SECONDS)
        if arm.stop is None:
            swept = await asyncio.to_thread(arm.unit.sweep)
        if arm.trial is not None:
            arm.meter.credit(int(message.get("charged") or 0) - (arm.spent - arm.trial["base"]))
        self.judge()
        if arm.trial is not None:
            trial = {"number": arm.trial["number"], "tokens": arm.spent - arm.trial["base"],
                     "seconds": round(time.monotonic() - arm.trial["started"], 3), "sweptUnits": swept["units"], "sweptProcesses": swept["processes"]}
            arm.trials.append(trial)
            arm.trial, arm.idle_base = None, arm.spent
            self.event("end", arm=arm.name, **trial)
            self.send({"event": "ok", "id": number, "trial": trial, "stopped": arm.stop and f"{arm.stop['rule']}: {arm.stop['detail']}"})
        else:
            self.send({"event": "refused", "id": number, "reason": "no trial of this arm is running"})
        if not swept["clean"]:
            self.stop_arm(arm, "sweep-failed", "what a trial left running outside its gateway could not be ended")

    # --- the process ------------------------------------------------------------------------------------------------

    async def run(self):
        """Serve one runner from arming to the end. Returns the exit code."""
        loop = asyncio.get_running_loop()
        for name in (signal.SIGTERM, signal.SIGINT, signal.SIGHUP):
            loop.add_signal_handler(name, self.end, "supervisor-stopped", f"the supervisor was sent {name.name}")
        connected = loop.create_future()

        async def accept(reader, writer):
            if connected.done() or _peer_uid(writer) != os.getuid():
                writer.close()
                return
            connected.set_result((reader, writer))
            await self.done.wait()

        path = pathlib.Path(self.plan["socket"])
        server = await asyncio.start_unix_server(accept, path=str(path), limit=1 << 20)
        try:
            try:
                reader, self._writer = await asyncio.wait_for(connected, CONNECT_SECONDS)
            except TimeoutError:
                self.event("refused", reason="no runner connected")
                return 3
            try:
                await self.arm()
            except Exception as error:
                reason = f"{type(error).__name__}: {error}"[:500]
                self.event("refused", reason=reason)
                self.send({"event": "refused", "reason": reason})
                with contextlib.suppress(ConnectionError):
                    await self._writer.drain()
                return 2
            self.send({"event": "armed", "pid": os.getpid(), "limits": self.limits, "arms": {n: a.identity for n, a in self.arms.items()}})
            self._tasks = [asyncio.ensure_future(t) for t in (*(watch(a) for a in self.arms.values() for watch in (self._poll, self._aggregate)), self._tick(), self._serve(reader))]
            for task in self._tasks:
                task.add_done_callback(self._task_ended)
            await self.done.wait()
        finally:
            await self._wind_down(server, path)
        return 0

    def _task_ended(self, task):
        # A bug in a watch is a watch that no longer watches.
        if not task.cancelled() and task.exception() is not None and not self.done.is_set():
            self.end("supervisor-stopped", f"internal error: {type(task.exception()).__name__}: {task.exception()}"[:300])

    async def _wind_down(self, server, path):
        while pending := [t for t in self._stops if not t.done()]:
            await asyncio.wait(pending, timeout=1.0)
            self.send({"event": "pulse", "tokens": self.run_tokens()})
        for task in self._tasks:
            task.cancel()
        await asyncio.gather(*self._tasks, return_exceptions=True)
        for arm in self.arms.values():
            await arm.disconnect()
        # Either every unit is proved stopped or nothing was ever sent, so the timer that would stop them is not needed.
        await asyncio.to_thread(disarm_deadman, self.plan)
        if self.armed_at is not None:
            self.save()
            self.event("ended", **(self.ended or {}))
            self.send({"event": "finished", "receipt": self.receipt()})
        if self._writer is not None:
            with contextlib.suppress(ConnectionError, TimeoutError):
                await asyncio.wait_for(self._writer.drain(), 2.0)
            self._writer.close()
        server.close()
        remove_socket(self.plan)


def remove_socket(plan):
    """The socket and the directory make_plan made for it. Either side may be the last one left to do it."""
    path = pathlib.Path(plan["socket"])
    with contextlib.suppress(OSError):
        path.unlink(missing_ok=True)
        path.parent.rmdir()


def disarm_deadman(plan):
    if plan.get("deadman"):
        systemctl("stop", f"{plan['deadman']}.timer")


def _peer_uid(writer):
    connection = writer.get_extra_info("socket")
    _, uid, _ = struct.unpack("3i", connection.getsockopt(socket.SOL_SOCKET, socket.SO_PEERCRED, struct.calcsize("3i")))
    return uid


def stop_everything(plan, by="a stop with no supervisor"):
    """Stop every unit of a plan, with no supervisor: the runner's, the deadman timer's and a person's. Returns {arm: result}.

    All of them are killed before any is proved stopped, so one that is slow to prove holds up no other.
    """
    units, running, out = {}, {}, {}
    for name, spec in plan["arms"].items():
        try:
            units[name] = from_spec(spec["unit"], plan["offline"])
            running[name] = units[name].kill()
        except Exception as error:
            out[name] = {"stopped": False, "problems": [f"{type(error).__name__}: {error}"[:200]]}

    def prove(name):
        try:
            out[name] = units[name].stop()
            if running.get(name):
                units[name].mark_stopped({"at": now_utc(), "rule": "stopped-without-supervisor", "detail": by})
        except Exception as error:
            out[name] = {"stopped": False, "problems": [f"{type(error).__name__}: {error}"[:200]]}
    with concurrent.futures.ThreadPoolExecutor(max(1, len(units))) as pool:
        list(pool.map(prove, units))
    return {name: out[name] for name in plan["arms"]}


def main(plan_path):
    plan = json.loads(pathlib.Path(plan_path).read_text())
    if plan.get("schema") != SCHEMA:
        raise SystemExit(f"{plan_path} is not a supervision plan")

    async def supervise():
        return await Supervisor(plan).run()
    return asyncio.run(supervise())
