import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const runner = new URL("../run-proofs.sh", import.meta.url);

test("row failures are aggregated after the complete selected matrix", async () => {
  const source = await readFile(runner, "utf8");

  assert.match(source, /declare -a MATRIX_ROW_FAILURES=\(\)/);
  assert.match(source, /MATRIX_ROW_FAILURES\+=\("\$ROW_ID:\$EFFECTIVE_RC"\)/);
  assert.match(source, /Continuing matrix so later rows retain their one-shot execution and receipts\./);
  assert.doesNotMatch(source, /exit "\$EFFECTIVE_RC"/);
  assert.match(source, /Rows with non-zero effective exits:/);
  assert.match(source, /exit "\$MATRIX_EXIT_CODE"/);
});
