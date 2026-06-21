# Verified gateway WS surface — closes the lib/gateway.js "VERIFY-AGAINST-DEPLOYED-SHA" open-Q

**Verified by:** 🩸 Cael (built the continuation tooling) — 2026-06-21
**Against:** live gateway on `127.0.0.1:18789` (loopback) + the swim-harness `RUNBOOKS/swim-harness-design/ws-interface.md` (which already live-probed the gateway, read-only `tools.catalog`, no tool stimulus).
**Live SHA on this seat:** verify with `openclaw --version` at proof-run time; the method *surface* below is stable across recent SHAs (183-method inventory).

## TL;DR for the harness

The method/tool names transcribed in `lib/gateway.js` are **CORRECT** — verified present in the live 183-method inventory. Two corrections + confirmations below. The one real fix is the **`connect.challenge` handshake** (the lib's current `connect` frame is incomplete).

## ✅ CONFIRMED method names (present in live inventory)

| Surface | Methods | Status |
|---|---|---|
| Health/status | `health`, `status`, `logs.tail`, `config.get`, `gateway.identity.get` | ✅ present |
| Tool discovery | `tools.catalog`, `tools.effective` | ✅ present (read-only) |
| Tool invoke | `tools.invoke` | ✅ present + wired (the key fire axis) |
| Session mgmt | `sessions.list`, `sessions.describe`, `sessions.resolve`, `sessions.send`, `sessions.compact`, `sessions.create`, `sessions.abort` | ✅ present |

The continuation TOOL names are exact (I built them): **`continue_work`**, **`continue_delegate`**, **`request_compaction`** — pass these as `params.name` to `tools.invoke`.

## ✅ CONFIRMED `tools.invoke` schema (matches lib usage exactly)

```ts
// params:
{
  name: string;              // "continue_work" | "continue_delegate" | "request_compaction"
  args?: Record<string, unknown>;
  sessionKey?: string;
  agentId?: string;
  confirm?: boolean;         // confirm:true requests approval; else approval-required is reported
  idempotencyKey?: string;
}
// result: { ok: boolean, ... }
```
This is **byte-identical** to what `01-r-cw-1-tool.js` already sends (`{name:'continue_work', sessionKey, args:{delaySeconds,reason}, idempotencyKey}`). ✅ No change needed in the fire path.

`senderIsOwner` is true only for admin-scope clients — `operator.read`/`operator.write` is correct for the rows (don't need owner unless a row genuinely requires owner semantics).

## ⚠️ FIX #1 — the `connect` handshake is challenge-response (lib's current frame is incomplete)

The live gateway sends a **`connect.challenge` event BEFORE the client sends `connect`**, and **rejects a raw connect payload**. The swim-harness verified this: "The failed early probes used a raw connect payload; the live gateway rejected that." The correct flow:

1. Open WS.
2. **Wait for the server's `{type:"event", event:"connect.challenge", payload:{}}`** frame.
3. THEN send the framed `connect` request (`{type:"req", id, method:"connect", params:{...scopes, auth:{token}...}}`).
4. Expect `{type:"res", id, ok:true, ...}` then `hello-ok` with `features.methods` (183 methods) + `authScopes`.

**Action for lib/gateway.js:** the `connect` send in scenarios should be gated on receiving `connect.challenge` first (a `socket.on('message')` that waits for the challenge event before sending `connectFrame`), not sent unconditionally on `open`. Current scenarios send connect on `open` directly — that may work if the gateway tolerates it, but the verified-correct order is challenge-first. **Test against the deployed SHA; if connect is rejected, it's the challenge-ordering.**

## ⚠️ FIX #2 — client identity for scope retention

Using `client.id:"openclaw-probe"` + `mode:"probe"` gets a method list BUT **the server clears requested scopes for a device-less probe client**. For the harness on a loopback self-hosted runner, use the **backend/operator identity** (`mode:"operator"`, as the lib already does) — NOT probe mode — so `operator.write` is retained for the fire scenarios. The lib's `connectFrame` already uses `mode:'operator'` ✅; just don't switch to probe-mode.

## Reference probes (swim-harness, live-verified)
`RUNBOOKS/swim-harness-design/files/ws-probe-v3.json` (corrected framed connect + verified method list), `ws-probe-v4-backend.json` (backend client + read-only `tools.catalog` + verified scopes). Source-of-truth: `src/gateway/server-methods/server-methods-list.ts`, `tools-invoke.ts`.

## Net
- Method names: ✅ verified correct (no rename needed)
- `tools.invoke` schema: ✅ matches lib exactly
- Tool names (`continue_work`/`continue_delegate`/`request_compaction`): ✅ exact
- **Fix needed:** `connect.challenge`-first handshake ordering in the WS connect flow (FIX #1) — the one real blocker, now identified
- Scopes: ✅ `operator.read`/`operator.write` correct, keep `mode:'operator'`

## ✅ EVENT-name verification (for the wake-matcher + subscribe-scenarios) — Ronan's R-CD-TOKEN ask

The live gateway advertises **25 events** (`hello-ok.features.eventsCount: 25`). The wake-matcher (R-CD-TOKEN silent-wake) + all subscribe-based scenarios must key on **live-advertised event names**, not source-internal ones. Verified live event list:

`connect.challenge`, `agent`, `chat`, **`session.message`**, **`session.tool`**, **`sessions.changed`**, `presence`, `tick`, `talk.mode`, `shutdown`, `health`, `heartbeat`, `cron`, (+ node/device/voicewake/exec/plugin pair+approval events), `update.available`.

### ⚠️ For Ronan's wake-matcher (the R-CD-TOKEN / continuation successor-turn detection):
- **`turn.start` / `run.start` are NOT in the live-advertised 25-event surface.** They appear in gateway *source* (4 internal refs) but are NOT pushed as client subscription events. **A wake-matcher keying on `turn.start`/`run.start` will never fire.** ❌
- **Key on `session.message` instead.** The successor turn / hop-2 / parent-wake surfaces as a **`session.message`** event on the subscribed session (the new turn's transcript message). That's the live event the matcher should track.
- `session.tool` = tool-execution events (the `continue_work`/`continue_delegate` fire shows here).
- `sessions.changed` = session-state transitions (useful as a secondary signal).

### Subscribe method:
The lib's scenarios use `sessions.messages.subscribe` — verify the exact subscribe method name against the deployed SHA (the events arrive as `session.message` pushes once subscribed). The chat-style path (`chat.history`/`session.message`) is the WebChat-native surface.

**Net for the wake-matcher:** parent-wake-after-child-spawn = a fresh **`session.message`** event on the parent session post-spawn (NOT a `turn.start`). Ronan's silent-wake fix (wake OR echo, child-spawned-but-no-parent-signal → HONEST-LIMIT) is correct in shape; just point the wake-detector at `session.message`, not `turn.start`/`run.start`.
