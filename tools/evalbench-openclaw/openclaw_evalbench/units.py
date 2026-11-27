"""The isolated gateways as processes: proving a unit is the one it should be, and ending everything it owns.

A stop here never asks the product to cooperate. A gateway that is told to stop may drain its turns for minutes, and a
durable exec runs in its own openclaw-proc-<hash> user unit, outside the gateway's cgroup, and outlives it (openclaw
ab5a30ea src/agents/bash-process-systemd.ts:70-162). process.childScope can move other commands into scopes of their own
(src/process/child-memory-scope.ts). So a stop kills the gateway's whole cgroup, then the same for every transient unit
that belongs to it and every process started with its state directory, until none is left. The cgroup is killed through
the kernel first (cgroup.kill), so that no stop waits on systemd; and nothing is called stopped that systemd could not
be asked about.
"""

import contextlib
import json
import os
import pathlib
import re
import signal
import subprocess
import time

UNIT = re.compile(r"openclaw-proof-comp-[0-9a-f]{8}")
COMMAND_SECONDS = 5.0
GONE_SECONDS = 5.0
SWEEP_SECONDS = 8.0
SWEEP_PAUSE_SECONDS = 0.2
# This harness's own transient units.
OWN_UNITS = "openclaw-evalprop-"
STOP_MARKER = "supervisor-stop.json"
_LIVE = ("active", "activating", "deactivating", "reloading")


class UnitRefused(Exception):
    """This is not an isolated proof gateway that a stop may be aimed at."""


def proof_directory(unit, home="~"):
    """Where the proof-gateway launcher keeps a unit's config, token and state (composite-launcher.sh:32-33)."""
    return pathlib.Path(home).expanduser() / "proof-gw" / unit.removeprefix("openclaw-proof-")


def systemctl(*args, timeout=COMMAND_SECONDS):
    """One systemctl --user command. Never raises: a stop has to go on whatever one command does."""
    argv = ["systemctl", "--user", "--no-ask-password", *args]
    try:
        return subprocess.run(argv, capture_output=True, text=True, timeout=timeout, check=False, stdin=subprocess.DEVNULL)
    except (subprocess.TimeoutExpired, OSError) as error:
        return subprocess.CompletedProcess(argv, 124, "", f"{type(error).__name__}: {error}")


def process_start(pid):
    """A process's start time, so a reused pid is not taken for it. None when it is gone or a zombie."""
    try:
        fields = pathlib.Path(f"/proc/{pid}/stat").read_text().rpartition(")")[2].split()
    except OSError:
        return None
    return None if fields[0] in ("Z", "X") else fields[19]


def _kill(pid):
    try:
        os.kill(pid, signal.SIGKILL)
        return True
    except (ProcessLookupError, PermissionError):
        return False


def _processes(cgroup):
    """Every process of a cgroup and the cgroups below it."""
    out = []
    for path in sorted(cgroup.rglob("cgroup.procs")) if cgroup else []:
        try:
            out += [int(p) for p in path.read_text().split()]
        except OSError:
            continue
    return out


def _kill_cgroup(cgroup):
    """SIGKILL for everything in a cgroup at once, by the kernel (cgroup v2), and one by one where it cannot."""
    if cgroup is None:
        return
    with contextlib.suppress(OSError):
        (cgroup / "cgroup.kill").write_text("1")
    for pid in _processes(cgroup):
        _kill(pid)


class SystemdUnit:
    """One proof gateway's transient user unit."""

    def __init__(self, unit, port, directory=None):
        if not UNIT.fullmatch(unit or ""):
            raise UnitRefused(f"{unit!r} is not a proof gateway's unit name")
        self.unit, self.port = unit, port
        self.directory = pathlib.Path(directory) if directory else proof_directory(unit)
        live = pathlib.Path("~/.openclaw").expanduser()
        if not self.directory.is_absolute() or self.directory == live or live in self.directory.parents:
            raise UnitRefused(f"{self.directory} is not an isolated gateway's directory")
        self._cgroup = None
        self._identity = None

    @property
    def state(self):
        return self.directory / "state"

    def show(self, name=None):
        """What systemd says of a unit, or None when it could not be asked. An unknown unit is an answer (not-found)."""
        done = systemctl("show", name or f"{self.unit}.service", "-p", "LoadState,ActiveState,MainPID,ControlGroup,Restart,KillMode,Environment")
        shown = dict(line.split("=", 1) for line in done.stdout.splitlines() if "=" in line)
        return shown if done.returncode == 0 and "ActiveState" in shown else None

    @staticmethod
    def _cgroup_of(shown, name):
        """The unit's own cgroup, and never one above it."""
        group = (shown or {}).get("ControlGroup") or ""
        return pathlib.Path("/sys/fs/cgroup") / group.lstrip("/") if group.endswith(f"/{name}") and ".." not in group else None

    def _beside(self, name):
        """Where a user unit's cgroup is when systemd does not say: beside this gateway's, in the user manager's app slice."""
        uid = os.getuid()
        slice_ = self._cgroup.parent if self._cgroup else pathlib.Path(f"/sys/fs/cgroup/user.slice/user-{uid}.slice/user@{uid}.service/app.slice")
        path = slice_ / name
        return path if path.is_dir() else None

    def verify(self):
        """That this unit is the isolated gateway, and that killing it ends it. Returns the receipt."""
        seen, problems = self.show(), []
        if seen is None:
            raise UnitRefused(f"{self.unit}: systemd could not be asked about it")
        pid = int(seen.get("MainPID") or 0)
        if seen.get("ActiveState") != "active" or pid <= 0:
            raise UnitRefused(f"{self.unit} is not running")
        environment = seen.get("Environment", "").split()
        for name, want in (("OPENCLAW_STATE_DIR", self.state), ("OPENCLAW_CONFIG_PATH", self.directory / "openclaw.json")):
            if f"{name}={want}" not in environment:
                problems.append(f"its {name} is not {want}")
        if seen.get("Restart") != "no":
            problems.append(f"it would restart (Restart={seen.get('Restart')})")
        if seen.get("KillMode") != "control-group":
            problems.append(f"a stop would not end its whole cgroup (KillMode={seen.get('KillMode')})")
        self._cgroup = self._cgroup_of(seen, f"{self.unit}.service")
        if self._cgroup is None or pid not in self.processes():
            problems.append("its cgroup cannot be read")
        elif not self._listens():
            problems.append(f"no process of it listens on {self.port}")
        owned = [name for name in self._owned_units() if self._live(name) is not False]
        if owned:
            problems.append(f"it already owns {', '.join(owned)}")
        if (self.directory / STOP_MARKER).exists():
            problems.append(f"a supervisor stopped it before ({self.directory / STOP_MARKER}); shred it, never restart it")
        if problems:
            raise UnitRefused(f"{self.unit}: " + "; ".join(problems))
        self._identity = (pid, process_start(pid))
        return {"unit": self.unit, "directory": str(self.directory), "mainPid": pid, "port": self.port}

    def alive(self):
        """Whether the process verify() saw is still that process. Cheap: no systemctl."""
        return self._identity is not None and process_start(self._identity[0]) == self._identity[1]

    def processes(self):
        return _processes(self._cgroup)

    def _listens(self):
        try:
            done = subprocess.run(["ss", "-ltnpH", f"sport = :{self.port}"], capture_output=True, text=True, timeout=COMMAND_SECONDS, check=False)
        except (subprocess.TimeoutExpired, OSError):
            return False
        return bool({int(p) for p in re.findall(r"pid=(\d+),", done.stdout)} & set(self.processes()))

    def _transient(self):
        return pathlib.Path(os.environ.get("XDG_RUNTIME_DIR") or f"/run/user/{os.getuid()}") / "systemd/transient"

    def _owned_units(self):
        """The transient user units that are this gateway's: a durable exec's log is under its state directory.

        Only the properties that say so count. A command line can name any path, this gateway's among them, and a unit that
        merely mentions it belongs to whoever started it.
        """
        out = []
        for path in sorted(p for p in self._transient().glob("*") if p.suffix in (".service", ".scope")):
            if path.name == f"{self.unit}.service" or path.name.startswith(OWN_UNITS):
                continue
            try:
                text = path.read_text(errors="replace")
            except OSError:
                continue
            if any(self._owns(*line.split("=", 1)) for line in text.splitlines() if "=" in line):
                out.append(path.name)
        return out

    def _owns(self, key, value):
        if key in ("StandardOutput", "StandardError"):
            return value.partition(":")[2].startswith(f"{self.directory}/")
        if key == "Environment":
            words = re.split(r'["\s]+', value)
            return f"OPENCLAW_STATE_DIR={self.state}" in words or f"OPENCLAW_SYSTEMD_UNIT={self.unit}.service" in words
        return key in ("BindsTo", "PartOf", "StopPropagatedFrom") and f"{self.unit}.service" in value.split()

    def _live(self, name):
        """Whether an owned unit still runs or is still held. None when that could not be learned."""
        shown = self.show(name)
        cgroup = self._cgroup_of(shown, name) or self._beside(name)
        if _processes(cgroup):
            return True
        return None if shown is None else shown["ActiveState"] in _LIVE

    def _end(self, name):
        _kill_cgroup(self._beside(name))
        _kill_cgroup(self._cgroup_of(self.show(name), name))
        systemctl("kill", "--signal=SIGKILL", name)
        systemctl("stop", name)
        systemctl("reset-failed", name)

    def _owned_processes(self):
        """Processes started with this gateway's state directory, outside its cgroup and wherever else they run."""
        needle, inside, out = f"OPENCLAW_STATE_DIR={self.state}".encode(), set(self.processes()), []
        for entry in pathlib.Path("/proc").iterdir():
            if not entry.name.isdigit() or int(entry.name) in (os.getpid(), *inside):
                continue
            try:
                if needle in (entry / "environ").read_bytes().split(b"\0") and process_start(int(entry.name)):
                    out.append(int(entry.name))
            except OSError:
                continue
        return out

    def sweep(self):
        """End what outlives the gateway. Safe while the gateway runs: its own cgroup is left alone."""
        units, processes, clean, end = [], 0, 0, time.monotonic() + SWEEP_SECONDS
        while time.monotonic() < end:
            live = [name for name in self._owned_units() if self._live(name) is not False]
            pids = self._owned_processes()
            if not live and not pids:
                clean += 1
                # A durable unit's start job can land just after the gateway that asked for it died.
                if clean == 2:
                    return {"clean": True, "units": units, "processes": processes}
            else:
                clean = 0
            for name in live:
                self._end(name)
                if name not in units:
                    units.append(name)
            processes += sum(_kill(pid) for pid in pids)
            time.sleep(SWEEP_PAUSE_SECONDS)
        return {"clean": False, "units": units, "processes": processes}

    def stop(self):
        """Kill the unit's whole cgroup, then end everything it owns elsewhere. Returns what was proved."""
        started, problems = time.monotonic(), []
        self.kill()
        killed_after = time.monotonic() - started
        while (left := self.processes()) and time.monotonic() < started + GONE_SECONDS:
            _kill_cgroup(self._cgroup)
            time.sleep(0.02)
        gone_after = time.monotonic() - started
        systemctl("kill", "--signal=SIGKILL", f"{self.unit}.service")
        systemctl("stop", "--no-block", f"{self.unit}.service")
        if left:
            problems.append(f"{len(left)} process(es) of the cgroup survived SIGKILL")
        shown = self.show()
        if shown is None:
            problems.append("systemd could not be asked whether it is stopped")
        elif shown["ActiveState"] in ("active", "activating", "reloading"):
            problems.append(f"{self.unit} is still {shown['ActiveState']}")
        swept = self.sweep()
        if not swept["clean"]:
            problems.append("something it owns is still running, or could not be asked about")
        return {"stopped": not problems, "problems": problems, "durableUnits": swept["units"], "strayProcesses": swept["processes"],
                "killSeconds": round(killed_after, 3), "goneSeconds": round(gone_after, 3), "seconds": round(time.monotonic() - started, 3)}

    def running(self):
        """Whether anything of the unit runs."""
        if self._cgroup is None:
            self._cgroup = self._beside(f"{self.unit}.service") or self._cgroup_of(self.show(), f"{self.unit}.service")
        return bool(self.processes())

    def kill(self):
        """The first half of a stop, with nothing to wait for."""
        self.running()
        _kill_cgroup(self._cgroup)

    def mark_stopped(self, record):
        """Leave the reason beside the gateway's state, so it is never restarted on what it was doing."""
        path = self.directory / STOP_MARKER
        try:
            with open(os.open(path, os.O_CREAT | os.O_WRONLY | os.O_TRUNC, 0o600), "w") as handle:
                handle.write(json.dumps(record, indent=2) + "\n")
        except OSError as error:
            return f"{type(error).__name__}: {error}"
        return None


class FakeProcess:
    """A fake gateway's process, for offline runs and tests. It owns no units; a stop is SIGKILL."""

    def __init__(self, pid):
        self.pid, self._start = int(pid), process_start(int(pid))

    def verify(self):
        cmdline = pathlib.Path(f"/proc/{self.pid}/cmdline").read_bytes().split(b"\0") if self._start else []
        if b"openclaw_evalbench.fake_gateway" not in cmdline:
            raise UnitRefused(f"pid {self.pid} is not a fake gateway")
        return {"pid": self.pid, "fake": True}

    def alive(self):
        return self._start is not None and process_start(self.pid) == self._start

    def sweep(self):
        return {"clean": True, "units": [], "processes": 0}

    def running(self):
        return self.alive()

    def kill(self):
        if self.alive():
            _kill(self.pid)

    def stop(self):
        started = time.monotonic()
        while self.alive() and time.monotonic() - started < GONE_SECONDS:
            _kill(self.pid)
            time.sleep(0.01)
        took, stopped = round(time.monotonic() - started, 3), not self.alive()
        return {"stopped": stopped, "problems": [] if stopped else ["the fake gateway survived SIGKILL"], "durableUnits": [],
                "strayProcesses": 0, "killSeconds": took, "goneSeconds": took, "seconds": took}

    def mark_stopped(self, _record):
        return None


def from_spec(spec, offline):
    """The unit a supervision plan names. A live plan can only name a proof gateway's systemd unit."""
    if spec.get("kind") == "systemd":
        return SystemdUnit(spec["unit"], spec["port"], spec.get("directory"))
    if spec.get("kind") == "fake" and offline:
        return FakeProcess(spec["pid"])
    raise UnitRefused(f"a {'offline' if offline else 'live'} plan cannot stop a {spec.get('kind')!r} unit")
