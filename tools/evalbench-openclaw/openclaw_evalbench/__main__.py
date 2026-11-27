"""model | preflight | run | offline | report | overlay | supervise | stop. See README.md."""

import argparse
import asyncio
import contextlib
import datetime
import hashlib
import json
import logging
import os
import pathlib
import re
import signal
import subprocess
import sys
import tempfile

import yaml

from . import arms as arms_module
from .arms import ROOT, default_arms, load_arms, load_scenarios
from .trial import SCRATCH_PATH

# Per arm, checked between trials. Not a ceiling: the trial in flight can exceed it (stops.py).
DEFAULT_TOKEN_BUDGET = 35_000_000
TOKEN_BUDGET_RULE = "per arm, checked between trials; not a ceiling, the trial in flight can exceed it"
OFFLINE_DEADLINE_SECONDS = 1.0
# The totals of a full fire (README.md, Cost); arms.json has the canary's, which `run` takes unless told otherwise.
FULL_RUN_TOKENS, FULL_RUN_SECONDS = 75_000_000, 4 * 3600
OFFLINE_POLL_SECONDS = 0.2
INTERRUPTS = (signal.SIGINT, signal.SIGTERM, signal.SIGHUP)
# EvalBench drops a session three hours after it starts and ends the job without a result (util/sessionmgr.py ttl).
SESSION_TTL_SECONDS = 48 * 3600
CSV_FILES = ("configs.csv", "evals.csv", "scores.csv", "summary.csv")
# A rehearsal's scripted awareness labels, beside its report: what the archive's report is rebuilt with.
AWARENESS_LABELS = "awareness-labels.jsonl"
log = logging.getLogger("openclaw_evalbench")


def _sha256(path):
    return hashlib.sha256(pathlib.Path(path).read_bytes()).hexdigest()


def _git(*args, cwd=ROOT):
    done = subprocess.run(["git", "-C", str(cwd), *args], capture_output=True, text=True, check=False)
    return done.stdout.strip() if done.returncode == 0 else None


def _now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")


def build_configs(out, arm_names, *, model, gateway_urls=None, num_trials=None, scenarios=None):
    """EvalBench's configs for this run, written under out/config. Returns {arm: run config}.

    The firing model goes into every arm's model config here, from arms.json: EvalBench copies it into configs.csv and
    sends it back with every turn, and the adapter refuses a turn that names another.

    Repository paths stay relative to this directory, which is the working directory of a run: EvalBench copies them
    into configs.csv, and a host path there would be noise.
    """
    config_dir = out / "config"
    config_dir.mkdir(parents=True)
    base = yaml.safe_load((ROOT / "configs/run_config.yaml").read_text())
    base["reporting"]["csv"]["output_directory"] = str(out / "results")
    if num_trials is not None:
        base["num_trials"] = num_trials
    if scenarios:
        base["scenarios"] = list(scenarios)
    run_configs = {}
    for name in arm_names:
        config = yaml.safe_load((ROOT / f"configs/model_arm_{name.lower()}.yaml").read_text())
        config["env"]["OPENCLAW_EVAL_MODEL"] = model
        if gateway_urls:
            config["env"]["OPENCLAW_EVAL_GATEWAY_URL"] = gateway_urls[name]
        path = config_dir / f"model_arm_{name.lower()}.yaml"
        path.write_text(yaml.safe_dump(config, sort_keys=False))
        run_configs[name] = {**base, "experiment_name": f"{base['experiment_name']}-{name}", "model_config": str(path)}
        (config_dir / f"run_arm_{name.lower()}.yaml").write_text(yaml.safe_dump(run_configs[name], sort_keys=False))
    return run_configs


def gateway_urls(arm_names, overrides):
    urls = {n: yaml.safe_load((ROOT / f"configs/model_arm_{n.lower()}.yaml").read_text())["env"]["OPENCLAW_EVAL_GATEWAY_URL"]
            for n in arm_names}
    for item in overrides or []:
        name, _, url = item.partition("=")
        if name not in urls or not url:
            raise SystemExit(f"--gateway-url wants ARM=ws://127.0.0.1:PORT, got {item!r}")
        urls[name] = url
    return urls


@contextlib.contextmanager
def _logging_to(path):
    """EvalBench logs every envelope at INFO: to a file, not to the terminal. The adapter's own lines go to both."""
    root = logging.getLogger()
    handler = logging.FileHandler(path)
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s"))
    console = logging.StreamHandler(sys.stderr)
    console.setFormatter(logging.Formatter("%(message)s"))
    root.handlers = [handler]
    root.setLevel(logging.INFO)
    log.addHandler(console)
    try:
        yield
    finally:
        log.removeHandler(console)
        root.removeHandler(handler)
        handler.close()


def _private(out):
    private = out / "private"
    private.mkdir(mode=0o700, exist_ok=True)
    return private


async def run_jobs(out, run_configs, *, arms, tokens, token_budget, supervision=None, deadline_seconds=None):
    """Host EvalBench's EvalService on loopback and run one job per arm, all at once. Returns {arm: result}."""
    import grpc
    from eval_service import EvalServicer, SessionManagerInterceptor
    from evalproto import eval_service_pb2_grpc
    from util import get_SessionManager

    from .adapter import ArmJob

    get_SessionManager().set_ttl(SESSION_TTL_SECONDS)
    private = _private(out)
    server = grpc.aio.server(interceptors=[SessionManagerInterceptor("openclaw")])
    eval_service_pb2_grpc.add_EvalServiceServicer_to_server(EvalServicer(), server)
    port = server.add_insecure_port("127.0.0.1:0")
    await server.start()
    results = {}
    try:
        async with grpc.aio.insecure_channel(f"127.0.0.1:{port}") as channel:
            extra = {} if deadline_seconds is None else {"deadline_seconds": deadline_seconds}

            async def one(name):
                trial_log = private / f"trials-{name}.jsonl"
                os.close(os.open(trial_log, os.O_CREAT | os.O_WRONLY, 0o600))
                job = ArmJob(channel=channel, arms=arms, arm_name=name, run_config=run_configs[name], token=tokens[name],
                             trial_log=trial_log, token_budget=token_budget, supervision=supervision, **extra)
                try:
                    results[name] = {**await job.run(), "error": None}
                except Exception as error:
                    results[name] = {"jobId": None, "summary": None, "error": f"{type(error).__name__}: {error}"}
                results[name].update(trials=job.trials, halted=job.guard.halted, meteredTokens=job.guard.tokens)

            await asyncio.gather(*(one(name) for name in run_configs))
    finally:
        await server.stop(grace=0)
    return results


def _supervision_failures(summary):
    """What the supervisor had to do, or could not do. A clean run has none: every gateway stopped, for no other reason."""
    failures = []
    if summary["halted"]:
        failures.append(f"run halted: {summary['halted']}")
    receipt = summary["receipt"]
    if receipt is None:
        failures.append("the supervisor left no receipt")
    stops = {n: a["stop"] for n, a in receipt["arms"].items()} if receipt else {}
    for name, stop in stops.items():
        if not stop or not (stop["result"] or {}).get("stopped"):
            failures.append(f"arm {name}'s gateway was not proved stopped")
    for name, result in (summary["runnerStops"] or {}).items():
        if not result["stopped"]:
            failures.append(f"arm {name}'s gateway was not proved stopped by the runner: {'; '.join(result['problems'])}")
    return failures


def _awareness_files(out, jobs, arms, offline):
    """The declared awareness sample and the judge's input, written privately (they hold replies). A rehearsal also labels
    them with the scripted stand-in; a run never judges itself. Returns the labels, or None."""
    from . import awareness
    from .report import awareness_items
    items = awareness_items(jobs, arms=arms)
    private = _private(out)
    awareness.write_jsonl(private / "awareness-sample.jsonl",
                          [{k: i[k] for k in ("item", "arm", "job", "evalId", "promptId", "kind", "elected")} for i in items])
    awareness.write_jsonl(private / "awareness-judge-input.jsonl", awareness.judge_input(items, arms))
    if not offline:
        return None
    labels = awareness.scripted_labels(items, arms)
    awareness.write_jsonl(out / AWARENESS_LABELS, labels, mode=0o644)
    return labels


def _finish(out, results, manifest, arms):
    """Manifest and report. Returns the exit code: 0 only when every arm's job ended, unhalted, with its CSVs."""
    from .report import build_report, render, render_csv
    jobs, failures = {}, []
    results = {name: results[name] for name in arms["arms"] if name in results}
    for name, result in results.items():
        job_dir = out / "results" / str(result["jobId"])
        if result["error"] or not all((job_dir / f).is_file() for f in CSV_FILES):
            failures.append(f"arm {name}: {result['error'] or 'CSV files missing'}")
            continue
        jobs[name] = [job_dir]
        if result["halted"]:
            failures.append(f"arm {name} halted: {result['halted']}")
    if manifest.get("supervision"):
        failures += _supervision_failures(manifest["supervision"])
    manifest.update(ended=_now(), results=results, failures=failures)
    (out / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    if jobs:
        try:
            labels = _awareness_files(out, jobs, arms, bool(manifest.get("offline")))
        except (ValueError, OSError) as error:
            # The rates are written whatever happened to the awareness files; the run says what did.
            labels = None
            failures.append(f"awareness: {error}")
            manifest["failures"] = failures
            (out / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
        report = build_report(jobs, arms=arms, manifest=manifest, awareness=labels)
        (out / "report.json").write_text(json.dumps(report, indent=2) + "\n")
        (out / "report.md").write_text(render(report))
        (out / "report.csv").write_text(render_csv(report))
        print(render(report))
    for failure in failures:
        print(f"FAILED: {failure}", file=sys.stderr)
    return 1 if failures else 0


def _manifest(args, arms, urls, offline):
    pin = (ROOT / "EVALBENCH_PIN").read_text().strip()
    return {
        "schema": "openclaw.evalbench.run.v1", "issue": "karmaterminal/openclaw#1575", "offline": offline,
        "go": getattr(args, "go", None), "started": _now(), "arms": args.arms, "model": arms["model"], "gatewayUrls": urls,
        "evalbenchPin": pin, "evalbenchHead": _git("rev-parse", "HEAD", cwd=os.environ.get("OPENCLAW_EVALBENCH_SRC", ".")),
        "harnessHead": _git("rev-parse", "HEAD"), "harnessDirty": bool(_git("status", "--porcelain", "--", ".")),
        "numTrials": args.num_trials, "scenarios": args.scenarios, "tokenBudgetPerArm": args.token_budget, "tokenBudgetRule": TOKEN_BUDGET_RULE,
        "caps": arms["caps"]["set"],
        "evalsetSha256": _sha256(ROOT / "datasets/continuation-propensity.evalset.json"), "armsSha256": _sha256(ROOT / "arms.json"),
        "awareness": {k: arms["awareness"][k] for k in ("prompt", "sha256", "seed", "perPrompt")},
    }


def _new_out(path):
    out = pathlib.Path(path).expanduser().resolve()
    if out.exists():
        raise SystemExit(f"{out} exists; a run never reuses a directory")
    out.mkdir(parents=True, mode=0o700)
    os.chdir(ROOT)  # the configs' own paths are relative to it
    return out


def _token_files(arm_names):
    from .adapter import read_token
    try:
        return {name: read_token(name) for name in arm_names}
    except (ValueError, OSError) as error:
        raise SystemExit(f"gateway token: {error}") from None


def cmd_preflight(args):
    from .gateway import GatewayClient
    from .trial import preflight
    arms = load_arms()
    urls, tokens = gateway_urls(args.arms, args.gateway_url), _token_files(args.arms)

    async def check(name):
        try:
            async with GatewayClient(arms_module.check_url(urls[name]), tokens[name]) as client:
                return {"ok": True, **await preflight(name, arms["arms"][name], arms["model"], arms["caps"], client)}
        except Exception as error:
            return {"ok": False, "arm": name, "reason": f"{type(error).__name__}: {error}"}

    async def everything():
        return [await check(name) for name in args.arms]

    receipts = asyncio.run(everything())
    print(json.dumps(receipts, indent=2))
    return 0 if all(r["ok"] for r in receipts) else 1


async def _supervised(path, plan, launch, work):
    """Arm the supervisor, do the work, and have every gateway stopped, whatever the work did. Returns (work, summary)."""
    from .supervision import Supervision
    supervision = await Supervision.start(path, plan, launch)
    loop, done = asyncio.get_running_loop(), None

    def interrupted(name):
        print(f"{name}: stopping every gateway; the run ends in order", file=sys.stderr, flush=True)
        supervision.interrupt(name)
        for sig in INTERRUPTS:  # a second one is the default again
            loop.remove_signal_handler(sig)
    for sig in INTERRUPTS:
        loop.add_signal_handler(sig, interrupted, sig.name)
    try:
        done = await work(supervision)
    finally:
        summary = await supervision.finish()
        for sig in INTERRUPTS:
            loop.remove_signal_handler(sig)
    return done, summary


def _declared_judge_prompt(arms):
    """Refuse a run whose awareness judge prompt is not the one arms.json declares, before anything is sent."""
    from . import awareness
    try:
        awareness.prompt_sha256(arms)
    except (ValueError, OSError) as error:
        raise SystemExit(f"refusing: {error}") from None


def cmd_run(args):
    from .supervision import SupervisorError, launch_live, limits_for, make_plan, stopped_before, systemd_units
    if not re.fullmatch(r"\d{17,20}", args.go or ""):
        raise SystemExit("refusing: --go needs the message id of the seat owner's go (README.md, Firing it)")
    arms, urls = load_arms(), gateway_urls(args.arms, args.gateway_url)
    _declared_judge_prompt(arms)
    for url in urls.values():
        try:
            arms_module.check_url(url)
        except arms_module.ArmMismatch as error:
            raise SystemExit(f"refusing {url}: {error}") from None
    if SCRATCH_PATH.exists():
        raise SystemExit(f"refusing: {SCRATCH_PATH} exists; the prompts need it absent")
    units = systemd_units(arms, urls)
    if before := stopped_before(units):
        raise SystemExit(f"refusing: a supervisor stopped {', '.join(before)} before; shred it and set it up again")
    tokens, out = _token_files(args.arms), _new_out(args.out)
    manifest = _manifest(args, arms, urls, offline=False)
    with _logging_to(out / "evalbench.log"):
        run_configs = build_configs(out, args.arms, model=arms["model"], gateway_urls=urls, num_trials=args.num_trials, scenarios=args.scenarios)
        path, plan = make_plan(_private(out), offline=False, urls=urls, units=units,
                               limits=limits_for(arms, run_tokens=args.run_token_cap, run_seconds=args.run_seconds),
                               token_files={n: pathlib.Path(os.environ[f"OPENCLAW_EVAL_TOKEN_FILE_{n}"]).expanduser().resolve() for n in args.arms})
        try:
            results, manifest["supervision"] = asyncio.run(_supervised(path, plan, launch_live, lambda supervision: run_jobs(
                out, run_configs, arms=arms, tokens=tokens, token_budget=args.token_budget, supervision=supervision)))
        except SupervisorError as error:
            raise SystemExit(f"refusing: the supervisor is not armed, so nothing was sent: {error}") from None
    return _finish(out, results, manifest, arms)


def cmd_offline(args):
    from .fake_gateway import launch_fakes
    from .gateway import GatewayClient
    from .supervision import launch_offline, limits_for, make_plan
    arms = load_arms()
    _declared_judge_prompt(arms)
    out = _new_out(args.out)
    manifest = _manifest(args, arms, None, offline=True)

    async def everything(secrets):
        with launch_fakes(args.arms, secrets) as fakes:
            urls = {n: f["url"] for n, f in fakes.items()}
            manifest["gatewayUrls"] = urls
            run_configs = build_configs(out, args.arms, model=arms["model"], gateway_urls=urls, num_trials=args.num_trials, scenarios=args.scenarios)
            path, plan = make_plan(_private(out), offline=True, urls=urls, token_files={n: f["tokenFile"] for n, f in fakes.items()},
                                   units={n: {"kind": "fake", "pid": f["pid"]} for n, f in fakes.items()},
                                   limits=limits_for(arms, run_tokens=args.run_token_cap, run_seconds=args.run_seconds, pollSeconds=OFFLINE_POLL_SECONDS))
            leftovers = {}

            async def work(supervision):
                results = await run_jobs(out, run_configs, arms=arms, tokens={n: pathlib.Path(f["tokenFile"]).read_text() for n, f in fakes.items()},
                                         token_budget=args.token_budget, supervision=supervision, deadline_seconds=OFFLINE_DEADLINE_SECONDS)
                for name, fake in fakes.items():
                    with contextlib.suppress(Exception):  # a fake the supervisor stopped has nothing left to ask
                        async with GatewayClient(fake["url"], pathlib.Path(fake["tokenFile"]).read_text()) as client:
                            left = len((await client.call("sessions.list", {"limit": 100}))["sessions"])
                            leftovers.update({name: left} if left else {})
                return results
            results, summary = await _supervised(path, plan, launch_offline, work)
            return results, summary, leftovers

    with _logging_to(out / "evalbench.log"), tempfile.TemporaryDirectory(prefix="evalprop-fakes-") as secrets:
        results, manifest["supervision"], leftovers = asyncio.run(everything(pathlib.Path(secrets)))
    code = _finish(out, results, manifest, arms)
    if leftovers:
        print(f"FAILED: sessions left on the fake gateways: {leftovers}", file=sys.stderr)
        return 1
    return code


def cmd_supervise(args):
    from .supervisor import main as supervise
    return supervise(args.plan)


def cmd_stop(args):
    """Stop every gateway of a plan now, with no supervisor and no runner. The deadman timer runs this too."""
    from .supervisor import stop_everything
    plan = json.loads(pathlib.Path(args.plan).read_text())
    results = stop_everything(plan, by="run.sh stop")
    print(json.dumps(results, indent=2))
    return 0 if all(r["stopped"] for r in results.values()) else 1


def cmd_report(args):
    """Rebuild a report from EvalBench job directories; more than one per arm adds a top-up job.

    --awareness reads a judge's labels for the declared sample; --judge-input writes that sample's input for a judge
    (mode 600: it holds replies); --csv writes the per-arm rows.
    """
    from . import awareness
    from .report import awareness_items, build_report, render, render_csv
    jobs = {}
    for item in args.job:
        name, _, path = item.partition("=")
        jobs.setdefault(name, []).append(pathlib.Path(path))
    jobs = {n: jobs[n] for n in sorted(jobs)}
    manifest = json.loads(pathlib.Path(args.manifest).read_text()) if args.manifest else None
    try:
        labels = awareness.read_labels(args.awareness) if args.awareness else None
        report = build_report(jobs, manifest=manifest, awareness=labels)
        if args.judge_input:
            awareness.write_jsonl(pathlib.Path(args.judge_input), awareness.judge_input(awareness_items(jobs), load_arms()))
    except (ValueError, OSError) as error:
        raise SystemExit(f"report: {error}") from None
    if args.csv:
        pathlib.Path(args.csv).write_text(render_csv(report))
    print(json.dumps(report, indent=2) if args.json else render(report))
    return 0


def cmd_model(_args):
    """Print the firing model, for the launcher's PROOF_PRIMARY_MODEL."""
    print(load_arms()["model"])
    return 0


def cmd_overlay(args):
    """Write the firing model and one arm's settings into an isolated proof gateway's config file, in place."""
    path = pathlib.Path(args.config).expanduser().resolve()
    live = pathlib.Path("~/.openclaw").expanduser().resolve()
    if path == live or live in path.parents:
        raise SystemExit("refusing: that is the live gateway's configuration")
    config = json.loads(path.read_text())
    if config.get("channels"):
        raise SystemExit("refusing: this config has a channel, so it is not an isolated proof gateway's")
    arms = load_arms()
    # Under state/, so the launcher's shred takes it.
    log_file = str(path.parent / "state" / "gateway.log")
    text = json.dumps(arms_module.apply_overlay(arms["arms"][args.arm], arms["model"], arms["caps"], config, log_file), indent=2) + "\n"
    temporary = path.with_name(path.name + ".evalprop")
    descriptor = os.open(temporary, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    with os.fdopen(descriptor, "w") as handle:
        handle.write(text)
    os.replace(temporary, path)
    print(f"arm {args.arm} settings and model {arms['model']} written to {path}; restart the gateway on it")
    return 0


def _arm_list(text):
    names = [n.strip().upper() for n in text.split(",") if n.strip()]
    known = load_arms()["arms"]
    if not names or [n for n in names if n not in known] or len(set(names)) != len(names):
        raise argparse.ArgumentTypeError(f"arms are a comma-separated choice of {', '.join(known)}")
    return names


def _scenario_list(text):
    names = [n.strip() for n in text.split(",") if n.strip()]
    known = {s["id"] for s in load_scenarios()}
    unknown = [n for n in names if n not in known]
    if unknown or not names:
        raise argparse.ArgumentTypeError(f"unknown scenario: {', '.join(unknown) or '(none)'}")
    return names


def _positive(text):
    value = int(text)
    if value < 1:
        raise argparse.ArgumentTypeError("must be 1 or more")
    return value


def main(argv=None):
    parser = argparse.ArgumentParser(prog="run.sh")
    commands = parser.add_subparsers(dest="command", required=True)
    for name, handler, live in (("preflight", cmd_preflight, True), ("run", cmd_run, True), ("offline", cmd_offline, False)):
        command = commands.add_parser(name)
        command.set_defaults(handler=handler)
        command.add_argument("--arms", type=_arm_list, default=default_arms(load_arms()),
                             help="comma-separated; the default leaves out the optional arms")
        if live:
            command.add_argument("--gateway-url", action="append", metavar="ARM=URL")
        if name != "preflight":
            command.add_argument("--out", required=True)
            command.add_argument("--num-trials", type=_positive, default=load_arms()["repetitions"])
            command.add_argument("--scenarios", type=_scenario_list)
            command.add_argument("--token-budget", type=_positive, default=DEFAULT_TOKEN_BUDGET, help=f"metered tokens, cache reads included: {TOKEN_BUDGET_RULE}")
            totals = load_arms()["supervision"]["canary"] if live else {"tokens": FULL_RUN_TOKENS, "seconds": FULL_RUN_SECONDS}
            command.add_argument("--run-token-cap", type=_positive, default=totals["tokens"],
                                 help="metered tokens on every arm together; the supervisor stops every gateway there (default: %(default)s)")
            command.add_argument("--run-seconds", type=_positive, default=totals["seconds"],
                                 help="wall clock of the whole run; the supervisor stops every gateway there (default: %(default)s)")
        if name == "run":
            command.add_argument("--go", help="message id of the seat owner's go")
    command = commands.add_parser("report")
    command.set_defaults(handler=cmd_report)
    command.add_argument("--job", action="append", required=True, metavar="ARM=DIR")
    command.add_argument("--json", action="store_true")
    command.add_argument("--manifest", help="the run's manifest.json, so the report says what the run was")
    command.add_argument("--awareness", metavar="LABELS", help="a judge's labels for the declared awareness sample (jsonl)")
    command.add_argument("--judge-input", metavar="OUT", help="write the declared awareness sample's judge input here (jsonl, mode 600)")
    command.add_argument("--csv", metavar="OUT", help="write the per-arm rows here")
    commands.add_parser("model").set_defaults(handler=cmd_model)
    command = commands.add_parser("overlay")
    command.set_defaults(handler=cmd_overlay)
    command.add_argument("arm", choices=list(load_arms()["arms"]))
    command.add_argument("config")
    for name, handler in (("supervise", cmd_supervise), ("stop", cmd_stop)):
        command = commands.add_parser(name)
        command.set_defaults(handler=handler)
        command.add_argument("--plan", required=True, help="a run's private/supervision-plan.json")
    args = parser.parse_args(argv)
    return args.handler(args)


if __name__ == "__main__":
    # os._exit: EvalBench leaves non-daemon worker threads behind (its own entry point exits the same way).
    code = main()
    sys.stdout.flush()
    sys.stderr.flush()
    os._exit(code)
