#!/bin/bash
# Library for the openclaw#124337 Telegram proof. Source with LABEL and W (worktree) set.
# Runs inside a user+network namespace (scenario.sh re-execs under `unshare -rn`): loopback only.
set -u
H=$HOME/i_have_a_pet_human/bm124-tg/harness
OUT=$HOME/i_have_a_pet_human/bm124-tg/runs/$LABEL
export PATH=$HOME/.nvm/versions/node/v26.12.1/bin:/usr/bin:/bin
export OPENCLAW_STATE_DIR=$HOME/.openclaw-proof-124337-tg-$LABEL
export OPENCLAW_CONFIG_PATH=$OPENCLAW_STATE_DIR/openclaw.json
GWP=19481; PVP=18585; MKP=18595
export OPENCLAW_GATEWAY_PORT=$GWP OPENCLAW_GATEWAY_TOKEN=proof-124337-tg-local-token
export PROOF_HANDLER_LOG=$OUT/handler.jsonl
api() { curl -fsS -X POST -H 'content-type: application/json' --data "$2" http://127.0.0.1:$MKP/__control/$1; }
fresh() {
  rm -rf "$OUT" "$OPENCLAW_STATE_DIR"; mkdir -p "$OUT" "$OPENCLAW_STATE_DIR/workspace"
  local codex; codex=$(ls $W/node_modules/.pnpm/@openai+codex@0.162.1-linux-x64/node_modules/@openai/codex/vendor/x86_64-unknown-linux-musl/bin/codex)
  sed -e "s|__CODEX__|$codex|" -e "s|__STATE__|$OPENCLAW_STATE_DIR|" -e "s|__GWPORT__|$GWP|" -e "s|__PROVPORT__|$PVP|" -e "s|__MOCKPORT__|$MKP|" -e "s|__PLUGIN__|$H/proof-interactive|" $H/config.template.json > "$OPENCLAW_CONFIG_PATH"
  echo "label=$LABEL tree=$(git -C $W rev-parse HEAD) dirty=$(git -C $W status --porcelain | wc -l) start=$(date -u +%TZ) netns=$(readlink /proc/self/ns/net) ifaces=$(ip -o link | cut -d: -f2 | tr -d " " | tr "\n" ",")" > "$OUT/meta.txt"
}
start_aux() {
  node $H/provider.mjs $PVP "$OUT/provider.jsonl" ${ROUNDS:-6} ${STEP:-20} > "$OUT/provider.out" 2>&1 & PROV=$!
  node $H/mock-telegram.mjs $MKP "$OUT/telegram.jsonl" > "$OUT/telegram.out" 2>&1 & MOCK=$!
  sleep 1
}
GWN=0
start_gw() {
  GWN=$((GWN+1))
  ( cd $W; exec setsid nice -n 19 taskset -c 16-31 node scripts/run-node.mjs gateway --port $GWP --verbose ) > "$OUT/gateway-$GWN.log" 2>&1 & GW=$!
  local i; for i in $(seq 1 240); do curl -fsS -o /dev/null http://127.0.0.1:$GWP/health 2>/dev/null && break; sleep 1; done
  local p0; p0=$(curl -fsS http://127.0.0.1:$MKP/__control/state | sed -E 's/.*"polls":([0-9]+).*/\1/')
  for i in $(seq 1 120); do p=$(curl -fsS http://127.0.0.1:$MKP/__control/state | sed -E 's/.*"polls":([0-9]+).*/\1/'); [ "$p" -gt "$p0" ] && break; sleep 1; done
  echo "gateway#$GWN up health+poll ${i}s state=$(curl -fsS http://127.0.0.1:$MKP/__control/state) $(date -u +%TZ)" >> "$OUT/meta.txt"
  sleep 5
}
stop_gw() {
  kill -TERM -- -$GW 2>/dev/null
  local i; for i in $(seq 1 60); do kill -0 $GW 2>/dev/null || break; sleep 1; done
  kill -0 $GW 2>/dev/null && { kill -KILL -- -$GW; echo "gateway#$GWN SIGKILL" >> "$OUT/meta.txt"; }
  echo "gateway#$GWN stopped $(date -u +%TZ)" >> "$OUT/meta.txt"
}
stop_aux() { kill $PROV $MOCK 2>/dev/null; wait $PROV $MOCK 2>/dev/null; }
say() { api text "{\"text\":\"$1\"}" >> "$OUT/sent.jsonl"; echo >> "$OUT/sent.jsonl"; echo "text '$1' $(date -u +%TZ)" >> "$OUT/meta.txt"; }
rows() { echo "== rows $1 $(date -u +%TZ)" >> "$OUT/rows.txt"; node $H/rows.mjs "$OPENCLAW_STATE_DIR" >> "$OUT/rows.txt" 2>&1; }
finish() {
  cp "$OPENCLAW_STATE_DIR/gateway-file.log" "$OUT/" 2>/dev/null
  echo "end=$(date -u +%TZ) tree=$(git -C $W rev-parse HEAD) dirty=$(git -C $W status --porcelain | wc -l)" >> "$OUT/meta.txt"
}
