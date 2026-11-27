"""The arms, the turn set, and the checks that a gateway really is the arm it claims to be."""

import ipaddress
import json
import os
import pathlib
from urllib.parse import urlsplit

ROOT = pathlib.Path(__file__).resolve().parent.parent
CONTINUATION_TOOLS = ("continue_work", "continue_delegate", "request_compaction")
# EvalBench's canonical `<server>__<tool>` form. Only the continuation tools get it: trajectory_matcher then drops
# every other tool from both sides and compares elections alone.
CANONICAL_SERVER = "openclaw"
LIVE_GATEWAY_PORT = 18789
# The agent every trial runs as. Its own settings outrank agents.defaults.
AGENT_ID = "main"
# The machine-wide log directory a gateway writes to, and prunes, when its config names no log file (src/logging/logger.ts:40).
SHARED_LOG_DIR = "/tmp/openclaw"
_MISSING = object()


class ArmMismatch(Exception):
    """The gateway is not the arm: its identity, configuration or tool surface contradicts arms.json."""


class CapsMismatch(ArmMismatch):
    """The product's spend caps are not in force on this gateway. It halts the whole run, not only its arm."""


def load_arms(path=None):
    return json.loads(pathlib.Path(path or ROOT / "arms.json").read_text())


def load_scenarios(path=None):
    data = json.loads(pathlib.Path(path or ROOT / "datasets/continuation-propensity.evalset.json").read_text())
    return data["scenarios"]


def canonical_tool_name(tool):
    return f"{CANONICAL_SERVER}__{tool}" if tool in CONTINUATION_TOOLS else tool


def check_url(url):
    """Refuse anything but a loopback WebSocket that is not the live gateway's port. Returns the URL."""
    parts = urlsplit(url or "")
    if parts.scheme != "ws" or parts.username or parts.password or parts.query or parts.fragment:
        raise ArmMismatch("gateway URL must be a plain ws:// URL")
    host = parts.hostname or ""
    try:
        loopback = host == "localhost" or ipaddress.ip_address(host).is_loopback
    except ValueError:
        loopback = False
    if not loopback:
        raise ArmMismatch("gateway URL is not loopback")
    if parts.port is None or parts.port == LIVE_GATEWAY_PORT:
        raise ArmMismatch(f"gateway URL names no port, or the live gateway's port {LIVE_GATEWAY_PORT}")
    return url


def check_identity(arm, hello):
    """hello-ok must name the arm's commit: server.commit (a prefix of the SHA) or a buildId holding its first 12 hex."""
    server = (hello or {}).get("server") or {}
    sha = arm["productSha"]
    commit, build_id = server.get("commit"), server.get("buildId")
    by_commit = isinstance(commit, str) and len(commit) >= 7 and sha.startswith(commit)
    by_build = isinstance(build_id, str) and sha[:12] in build_id
    # A commit that names another build is a contradiction even beside a matching buildId.
    if isinstance(commit, str) and commit and not by_commit:
        raise ArmMismatch(f"gateway commit {commit[:12]} is not the arm's {sha[:12]}")
    if not (by_commit or by_build):
        raise ArmMismatch(f"gateway does not identify itself as {sha[:12]}")
    return {"commit": commit, "buildId": build_id, "version": server.get("version"), "bootId": server.get("bootId")}


def default_arms(arms):
    """The arms a run takes when none are named: every arm but the optional ones."""
    return [name for name, arm in arms["arms"].items() if not arm.get("optional")]


def outranking_paths(model):
    """The settings that outrank the arm's model or its tools.codeMode for this agent and model.

    The proof-gateway launcher copies both places from the seat's live config. openclaw ab5a30ea:
    src/agents/agent-scope.ts:268-273 (an agent's own model) and src/agents/code-mode-runtime.ts:84-92 (codeMode).
    """
    agent = ("agents", "entries", AGENT_ID)
    return ((*agent, "model"), (*agent, "tools", "codeMode"), (*agent, "models", model, "codeMode"),
            ("agents", "defaults", "models", model, "codeMode"))


def outranking_cap_paths():
    """The agent's own settings that outrank a cap's: its swarm limits (openclaw ab5a30ea
    src/agents/subagents/swarm/swarm-config.ts:24-29) and its utility model (src/agents/utility-model-setting.ts:19-22).

    Only the caps' own keys: an agent's swarm `enabled` is the seat's surface, and is left alone. No other cap has an
    agent-level form: continuation, subagents.max*, timeoutSeconds and maxConcurrent are read from agents.defaults only,
    and cron.enabled from the root.
    """
    agent = ("agents", "entries", AGENT_ID)
    return (*((*agent, "tools", "swarm", leaf) for leaf in ("maxConcurrent", "maxChildrenPerGroup", "maxTotalPerGroup")),
            (*agent, "utilityModel"))


WORKSHOP_ID = "skill-workshop"
WORKSHOP_MARKER = "meta.migrations.skillWorkshopPlugin"


def workshop_policy_to_migrate(config, caps):
    """Skill Workshop policy beside the caps' migration marker that the marker would make take effect. Empty when none.

    The caps set the marker so the runtime reads Skill Workshop's setting. Unmarked, the runtime ignores older Workshop
    policy, and Doctor would repair it: an entry or deny id dropped and an allowlist joined (openclaw ab5a30ea
    src/config/skill-workshop-plugin-migration.ts:33-86), `skills.workshop` moved (:170-209). Marked, it takes effect, and a
    deny or an allowlist without the plugin would remove `skill_workshop` from the surface. So any of it is refused, at
    overlay and at preflight alike, whether or not the seat's own config was marked already; the launcher copies none.
    """
    if WORKSHOP_MARKER not in caps["set"]:
        return []
    ours = {k.removeprefix(f"plugins.entries.{WORKSHOP_ID}."): v for k, v in caps["set"].items() if k.startswith(f"plugins.entries.{WORKSHOP_ID}.")}
    found = []
    if read_path(config, "skills.workshop") is not _MISSING:
        found.append("skills.workshop")
    entry = read_path(config, ("plugins", "entries", WORKSHOP_ID))
    beside_ours = isinstance(entry, dict) and bool(set(entry) - {"config"})
    if entry is not _MISSING and (beside_ours or any(read_path(entry, key) != value for key, value in ours.items())):
        found.append(f"plugins.entries.{WORKSHOP_ID}")
    is_workshop = lambda value: isinstance(value, str) and value.strip().lower() == WORKSHOP_ID
    deny, allow = read_path(config, "plugins.deny"), read_path(config, "plugins.allow")
    if isinstance(deny, list) and any(map(is_workshop, deny)):
        found.append("plugins.deny")
    if isinstance(allow, list) and allow and not any(map(is_workshop, allow)):
        found.append("plugins.allow")
    return found


def read_path(config, path):
    """The value at a dotted path, or at a tuple of keys (a model id has dots in it)."""
    node = config
    for part in path.split(".") if isinstance(path, str) else path:
        if not isinstance(node, dict) or part not in node:
            return _MISSING
        node = node[part]
    return node


def _private_log(path):
    """Whether a logging.file is the isolated gateway's own: absolute, and outside the shared log directory and the live state."""
    if not isinstance(path, str) or not path.startswith("/"):
        return False
    parents = pathlib.Path(os.path.normpath(path)).parents
    return not any(pathlib.Path(p).expanduser() in parents for p in (SHARED_LOG_DIR, "~/.openclaw"))


def check_config(arm, model, payload):
    """Check config.get's authored (sourceConfig) and effective (config) settings for the arm and the firing model."""
    source, effective = (payload or {}).get("sourceConfig"), (payload or {}).get("config")
    if (payload or {}).get("valid") is not True or not isinstance(source, dict) or not isinstance(effective, dict):
        raise ArmMismatch("config.get returned no valid configuration")
    problems = []
    for key, want in arm["config"].get("set", {}).items():
        got = read_path(source, key)
        if got is _MISSING or got != want:
            problems.append(f"{key} must be {json.dumps(want)}")
    for key in arm["config"].get("absent", []):
        if read_path(source, key) is not _MISSING:
            problems.append(f"{key} must be unset")
    for key, banned in arm["config"].get("forbid", {}).items():
        if read_path(source, key) == banned:
            problems.append(f"{key} must not be {json.dumps(banned)}")
    if read_path(effective, "agents.defaults.continuation.enabled") is not True:
        problems.append("agents.defaults.continuation.enabled must be true")
    if read_path(effective, "agents.defaults.model.primary") != model:
        problems.append(f"agents.defaults.model.primary must be {model}")
    if read_path(effective, "agents.defaults.model.fallbacks") not in (_MISSING, []):
        problems.append("agents.defaults.model.fallbacks must be empty")
    for path in outranking_paths(model):
        if read_path(source, path) is not _MISSING:
            problems.append(f"{'.'.join(path)} must be unset: it outranks the arm's setting")
    if not _private_log(read_path(source, "logging.file")):
        problems.append(f"logging.file must name a private file: without it the gateway shares the live gateway's log in {SHARED_LOG_DIR}")
    # An isolated proof gateway has no channel. A live one does, and must never be evaluated.
    for config in (source, effective):
        channels = read_path(config, "channels")
        if channels is not _MISSING and channels:
            problems.append("a channel is configured: this is not an isolated proof gateway")
            break
    if problems:
        raise ArmMismatch("; ".join(problems))
    return {"configRevisionHash": payload.get("configRevisionHash")}


def _same(got, want):
    """Equality that keeps 1 and true apart."""
    return got is not _MISSING and type(got) is type(want) and got == want


def check_caps(caps, payload):
    """Check that the run's spend caps are authored, effective and applied by the running gateway. Returns the receipt.

    config.get answers with the file as authored (sourceConfig), with the product's defaults filled in (config), and with
    the revision the running gateway has applied (openclaw ab5a30ea src/gateway/config-get-response.ts:27-38). A file
    that was edited and not loaded has two different revisions.
    """
    payload = payload or {}
    source, effective = payload.get("sourceConfig"), payload.get("config")
    if payload.get("valid") is not True or not isinstance(source, dict) or not isinstance(effective, dict):
        raise CapsMismatch("config.get returned no valid configuration")
    problems = []
    for key, want in caps["set"].items():
        for name, config in (("authored", source), ("effective", effective)):
            got = read_path(config, key)
            if not _same(got, want):
                problems.append(f"{name} {key} is {'unset' if got is _MISSING else json.dumps(got)}, not {json.dumps(want)}")
    for path in outranking_cap_paths():
        if read_path(source, path) is not _MISSING:
            problems.append(f"{'.'.join(path)} must be unset: it outranks the caps")
    stale = workshop_policy_to_migrate(source, caps)
    if stale:
        problems.append(f"Skill Workshop policy that the migration marker would leave unrepaired: {', '.join(stale)}")
    authored, applied = payload.get("configRevisionHash"), payload.get("appliedConfigHash")
    if not authored or applied != authored:
        problems.append("the running gateway has not applied this configuration")
    if problems:
        raise CapsMismatch("caps not in force: " + "; ".join(problems))
    return {"verdict": "verified", "configRevisionHash": authored, "values": dict(caps["set"])}


def apply_overlay(arm, model, caps, config, log_file):
    """The firing model, a private log file, the run's spend caps and the arm's settings, written into a proof gateway's config.

    Returns a new dict; the input is not changed.
    """
    stale = workshop_policy_to_migrate(config, caps)
    if stale:
        raise ArmMismatch(f"this config holds Skill Workshop policy that Doctor must migrate first: {', '.join(stale)}")
    out = json.loads(json.dumps(config))
    swarm = read_path(out, "tools.swarm")
    if isinstance(swarm, bool):
        # The product takes a bare switch here as well as an object; the caps need the object.
        out["tools"]["swarm"] = {"enabled": swarm}
    settings = {"agents.defaults.model": {"primary": model, "fallbacks": []}, "logging.file": log_file, **caps["set"], **arm["config"].get("set", {})}
    for key, value in settings.items():
        node = out
        *parents, leaf = key.split(".")
        for part in parents:
            node = node.setdefault(part, {})
            if not isinstance(node, dict):
                raise ArmMismatch(f"{key}: {part} is not an object in this config")
        node[leaf] = value
    for path in [*(key.split(".") for key in arm["config"].get("absent", [])), *outranking_paths(model), *outranking_cap_paths()]:
        node = out
        *parents, leaf = path
        for part in parents:
            node = node.get(part) if isinstance(node, dict) else None
        if isinstance(node, dict):
            node.pop(leaf, None)
    return out
