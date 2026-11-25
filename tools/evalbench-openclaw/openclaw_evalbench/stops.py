"""One arm's stop rules. Once one fires, the arm starts no further trial."""

import re

MAX_CONSECUTIVE_INFRA_ERRORS = 3
# Charged when a turn was sent and the gateway reported no usage for it (a Codex turn with no final text stores none:
# event-projector-result.ts:333-341). The budget must never run on zeros.
ASSUMED_TRIAL_TOKENS = 150_000
# The provider refused the account or the rate, so every further turn would spend or fail the same way.
_PROVIDER_STOP = re.compile(
    r"\b(401|403|429)\b|rate.?limit|quota|usage limit|insufficient|billing|unauthorized|authentication|"
    r"token (?:has )?expired|invalid.{0,12}(?:api key|token)", re.I)


def charge(record):
    """The metered tokens one trial counts against the budget: its turn, any later turn of its session, its children."""
    metered = record.get("metered")
    if not metered:
        return 0  # no turn was sent
    own = max(int((record.get("usage") or {}).get("total") or 0), int(metered.get("session") or 0))
    return (own or ASSUMED_TRIAL_TOKENS) + int(metered.get("children") or 0)


class ArmGuard:
    def __init__(self, arm_name, token_budget):
        self.arm_name, self.token_budget = arm_name, token_budget
        self.tokens = 0
        self.consecutive_errors = 0
        self.halted = None

    def halt(self, reason):
        if self.halted is None:
            self.halted = reason

    def before_trial(self):
        """The reason this arm may not start another trial, or None."""
        if self.halted is None and self.token_budget is not None and self.tokens >= self.token_budget:
            self.halt(f"token budget reached: {self.tokens} of {self.token_budget} metered tokens")
        return self.halted

    def after_trial(self, record):
        self.tokens += charge(record)
        status, reason = record["status"], record.get("reason") or ""
        if status == "arm_mismatch":
            self.halt(f"arm mismatch: {reason}")
        elif status in ("infra_error", "deadline_unreadable"):
            self.consecutive_errors += 1
            if _PROVIDER_STOP.search(reason):
                self.halt(f"provider refused: {reason}")
            elif self.consecutive_errors >= MAX_CONSECUTIVE_INFRA_ERRORS:
                self.halt(f"{self.consecutive_errors} infrastructure errors in a row; last: {reason}")
        else:
            self.consecutive_errors = 0
        if record.get("cleanup", {}).get("ok") is False:
            self.halt(f"cleanup failed: {record['cleanup'].get('reason')}")
