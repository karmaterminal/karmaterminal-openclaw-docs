#!/bin/bash
# Library for the openclaw#124337 Gateway proof. Source it with LABEL and W (worktree) set.
set -u
H=$HOME/i_have_a_pet_human/bm124-gate/harness
OUT=$HOME/i_have_a_pet_human/bm124-gate/runs/$LABEL
export PATH=$HOME/.nvm/versions/node/v26.12.1/bin:$PATH
export OPENCLAW_STATE_DIR=$HOME/.openclaw-proof-124337-$LABEL
export OPENCLAW_CONFIG_PATH=$OPENCLAW_STATE_DIR/openclaw.json
export OPENCLAW_GATEWAY_PORT=19461 OPENCLAW_GATEWAY_TOKEN=proof-124337-local-token
export DISCORD_API_URL=http://127.0.0.1:18575/api/v10
OFF=${OFF:-0}; GWP=$((19461+OFF)); PVP=$((18565+OFF)); MKP=$((18575+OFF))
export OPENCLAW_GATEWAY_PORT=$GWP DISCORD_API_URL=http://127.0.0.1:$MKP/api/v10
fresh() {
  rm -rf "$OUT" "$OPENCLAW_STATE_DIR"; mkdir -p "$OUT" "$OPENCLAW_STATE_DIR/workspace"
  local codex; codex=$(ls $W/node_modules/.pnpm/@openai+codex@0.162.1-linux-x64/node_modules/@openai/codex/vendor/x86_64-unknown-linux-musl/bin/codex)
  sed -e "s|__CODEX__|$codex|" -e "s|__STATE__|$OPENCLAW_STATE_DIR|" -e "s|__DROP__|${DROP:-old}|" -e "s|__GWPORT__|$GWP|" -e "s|__MODE__|${QMODE:-followup}|" -e "s|__CAP__|${QCAP:-1}|" -e "s|__PROVPORT__|$PVP|" $H/config.template.json > "$OPENCLAW_CONFIG_PATH"
  echo "label=$LABEL tree=$(git -C $W rev-parse HEAD) dirty=$(git -C $W status --porcelain | wc -l) start=$(date -u +%TZ)" > "$OUT/meta.txt"
}
start_aux() {
  node $H/provider.mjs $PVP "$OUT/provider.jsonl" ${ROUNDS:-16} ${STEP:-25} > "$OUT/provider.out" 2>&1 & PROV=$!
  node $H/mock-discord.mjs $MKP "$OUT/discord.jsonl" $W/node_modules/.pnpm/ws@8.22.0/node_modules > "$OUT/discord.out" 2>&1 & MOCK=$!
  sleep 1
}
GWN=0
start_gw() {
  GWN=$((GWN+1))
  ( cd $W; exec setsid nice -n 19 taskset -c 16-31 node scripts/run-node.mjs gateway --port $GWP --verbose ) > "$OUT/gateway-$GWN.log" 2>&1 & GW=$!
  local i; for i in $(seq 1 240); do curl -fsS -o /dev/null http://127.0.0.1:$GWP/health 2>/dev/null && break; sleep 1; done
  for i in $(seq 1 120); do curl -fsS http://127.0.0.1:$MKP/__control/state 2>/dev/null | grep -q '"connected":true' && break; sleep 1; done
  echo "gateway#$GWN up health+${i}s discord=$(curl -fsS http://127.0.0.1:$MKP/__control/state) $(date -u +%TZ)" >> "$OUT/meta.txt"
  sleep 5
}
stop_gw() {
  kill -TERM -- -$GW 2>/dev/null
  local i; for i in $(seq 1 60); do kill -0 $GW 2>/dev/null || break; sleep 1; done
  kill -0 $GW 2>/dev/null && { kill -KILL -- -$GW; echo "gateway#$GWN SIGKILL" >> "$OUT/meta.txt"; }
  echo "gateway#$GWN stopped $(date -u +%TZ)" >> "$OUT/meta.txt"
}
stop_aux() { kill $PROV $MOCK 2>/dev/null; wait $PROV $MOCK 2>/dev/null; }
dm() { curl -fsS -X POST -H 'content-type: application/json' --data "{\"content\":\"$1\"}" http://127.0.0.1:$MKP/__control/dm >> "$OUT/sent.jsonl"; echo >> "$OUT/sent.jsonl"; echo "dm '$1' $(date -u +%TZ)" >> "$OUT/meta.txt"; }
gm() { curl -fsS -X POST -H 'content-type: application/json' --data "{\"content\":\"$1\"}" http://127.0.0.1:$MKP/__control/guild >> "$OUT/sent.jsonl"; echo >> "$OUT/sent.jsonl"; echo "guild '$1' $(date -u +%TZ)" >> "$OUT/meta.txt"; }
rows() {
  local db; db=$(find "$OPENCLAW_STATE_DIR" -name '*.sqlite' -o -name '*.db' 2>/dev/null | head -20)
  echo "== rows $1 $(date -u +%TZ)" >> "$OUT/rows.txt"
  node $H/rows.mjs "$OPENCLAW_STATE_DIR" >> "$OUT/rows.txt" 2>&1
}
finish() {
  cp "$OPENCLAW_STATE_DIR/gateway-file.log" "$OUT/" 2>/dev/null
  echo "end=$(date -u +%TZ)" >> "$OUT/meta.txt"
}
