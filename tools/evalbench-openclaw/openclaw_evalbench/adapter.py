"""The EvalBench side: a gRPC client that answers AgentInteract turn requests by running trials.

In EvalBench's agent proxy protocol EvalBench is the gRPC server; the agent connects, sends its run config, and then
answers TurnRequests on one bidirectional stream (evalbench/eval_service.py AgentInteract).
"""

import json
import logging
import os
import pathlib
import re
import uuid

import grpc
import yaml

from evalproto import (
    eval_agent_pb2, eval_config_pb2, eval_connect_pb2, eval_request_pb2, eval_service_pb2_grpc,
)

from .arms import canonical_tool_name
from .generator import META_TOOL, UNSCORED
from .stops import ArmGuard
from .trial import SCORED, TURN_DEADLINE_SECONDS, run_trial

log = logging.getLogger("openclaw_evalbench")
ARGS_MAX_CHARS = 600
REPLY_MAX_CHARS = 8000
# The adapter always answers before EvalBench's own timeout, which would turn silence into a scored failure.
ANSWER_MARGIN_SECONDS = 180.0
# A model can write a session key into a tool call or a reply.
_SESSION_KEY = re.compile(r"agent:[A-Za-z0-9_.-]+:[A-Za-z0-9_.:/@-]+")


class JobError(Exception):
    """EvalBench ended the stream without a result."""


def read_token(arm_name, environ=os.environ):
    """The arm's gateway token, from the file named in this process's environment. Never from a config or an argument."""
    path = environ.get(f"OPENCLAW_EVAL_TOKEN_FILE_{arm_name}")
    if not path:
        raise ValueError(f"OPENCLAW_EVAL_TOKEN_FILE_{arm_name} is not set")
    token = pathlib.Path(path).expanduser().read_text().strip()
    if not token:
        raise ValueError(f"OPENCLAW_EVAL_TOKEN_FILE_{arm_name} names an empty file")
    return token


def scrub(value, token):
    """A record without gateway tokens or session keys, wherever the model or the gateway put them."""
    if isinstance(value, str):
        return _SESSION_KEY.sub("agent:<key>", value.replace(token, "<token>") if token else value)
    if isinstance(value, list):
        return [scrub(v, token) for v in value]
    if isinstance(value, dict):
        return {k: scrub(v, token) for k, v in value.items()}
    return value


def meta_of(record):
    """The trial record as it goes into EvalBench's CSV: no session key, no tool output."""
    return {k: v for k, v in record.items() if k not in ("reply", "calls")}


def turn_response(turn_index, record):
    """One trial as an EvalBench TurnResponse."""
    calls = [eval_agent_pb2.ToolCallRecord(
        tool_id=c["id"] or "", tool_name=canonical_tool_name(c["name"]),
        parameters_json=json.dumps(c["args"], ensure_ascii=False)[:ARGS_MAX_CHARS], output="",
        status="error" if c["isError"] else (c["status"] or "success"), duration_ms=0) for c in record.get("calls") or []]
    calls.append(eval_agent_pb2.ToolCallRecord(
        tool_id="meta", tool_name=META_TOOL, parameters_json=json.dumps(meta_of(record), ensure_ascii=False),
        output="", status="success", duration_ms=0))
    usage = record.get("usage") or {}
    scored = record["status"] in SCORED
    return eval_agent_pb2.TurnResponse(
        turn_index=turn_index, response_text=(record.get("reply") or "")[:REPLY_MAX_CHARS], tool_calls=calls,
        token_stats={k: int(v) for k, v in usage.items()}, success=scored, execution_completed=True,
        error_message="" if scored else f"{UNSCORED}{record['status']}: {record.get('reason')}")


class ArmJob:
    """One arm's EvalBench job over one AgentInteract stream."""

    def __init__(self, *, channel, arms, arm_name, run_config, token, trial_log, token_budget,
                 deadline_seconds=TURN_DEADLINE_SECONDS, runner=run_trial):
        self.arm_name, self.arm, self.arms = arm_name, arms["arms"][arm_name], arms
        self.run_config, self._token, self.trial_log = run_config, token, trial_log
        self.deadline_seconds, self._runner = deadline_seconds, runner
        self.guard = ArmGuard(arm_name, token_budget)
        self._stub = eval_service_pb2_grpc.EvalServiceStub(channel)
        self.session_id = f"evalprop-{arm_name}-{uuid.uuid4().hex}"
        self.trials = 0
        self.verified = None  # the arm's last verified surface, for a turn stopped before it stored its own

    async def run(self):
        """Run the job to its end. Returns {jobId, summary}."""
        metadata = [("client-rpc-id", self.session_id)]
        await self._stub.Ping(eval_request_pb2.PingRequest(), metadata=metadata)
        await self._stub.Connect(eval_connect_pb2.EvalConnectRequest(bidirectional_stream=True), metadata=metadata)
        await self._stub.EvalConfig(
            eval_config_pb2.EvalConfigRequest(yaml_config=yaml.safe_dump(self.run_config).encode()), metadata=metadata)
        stream = self._stub.AgentInteract(metadata=metadata)
        result = None
        try:
            async for message in stream:
                payload = message.WhichOneof("payload")
                if payload == "turn_request":
                    record = await self._settle(message.turn_request)
                    await stream.write(eval_agent_pb2.AgentStreamMessage(
                        session_id=self.session_id, correlation_id=message.correlation_id,
                        turn_response=turn_response(message.turn_request.turn_index, record)))
                elif payload == "session_summary":
                    result = {"jobId": message.session_summary.job_id,
                              "summary": json.loads(message.session_summary.summary_json)}
                    break
                else:
                    raise JobError(f"unexpected {payload}: the run config delegates nothing")
            # Let EvalBench finish the RPC before this side closes it.
            await stream.done_writing()
        except grpc.aio.AioRpcError as error:
            raise JobError(f"EvalBench ended arm {self.arm_name}'s stream: {error.code().name} {error.details()}") from None
        finally:
            if result is None:
                stream.cancel()
        if result is None:
            raise JobError(f"EvalBench ended arm {self.arm_name}'s stream without a summary")
        return result

    async def _settle(self, request):
        """The record for one turn request, whatever happens. A silent stream would hold EvalBench for its whole timeout."""
        halted = self.guard.before_trial()
        base = {"schema": "openclaw.evalbench.trial.v1", "arm": self.arm_name, "model": self.arms["model"],
                "promptId": request.env.get("OPENCLAW_EVAL_PROMPT_ID") or "", "kind": request.env.get("OPENCLAW_EVAL_KIND") or "",
                "elected": None, "usage": None, "metered": None, "reply": "", "calls": [], "cleanup": {"ok": None, "reason": None}}
        if halted:
            record = {**base, "status": "halted", "reason": halted}
        else:
            try:
                record = await self._answer(request, base)
            except Exception as error:
                # run_trial settles its own failures, so this is a bug here: nothing after it can be trusted.
                record = {**base, "status": "infra_error", "reason": f"adapter bug: {type(error).__name__}: {error}"[:300]}
                self.guard.halt(record["reason"])
            self.guard.after_trial(record)
            if (record.get("surface") or {}).get("verdict") == "verified":
                kept = {k: v for k, v in record["surface"].items() if k not in ("verdict", "reason")}
                self.verified = {"gateway": record["gateway"], "surface": kept}
        self.trials += 1
        record = scrub(record, self._token)
        with self.trial_log.open("a") as out:
            out.write(json.dumps({"trial": self.trials, **record}, ensure_ascii=False) + "\n")
        log.info("arm %s trial %d %s: %s%s", self.arm_name, self.trials, record["promptId"], record["status"],
                 f" ({record['reason']})" if record.get("reason") else "")
        return record

    async def _answer(self, request, base):
        env, prompt_id, kind = dict(request.env), base["promptId"], base["kind"]
        if env.get("OPENCLAW_EVAL_ARM") != self.arm_name:
            return {**base, "status": "arm_mismatch",
                    "reason": f"model config says arm {env.get('OPENCLAW_EVAL_ARM')}, this job is arm {self.arm_name}"}
        if env.get("OPENCLAW_EVAL_MODEL") != self.arms["model"]:
            return {**base, "status": "arm_mismatch",
                    "reason": f"model config says model {env.get('OPENCLAW_EVAL_MODEL')}, arms.json says {self.arms['model']}"}
        if request.resume:
            return {**base, "status": "infra_error", "reason": "a resumed turn was requested; every trial is one fresh turn"}
        if not prompt_id or kind not in ("eligible", "control"):
            return {**base, "status": "infra_error", "reason": "the scenario's env names no prompt id or kind"}
        return await self._runner(
            arm_name=self.arm_name, arm=self.arm, model=self.arms["model"],
            descriptions=self.arms["descriptions"][self.arm["descriptions"]]["tools"],
            url=env.get("OPENCLAW_EVAL_GATEWAY_URL"), token=self._token, prompt=request.prompt, prompt_id=prompt_id,
            kind=kind, verified=self.verified, deadline_seconds=min(self.deadline_seconds, max(1.0, request.timeout_seconds - ANSWER_MARGIN_SECONDS)))
