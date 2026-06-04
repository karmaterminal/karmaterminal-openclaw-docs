# R-CONFIG-INTERSESSION — emeric-NUC seat, CANDIDATE_SHA `f34bfaef508021983f5598581d59bc7a8e01bef0`

Captured 2026-06-04T10:46 PDT. Binary: `OpenClaw 2026.6.2 (f34bfae)`. emeric-NUC (Intel i7-12700H 6P+8E + 64GB CachyOS) gateway-pid post-#918-merge deploy.

## Row purpose

Verify the `crossSessionTargeting: "enabled"` config gate behavior at byte. This is the substantive substrate-gate for cross-session `continue_delegate(targetSessionKey=...)` / `targetSessionKeys=[...]` / `fanoutMode=tree|all` semantics — the gate must be EXPLICITLY opted into per safe-by-default posture (default in source = `"disabled"`).

## Byte-evidence

### Emeric-seat fleet config (`crossSession_value.json`)

At byte on emeric-seat `~/.openclaw/openclaw.json` `agents.defaults.continuation.crossSessionTargeting`:

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

Emeric-seat fleet config opt-in to `"enabled"` substantively-permits:

- `continue_delegate(targetSessionKey="...")` — single-session-targeted return
- `continue_delegate(targetSessionKeys=["...", "..."])` — multi-session byte-identical fan-out return
- `continue_delegate(fanoutMode="tree")` — return to every ancestor in current continuation chain
- `continue_delegate(fanoutMode="all")` — return to every known session on this host

When fleet config omits or sets any non-`"enabled"` value, resolver collapses to `"disabled"` and the runtime substantively-refuses those cross-session-targeting options.

## Cross-SHA stability vs `2f71e4378b70ea43fb185edff1af14571eca826f`

The PR #918 cure + cael's #921 codex-fold did not touch:
- `src/auto-reply/continuation/config.ts:95-99` (resolver strict-equality gate)
- `src/config/zod-schema.agent-defaults.ts:282-284` (Zod default)

R-CONFIG-INTERSESSION substrate carries through `2f71e43` → `f34bfaef` unchanged. The cross-session-targeting safe-by-default posture is preserved end-to-end across the cure-merge.

## Row result

✅ **R-CONFIG-INTERSESSION PROVEN at byte for `f34bfaef` on emeric-NUC seat.**

- Resolver strict-equality-on-`"enabled"` gate verified at byte ✅
- Two-layer safe-by-default substrate (schema + runtime resolver) verified ✅
- Cross-SHA stability `2f71e43` → `f34bfaef` (no #918/#921 touch on this surface) ✅
- Emeric-seat fleet config opt-in to `"enabled"` permits the documented cross-session-targeting options ✅

Sister row (R-CONFIG-DEFAULTS) at `../R-CONFIG-DEFAULTS/emeric-nuc/` verifies the broader continuation-config-defaults substrate.
