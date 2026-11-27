"""EvalBench's agent_grpc_proxy generator, with what that protocol drops put back.

Loaded through EvalBench's own `generator_class` hook (docs/configs/model-config.md); the run still uses the
agent_grpc_proxy protocol. At the pinned commit the stock generator:

- scores an infrastructure failure as an outcome. model_api_error() is never overridden, so a trial the gateway never
  ran counts as "no election", and a control that timed out scores 100.
- reports tokens where no scorer reads them. token_consumption sums stats.models.*.tokens.total, and the stock
  envelope only has stats.tokens, so the score is always 0.
- has no field for what a trial measured beyond its tool calls.

The adapter sends those facts as one extra ToolCallRecord named META_TOOL; this class takes it out again before any
scorer sees the tool list. See REPORT.md.
"""

import json
import subprocess

from generators.models.agent_grpc_proxy import AgentGrpcProxyGenerator

META_TOOL = "openclaw_eval_meta"
UNSCORED = "OPENCLAW_EVAL_UNSCORED: "


class OpenClawProxyGenerator(AgentGrpcProxyGenerator):
    def __init__(self, querygenerator_config):
        super().__init__(querygenerator_config)
        self.arm = str(self.env.get("OPENCLAW_EVAL_ARM") or "unknown")

    @property
    def version(self):
        """Reported as agent_version in configs.csv."""
        return f"openclaw-arm-{self.arm}"

    def safe_generate(self, cli_cmd, timeout_seconds=None):
        result = super().safe_generate(cli_cmd, timeout_seconds)
        if result.returncode != 0 and not result.stdout:
            # No answer from the adapter at all (stream gone, or EvalBench's own 124 timeout, which it would score).
            return subprocess.CompletedProcess(result.args, 1, "", UNSCORED + (result.stderr or "no answer"))
        return result

    def _turn_response_to_process(self, turn_resp, session_id):
        result = super()._turn_response_to_process(turn_resp, session_id)
        envelope = json.loads(result.stdout)
        meta = {}
        kept = []
        for call in envelope["tool_calls"]:
            if call["tool_name"] == META_TOOL:
                meta = json.loads(call["parameters"])
            else:
                kept.append(call)
        envelope["tool_calls"] = kept
        envelope["openclaw"] = meta
        tools = envelope["stats"]["tools"]
        tools["byName"].pop(META_TOOL, None)
        tools["totalCalls"] = len(kept)
        usage = meta.get("usage") or {}
        served = (meta.get("servedModels") or ["unknown"])[0]
        envelope["stats"]["models"] = {served: {"tokens": {
            "input": usage.get("input", 0), "prompt": usage.get("input", 0), "candidates": usage.get("output", 0),
            "cached": usage.get("cacheRead", 0), "cache_creation": usage.get("cacheWrite", 0),
            # EvalBench's `total` is fresh input plus output; tokens_processed adds the cache tiers itself.
            "total": usage.get("input", 0) + usage.get("output", 0),
        }}}
        return subprocess.CompletedProcess(result.args, result.returncode, json.dumps(envelope), result.stderr)

    def model_api_error(self, result):
        """EvalBench leaves a trial with this error out of every score and denominator."""
        stderr = result.stderr or ""
        return stderr if stderr.startswith(UNSCORED) else None
