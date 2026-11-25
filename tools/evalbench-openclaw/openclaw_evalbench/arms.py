"""The arms, the turn set, and the checks that a gateway really is the arm it claims to be."""

import ipaddress
import json
import pathlib
from urllib.parse import urlsplit

ROOT = pathlib.Path(__file__).resolve().parent.parent
CONTINUATION_TOOLS = ("continue_work", "continue_delegate", "request_compaction")
# EvalBench's canonical `<server>__<tool>` form. Only the continuation tools get it: trajectory_matcher then drops
# every other tool from both sides and compares elections alone.
CANONICAL_SERVER = "openclaw"
LIVE_GATEWAY_PORT = 18789
_MISSING = object()


class ArmMismatch(Exception):
    """The gateway is not the arm: its identity, configuration or tool surface contradicts arms.json."""


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
    return {"commit": commit, "buildId": build_id, "version": server.get("version")}


def read_path(config, dotted):
    node = config
    for part in dotted.split("."):
        if not isinstance(node, dict) or part not in node:
            return _MISSING
        node = node[part]
    return node


def check_config(arm, model, payload):
    """Check config.get's authored (sourceConfig) and effective (config) settings for the arm."""
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
    # An isolated proof gateway has no channel. A live one does, and must never be evaluated.
    for config in (source, effective):
        channels = read_path(config, "channels")
        if channels is not _MISSING and channels:
            problems.append("a channel is configured: this is not an isolated proof gateway")
            break
    if problems:
        raise ArmMismatch("; ".join(problems))
    return {"configRevisionHash": payload.get("configRevisionHash")}


def apply_overlay(arm, config):
    """The arm's settings written into a proof gateway's config (a new dict; the input is not changed)."""
    out = json.loads(json.dumps(config))
    for key, value in arm["config"].get("set", {}).items():
        node = out
        *parents, leaf = key.split(".")
        for part in parents:
            node = node.setdefault(part, {})
            if not isinstance(node, dict):
                raise ArmMismatch(f"{key}: {part} is not an object in this config")
        node[leaf] = value
    for key in arm["config"].get("absent", []):
        node = out
        *parents, leaf = key.split(".")
        for part in parents:
            node = node.get(part) if isinstance(node, dict) else None
        if isinstance(node, dict):
            node.pop(leaf, None)
    return out
