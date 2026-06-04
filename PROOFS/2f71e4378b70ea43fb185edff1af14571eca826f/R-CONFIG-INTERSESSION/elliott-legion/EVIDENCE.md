# R-CONFIG-INTERSESSION — elliott-Legion seat, CANDIDATE_SHA `2f71e4378b70ea43fb185edff1af14571eca826f`

Captured 2026-06-04T04:09 PDT. Binary: `OpenClaw 2026.6.2 (2f71e43)`. Elliott-Legion (AMD Ryzen 9 5900HX + RTX 3080 + 64GB CachyOS) gateway-pid `804005`.

## Row purpose

Verify the `crossSessionTargeting: "enabled"` config gate behavior at byte. This is the substantive substrate-gate for cross-session `continue_delegate(targetSessionKey=...)` / `targetSessionKeys=[...]` / `fanoutMode=tree|all` semantics — the gate must be EXPLICITLY opted into per safe-by-default posture (default in source = `"disabled"`).

## Byte-evidence

### Elliott-seat fleet config (`crossSession_value.json`)

At byte on elliott-seat `~/.openclaw/openclaw.json` `agents.defaults.continuation.crossSessionTargeting`:

```
"enabled"
```

### Resolver source-of-truth (`source_resolver.txt`) — `src/auto-reply/continuation/config.ts:95-99`

```ts
crossSessionTargeting:
  continuation?.crossSessionTargeting === "enabled" ? "enabled" : "disabled",
```

The resolver is **strict-equality-on-`"enabled"`** — any other value (including unset / `null` / `"disabled"` / `"true"` / `true`) collapses to `"disabled"`. This is intentional safe-by-default posture: only the literal string `"enabled"` opts into cross-session targeting.

### Zod schema defaults — `src/config/zod-schema.agent-defaults.ts:282-284`

```ts
crossSessionTargeting: z
  .union([z.literal("disabled"), z.literal("enabled")])
  .default("disabled"),
```

Schema-level default = `"disabled"`. Two-layer safe-by-default substrate: schema-level + runtime-resolver-level both default to `"disabled"`.

### Behavioral substrate at byte

Elliott-seat fleet config opt-in to `"enabled"` substantively-permits:
- `continue_delegate(targetSessionKey="agent:main:discord:channel:1466192485440164011")` — return delegate-completion-payload to specific other session-key on this host
- `continue_delegate(targetSessionKeys=["sessionA", "sessionB"])` — byte-identical fan-out return to multiple sessions
- `continue_delegate(fanoutMode="tree")` — return to every ancestor in the current continuation/subagent chain
- `continue_delegate(fanoutMode="all")` — return to every known session on this host

R-CD-CHAINED-DEPTH-2 (ronan-axis lead) exercises the fan-out + cross-session-targeting paths empirically; R-CONFIG-INTERSESSION proves the gate-config substantively-honored on elliott-seat at byte.

## Cohort substrate-verdict

✅ **PASS** — `crossSessionTargeting: "enabled"` config gate substantively-set at byte on elliott-Legion seat fleet config. Resolver-source-of-truth strict-equality-on-`"enabled"` confirmed; schema-level + runtime-resolver-level both default to safe `"disabled"` for non-opting-in fleets. Elliott-seat opts in, enabling cross-session targeted-return + fanout substrate on this seat.

## Scope-bound at byte

Proves the config gate is set on elliott-seat. Does NOT exercise the cross-session-routing behavioral path empirically — that's R-CD-CHAINED-DEPTH-2 (ronan-axis lead) substrate. This row substantively-proves the gate-config-substrate-precondition that R-CD-CHAINED-DEPTH-2 + R-CD-4 depend on.
