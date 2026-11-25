"""What an isolated gateway's sessions have consumed, read from the gateway and kept as a ledger that never goes down.

The source is sessions.usage.timeseries, the one fresh and cumulative reading (tools/k6-proofs/lib/token-budget.mjs has
the product lines). It is current to the last completed model call. It never shows a call that is still running or was
cut off, a compaction, or a title or utility call: the supervisor's wall clock bounds those, and nothing here counts them.
"""

import asyncio
import re

LIST_PAGE = 500
BASELINE_ATTEMPTS = 20
LIST_MAX_PAGES = 20
# The product's answer for a session with no transcript yet (openclaw ab5a30ea src/gateway/server-methods/usage.ts:695-701).
_NO_TRANSCRIPT = re.compile(r"^No transcript found for session: ")
_AGENT_KEY = re.compile(r"^agent:([^:]+):")


class MeterError(Exception):
    """The gateway answered with something that is not a usage reading."""


def timeseries_tokens(payload):
    """The cumulative tokens in one sessions.usage.timeseries payload, cache reads included."""
    points = payload.get("points") if isinstance(payload, dict) else None
    if not isinstance(points, list):
        raise MeterError("sessions.usage.timeseries answered without points")
    total = 0
    for point in points:
        parts = [point.get(n) or 0 for n in ("input", "output", "cacheRead", "cacheWrite")]
        total += max(point.get("totalTokens") or 0, sum(parts))
    return int(total)


def no_transcript(error):
    return error.code == "INVALID_REQUEST" and bool(_NO_TRANSCRIPT.match(error.message))


def _agent_of(key):
    match = _AGENT_KEY.match(key)
    return match.group(1) if match else "main"


class GatewayMeter:
    """Every session one gateway has listed since the baseline, at the highest count ever read for it.

    A session that leaves the listing is read once more from its archive, so what it spent after the last reading is
    counted. One that could not be read there keeps what it was seen to spend.
    """

    def __init__(self):
        self._highest = {}   # id -> tokens
        self._open = {}      # id -> (key, sessionId) of sessions still listed
        self._base = None
        self._other_base = None
        self._other = 0      # tokens sessions.usage knows beyond its own baseline
        self._credit = 0     # tokens only the harness's own reading saw
        self.keys = []       # the last listing, for the supervisor's aborts
        self.active = 0

    @property
    def tokens(self):
        """Tokens since the baseline. The larger of the two readings, so a session the list hides is still counted."""
        listed = sum(self._highest.values()) - sum((self._base or {}).values())
        return max(listed + self._credit, self._other)

    def credit(self, tokens):
        """Count what the harness read at the end of a trial and these readings missed: a session can live and go between two."""
        self._credit += max(0, tokens)

    @property
    def sessions(self):
        return len(self._highest)

    async def baseline(self, client, timeout):
        """What was already spent. Refused when it is only known to be more than something."""
        await self.read(client, timeout)
        self._base = dict(self._highest)
        for attempt in range(BASELINE_ATTEMPTS):
            if await self.read_aggregate(client, timeout):
                return
            await asyncio.sleep(0.5)
        raise MeterError("sessions.usage would only give a partial total, so there is no baseline to count from")

    async def read(self, client, timeout):
        """One complete reading. Raises when any part of it could not be read."""
        rows = await self._list(client, timeout)
        listed = {}
        for row in rows:
            key = row.get("key")
            if not isinstance(key, str) or not key:
                raise MeterError("sessions.list answered a row without a key")
            session_id = row.get("sessionId") if isinstance(row.get("sessionId"), str) else None
            listed[f"{_agent_of(key)}:{session_id or 'key:' + key}"] = (key, session_id)
        wanted = {identity: key for identity, (key, _) in listed.items()}
        gone = [i for i in self._open if i not in listed]
        for identity in gone:
            key, session_id = self._open[identity]
            if session_id:
                # A deleted or reset session's archive (openclaw ab5a30ea usage-session-selection.ts:72-95).
                wanted[identity] = f"agent:{_agent_of(key)}:{session_id}"
        counts = await asyncio.gather(*(self._tokens(client, key, timeout) for key in wanted.values()))
        # Only now is anything noted or let go: a reading that failed anywhere is made again whole.
        for identity, tokens in zip(wanted, counts):
            self._note(identity, tokens)
        for identity in gone:
            del self._open[identity]
        self._open.update(listed)
        self.keys = [key for key, _ in listed.values()]
        self.active = sum(1 for row in rows if row.get("hasActiveRun") is True)

    async def read_aggregate(self, client, timeout):
        """sessions.usage's own total: cached for 30 s, but it also sees sessions the list leaves out (a cron run).

        Returns whether it was whole. The product says when a total is a lower bound (openclaw ab5a30ea
        src/gateway/server-methods/usage.ts:328-335): good enough to raise the count, never to count from.
        """
        payload = await client.call("sessions.usage", {"limit": 1, "agentScope": "all"}, timeout=timeout)
        total = (payload.get("totals") or {}).get("totalTokens")
        if not isinstance(total, (int, float)) or isinstance(total, bool):
            raise MeterError("sessions.usage answered without totals")
        whole = not payload.get("partial") and ((payload.get("cacheStatus") or {}).get("status") or "fresh") == "fresh"
        if self._other_base is None:
            if not whole:
                return False
            self._other_base = total
        self._other = max(self._other, int(total - self._other_base))
        return whole

    def _note(self, identity, tokens):
        self._highest[identity] = max(self._highest.get(identity, 0), tokens)

    async def _list(self, client, timeout):
        rows, offset = [], 0
        for _ in range(LIST_MAX_PAGES):
            params = {"limit": LIST_PAGE, "archived": "all"}
            if offset:
                params["offset"] = offset
            page = await client.call("sessions.list", params, timeout=timeout)
            sessions = page.get("sessions")
            if not isinstance(sessions, list) or not all(isinstance(r, dict) for r in sessions):
                raise MeterError("sessions.list answered without sessions")
            rows += sessions
            if page.get("hasMore") is not True:
                return rows
            following = page.get("nextOffset")
            if not isinstance(following, int) or following <= offset:
                raise MeterError("sessions.list paging did not advance")
            offset = following
        raise MeterError("sessions.list did not end")

    async def _tokens(self, client, key, timeout):
        from .gateway import GatewayError
        try:
            return timeseries_tokens(await client.call("sessions.usage.timeseries", {"key": key}, timeout=timeout))
        except GatewayError as error:
            if no_transcript(error):
                return 0
            raise
