"""One arm's stop rules. Once one fires, the arm starts no further trial."""

import re

MAX_CONSECUTIVE_INFRA_ERRORS = 3
# The provider refused the account or the rate, so every further turn would spend or fail the same way.
_PROVIDER_STOP = re.compile(
    r"\b(401|403|429)\b|rate.?limit|quota|usage limit|insufficient|billing|unauthorized|authentication|"
    r"token (?:has )?expired|invalid.{0,12}(?:api key|token)", re.I)


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
        self.tokens += int(((record.get("usage") or {}).get("total")) or 0)
        status, reason = record["status"], record.get("reason") or ""
        if status == "arm_mismatch":
            self.halt(f"arm mismatch: {reason}")
        elif status == "infra_error":
            self.consecutive_errors += 1
            if _PROVIDER_STOP.search(reason):
                self.halt(f"provider refused: {reason}")
            elif self.consecutive_errors >= MAX_CONSECUTIVE_INFRA_ERRORS:
                self.halt(f"{self.consecutive_errors} infrastructure errors in a row; last: {reason}")
        else:
            self.consecutive_errors = 0
        if record.get("cleanup", {}).get("ok") is False:
            self.halt(f"cleanup failed: {record['cleanup'].get('reason')}")
