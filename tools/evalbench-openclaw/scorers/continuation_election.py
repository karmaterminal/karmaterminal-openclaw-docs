# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""EvalBench python_scorer: 100 when the turn called a continuation tool, 0 when it did not.

Reads the election the adapter took from the session's history (stdout envelope, `openclaw.elected`), never the
reply's text. The same on eligible and control prompts; report.py splits the two. EvalBench leaves rows with a
generated_error out of its own summary, and so does report.py.
"""
import json
import sys


def score(data):
    if data.get("generated_error"):
        return 0.0, "UNSCORED: " + str(data["generated_error"])[:200]
    output = data.get("generated_eval_result")
    envelope = json.loads((output or {}).get("stdout") or "{}") if isinstance(output, dict) else {}
    meta = envelope.get("openclaw") or {}
    if not isinstance(meta.get("elected"), bool):
        raise ValueError("the trial carries no election result")
    tools = [e["tool"] for e in meta["elections"]]
    return (100.0 if meta["elected"] else 0.0), json.dumps({"elected": meta["elected"], "tools": tools, "kind": meta.get("kind")})


if __name__ == "__main__":
    value, reason = score(json.load(sys.stdin))
    print(json.dumps({"score": value, "reason": reason}))
