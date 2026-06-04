# R-CONFIG-INTERSESSION — emeric-NUC seat, CANDIDATE_SHA `daa0e92f2750092faeaa0406cde91a303884d9ba`

Captured 2026-06-04T10:48 PDT. Binary: `OpenClaw 2026.6.2 (daa0e92)`. emeric-NUC (Intel i7-12700H 6P+8E + 64GB CachyOS) gateway-pid post-Gate-2.7-cure deploy.

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

## Cross-SHA stability vs `2f71e4378b70ea43fb185edff1af14571eca826f` and `f34bfaef508021983f5598581d59bc7a8e01bef0`

Source-files `src/auto-reply/continuation/config.ts:95-99` (resolver) + `src/config/zod-schema.agent-defaults.ts:282-284` (Zod default) byte-identical across all three CANDIDATE_SHAs in this cycle:
- `2f71e43` (pre-#918-merge baseline)
- `f34bfaef` (post-#918-merge + #921 codex-fold; sister PROOFS at `../../f34bfaef.../R-CONFIG-INTERSESSION/emeric-nuc/`)
- `daa0e92f` (post-Gate-2.7-cure: `f34bfaef` + single-file re-sync of `bundled-channel-plugin-loader.ts` to upstream/main)

The `f34bfaef` → `daa0e92f` delta is channels-plugin-substrate, outside the cross-session-targeting gate surface this row verifies.

## Row result

✅ **R-CONFIG-INTERSESSION PROVEN at byte for `daa0e92f` on emeric-NUC seat.**

- Resolver strict-equality-on-`"enabled"` gate verified at byte ✅
- Two-layer safe-by-default substrate (schema + runtime resolver) verified ✅
- Cross-SHA stability `2f71e43` → `f34bfaef` → `daa0e92f` (no touch on this surface across any cure) ✅
- Emeric-seat fleet config opt-in to `"enabled"` permits the documented cross-session-targeting options ✅

Sister row (R-CONFIG-DEFAULTS) at `../R-CONFIG-DEFAULTS/emeric-nuc/` verifies the broader continuation-config-defaults substrate.
