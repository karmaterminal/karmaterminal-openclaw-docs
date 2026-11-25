"""A small OpenClaw gateway WebSocket client: the connect handshake and RPC frames.

The frames, identity and scopes are the k6 harness's (tools/k6-proofs/lib/gateway-ws.js, gateway-client-identity.mjs):
responses are {type:"res", id, ok, payload|error}, and the client is the device-less local backend with
operator.read and operator.write only. EvalBench is Python, so this is a Python twin and not a second design.
"""

import asyncio
import json
import uuid

from websockets.asyncio.client import connect as ws_connect

CLIENT = {"id": "gateway-client", "version": "0.1.0", "platform": "linux", "mode": "backend"}
USER_AGENT = "openclaw-evalbench/0.1.0"
SCOPES = ("operator.read", "operator.write")
MAX_FRAME_BYTES = 32 * 1024 * 1024
# Everything a trial calls. Checked against hello-ok features.methods before anything is sent, so an arm that lacks
# one fails before it costs a turn. sessions.usage is served but unadvertised at ab5a (core-descriptors.ts:369).
REQUIRED_METHODS = (
    "config.get", "sessions.create", "sessions.send", "agent.wait", "chat.history", "sessions.describe",
    "sessions.list", "sessions.abort", "sessions.patch", "sessions.delete",
)


class GatewayError(Exception):
    def __init__(self, method, code, message):
        super().__init__(f"{method}: {code}: {message}")
        self.method, self.code, self.message = method, code, message


class GatewayClient:
    """One authenticated connection. Use as an async context manager."""

    def __init__(self, url, token, connect_timeout=15.0):
        self.url, self._token, self._connect_timeout = url, token, connect_timeout
        self._ws = None
        self._reader = None
        self._pending = {}
        self._challenge = None
        self.hello = None

    async def __aenter__(self):
        loop = asyncio.get_running_loop()
        self._challenge = loop.create_future()
        # proxy=None: a loopback socket never goes through an environment proxy.
        self._ws = await asyncio.wait_for(
            ws_connect(self.url, max_size=MAX_FRAME_BYTES, proxy=None), self._connect_timeout)
        self._reader = asyncio.create_task(self._read())
        try:
            await asyncio.wait_for(self._challenge, self._connect_timeout)
            payload = await self.call("connect", {
                "minProtocol": 3, "maxProtocol": 4, "client": CLIENT, "role": "operator", "scopes": list(SCOPES),
                "caps": [], "commands": [], "permissions": {}, "auth": {"token": self._token},
                "userAgent": USER_AGENT,
            }, timeout=self._connect_timeout)
            if payload.get("type") != "hello-ok":
                raise GatewayError("connect", "BAD_HELLO", "connect was not answered with hello-ok")
            self.hello = payload
        except BaseException:
            await self.__aexit__(None, None, None)
            raise
        return self

    async def __aexit__(self, *exc):
        if self._ws is not None:
            await self._ws.close()
        if self._reader is not None:
            self._reader.cancel()
            await asyncio.gather(self._reader, return_exceptions=True)

    def missing_methods(self, required=REQUIRED_METHODS):
        advertised = ((self.hello or {}).get("features") or {}).get("methods")
        if not isinstance(advertised, list):
            return list(required)
        return [m for m in required if m not in advertised]

    async def call(self, method, params, timeout=30.0):
        """One RPC. Raises GatewayError on a refusal or a closed socket, TimeoutError on no answer."""
        frame_id = uuid.uuid4().hex
        future = asyncio.get_running_loop().create_future()
        self._pending[frame_id] = future
        try:
            await self._ws.send(json.dumps({"type": "req", "id": frame_id, "method": method, "params": params}))
            frame = await asyncio.wait_for(future, timeout)
        except TimeoutError:
            raise
        except GatewayError:
            raise
        except Exception as error:
            raise GatewayError(method, "TRANSPORT", type(error).__name__) from None
        finally:
            self._pending.pop(frame_id, None)
        if frame.get("ok") is False or frame.get("error"):
            error = frame.get("error") or {}
            raise GatewayError(method, str(error.get("code") or "ERROR"), str(error.get("message") or ""))
        payload = frame.get("payload")
        return payload if isinstance(payload, dict) else {}

    async def _read(self):
        reason = "connection closed"
        try:
            async for raw in self._ws:
                try:
                    frame = json.loads(raw)
                except ValueError:
                    continue
                if not isinstance(frame, dict):
                    continue
                if frame.get("type") == "res":
                    future = self._pending.get(frame.get("id"))
                    if future is not None and not future.done():
                        future.set_result(frame)
                elif frame.get("type") == "event" and frame.get("event") == "connect.challenge":
                    if not self._challenge.done():
                        self._challenge.set_result(True)
        except asyncio.CancelledError:
            raise
        except Exception as error:
            reason = type(error).__name__
        finally:
            for future in list(self._pending.values()):
                if not future.done():
                    future.set_exception(GatewayError("socket", "CLOSED", reason))
            if not self._challenge.done():
                self._challenge.set_exception(GatewayError("connect", "CLOSED", reason))
