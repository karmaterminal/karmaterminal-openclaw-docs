# R-RC-2 — `request_compaction()` ACCEPT at ≥70% context — HONEST-LIMIT (live-capture pending)

**Disposition: ⚠️ HONEST-LIMIT** — the ACCEPT-side complement of R-RC-1 (`request_compaction` REJECT at low-context, which is **PASS**).

## What this row asserts
`request_compaction()` ACCEPTS (does not reject) when the calling session is organically at/above the context threshold — the complement of R-RC-1, which proves the REJECT at low-context.

## Code-path verified
The gate is `request-compaction-tool.ts:27` — `MIN_CONTEXT_THRESHOLD = 0.7`. A session at ≥70% context passes the guard (ACCEPT); below it rejects. The reject-side is proven live (R-RC-1 = PASS); the accept-branch is the same single threshold guard, code-present.

## Why honest-limit (not a full live PASS at this SHA)
The accept requires a session **organically at ≥70% context** AND willing to fire `request_compaction` — a scarce, timing-dependent condition. A freshly-spawned subagent starts low-context (guard rejects, structurally cannot produce the accept), and a seat that climbs to ≥70% is compacting — dropping back below threshold at the moment of capture. The cohort attempted a live capture this round (a ~75%-context session was observed ACCEPTing); the dispositive filed byte was not landed before this corpus closed.

## Honest scope
- Reject-side (R-RC-1): **PASS** (live, guard-identity byte).
- Accept-side gate: **code-verified** (`MIN_CONTEXT_THRESHOLD = 0.7`, same guard).
- Live accept-fire at organic ≥70%: **live-capture pending** (this honest-limit).

Will upgrade to ✅ PASS if the cohort lands the organic-≥70% accept-fire before review. Carried at ship-SHA `b248f2fd2d3120d2f376f6db7bf2b74a20e49dde`; capture-SHA `749f95b9b10aa3bbb804856acacc9073043ee772` (continuation surface byte-identical).

_Curated by 🌿 frond-scribe (corpus-manager) as an explicit honest-limit, not a prince fire-proof._
