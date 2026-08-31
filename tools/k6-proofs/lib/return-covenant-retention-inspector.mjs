import { createHash } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import {
  lstat,
  mkdir,
  open,
  readdir,
  realpath,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { canonicalJson } from './canonical-json.mjs';
import {
  fingerprintProcessLoopbackListeners,
  inspectProcessLoopbackListeners,
} from './return-covenant-driver-attestation.mjs';

export const RETURN_COVENANT_STORE_OBSERVATION_SCHEMA =
  'openclaw.k6.return-covenant-store-observation.v1';
export const RETURN_COVENANT_PRODUCT_STORE_CONTRACT_SHA =
  '0ed59cb64f31971e8659b417fe3fd2ba6a1730c3';

const MAX_DATABASE_BYTES = 128 * 1024 * 1024;
const MAX_SIDECAR_BYTES = 256 * 1024 * 1024;
const MAX_RESOURCE_COUNT = 100;
const MAX_AGENT_DATABASES = 128;
const PROCESS_QUIESCE_TIMEOUT_MS = 2_000;
const PROCESS_QUIESCE_POLL_MS = 10;
const OPEN_DIRECTORY_FLAGS =
  fsConstants.O_RDONLY |
  fsConstants.O_NOFOLLOW |
  (fsConstants.O_DIRECTORY ?? 0);
const OPEN_FILE_FLAGS = fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW;
const FLOW_STATUSES = new Set([
  'queued',
  'running',
  'waiting',
  'blocked',
  'succeeded',
  'failed',
  'cancelled',
  'lost',
]);
const FLOW_SYNC_MODES = new Set(['task_mirrored', 'managed']);
const CONTINUATION_FLOW_CONTROLLERS = new Set([
  'core/continuation-work',
  'core/continuation-delegate',
  'core/continuation-post-compaction',
]);
const TERMINAL_FLOW_STATUSES = new Set([
  'succeeded',
  'failed',
  'cancelled',
  'lost',
]);
const SUBAGENT_EXECUTION_STATUSES = new Set([
  'queued',
  'running',
  'interrupted',
  'terminal',
]);
const SUBAGENT_DELIVERY_STATUSES = new Set([
  'not_required',
  'pending',
  'in_progress',
  'delivered',
  'failed',
  'suspended',
  'discarded',
]);
const SUBAGENT_DELIVERY_DISPOSITIONS = new Set([
  'delivered',
  'session_queued',
  'intentional_non_delivery',
  'retryable',
  'ambiguous',
  'permanent_failure',
]);
const DELIVERY_QUEUE_STATUSES = new Set(['pending', 'failed', 'completed']);
const DELIVERY_QUEUE_RECOVERY_STATES = new Set([
  'producer_claimed',
  'send_attempt_started',
  'unknown_after_send',
  'settlement_pending',
  'completed_permanent',
  'completed_bounded',
]);
const SESSION_STATUSES = new Set([
  'running',
  'done',
  'failed',
  'killed',
  'timeout',
]);
const SESSION_CREATED_VIA = new Set([
  'operator',
  'spawn',
  'channel',
  'cron',
  'talk',
  'run',
  'plugin',
  'internal',
]);
const REQUIRED_GLOBAL_COLUMNS = Object.freeze({
  schema_meta: [
    'meta_key',
    'role',
    'schema_version',
    'agent_id',
    'app_version',
    'created_at',
    'updated_at',
  ],
  agent_databases: [
    'agent_id',
    'path',
    'schema_version',
    'last_seen_at',
    'size_bytes',
  ],
  current_conversation_bindings: [
    'binding_key',
    'binding_id',
    'target_session_key',
    'channel',
    'account_id',
    'conversation_kind',
    'parent_conversation_id',
    'conversation_id',
    'target_kind',
    'status',
    'bound_at',
    'expires_at',
    'metadata_json',
    'record_json',
    'updated_at',
  ],
  delivery_queue_entries: [
    'queue_name',
    'id',
    'status',
    'entry_kind',
    'session_key',
    'channel',
    'target',
    'account_id',
    'retry_count',
    'last_attempt_at',
    'last_error',
    'recovery_state',
    'platform_send_started_at',
    'entry_json',
    'enqueued_at',
    'updated_at',
    'failed_at',
  ],
  subagent_runs: [
    'run_id',
    'child_session_key',
    'controller_session_key',
    'requester_session_key',
    'created_at',
    'payload_json',
  ],
  flow_runs: [
    'flow_id',
    'shape',
    'sync_mode',
    'owner_key',
    'chain_id',
    'requester_origin_json',
    'controller_id',
    'revision',
    'status',
    'notify_policy',
    'goal',
    'current_step',
    'blocked_task_id',
    'blocked_summary',
    'state_json',
    'wait_json',
    'cancel_requested_at',
    'created_at',
    'updated_at',
    'ended_at',
  ],
});
const REQUIRED_AGENT_COLUMNS = Object.freeze({
  schema_meta: REQUIRED_GLOBAL_COLUMNS.schema_meta,
  session_nodes: [
    'session_key',
    'current_session_id',
    'entry_json',
    'entry_valid',
    'updated_at',
    'status',
    'created_at',
    'created_via',
    'created_actor_type',
    'created_actor_id',
    'owner_actor_type',
    'owner_actor_id',
    'owner_assigned_by_type',
    'owner_assigned_by_id',
    'owner_assigned_at',
    'project_id',
    'parent_session_key',
    'spawned_by',
    'fork_source_session_key',
    'fork_source_session_id',
    'fork_source_entry_id',
    'label',
    'display_name',
    'category',
    'icon',
    'pinned_at',
    'archived_at',
    'last_read_at',
    'last_interaction_at',
    'last_activity_at',
  ],
  session_windows: [
    'session_id',
    'session_key',
    'previous_session_id',
    'reason',
    'session_scope',
    'created_at',
    'updated_at',
    'transcript_updated_at',
    'transcript_observed_at',
    'session_entry_provenance',
    'acp_owned',
    'plugin_owner_id',
    'hook_external_content_source',
    'started_at',
    'ended_at',
    'status',
    'chat_type',
    'channel',
    'account_id',
    'primary_conversation_id',
    'model_provider',
    'model',
    'agent_harness_id',
    'parent_session_key',
    'spawned_by',
    'display_name',
  ],
});
const TABLE_INTEGER_COLUMNS = Object.freeze({
  schema_meta: ['schema_version', 'created_at', 'updated_at'],
  agent_databases: [
    'schema_version',
    'last_seen_at',
    'size_bytes',
  ],
  current_conversation_bindings: [
    'bound_at',
    'expires_at',
    'updated_at',
  ],
  delivery_queue_entries: [
    'retry_count',
    'last_attempt_at',
    'platform_send_started_at',
    'enqueued_at',
    'updated_at',
    'failed_at',
  ],
  subagent_runs: ['created_at'],
  flow_runs: [
    'revision',
    'cancel_requested_at',
    'created_at',
    'updated_at',
    'ended_at',
  ],
  session_nodes: [
    'entry_valid',
    'updated_at',
    'created_at',
    'owner_assigned_at',
    'pinned_at',
    'archived_at',
    'last_read_at',
    'last_interaction_at',
    'last_activity_at',
  ],
  session_windows: [
    'created_at',
    'updated_at',
    'transcript_updated_at',
    'transcript_observed_at',
    'session_entry_provenance',
    'acp_owned',
    'started_at',
    'ended_at',
  ],
});
const TABLE_NULLABLE_COLUMNS = Object.freeze({
  schema_meta: ['agent_id', 'app_version'],
  agent_databases: ['size_bytes'],
  current_conversation_bindings: [
    'parent_conversation_id',
    'expires_at',
    'metadata_json',
  ],
  delivery_queue_entries: [
    'entry_kind',
    'session_key',
    'channel',
    'target',
    'account_id',
    'last_attempt_at',
    'last_error',
    'recovery_state',
    'platform_send_started_at',
    'failed_at',
  ],
  subagent_runs: ['controller_session_key'],
  flow_runs: [
    'shape',
    'chain_id',
    'requester_origin_json',
    'controller_id',
    'current_step',
    'blocked_task_id',
    'blocked_summary',
    'state_json',
    'wait_json',
    'cancel_requested_at',
    'ended_at',
  ],
  session_nodes: REQUIRED_AGENT_COLUMNS.session_nodes.slice(5),
  session_windows: [
    'previous_session_id',
    'reason',
    'transcript_updated_at',
    'transcript_observed_at',
    'plugin_owner_id',
    'hook_external_content_source',
    'started_at',
    'ended_at',
    'status',
    'chat_type',
    'channel',
    'account_id',
    'primary_conversation_id',
    'model_provider',
    'model',
    'agent_harness_id',
    'parent_session_key',
    'spawned_by',
    'display_name',
  ],
});
const TABLE_PRIMARY_KEYS = Object.freeze({
  schema_meta: ['meta_key'],
  agent_databases: ['agent_id', 'path'],
  current_conversation_bindings: ['binding_key'],
  delivery_queue_entries: ['queue_name', 'id'],
  subagent_runs: ['run_id'],
  flow_runs: ['flow_id'],
  session_nodes: ['session_key'],
  session_windows: ['session_id'],
});
const TABLE_DEFAULTS = Object.freeze({
  schema_meta: {},
  agent_databases: {},
  current_conversation_bindings: {},
  delivery_queue_entries: { retry_count: '0' },
  subagent_runs: { payload_json: "'{}'" },
  flow_runs: { sync_mode: "'managed'", revision: '0' },
  session_nodes: { entry_valid: '0' },
  session_windows: {
    session_scope: "'conversation'",
    transcript_updated_at: 'NULL',
    transcript_observed_at: 'NULL',
    session_entry_provenance: '0',
    acp_owned: '0',
  },
});
const TABLE_CHECKS = Object.freeze({
  schema_meta: [],
  agent_databases: [],
  current_conversation_bindings: [],
  delivery_queue_entries: [],
  subagent_runs: [],
  flow_runs: [],
  session_nodes: [
    'entry_valid IN (-1, 0, 1)',
    "status IS NULL OR status IN ('running', 'done', 'failed', 'killed', 'timeout')",
    "created_via IS NULL OR created_via IN ('operator', 'spawn', 'channel', 'cron', 'talk', 'run', 'plugin', 'internal')",
    "created_actor_type IS NULL OR created_actor_type IN ('human', 'agent', 'system')",
  ],
  session_windows: [
    "reason IS NULL OR reason IN ('initial', 'reset', 'rollover', 'fork', 'rewind', 'switch', 'recovery', 'compaction')",
    "session_scope IN ('conversation', 'shared-main', 'group', 'channel')",
    'session_entry_provenance IN (0, 1)',
    'acp_owned IN (0, 1)',
    "hook_external_content_source IS NULL OR hook_external_content_source IN ('gmail', 'webhook')",
    "status IS NULL OR status IN ('running', 'done', 'failed', 'killed', 'timeout')",
    "chat_type IS NULL OR chat_type IN ('direct', 'group', 'channel')",
  ],
});
const TABLE_FOREIGN_KEYS = Object.freeze({
  schema_meta: [],
  agent_databases: [],
  current_conversation_bindings: [],
  delivery_queue_entries: [],
  subagent_runs: [],
  flow_runs: [],
  session_nodes: [],
  session_windows: [
    {
      table: 'session_nodes',
      columns: [['session_key', 'session_key']],
      onUpdate: 'NO ACTION',
      onDelete: 'CASCADE',
      match: 'NONE',
    },
    {
      table: 'conversations',
      columns: [['primary_conversation_id', 'conversation_id']],
      onUpdate: 'NO ACTION',
      onDelete: 'SET NULL',
      match: 'NONE',
    },
  ],
});
const TABLE_TRIGGERS = Object.freeze({
  schema_meta: [],
  agent_databases: [],
  current_conversation_bindings: [],
  delivery_queue_entries: [],
  subagent_runs: [],
  flow_runs: [],
  session_windows: [],
  session_nodes: [
    {
      name: 'session_nodes_entry_valid_after_insert',
      sql: `
        CREATE TRIGGER session_nodes_entry_valid_after_insert
        AFTER INSERT ON session_nodes
        BEGIN
          UPDATE session_nodes SET entry_valid = 0
          WHERE session_key = NEW.session_key;
        END
      `,
    },
    {
      name: 'session_nodes_entry_valid_after_entry_update',
      sql: `
        CREATE TRIGGER session_nodes_entry_valid_after_entry_update
        AFTER UPDATE OF entry_json ON session_nodes
        BEGIN
          UPDATE session_nodes SET entry_valid = 0
          WHERE session_key = NEW.session_key;
        END
      `,
    },
    {
      name: 'session_nodes_entry_valid_after_identity_update',
      sql: `
        CREATE TRIGGER session_nodes_entry_valid_after_identity_update
        AFTER UPDATE OF current_session_id, updated_at ON session_nodes
        BEGIN
          UPDATE session_nodes SET entry_valid = 0
          WHERE session_key = NEW.session_key;
        END
      `,
    },
  ],
});
const REQUIRED_TABLE_INDEXES = Object.freeze({
  schema_meta: [],
  agent_databases: [],
  current_conversation_bindings: [
    {
      name: 'idx_current_conversation_bindings_target',
      columns: [['target_session_key', 0], ['updated_at', 1], ['binding_key', 0]],
    },
    {
      name: 'idx_current_conversation_bindings_conversation',
      columns: [
        ['channel', 0],
        ['account_id', 0],
        ['conversation_kind', 0],
        ['conversation_id', 0],
      ],
    },
    {
      name: 'idx_current_conversation_bindings_expires',
      columns: [['expires_at', 0], ['binding_key', 0]],
    },
  ],
  delivery_queue_entries: [
    {
      name: 'idx_delivery_queue_pending',
      columns: [
        ['queue_name', 0],
        ['status', 0],
        ['enqueued_at', 0],
        ['id', 0],
      ],
    },
    {
      name: 'idx_delivery_queue_failed',
      columns: [
        ['queue_name', 0],
        ['status', 0],
        ['failed_at', 0],
        ['id', 0],
      ],
    },
    {
      name: 'idx_delivery_queue_session',
      columns: [
        ['queue_name', 0],
        ['status', 0],
        ['session_key', 0],
        ['enqueued_at', 0],
        ['id', 0],
      ],
      where: 'session_key is not null',
    },
    {
      name: 'idx_delivery_queue_target',
      columns: [
        ['queue_name', 0],
        ['status', 0],
        ['channel', 0],
        ['target', 0],
        ['enqueued_at', 0],
        ['id', 0],
      ],
      where: 'channel is not null and target is not null',
    },
  ],
  subagent_runs: [
    {
      name: 'idx_subagent_runs_child_session_key',
      columns: [['child_session_key', 0], ['created_at', 1], ['run_id', 0]],
    },
    {
      name: 'idx_subagent_runs_requester_session_key',
      columns: [['requester_session_key', 0], ['created_at', 1], ['run_id', 0]],
    },
    {
      name: 'idx_subagent_runs_controller_session_key',
      columns: [['controller_session_key', 0], ['created_at', 1], ['run_id', 0]],
    },
  ],
  flow_runs: [
    { name: 'idx_flow_runs_status', columns: [['status', 0]] },
    { name: 'idx_flow_runs_owner_key', columns: [['owner_key', 0]] },
    { name: 'idx_flow_runs_updated_at', columns: [['updated_at', 0]] },
  ],
  session_nodes: [
    {
      name: 'idx_agent_session_nodes_updated_at',
      columns: [['updated_at', 1], ['session_key', 0]],
    },
    {
      name: 'idx_agent_session_nodes_last_interaction_at',
      columns: [['last_interaction_at', 1], ['session_key', 0]],
    },
    {
      name: 'idx_agent_session_nodes_parent_session_key',
      columns: [['parent_session_key', 0], ['session_key', 0]],
    },
    {
      name: 'idx_agent_session_nodes_spawned_by',
      columns: [['spawned_by', 0], ['session_key', 0]],
    },
    {
      name: 'idx_agent_session_nodes_status',
      columns: [['status', 0], ['session_key', 0]],
      where: 'status is not null',
    },
    {
      name: 'idx_agent_session_nodes_archived_at',
      columns: [['archived_at', 0], ['session_key', 0]],
      where: 'archived_at is not null',
    },
    {
      name: 'idx_agent_session_nodes_current_session_id',
      columns: [['current_session_id', 0]],
    },
    {
      name: 'idx_agent_session_nodes_entry_valid_pending',
      columns: [['session_key', 0]],
      where: 'entry_valid = 0',
    },
  ],
  session_windows: [
    {
      name: 'idx_agent_session_windows_updated_at',
      columns: [['updated_at', 1], ['session_id', 0]],
    },
    {
      name: 'idx_agent_session_windows_session_key',
      columns: [['session_key', 0], ['updated_at', 1], ['session_id', 0]],
    },
    {
      name: 'idx_agent_session_windows_created_at',
      columns: [['created_at', 1], ['session_id', 0]],
    },
    {
      name: 'idx_agent_session_windows_conversation',
      columns: [
        ['primary_conversation_id', 0],
        ['updated_at', 1],
        ['session_id', 0],
      ],
      where: 'primary_conversation_id is not null',
    },
  ],
});

function expectedTableLayout(table, columns) {
  const integerColumns = new Set(TABLE_INTEGER_COLUMNS[table]);
  const nullableColumns = new Set(TABLE_NULLABLE_COLUMNS[table]);
  const primaryKeys = TABLE_PRIMARY_KEYS[table];
  const defaults = TABLE_DEFAULTS[table];
  return columns.map((name, cid) => ({
    cid,
    name,
    type: integerColumns.has(name) ? 'INTEGER' : 'TEXT',
    notnull: nullableColumns.has(name) ? 0 : 1,
    defaultExpression: defaults[name] ?? null,
    pk: primaryKeys.indexOf(name) + 1,
    hidden: 0,
    collation: 'BINARY',
  }));
}

function tokenizeSql(value) {
  const tokens = [];
  let depth = 0;
  for (let index = 0; index < value.length;) {
    const character = value[index];
    if (/\s/u.test(character)) {
      index += 1;
      continue;
    }
    if (character === '-' && value[index + 1] === '-') {
      index += 2;
      while (index < value.length && value[index] !== '\n') index += 1;
      continue;
    }
    if (character === '/' && value[index + 1] === '*') {
      const closeIndex = value.indexOf('*/', index + 2);
      if (closeIndex < 0) throw new Error('SQL has an unterminated block comment');
      index = closeIndex + 2;
      continue;
    }
    const isBlobLiteral =
      (character === 'x' || character === 'X') &&
      value[index + 1] === "'";
    if (character === "'" || isBlobLiteral) {
      const start = index;
      if (isBlobLiteral) index += 1;
      let closed = false;
      for (index += 1; index < value.length; index += 1) {
        if (value[index] !== "'") continue;
        if (value[index + 1] === "'") {
          index += 1;
        } else {
          index += 1;
          closed = true;
          break;
        }
      }
      if (!closed) throw new Error('SQL has an unterminated string literal');
      tokens.push({
        type: isBlobLiteral ? 'blob' : 'string',
        value: value.slice(start, index),
      });
      continue;
    }
    if (character === '"' || character === '`' || character === '[') {
      const close = character === '[' ? ']' : character;
      let identifier = '';
      let closed = false;
      for (index += 1; index < value.length; index += 1) {
        if (value[index] !== close) {
          identifier += value[index];
          continue;
        }
        if (character !== '[' && value[index + 1] === close) {
          identifier += close;
          index += 1;
          continue;
        }
        index += 1;
        closed = true;
        break;
      }
      if (!closed) throw new Error('SQL has an unterminated quoted identifier');
      tokens.push({ type: 'identifier', value: identifier });
      continue;
    }
    if ('(),;'.includes(character)) {
      if (character === '(') depth += 1;
      if (character === ')') {
        depth -= 1;
        if (depth < 0) throw new Error('SQL has unbalanced parentheses');
      }
      tokens.push({ type: 'punctuation', value: character });
      index += 1;
      continue;
    }
    if (/[\p{L}\p{N}_$]/u.test(character)) {
      const start = index;
      while (/[\p{L}\p{N}_$]/u.test(value[index] ?? '')) index += 1;
      tokens.push({ type: 'ordinary', value: value.slice(start, index) });
      continue;
    }
    const operator = ['->>', '||', '<<', '>>', '<=', '>=', '==', '!=', '<>', '->']
      .find((candidate) => value.startsWith(candidate, index));
    tokens.push({ type: 'punctuation', value: operator ?? character });
    index += operator?.length ?? 1;
  }
  if (depth !== 0) throw new Error('SQL has unbalanced parentheses');
  return tokens;
}

function normalizeSqlTokens(tokens) {
  return tokens.map((token) => {
    if (token.type === 'string') return token.value;
    if (token.type === 'blob') return `x${token.value.slice(1)}`;
    return token.value.toLowerCase();
  }).join(' ');
}

function normalizeSqlFragment(value) {
  return normalizeSqlTokens(tokenizeSql(value));
}

function tokenIsKeyword(token, keyword) {
  return token?.type === 'ordinary' &&
    token.value.toUpperCase() === keyword.toUpperCase();
}

function splitTopLevelSql(tokens) {
  const parts = [];
  let start = 0;
  let depth = 0;
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.value === '(') {
      depth += 1;
    } else if (token.value === ')') {
      depth -= 1;
    } else if (token.value === ',' && depth === 0) {
      parts.push(tokens.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(tokens.slice(start));
  return parts;
}

function tableSqlClauses(sql) {
  const tokens = tokenizeSql(sql);
  const openIndex = tokens.findIndex((token) => token.value === '(');
  if (openIndex < 0) throw new Error('table SQL has no column-list boundary');
  let depth = 0;
  for (let index = openIndex; index < tokens.length; index += 1) {
    if (tokens[index].value === '(') {
      depth += 1;
    } else if (tokens[index].value === ')') {
      depth -= 1;
      if (depth === 0) {
        return splitTopLevelSql(tokens.slice(openIndex + 1, index));
      }
    }
  }
  throw new Error('table SQL has an unterminated column list');
}

function tableSqlModifiers(sql) {
  const tokens = tokenizeSql(sql);
  const openIndex = tokens.findIndex((token) => token.value === '(');
  if (openIndex < 0) throw new Error('table SQL has no column-list boundary');
  let depth = 0;
  for (let index = openIndex; index < tokens.length; index += 1) {
    if (tokens[index].value === '(') depth += 1;
    if (tokens[index].value !== ')') continue;
    depth -= 1;
    if (depth !== 0) continue;
    return tokens.slice(index + 1).filter((token) => token.value !== ';');
  }
  throw new Error('table SQL has an unterminated column list');
}

function findTopLevelKeyword(tokens, keyword, fromIndex = 0) {
  let depth = 0;
  for (let index = fromIndex; index < tokens.length; index += 1) {
    if (tokens[index].value === '(') {
      depth += 1;
      continue;
    }
    if (tokens[index].value === ')') {
      depth -= 1;
      continue;
    }
    if (depth === 0 && tokenIsKeyword(tokens[index], keyword)) return index;
  }
  return -1;
}

function extractParenthesizedExpressions(tokens, keyword) {
  const expressions = [];
  let searchIndex = 0;
  while (searchIndex < tokens.length) {
    const keywordIndex = findTopLevelKeyword(tokens, keyword, searchIndex);
    if (keywordIndex < 0) break;
    const openIndex = keywordIndex + 1;
    if (tokens[openIndex]?.value !== '(') {
      searchIndex = openIndex + 1;
      continue;
    }
    let depth = 1;
    let closed = false;
    for (let index = openIndex + 1; index < tokens.length; index += 1) {
      if (tokens[index].value === '(') {
        depth += 1;
      } else if (tokens[index].value === ')') {
        depth -= 1;
        if (depth === 0) {
          expressions.push(tokens.slice(openIndex + 1, index));
          searchIndex = index + 1;
          closed = true;
          break;
        }
      }
    }
    if (!closed) {
      throw new Error(`${keyword} expression has unbalanced parentheses`);
    }
  }
  return expressions;
}

function stripWholeExpressionGrouping(tokens) {
  let result = tokens;
  while (result[0]?.value === '(' && result.at(-1)?.value === ')') {
    let depth = 0;
    let closesAtEnd = false;
    for (let index = 0; index < result.length; index += 1) {
      if (result[index].value === '(') depth += 1;
      if (result[index].value === ')') depth -= 1;
      if (depth === 0) {
        closesAtEnd = index === result.length - 1;
        break;
      }
    }
    if (!closesAtEnd) break;
    result = result.slice(1, -1);
  }
  return result;
}

function columnSqlClauses(sql) {
  return new Map(tableSqlClauses(sql).flatMap((clause) => {
    if (
      tokenIsKeyword(clause[0], 'CONSTRAINT') ||
      tokenIsKeyword(clause[0], 'UNIQUE') ||
      tokenIsKeyword(clause[0], 'CHECK') ||
      (
        tokenIsKeyword(clause[0], 'PRIMARY') &&
        tokenIsKeyword(clause[1], 'KEY')
      ) ||
      (
        tokenIsKeyword(clause[0], 'FOREIGN') &&
        tokenIsKeyword(clause[1], 'KEY')
      )
    ) {
      return [];
    }
    const name = clause[0];
    return name?.type === 'ordinary' || name?.type === 'identifier'
      ? [[name.value.toLowerCase(), clause]]
      : [];
  }));
}

function tableCheckFingerprint(sql) {
  return tableSqlClauses(sql)
    .flatMap((clause) => extractParenthesizedExpressions(clause, 'CHECK'))
    .map(stripWholeExpressionGrouping)
    .map(normalizeSqlTokens)
    .toSorted();
}

function generatedColumnFingerprint(sql, rows) {
  const clauses = columnSqlClauses(sql);
  return rows.filter((row) => row.hidden === 2 || row.hidden === 3).map((row) => {
    const clause = clauses.get(row.name.toLowerCase()) ?? [];
    const expression = extractParenthesizedExpressions(clause, 'AS')[0];
    if (expression === undefined) {
      throw new Error(`generated column ${row.name} has no parseable expression`);
    }
    return {
      name: row.name,
      expression: normalizeSqlTokens(expression),
      mode: row.hidden === 3 ? 'stored' : 'virtual',
    };
  });
}

function columnCollations(sql) {
  return new Map([...columnSqlClauses(sql)].map(([name, clause]) => {
    const keywordIndex = findTopLevelKeyword(clause, 'COLLATE');
    if (keywordIndex < 0) return [name, 'BINARY'];
    const collation = clause[keywordIndex + 1];
    if (
      collation?.type !== 'ordinary' &&
      collation?.type !== 'identifier'
    ) {
      throw new Error(`column ${name} has malformed COLLATE syntax`);
    }
    return [name, collation.value.toUpperCase()];
  }));
}

function indexFingerprint(db, table) {
  return db.prepare(`PRAGMA index_list(${table})`).all().map((row) => {
    const object = db.prepare(
      'SELECT type, sql FROM sqlite_schema WHERE name = ?',
    ).get(row.name);
    const tokens = typeof object?.sql === 'string'
      ? tokenizeSql(object.sql)
      : [];
    const whereIndex = typeof object?.sql === 'string'
      ? findTopLevelKeyword(tokens, 'WHERE')
      : -1;
    const where = whereIndex < 0
      ? null
      : tokens.slice(whereIndex + 1);
    return {
      name: row.name,
      unique: row.unique,
      origin: row.origin,
      partial: row.partial,
      columns: db.prepare(`PRAGMA index_xinfo(${row.name})`).all().map((column) => ({
        seqno: column.seqno,
        cid: column.cid,
        name: column.name,
        desc: column.desc,
        collation: column.coll,
        key: column.key,
      })),
      where: where === null ? null : normalizeSqlTokens(where),
    };
  }).toSorted((left, right) => left.name.localeCompare(right.name));
}

function expectedIndexFingerprint(table, expectedColumns) {
  const columnIds = new Map(expectedColumns.map((name, index) => [name, index]));
  const entries = REQUIRED_TABLE_INDEXES[table].map((entry) => ({
    ...entry,
    unique: 0,
    origin: 'c',
  }));
  entries.push({
    name: `sqlite_autoindex_${table}_1`,
    columns: TABLE_PRIMARY_KEYS[table].map((name) => [name, 0]),
    unique: 1,
    origin: 'pk',
  });
  return entries.map((entry) => ({
    name: entry.name,
    unique: entry.unique,
    origin: entry.origin,
    partial: Number(entry.where !== undefined),
    columns: [
      ...entry.columns.map(([name, desc], seqno) => ({
        seqno,
        cid: columnIds.get(name),
        name,
        desc,
        collation: 'BINARY',
        key: 1,
      })),
      {
        seqno: entry.columns.length,
        cid: -1,
        name: null,
        desc: 0,
        collation: 'BINARY',
        key: 0,
      },
    ],
    where: entry.where === undefined
      ? null
      : normalizeSqlFragment(entry.where),
  })).toSorted((left, right) => left.name.localeCompare(right.name));
}

function foreignKeyFingerprint(db, table) {
  const groups = new Map();
  for (const row of db.prepare(`PRAGMA foreign_key_list(${table})`).all()) {
    const group = groups.get(row.id) ?? {
      table: row.table,
      columns: [],
      onUpdate: row.on_update,
      onDelete: row.on_delete,
      match: row.match,
    };
    group.columns.push([row.seq, row.from, row.to]);
    groups.set(row.id, group);
  }
  return [...groups.values()]
    .map((group) => ({
      ...group,
      columns: group.columns
        .toSorted((left, right) => left[0] - right[0])
        .map(([, from, to]) => [from, to]),
    }))
    .toSorted((left, right) => canonicalJson(left).localeCompare(canonicalJson(right)));
}

function expectedForeignKeyFingerprint(table) {
  return structuredClone(TABLE_FOREIGN_KEYS[table])
    .toSorted((left, right) => canonicalJson(left).localeCompare(canonicalJson(right)));
}

function normalizeTriggerSql(value) {
  const tokens = tokenizeSql(value);
  if (
    tokenIsKeyword(tokens[0], 'CREATE') &&
    tokenIsKeyword(tokens[1], 'TRIGGER') &&
    tokenIsKeyword(tokens[2], 'IF') &&
    tokenIsKeyword(tokens[3], 'NOT') &&
    tokenIsKeyword(tokens[4], 'EXISTS')
  ) {
    tokens.splice(2, 3);
  }
  return normalizeSqlTokens(tokens);
}

function triggerFingerprint(db, table) {
  return db.prepare(`
    SELECT name, sql
    FROM sqlite_schema
    WHERE type = 'trigger' AND tbl_name = ?
    ORDER BY name ASC
  `).all(table).map((row) => ({
    name: row.name,
    sql: normalizeTriggerSql(row.sql),
  }));
}

function expectedTriggerFingerprint(table) {
  return TABLE_TRIGGERS[table].map((entry) => ({
    name: entry.name,
    sql: normalizeTriggerSql(entry.sql),
  })).toSorted((left, right) => left.name.localeCompare(right.name));
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function pathWithin(child, parent) {
  const relative = path.relative(parent, child);
  return relative === '' ||
    (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function statIdentity(info) {
  return {
    dev: String(info.dev),
    ino: String(info.ino),
    size: Number(info.size),
    mode: Number(info.mode & 0o7777n),
    mtimeNs: String(info.mtimeNs),
  };
}

function sameIdentity(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

async function openBoundPath(
  pathname,
  rootReal,
  kind,
  maxBytes,
  allowEmpty = false,
) {
  const lexicalPath = path.resolve(pathname);
  const [resolved, pathInfo] = await Promise.all([
    realpath(lexicalPath),
    lstat(lexicalPath, { bigint: true }),
  ]);
  const isExpectedKind =
    kind === 'directory' ? pathInfo.isDirectory() : pathInfo.isFile();
  if (
    resolved !== lexicalPath ||
    !pathWithin(resolved, rootReal) ||
    pathInfo.isSymbolicLink() ||
    !isExpectedKind ||
    (
      kind === 'file' &&
      (
        pathInfo.size < (allowEmpty ? 0n : 1n) ||
        pathInfo.size > BigInt(maxBytes)
      )
    )
  ) {
    throw new Error(`retention source is not a canonical bounded ${kind}: ${pathname}`);
  }
  const handle = await open(
    lexicalPath,
    kind === 'directory' ? OPEN_DIRECTORY_FLAGS : OPEN_FILE_FLAGS,
  );
  try {
    const openedInfo = await handle.stat({ bigint: true });
    if (
      (kind === 'directory' ? !openedInfo.isDirectory() : !openedInfo.isFile()) ||
      !sameIdentity(statIdentity(pathInfo), statIdentity(openedInfo))
    ) {
      throw new Error(`retention source changed before open: ${pathname}`);
    }
    return {
      handle,
      pathname: lexicalPath,
      identity: statIdentity(openedInfo),
      kind,
    };
  } catch (error) {
    await handle.close();
    throw error;
  }
}

async function openOptionalBoundFile(pathname, rootReal, maxBytes) {
  try {
    return await openBoundPath(pathname, rootReal, 'file', maxBytes, true);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return { handle: null, pathname: path.resolve(pathname), identity: null, kind: 'file' };
    }
    throw error;
  }
}

async function revalidateOpenedPath(opened, rootReal) {
  if (!opened.handle) {
    try {
      await lstat(opened.pathname);
    } catch (error) {
      if (error?.code === 'ENOENT') return;
      throw error;
    }
    throw new Error(`retention sidecar appeared during snapshot: ${opened.pathname}`);
  }
  const [resolved, pathInfo, handleInfo] = await Promise.all([
    realpath(opened.pathname),
    lstat(opened.pathname, { bigint: true }),
    opened.handle.stat({ bigint: true }),
  ]);
  if (
    resolved !== opened.pathname ||
    !pathWithin(resolved, rootReal) ||
    pathInfo.isSymbolicLink() ||
    !sameIdentity(opened.identity, statIdentity(pathInfo)) ||
    !sameIdentity(opened.identity, statIdentity(handleInfo))
  ) {
    throw new Error(`retention source changed during snapshot: ${opened.pathname}`);
  }
}

async function copyOpenedFile(opened, targetPath) {
  if (!opened.handle) return null;
  const bytes = await opened.handle.readFile();
  if (bytes.length !== opened.identity.size) {
    throw new Error(`retention source size changed during snapshot: ${opened.pathname}`);
  }
  await writeFile(targetPath, bytes, { flag: 'wx', mode: 0o600 });
  return {
    ...opened.identity,
    sha256: sha256(bytes),
  };
}

async function closeOpenedPaths(openedPaths) {
  await Promise.all(openedPaths.flatMap((entry) =>
    entry.handle ? [entry.handle.close()] : []));
}

async function snapshotSqliteFiles({
  databasePath,
  destinationDirectory,
  rootReal,
  openedPaths,
  testHooks,
}) {
  const databaseDirectory = await openBoundPath(
    path.dirname(databasePath),
    rootReal,
    'directory',
  );
  openedPaths.push(databaseDirectory);
  const database = await openBoundPath(
    databasePath,
    rootReal,
    'file',
    MAX_DATABASE_BYTES,
  );
  openedPaths.push(database);
  const wal = await openOptionalBoundFile(
    `${databasePath}-wal`,
    rootReal,
    MAX_SIDECAR_BYTES,
  );
  openedPaths.push(wal);
  const shm = await openOptionalBoundFile(
    `${databasePath}-shm`,
    rootReal,
    MAX_SIDECAR_BYTES,
  );
  openedPaths.push(shm);
  await testHooks?.afterSourceOpen?.({
    databasePath,
    databaseIdentity: database.identity,
  });
  await mkdir(destinationDirectory, { mode: 0o700 });
  const snapshotDatabasePath = path.join(
    destinationDirectory,
    path.basename(databasePath),
  );
  const source = {
    database: await copyOpenedFile(database, snapshotDatabasePath),
    wal: await copyOpenedFile(wal, `${snapshotDatabasePath}-wal`),
    shm: await copyOpenedFile(shm, `${snapshotDatabasePath}-shm`),
  };
  await Promise.all([
    revalidateOpenedPath(databaseDirectory, rootReal),
    revalidateOpenedPath(database, rootReal),
    revalidateOpenedPath(wal, rootReal),
    revalidateOpenedPath(shm, rootReal),
  ]);
  return {
    snapshotDatabasePath,
    binding: {
      pathFingerprint: sha256(databasePath),
      source,
      snapshotSha256: sha256(canonicalJson(source)),
    },
  };
}

function requireExactTable(db, table, expectedColumns) {
  const object = db.prepare(
    'SELECT type, sql FROM sqlite_schema WHERE name = ?',
  ).get(table);
  const modifiers = object?.type === 'table' && typeof object.sql === 'string'
    ? tableSqlModifiers(object.sql)
    : [];
  const strict = modifiers.some((token) => tokenIsKeyword(token, 'STRICT'));
  const withoutRowid = modifiers.some((token, index) =>
    tokenIsKeyword(token, 'WITHOUT') &&
    tokenIsKeyword(modifiers[index + 1], 'ROWID'));
  if (
    object?.type !== 'table' ||
    typeof object.sql !== 'string' ||
    !strict ||
    withoutRowid
  ) {
    throw new Error(`${table} is not a canonical STRICT SQLite table`);
  }
  const rows = db.prepare(`PRAGMA table_xinfo(${table})`).all();
  const names = rows.map((row) => row.name);
  if (canonicalJson(names) !== canonicalJson(expectedColumns)) {
    throw new Error(`${table} does not expose the exact product table_xinfo inventory`);
  }
  const collations = columnCollations(object.sql);
  const layout = rows.map((row) => ({
    cid: row.cid,
    name: row.name,
    type: row.type,
    notnull: row.notnull,
    defaultExpression: row.dflt_value === null
      ? null
      : normalizeSqlFragment(String(row.dflt_value)),
    pk: row.pk,
    hidden: row.hidden,
    collation: collations.get(row.name) ?? 'BINARY',
  }));
  const expectedLayout = expectedTableLayout(table, expectedColumns).map((column) => ({
    ...column,
    defaultExpression: column.defaultExpression === null
      ? null
      : normalizeSqlFragment(column.defaultExpression),
  }));
  if (
    canonicalJson(layout) !== canonicalJson(expectedLayout)
  ) {
    throw new Error(
      `${table} does not expose the exact product column/default/collation layout`,
    );
  }
  const indexes = indexFingerprint(db, table);
  if (
    canonicalJson(indexes) !==
    canonicalJson(expectedIndexFingerprint(table, expectedColumns))
  ) {
    throw new Error(`${table} does not expose the exact product index inventory`);
  }
  const foreignKeys = foreignKeyFingerprint(db, table);
  if (
    canonicalJson(foreignKeys) !==
    canonicalJson(expectedForeignKeyFingerprint(table))
  ) {
    throw new Error(`${table} does not expose the exact product foreign keys`);
  }
  const checks = tableCheckFingerprint(object.sql);
  const expectedChecks = TABLE_CHECKS[table].map(normalizeSqlFragment).toSorted();
  if (canonicalJson(checks) !== canonicalJson(expectedChecks)) {
    throw new Error(`${table} does not expose the exact product CHECK constraints`);
  }
  const triggers = triggerFingerprint(db, table);
  if (
    canonicalJson(triggers) !==
    canonicalJson(expectedTriggerFingerprint(table))
  ) {
    throw new Error(`${table} does not expose the exact product triggers`);
  }
  const generatedColumns = generatedColumnFingerprint(object.sql, rows);
  if (generatedColumns.length !== 0) {
    throw new Error(`${table} exposes unexpected generated columns`);
  }
  return {
    objectType: object.type,
    strict,
    withoutRowid,
    createSqlSha256: sha256(object.sql),
    columns: layout,
    indexes,
    foreignKeys,
    checks,
    triggers,
    generatedColumns,
  };
}

function requireDatabaseIntegrity(db, expectedVersion, expectedOwner) {
  const integrity = db.prepare('PRAGMA integrity_check').get();
  if (integrity?.integrity_check !== 'ok') {
    throw new Error('retention snapshot failed SQLite integrity_check');
  }
  const version = Number(db.prepare('PRAGMA user_version').get()?.user_version);
  if (version !== expectedVersion) {
    throw new Error(`retention snapshot has unexpected schema version ${version}`);
  }
  const owner = db.prepare(
    "SELECT role, schema_version, agent_id FROM schema_meta WHERE meta_key = 'primary'",
  ).get();
  if (
    owner?.role !== expectedOwner.role ||
    Number(owner?.schema_version) !== expectedVersion ||
    (owner?.agent_id ?? null) !== expectedOwner.agentId
  ) {
    throw new Error('retention snapshot has an invalid database owner');
  }
}

function requirePhysicalSchema(db, requiredTables, expectedVersion, expectedOwner) {
  const schema = Object.fromEntries(
    Object.entries(requiredTables).map(([table, columns]) => [
      table,
      requireExactTable(db, table, columns),
    ]),
  );
  requireDatabaseIntegrity(db, expectedVersion, expectedOwner);
  return schema;
}

export function inspectReturnCovenantPhysicalSchema({
  database,
  kind,
  agentId,
}) {
  if (kind !== 'global' && kind !== 'agent') {
    throw new Error('physical schema inspection kind must be global or agent');
  }
  if (
    !database ||
    typeof database.prepare !== 'function' ||
    typeof database.exec !== 'function'
  ) {
    throw new Error('physical schema inspection requires an opened SQLite database');
  }
  if (kind === 'agent' && !nonEmptyString(agentId)) {
    throw new Error('agent physical schema inspection requires an agent id');
  }
  try {
    database.exec('BEGIN');
    const schema = kind === 'global'
      ? requirePhysicalSchema(
        database,
        REQUIRED_GLOBAL_COLUMNS,
        15,
        { role: 'global', agentId: null },
      )
      : requirePhysicalSchema(
        database,
        REQUIRED_AGENT_COLUMNS,
        19,
        { role: 'agent', agentId },
      );
    database.exec('COMMIT');
    return schema;
  } catch (error) {
    try {
      database.exec('ROLLBACK');
    } catch {
      // Preserve the original read failure.
    }
    throw error;
  }
}

function parseJsonRecord(raw, label) {
  const value = parseJsonValue(raw, label);
  if (!isRecord(value)) {
    throw new Error(`${label} is not a JSON object`);
  }
  return value;
}

function parseJsonValue(raw, label) {
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error(`${label} is not valid JSON`);
  }
  return value;
}

function optionalString(value, label) {
  if (value === undefined || value === null) return null;
  if (!nonEmptyString(value)) throw new Error(`${label} is not a non-empty string`);
  return value.trim();
}

function optionalStringArray(value, label) {
  if (value === undefined) return [];
  if (
    !Array.isArray(value) ||
    value.some((entry) => !nonEmptyString(entry))
  ) {
    throw new Error(`${label} is not an array of non-empty strings`);
  }
  return value.map((entry) => entry.trim());
}

function collectRecipientAuthoritySessionKeys(binding, label, keys) {
  if (binding === undefined) return;
  if (
    !isRecord(binding) ||
    binding.version !== 1 ||
    (
      binding.selection !== 'pending' &&
      binding.selection !== 'selected'
    )
  ) {
    throw new Error(`${label} is malformed`);
  }
  if (binding.selection === 'pending') {
    if (
      (binding.fanoutMode !== 'tree' && binding.fanoutMode !== 'all') ||
      Object.keys(binding).some((key) =>
        !['version', 'selection', 'fanoutMode'].includes(key))
    ) {
      throw new Error(`${label} pending selection is malformed`);
    }
    return;
  }
  if (
    !Array.isArray(binding.recipients) ||
    binding.recipients.length > 10_000 ||
    Object.keys(binding).some((key) =>
      !['version', 'selection', 'recipients'].includes(key))
  ) {
    throw new Error(`${label} selected recipients are malformed`);
  }
  const selected = new Set();
  for (const recipient of binding.recipients) {
    if (
      !isRecord(recipient) ||
      !nonEmptyString(recipient.sessionKey) ||
      !isRecord(recipient.authority) ||
      recipient.authority.state !== 'bound' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu
        .test(recipient.authority.epoch || '') ||
      Object.keys(recipient).some((key) =>
        !['sessionKey', 'authority'].includes(key)) ||
      Object.keys(recipient.authority).some((key) =>
        !['state', 'epoch'].includes(key))
    ) {
      throw new Error(`${label} contains a malformed recipient`);
    }
    const sessionKey = recipient.sessionKey.trim();
    if (selected.has(sessionKey)) {
      throw new Error(`${label} contains a duplicate recipient`);
    }
    selected.add(sessionKey);
    keys.add(sessionKey);
  }
}

function validateOptionalTimestamp(value, label) {
  if (value !== undefined && (!finiteNumber(value) || value < 0)) {
    throw new Error(`${label} is not a non-negative timestamp`);
  }
}

function decodeSubagentRow(row) {
  if (
    !nonEmptyString(row.run_id) ||
    !nonEmptyString(row.child_session_key) ||
    !nonEmptyString(row.requester_session_key) ||
    (row.controller_session_key !== null &&
      !nonEmptyString(row.controller_session_key))
  ) {
    throw new Error('subagent_runs contains malformed indexed identity');
  }
  const payload = parseJsonRecord(row.payload_json, 'subagent_runs.payload_json');
  const execution = payload.execution;
  const completion = payload.completion;
  const delivery = payload.delivery;
  if (
    !isRecord(execution) ||
    !SUBAGENT_EXECUTION_STATUSES.has(execution.status) ||
    !isRecord(completion) ||
    typeof completion.required !== 'boolean' ||
    !isRecord(delivery) ||
    !SUBAGENT_DELIVERY_STATUSES.has(delivery.status) ||
    'handoffLeaseId' in delivery ||
    'handoffLeasedAt' in delivery ||
    'handoffInjectedAt' in delivery
  ) {
    throw new Error('subagent_runs.payload_json is not a canonical subagent record');
  }
  for (const [value, label] of [
    [execution.endedAt, 'execution.endedAt'],
    [payload.cleanupCompletedAt, 'cleanupCompletedAt'],
    [delivery.suspendedAt, 'delivery.suspendedAt'],
  ]) {
    validateOptionalTimestamp(value, `subagent_runs.payload_json.${label}`);
  }
  if (
    payload.cleanup !== undefined &&
    payload.cleanup !== 'delete' &&
    payload.cleanup !== 'keep'
  ) {
    throw new Error('subagent_runs.payload_json.cleanup is unknown');
  }
  if (
    payload.expectsCompletionMessage !== undefined &&
    typeof payload.expectsCompletionMessage !== 'boolean'
  ) {
    throw new Error(
      'subagent_runs.payload_json.expectsCompletionMessage is malformed',
    );
  }
  if (
    payload.suppressCompletionDelivery !== undefined &&
    typeof payload.suppressCompletionDelivery !== 'boolean'
  ) {
    throw new Error(
      'subagent_runs.payload_json.suppressCompletionDelivery is malformed',
    );
  }
  if (
    delivery.disposition !== undefined &&
    !SUBAGENT_DELIVERY_DISPOSITIONS.has(delivery.disposition)
  ) {
    throw new Error('subagent_runs.payload_json.delivery.disposition is unknown');
  }
  const effectiveDeliveryStatus =
    payload.expectsCompletionMessage === false ? 'not_required' : delivery.status;
  const deliveryPayload = delivery.payload;
  if (
    deliveryPayload !== undefined &&
    !isRecord(deliveryPayload)
  ) {
    throw new Error('subagent_runs.payload_json.delivery.payload is malformed');
  }
  const suspended =
    effectiveDeliveryStatus === 'suspended' &&
    finiteNumber(delivery.suspendedAt);
  const requiredDelivery =
    payload.expectsCompletionMessage === true &&
    payload.suppressCompletionDelivery !== true &&
    completion.required === true &&
    isRecord(deliveryPayload) &&
    (
      suspended ||
      effectiveDeliveryStatus === 'in_progress' ||
      (
        effectiveDeliveryStatus === 'pending' &&
        delivery.disposition !== 'ambiguous' &&
        delivery.disposition !== 'intentional_non_delivery' &&
        delivery.disposition !== 'permanent_failure'
      )
    );
  if (
    effectiveDeliveryStatus === 'suspended' &&
    !finiteNumber(delivery.suspendedAt)
  ) {
    throw new Error(
      'subagent_runs.payload_json suspended delivery lacks suspendedAt',
    );
  }
  const childSessionKeys = new Set([row.child_session_key.trim()]);
  if (isRecord(deliveryPayload)) {
    const deliveryChild = optionalString(
      deliveryPayload.childSessionKey,
      'subagent_runs.payload_json.delivery.payload.childSessionKey',
    );
    if (deliveryChild) childSessionKeys.add(deliveryChild);
  }
  for (const [value, label] of [
    [payload.continuationTargetSessionKey, 'continuationTargetSessionKey'],
    [payload.swarmRequesterSessionKey, 'swarmRequesterSessionKey'],
  ]) {
    const key = optionalString(value, `subagent_runs.payload_json.${label}`);
    if (key) childSessionKeys.add(key);
  }
  for (const key of optionalStringArray(
    payload.continuationTargetSessionKeys,
    'subagent_runs.payload_json.continuationTargetSessionKeys',
  )) {
    childSessionKeys.add(key);
  }
  collectRecipientAuthoritySessionKeys(
    payload.continuationRecipientAuthorityBinding,
    'subagent_runs.payload_json.continuationRecipientAuthorityBinding',
    childSessionKeys,
  );
  for (const key of optionalStringArray(
    payload.swarmWaitOwnerSessionKeys,
    'subagent_runs.payload_json.swarmWaitOwnerSessionKeys',
  )) {
    childSessionKeys.add(key);
  }
  return {
    payload,
    effectiveDeliveryStatus,
    requiredDelivery,
    retained:
      execution.status !== 'terminal' ||
      !finiteNumber(payload.cleanupCompletedAt) ||
      requiredDelivery ||
      isRecord(payload.requesterSettleWake) ||
      isRecord(payload.killReconciliation) ||
      isRecord(payload.killIntent) ||
      isRecord(payload.acceptedSteerDispatch) ||
      isRecord(payload.acceptedSpawnRollback) ||
      isRecord(execution.restartRecovery) ||
      payload.terminalOwner === 'interrupted-recovery' ||
      (
        payload.collect === true &&
        !isRecord(payload.collectorCompletion)
      ),
    childSessionKeys,
  };
}

function nonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function positiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function validateContinuationWorkState(state) {
  if (
    !isRecord(state) ||
    state.kind !== 'continuation_work' ||
    !nonEmptyString(state.sessionKey) ||
    !positiveInteger(state.hop) ||
    !nonNegativeInteger(state.delayMs) ||
    !nonNegativeInteger(state.electedAt) ||
    !nonNegativeInteger(state.dueAt) ||
    !positiveInteger(state.maxChainLength)
  ) {
    throw new Error('continuation work flow has malformed state_json');
  }
  for (const name of [
    'recoveryDueAt',
    'chainStartedAt',
    'accumulatedChainTokens',
    'anchorFinalizedAt',
    'releasedAt',
    'deliveredAt',
    'turnGrantedAt',
    'foldedAt',
    'overdueByMs',
    'retryCount',
    'busySkipCount',
  ]) {
    if (state[name] !== undefined && !nonNegativeInteger(state[name])) {
      throw new Error(`continuation work flow has malformed ${name}`);
    }
  }
  for (const name of [
    'reason',
    'parentRunId',
    'chainId',
    'traceparent',
    'originRunId',
    'originTurnId',
  ]) {
    if (state[name] !== undefined && typeof state[name] !== 'string') {
      throw new Error(`continuation work flow has malformed ${name}`);
    }
  }
  if (
    (state.traceparentProvenance !== undefined &&
      state.traceparentProvenance !== 'internal') ||
    (state.anchorPending !== undefined &&
      typeof state.anchorPending !== 'boolean') ||
    (state.disposition !== undefined &&
      state.disposition !== 'granted' &&
      state.disposition !== 'folded-active')
  ) {
    throw new Error('continuation work flow has malformed state_json');
  }
  if (state.idleRetry !== undefined) {
    if (
      !isRecord(state.idleRetry) ||
      !['reply-run-ended', 'command-lane-idle']
        .includes(state.idleRetry.trigger) ||
      !['follow-up-work', 'wait-shaped', 'unknown']
        .includes(state.idleRetry.reasonCategory) ||
      !nonNegativeInteger(state.idleRetry.armedAt)
    ) {
      throw new Error('continuation work flow has malformed idleRetry');
    }
  }
  if (
    state.succeeded !== undefined &&
    (
      !isRecord(state.succeeded) ||
      state.succeeded.point !== 'optimal' ||
      state.succeeded.durability !== 'durable' ||
      Object.keys(state.succeeded).length !== 2
    )
  ) {
    throw new Error('continuation work flow has malformed succeeded state');
  }
}

function isTerminalFlowRow(row) {
  return TERMINAL_FLOW_STATUSES.has(row.status) ||
    (row.status === 'blocked' && row.ended_at !== null);
}

function hasDefinedTerminalNotice(state) {
  return isRecord(state) && state.terminalNoticePending !== undefined;
}

function isRetainedFlow(row, state) {
  if (
    !nonEmptyString(row.flow_id) ||
    !nonEmptyString(row.owner_key) ||
    !FLOW_SYNC_MODES.has(row.sync_mode) ||
    !FLOW_STATUSES.has(row.status) ||
    (row.controller_id !== null && !nonEmptyString(row.controller_id))
  ) {
    throw new Error('flow_runs contains unknown or malformed lifecycle state');
  }
  if (row.controller_id === 'core/continuation-work') {
    if (row.sync_mode !== 'managed') {
      throw new Error('continuation work flow has malformed state_json');
    }
    validateContinuationWorkState(state);
    if (state.sessionKey.trim() !== row.owner_key.trim()) {
      throw new Error(
        'continuation work flow has malformed state_json',
      );
    }
    const terminalNoticePending = hasDefinedTerminalNotice(state);
    if (
      terminalNoticePending &&
      state.terminalNoticePending !== 'retry-exhausted'
    ) {
      throw new Error(
        'continuation work flow has malformed terminal notice marker',
      );
    }
    if (
      terminalNoticePending &&
      (
        row.status !== 'failed' ||
        row.ended_at === null ||
        row.cancel_requested_at !== null ||
        state.succeeded !== undefined
      )
    ) {
      throw new Error(
        'continuation work flow has contradictory terminal notice state',
      );
    }
    return (
      terminalNoticePending ||
      (
        row.cancel_requested_at === null &&
        (row.status === 'queued' || row.status === 'running') &&
        state.succeeded === undefined
      )
    );
  }
  if (hasDefinedTerminalNotice(state)) {
    if (!isTerminalFlowRow(row)) {
      throw new Error('task flow has contradictory terminal notice state');
    }
    return true;
  }
  if (
    row.controller_id === 'core/continuation-delegate' ||
    row.controller_id === 'core/continuation-post-compaction'
  ) {
    if (
      row.sync_mode !== 'managed' ||
      !isRecord(state) ||
      state.kind !== 'continuation_delegate' ||
      !nonEmptyString(state.task)
    ) {
      throw new Error('continuation delegate flow has malformed state_json');
    }
    if (
      row.controller_id === 'core/continuation-post-compaction' &&
      state.postCompaction !== true
    ) {
      throw new Error('post-compaction flow lacks its canonical state marker');
    }
    return (
      row.cancel_requested_at === null &&
      (row.status === 'queued' || row.status === 'running')
    );
  }
  return false;
}

function decodeDeliveryQueueRow(row) {
  if (
    !nonEmptyString(row.queue_name) ||
    !nonEmptyString(row.id) ||
    !DELIVERY_QUEUE_STATUSES.has(row.status) ||
    !Number.isSafeInteger(Number(row.retry_count)) ||
    Number(row.retry_count) < 0 ||
    !Number.isSafeInteger(Number(row.enqueued_at)) ||
    Number(row.enqueued_at) < 0
  ) {
    throw new Error('delivery_queue_entries contains malformed lifecycle state');
  }
  if (
    row.recovery_state !== null &&
    !DELIVERY_QUEUE_RECOVERY_STATES.has(row.recovery_state)
  ) {
    throw new Error('delivery_queue_entries contains an unknown recovery state');
  }
  const entry = parseJsonRecord(
    row.entry_json,
    'delivery_queue_entries.entry_json',
  );
  const metadata = {
    sessionKey: entry.sessionKey ?? entry.session?.key ?? null,
    channel:
      entry.channel ??
      entry.route?.channel ??
      entry.deliveryContext?.channel ??
      null,
    target:
      entry.to ??
      entry.route?.to ??
      entry.deliveryContext?.to ??
      null,
    accountId:
      entry.accountId ??
      entry.route?.accountId ??
      entry.deliveryContext?.accountId ??
      null,
  };
  const unfinished =
    row.status === 'pending' ||
    (row.status === 'failed' && row.recovery_state === 'settlement_pending');
  if (entry.owner !== undefined) {
    if (
      !isRecord(entry.owner) ||
      entry.owner.kind !== 'subagent_completion' ||
      !nonEmptyString(entry.owner.runId) ||
      !nonEmptyString(entry.owner.taskId) ||
      !Number.isSafeInteger(entry.owner.generation) ||
      entry.owner.generation < 1 ||
      !finiteNumber(entry.owner.deadlineAt) ||
      Object.keys(entry.owner).some((key) =>
        !['kind', 'runId', 'taskId', 'generation', 'deadlineAt'].includes(key))
    ) {
      throw new Error('delivery_queue_entries.entry_json.owner is malformed');
    }
  }
  if (
    (entry.sourceFlowId === undefined) !==
      (entry.sourceExpectedRevision === undefined) ||
    (
      entry.sourceFlowId !== undefined &&
      (
        !nonEmptyString(entry.sourceFlowId) ||
        !Number.isSafeInteger(entry.sourceExpectedRevision)
      )
    )
  ) {
    throw new Error(
      'delivery_queue_entries post-compaction flow binding is malformed',
    );
  }
  if (
    entry.id !== row.id ||
    Number(entry.enqueuedAt) !== Number(row.enqueued_at) ||
    Number(entry.retryCount) !== Number(row.retry_count) ||
    (entry.lastAttemptAt ?? null) !== row.last_attempt_at ||
    (
      unfinished &&
      (entry.lastError ?? null) !== row.last_error
    ) ||
    (entry.recoveryState ?? null) !== row.recovery_state ||
    (entry.platformSendStartedAt ?? null) !== row.platform_send_started_at ||
    (
      unfinished &&
      (
        (
          entry.kind !== undefined &&
          entry.kind !== row.entry_kind
        ) ||
        metadata.sessionKey !== row.session_key ||
        metadata.channel !== row.channel ||
        metadata.target !== row.target ||
        metadata.accountId !== row.account_id
      )
    ) ||
    (
      !unfinished &&
      [
        row.entry_kind,
        row.session_key,
        row.channel,
        row.target,
        row.account_id,
      ].some((value) => value !== null)
    )
  ) {
    throw new Error('delivery_queue_entries indexed fields differ from entry_json');
  }
  for (const [value, label] of [
    [entry.deliveryStartedAt, 'deliveryStartedAt'],
    [entry.platformSendStartedAt, 'platformSendStartedAt'],
  ]) {
    validateOptionalTimestamp(value, `delivery_queue_entries.${label}`);
  }
  if (
    row.platform_send_started_at !== null &&
    (!finiteNumber(row.platform_send_started_at) ||
      row.platform_send_started_at < 0)
  ) {
    throw new Error(
      'delivery_queue_entries.platform_send_started_at is malformed',
    );
  }
  if (
    entry.availableAt !== undefined &&
    (!finiteNumber(entry.availableAt) || entry.availableAt < 0)
  ) {
    throw new Error('delivery_queue_entries.entry_json.availableAt is malformed');
  }
  if (
    entry.attemptCount !== undefined &&
    (
      !Number.isSafeInteger(entry.attemptCount) ||
      entry.attemptCount < 0
    )
  ) {
    throw new Error('delivery_queue_entries.entry_json.attemptCount is malformed');
  }
  if (
    entry.requiresProducerClaim !== undefined &&
    typeof entry.requiresProducerClaim !== 'boolean'
  ) {
    throw new Error(
      'delivery_queue_entries.entry_json.requiresProducerClaim is malformed',
    );
  }
  const producerClaimOwned =
    row.recovery_state === 'producer_claimed' &&
    nonEmptyString(entry.producerClaimId) &&
    finiteNumber(entry.availableAt);
  const platformClaimOwned =
    (
      row.recovery_state === 'send_attempt_started' ||
      row.recovery_state === 'unknown_after_send'
    ) &&
    nonEmptyString(entry.platformSendAttemptId) &&
    finiteNumber(entry.platformSendStartedAt);
  if (
    (
      row.recovery_state === 'producer_claimed' &&
      !producerClaimOwned
    ) ||
    (
      (
        row.recovery_state === 'send_attempt_started' ||
        row.recovery_state === 'unknown_after_send'
      ) &&
      !platformClaimOwned
    )
  ) {
    throw new Error(
      'delivery_queue_entries contains malformed delivery-attempt ownership',
    );
  }
  const attemptOwned =
    finiteNumber(entry.deliveryStartedAt) ||
    finiteNumber(entry.platformSendStartedAt) ||
    row.platform_send_started_at !== null ||
    producerClaimOwned ||
    platformClaimOwned;
  const retained = unfinished;
  if (!retained && attemptOwned) {
    throw new Error('terminal delivery_queue_entries row retains attempt ownership');
  }
  return { entry, retained, attemptOwned };
}

function collectFlowSessionKeys(state, keys) {
  if (!isRecord(state)) return;
  for (const [value, label] of [
    [state.sessionKey, 'sessionKey'],
    [state.childSessionKey, 'childSessionKey'],
    [state.targetSessionKey, 'targetSessionKey'],
  ]) {
    const key = optionalString(value, `flow_runs.state_json.${label}`);
    if (key) keys.add(key);
  }
  for (const key of optionalStringArray(
    state.targetSessionKeys,
    'flow_runs.state_json.targetSessionKeys',
  )) {
    keys.add(key);
  }
  collectRecipientAuthoritySessionKeys(
    state.recipientAuthorityBinding,
    'flow_runs.state_json.recipientAuthorityBinding',
    keys,
  );
}

function collectQueueSessionKeys(row, entry, keys) {
  for (const [value, label] of [
    [row.session_key, 'session_key'],
    [entry.sessionKey, 'entry_json.sessionKey'],
    [entry.targetSessionKey, 'entry_json.targetSessionKey'],
  ]) {
    const key = optionalString(value, `delivery_queue_entries.${label}`);
    if (key) keys.add(key);
  }
  for (const key of optionalStringArray(
    entry.targetSessionKeys,
    'delivery_queue_entries.entry_json.targetSessionKeys',
  )) {
    keys.add(key);
  }
  collectRecipientAuthoritySessionKeys(
    entry.recipientAuthorityBinding,
    'delivery_queue_entries.entry_json.recipientAuthorityBinding',
    keys,
  );
}

function temporarySessionRelevance(entry, sessionKey, runBoundSessionKeys) {
  const spawnedBy = optionalString(entry.spawnedBy, 'session_nodes.entry_json.spawnedBy');
  const parentSessionKey = optionalString(
    entry.parentSessionKey,
    'session_nodes.entry_json.parentSessionKey',
  );
  const createdVia = entry.createdVia;
  if (createdVia !== undefined && !SESSION_CREATED_VIA.has(createdVia)) {
    throw new Error('session_nodes.entry_json.createdVia is unknown');
  }
  if (
    entry.spawnDepth !== undefined &&
    (
      !Number.isSafeInteger(entry.spawnDepth) ||
      entry.spawnDepth < 0
    )
  ) {
    throw new Error('session_nodes.entry_json.spawnDepth is malformed');
  }
  if (entry.incognito !== undefined) {
    throw new Error('persistent session_nodes entry cannot be incognito');
  }
  const spawned =
    createdVia === 'spawn' ||
    entry.spawnDepth > 0 ||
    spawnedBy !== null;
  const runBound =
    runBoundSessionKeys.has(sessionKey) ||
    (spawnedBy !== null && runBoundSessionKeys.has(spawnedBy)) ||
    (parentSessionKey !== null && runBoundSessionKeys.has(parentSessionKey));
  return { spawned, runBound };
}

function inspectGlobalDatabase(snapshotDatabasePath) {
  const db = new DatabaseSync(snapshotDatabasePath, { readOnly: true });
  try {
    db.exec('BEGIN');
    const schema = requirePhysicalSchema(
      db,
      REQUIRED_GLOBAL_COLUMNS,
      15,
      { role: 'global', agentId: null },
    );
    const agentDatabases = db.prepare(`
      SELECT agent_id, path, schema_version, last_seen_at, size_bytes
      FROM agent_databases
      ORDER BY agent_id ASC, path ASC
    `).all();
    const flowRows = db.prepare(`
      SELECT
        flow_id, shape, sync_mode, owner_key, chain_id,
        requester_origin_json, controller_id, revision, status,
        notify_policy, goal, current_step, blocked_task_id,
        blocked_summary, state_json, wait_json, cancel_requested_at,
        created_at, updated_at, ended_at
      FROM flow_runs
      ORDER BY created_at ASC, flow_id ASC
    `).all();
    const subagentRows = db.prepare(`
      SELECT
        run_id, child_session_key, controller_session_key,
        requester_session_key, created_at, payload_json
      FROM subagent_runs
      ORDER BY created_at ASC, run_id ASC
    `).all();
    const deliveryRows = db.prepare(`
      SELECT
        queue_name, id, status, entry_kind, session_key, channel,
        target, account_id, retry_count, last_attempt_at, last_error,
        recovery_state, platform_send_started_at, entry_json,
        enqueued_at, updated_at, failed_at
      FROM delivery_queue_entries
      ORDER BY enqueued_at ASC, queue_name ASC, id ASC
    `).all();
    db.exec('COMMIT');
    return { agentDatabases, deliveryRows, flowRows, schema, subagentRows };
  } catch (error) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // Preserve the original read failure.
    }
    throw error;
  } finally {
    db.close();
  }
}

function inspectAgentDatabase(
  snapshotDatabasePath,
  expectedAgentId,
  runBoundSessionKeys,
) {
  const db = new DatabaseSync(snapshotDatabasePath, { readOnly: true });
  try {
    db.exec('BEGIN');
    const schema = requirePhysicalSchema(
      db,
      REQUIRED_AGENT_COLUMNS,
      19,
      { role: 'agent', agentId: expectedAgentId },
    );
    const rows = db.prepare(`
      SELECT
        session_nodes.session_key,
        session_nodes.current_session_id,
        session_nodes.entry_json,
        session_nodes.entry_valid,
        session_nodes.updated_at,
        session_nodes.status,
        session_nodes.created_via,
        session_nodes.parent_session_key,
        session_nodes.spawned_by,
        retained_window.session_id AS retained_window_id
      FROM session_nodes
      LEFT JOIN session_windows AS retained_window
        ON retained_window.session_id = session_nodes.current_session_id
       AND retained_window.session_key = session_nodes.session_key
      ORDER BY session_nodes.session_key ASC
    `).all();
    const temporarySessions = [];
    for (const row of rows) {
      if (
        row.entry_json === '{}' &&
        row.entry_valid === -1 &&
        row.retained_window_id === row.current_session_id
      ) {
        continue;
      }
      if (
        !nonEmptyString(row.session_key) ||
        !nonEmptyString(row.current_session_id) ||
        row.entry_valid !== 1 ||
        !Number.isSafeInteger(Number(row.updated_at)) ||
        (row.status !== null && !SESSION_STATUSES.has(row.status))
      ) {
        throw new Error('session_nodes contains malformed canonical identity');
      }
      const entry = parseJsonRecord(row.entry_json, 'session_nodes.entry_json');
      if (
        entry.sessionId !== row.current_session_id ||
        entry.updatedAt !== Number(row.updated_at)
      ) {
        throw new Error('session_nodes identity differs from entry_json');
      }
      if (
        (entry.status !== undefined && !SESSION_STATUSES.has(entry.status)) ||
        (entry.status ?? null) !== row.status ||
        (entry.createdVia ?? null) !== row.created_via
      ) {
        throw new Error(
          'session_nodes status or creation projection differs from entry_json',
        );
      }
      const spawnedBy = optionalString(
        entry.spawnedBy,
        'session_nodes.entry_json.spawnedBy',
      );
      const parentSessionKey = optionalString(
        entry.parentSessionKey,
        'session_nodes.entry_json.parentSessionKey',
      );
      if (
        (row.spawned_by ?? null) !== spawnedBy ||
        (row.parent_session_key ?? null) !==
          (parentSessionKey ?? spawnedBy)
      ) {
        throw new Error('session_nodes lineage projections differ from entry_json');
      }
      const relevance = temporarySessionRelevance(
        entry,
        row.session_key,
        runBoundSessionKeys,
      );
      if (relevance.spawned) {
        temporarySessions.push({
          id: `${expectedAgentId}:${row.session_key}`,
          agentId: expectedAgentId,
          sessionKey: row.session_key,
          sessionId: row.current_session_id,
          spawnedBy,
          parentSessionKey,
          spawnDepth: entry.spawnDepth ?? null,
          runBound: relevance.runBound,
          entrySha256: sha256(canonicalJson(entry)),
        });
      }
    }
    db.exec('COMMIT');
    return { schema, temporarySessions };
  } catch (error) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // Preserve the original read failure.
    }
    throw error;
  } finally {
    db.close();
  }
}

function canonicalAgentDatabasePath(stateRoot, agentId) {
  return path.join(
    stateRoot,
    'agents',
    agentId,
    'agent',
    'openclaw-agent.sqlite',
  );
}

async function snapshotCanonicalStores({
  statePath,
  snapshotPath,
  testHooks,
}) {
  const stateRoot = path.resolve(statePath);
  const rootReal = await realpath(stateRoot);
  if (rootReal !== stateRoot) {
    throw new Error('isolated state root is not a canonical no-follow path');
  }
  await mkdir(snapshotPath, { mode: 0o700 });
  const snapshotReal = await realpath(snapshotPath);
  const snapshotInfo = await lstat(snapshotReal);
  if (
    snapshotReal !== path.resolve(snapshotPath) ||
    !snapshotInfo.isDirectory() ||
    snapshotInfo.isSymbolicLink() ||
    pathWithin(snapshotReal, rootReal) ||
    pathWithin(rootReal, snapshotReal)
  ) {
    throw new Error('launcher snapshot root is not canonical');
  }
  const openedPaths = [];
  try {
    const stateRootDirectory = await openBoundPath(
      stateRoot,
      rootReal,
      'directory',
    );
    const stateDirectory = await openBoundPath(
      path.join(stateRoot, 'state'),
      rootReal,
      'directory',
    );
    openedPaths.push(stateRootDirectory, stateDirectory);
    const globalSnapshot = await snapshotSqliteFiles({
      databasePath: path.join(stateRoot, 'state', 'openclaw.sqlite'),
      destinationDirectory: path.join(snapshotReal, 'global'),
      rootReal,
      openedPaths,
      testHooks,
    });
    const global = inspectGlobalDatabase(globalSnapshot.snapshotDatabasePath);
    if (
      global.agentDatabases.length < 1 ||
      global.agentDatabases.length > MAX_AGENT_DATABASES
    ) {
      throw new Error('canonical agent database registry is missing or over limit');
    }
    const agentsDirectory = await openBoundPath(
      path.join(stateRoot, 'agents'),
      rootReal,
      'directory',
    );
    openedPaths.push(agentsDirectory);
    const directoryEntries = await readdir(
      path.join(stateRoot, 'agents'),
      { withFileTypes: true },
    );
    if (
      directoryEntries.some((entry) =>
        !entry.isDirectory() || entry.isSymbolicLink()) ||
      directoryEntries.length !== global.agentDatabases.length
    ) {
      throw new Error('isolated agent database layout differs from its registry');
    }
    const registeredAgentIds = global.agentDatabases.map((row) => row.agent_id);
    if (
      registeredAgentIds.some((agentId) => !nonEmptyString(agentId)) ||
      new Set(registeredAgentIds).size !== registeredAgentIds.length ||
      canonicalJson(directoryEntries.map((entry) => entry.name).toSorted()) !==
        canonicalJson([...registeredAgentIds].toSorted())
    ) {
      throw new Error('isolated agent database registry has ambiguous owners');
    }
    const agentSnapshots = [];
    for (const [index, row] of global.agentDatabases.entries()) {
      if (
        Number(row.schema_version) !== 19 ||
        !Number.isSafeInteger(Number(row.last_seen_at)) ||
        (row.size_bytes !== null && !Number.isSafeInteger(Number(row.size_bytes)))
      ) {
        throw new Error('agent_databases contains malformed registry metadata');
      }
      const expectedPath = canonicalAgentDatabasePath(stateRoot, row.agent_id);
      const expectedStoredPath = path.relative(stateRoot, expectedPath);
      if (row.path !== expectedStoredPath) {
        throw new Error('agent_databases contains a noncanonical database locator');
      }
      const agentDirectory = await openBoundPath(
        path.join(stateRoot, 'agents', row.agent_id),
        rootReal,
        'directory',
      );
      const databaseDirectory = await openBoundPath(
        path.dirname(expectedPath),
        rootReal,
        'directory',
      );
      openedPaths.push(agentDirectory, databaseDirectory);
      const snapshot = await snapshotSqliteFiles({
        databasePath: expectedPath,
        destinationDirectory: path.join(snapshotReal, `agent-${index}`),
        rootReal,
        openedPaths,
        testHooks,
      });
      agentSnapshots.push({
        agentId: row.agent_id,
        ...snapshot,
      });
    }
    await Promise.all(openedPaths.map((entry) =>
      revalidateOpenedPath(entry, rootReal)));
    return {
      global,
      globalSnapshot,
      agentSnapshots,
      directoryBinding: {
        stateRoot: stateRootDirectory.identity,
        state: stateDirectory.identity,
        agents: agentsDirectory.identity,
      },
    };
  } finally {
    await closeOpenedPaths(openedPaths);
  }
}

async function readProcessStat(pid) {
  let handle;
  try {
    handle = await open(
      `/proc/${pid}/stat`,
      OPEN_FILE_FLAGS,
    );
    const raw = await handle.readFile({ encoding: 'utf8' });
    const fields = raw.slice(raw.lastIndexOf(')') + 2).trim().split(/\s+/u);
    return {
      pid,
      state: fields[0],
      processGroupId: Number(fields[2]),
      startFingerprint: fields[19] ? sha256(`${pid}:${fields[19]}`) : null,
    };
  } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'ESRCH') return null;
    throw error;
  } finally {
    if (handle) await handle.close();
  }
}

async function processGroupSnapshot(processGroupId) {
  const members = [];
  for (const entry of await readdir('/proc')) {
    if (!/^[0-9]+$/u.test(entry)) continue;
    const observation = await readProcessStat(Number(entry));
    if (observation?.processGroupId === processGroupId) {
      members.push(observation);
    }
  }
  return members.toSorted((left, right) => left.pid - right.pid);
}

function signalProcessGroup(processGroupId, signal) {
  try {
    process.kill(-processGroupId, signal);
    return true;
  } catch (error) {
    if (error?.code === 'ESRCH') return false;
    throw error;
  }
}

async function waitForStoppedProcessGroup(processGroupId) {
  const deadline = Date.now() + PROCESS_QUIESCE_TIMEOUT_MS;
  let previous = null;
  while (Date.now() < deadline) {
    const members = await processGroupSnapshot(processGroupId);
    const fingerprint = sha256(canonicalJson(members));
    if (
      members.length > 0 &&
      members.every((entry) => entry.state === 'T' || entry.state === 't') &&
      previous === fingerprint
    ) {
      return members;
    }
    previous =
      members.every((entry) => entry.state === 'T' || entry.state === 't')
        ? fingerprint
        : null;
    await new Promise((resolve) => setTimeout(resolve, PROCESS_QUIESCE_POLL_MS));
  }
  throw new Error('isolated process group did not reach a stable stopped state');
}

async function sampleRuntimeBinding(runtimeProcess) {
  const [driver, gateway, members] = await Promise.all([
    readProcessStat(runtimeProcess.driver.pid),
    readProcessStat(runtimeProcess.gateway.pid),
    processGroupSnapshot(runtimeProcess.processGroupId),
  ]);
  let listeners = [];
  if (gateway?.startFingerprint === runtimeProcess.gateway.startFingerprint) {
    listeners = await inspectProcessLoopbackListeners(runtimeProcess.gateway.pid);
  }
  return {
    driverStartFingerprint: driver?.startFingerprint ?? null,
    gatewayStartFingerprint: gateway?.startFingerprint ?? null,
    gatewaySocketFingerprint:
      listeners.length > 0
        ? fingerprintProcessLoopbackListeners(listeners)
        : null,
    gatewayEndpointOwned: listeners.some((entry) =>
      entry.endpoint === runtimeProcess.gateway.endpoint),
    processGroupMembers: members.map((entry) => ({
      pidFingerprint: sha256(String(entry.pid)),
      startFingerprint: entry.startFingerprint,
      state: entry.state,
    })),
  };
}

function runtimeSampleMatches(
  sample,
  runtimeProcess,
  expectedAlive,
  requireStopped = true,
) {
  if (!expectedAlive) {
    return (
      sample.driverStartFingerprint === null &&
      sample.gatewayStartFingerprint === null &&
      sample.gatewaySocketFingerprint === null &&
      sample.gatewayEndpointOwned === false &&
      sample.processGroupMembers.length === 0
    );
  }
  return (
    sample.driverStartFingerprint === runtimeProcess.driver.startFingerprint &&
    sample.gatewayStartFingerprint === runtimeProcess.gateway.startFingerprint &&
    sample.gatewaySocketFingerprint === runtimeProcess.gateway.socketFingerprint &&
    sample.gatewayEndpointOwned === true &&
    sample.processGroupMembers.some((entry) =>
      entry.pidFingerprint === sha256(String(runtimeProcess.driver.pid)) &&
      entry.startFingerprint === runtimeProcess.driver.startFingerprint) &&
    sample.processGroupMembers.some((entry) =>
      entry.pidFingerprint === sha256(String(runtimeProcess.gateway.pid)) &&
      entry.startFingerprint === runtimeProcess.gateway.startFingerprint) &&
    (
      !requireStopped ||
      sample.processGroupMembers.every((entry) =>
        entry.state === 'T' || entry.state === 't')
    )
  );
}

function initialRuntimeObservation(runtimeProcess, expectedAlive) {
  return {
    driverPidFingerprint: Number.isInteger(runtimeProcess?.driver?.pid)
      ? sha256(String(runtimeProcess.driver.pid))
      : null,
    gatewayPidFingerprint: Number.isInteger(runtimeProcess?.gateway?.pid)
      ? sha256(String(runtimeProcess.gateway.pid))
      : null,
    processGroupFingerprint: Number.isInteger(runtimeProcess?.processGroupId)
      ? sha256(String(runtimeProcess.processGroupId))
      : null,
    expectedDriverStartFingerprint:
      runtimeProcess?.driver?.startFingerprint ?? null,
    expectedGatewayStartFingerprint:
      runtimeProcess?.gateway?.startFingerprint ?? null,
    expectedGatewaySocketFingerprint:
      runtimeProcess?.gateway?.socketFingerprint ?? null,
    expectedGatewayEndpoint: runtimeProcess?.gateway?.endpoint ?? null,
    expectedAlive,
    before: null,
    after: null,
    quiescence: {
      required: expectedAlive,
      stoppedAt: null,
      resumedAt: null,
      membersStopped: null,
    },
    shutdownSettledAt: runtimeProcess?.shutdownSettledAt ?? null,
    matched: false,
  };
}

function assertRuntimeProcessInput(runtimeProcess, expectedAlive) {
  if (
    !Number.isInteger(runtimeProcess?.processGroupId) ||
    runtimeProcess.processGroupId < 2 ||
    !Number.isInteger(runtimeProcess?.driver?.pid) ||
    runtimeProcess.driver.pid < 2 ||
    !/^[a-f0-9]{64}$/u.test(runtimeProcess.driver.startFingerprint || '') ||
    !Number.isInteger(runtimeProcess?.gateway?.pid) ||
    runtimeProcess.gateway.pid < 2 ||
    !/^[a-f0-9]{64}$/u.test(runtimeProcess.gateway.startFingerprint || '') ||
    !/^[a-f0-9]{64}$/u.test(runtimeProcess.gateway.socketFingerprint || '') ||
    !/^http:\/\/127\.0\.0\.1(?::[0-9]+)?$/u.test(
      runtimeProcess.gateway.endpoint || '',
    ) ||
    (
      !expectedAlive &&
      Number.isNaN(Date.parse(runtimeProcess?.shutdownSettledAt || ''))
    )
  ) {
    throw new Error('trusted runtime process binding is incomplete');
  }
}

function buildResources(global, agentResults) {
  const delegates = [];
  const queueItems = [];
  const runBoundSessionKeys = new Set();
  for (const row of global.subagentRows) {
    const decoded = decodeSubagentRow(row);
    runBoundSessionKeys.add(row.child_session_key.trim());
    runBoundSessionKeys.add(row.requester_session_key.trim());
    if (row.controller_session_key) {
      runBoundSessionKeys.add(row.controller_session_key.trim());
    }
    for (const key of decoded.childSessionKeys) runBoundSessionKeys.add(key);
    if (decoded.retained) {
      delegates.push({
        id: row.run_id,
        childSessionKey: row.child_session_key,
        requesterSessionKey: row.requester_session_key,
        controllerSessionKey: row.controller_session_key,
        executionStatus: decoded.payload.execution.status,
        cleanupCompletedAt: decoded.payload.cleanupCompletedAt ?? null,
        deliveryStatus: decoded.effectiveDeliveryStatus,
        requiredDelivery: decoded.requiredDelivery,
        payloadSha256: sha256(row.payload_json),
      });
    }
  }
  for (const row of global.flowRows) {
    let state = null;
    if (row.state_json !== null) {
      state = parseJsonValue(row.state_json, 'flow_runs.state_json');
    }
    const retained = isRetainedFlow(row, state);
    const retentionRelevantFlow =
      CONTINUATION_FLOW_CONTROLLERS.has(row.controller_id) ||
      hasDefinedTerminalNotice(state);
    if (retentionRelevantFlow) {
      runBoundSessionKeys.add(row.owner_key.trim());
      collectFlowSessionKeys(state, runBoundSessionKeys);
    }
    if (retained) {
      if (!retentionRelevantFlow) {
        throw new Error('unknown continuation flow controller escaped filtering');
      }
      queueItems.push({
        id: `flow:${row.flow_id}`,
        source: 'flow_runs',
        ownerKey: row.owner_key,
        controllerId: row.controller_id,
        syncMode: row.sync_mode,
        status: row.status,
        endedAt: row.ended_at,
        stateSha256: sha256(row.state_json ?? 'null'),
      });
    }
  }
  for (const row of global.deliveryRows) {
    const decoded = decodeDeliveryQueueRow(row);
    collectQueueSessionKeys(row, decoded.entry, runBoundSessionKeys);
    if (decoded.retained) {
      queueItems.push({
        id: `delivery:${row.queue_name}:${row.id}`,
        source: 'delivery_queue_entries',
        queueName: row.queue_name,
        entryKind: row.entry_kind,
        status: row.status,
        recoveryState: row.recovery_state,
        sessionKey: row.session_key,
        attemptOwned: decoded.attemptOwned,
        entrySha256: sha256(row.entry_json),
      });
    }
  }
  const inspectedAgents = agentResults.map((result) => ({
    result,
    inspection: inspectAgentDatabase(
      result.snapshotDatabasePath,
      result.agentId,
      runBoundSessionKeys,
    ),
  }));
  const temporarySessions = inspectedAgents.flatMap(({ result, inspection }) =>
    inspection.temporarySessions.map((entry) => ({
      ...entry,
      storePathFingerprint: result.binding.pathFingerprint,
    })));
  return {
    resources: { delegates, queueItems, temporarySessions },
    agentSchemas: inspectedAgents.map(({ inspection }) => inspection.schema),
  };
}

function boundedResources(resources) {
  return Object.values(resources).every((entries) =>
    Array.isArray(entries) &&
    entries.length <= MAX_RESOURCE_COUNT &&
    new Set(entries.map((entry) => entry.id)).size === entries.length);
}

function buildSourceBinding(snapshot, agentSchemas) {
  return {
    method: 'quiesced-opened-file-set-v1',
    productStoreContractSha: RETURN_COVENANT_PRODUCT_STORE_CONTRACT_SHA,
    directoryIdentities: snapshot.directoryBinding,
    databases: [
      {
        kind: 'global',
        agentId: null,
        ...snapshot.globalSnapshot.binding,
        schemaSha256: sha256(canonicalJson(snapshot.global.schema)),
      },
      ...snapshot.agentSnapshots.map((entry, index) => ({
        kind: 'agent',
        agentId: entry.agentId,
        ...entry.binding,
        schemaSha256: sha256(canonicalJson(agentSchemas[index])),
      })),
    ],
  };
}

export async function inspectReturnCovenantDurableStores({
  plan,
  evidence,
  statePath,
  snapshotPath,
  runtimeProcess,
  expectedRuntimeAlive,
  testHooks,
}) {
  const requestedAt = new Date().toISOString();
  const identity = {
    rowId: plan.rowId,
    runId: plan.runId,
    candidateSha: plan.target.candidateSha,
    productTreeSha: plan.target.productTreeSha,
    runtimeBuildSha: plan.target.runtimeBuildSha,
    docsHarnessSha: plan.target.docsHarnessSha,
    runtimeConfigSha256: plan.target.runtimeConfigSha256,
    runtimeArtifactManifestSha256:
      plan.target.runtimeArtifactManifestSha256,
    observationSetSha256: sha256(canonicalJson(evidence.observations)),
    phaseChainSha256: sha256(canonicalJson(evidence.phaseChains)),
    cleanupRunReceiptId: evidence.cleanupRun?.receiptId ?? null,
  };
  const runtimeObservation = initialRuntimeObservation(
    runtimeProcess,
    expectedRuntimeAlive,
  );
  let processGroupStopped = false;
  try {
    assertRuntimeProcessInput(runtimeProcess, expectedRuntimeAlive);
    if (expectedRuntimeAlive) {
      const preQuiescence = await sampleRuntimeBinding(runtimeProcess);
      if (
        !runtimeSampleMatches(
          preQuiescence,
          runtimeProcess,
          true,
          false,
        )
      ) {
        throw new Error(
          'runtime identity differs before process-group quiescence',
        );
      }
      if (!signalProcessGroup(runtimeProcess.processGroupId, 'SIGSTOP')) {
        throw new Error('isolated process group exited before live snapshot');
      }
      processGroupStopped = true;
      const stopped = await waitForStoppedProcessGroup(
        runtimeProcess.processGroupId,
      );
      runtimeObservation.quiescence.stoppedAt = new Date().toISOString();
      runtimeObservation.quiescence.membersStopped = stopped.length;
    }
    runtimeObservation.before = await sampleRuntimeBinding(runtimeProcess);
    if (
      !runtimeSampleMatches(
        runtimeObservation.before,
        runtimeProcess,
        expectedRuntimeAlive,
      )
    ) {
      throw new Error('runtime identity differs before durable-store snapshot');
    }
    const snapshotStartedAt = new Date().toISOString();
    const snapshot = await snapshotCanonicalStores({
      statePath,
      snapshotPath,
      testHooks,
    });
    const global = snapshot.global;
    const { resources, agentSchemas } = buildResources(
      global,
      snapshot.agentSnapshots,
    );
    if (!boundedResources(resources)) {
      throw new Error('isolated retention resource inventory exceeded its bound');
    }
    const sourceBinding = buildSourceBinding(snapshot, agentSchemas);
    const snapshotCompletedAt = new Date().toISOString();
    runtimeObservation.after = await sampleRuntimeBinding(runtimeProcess);
    runtimeObservation.matched =
      runtimeSampleMatches(
        runtimeObservation.after,
        runtimeProcess,
        expectedRuntimeAlive,
      ) &&
      canonicalJson(runtimeObservation.before) ===
        canonicalJson(runtimeObservation.after);
    if (!runtimeObservation.matched) {
      throw new Error('runtime identity changed across durable-store snapshot');
    }
    const observedAt = new Date().toISOString();
    if (processGroupStopped) {
      if (!signalProcessGroup(runtimeProcess.processGroupId, 'SIGCONT')) {
        throw new Error('isolated process group exited before live snapshot resume');
      }
      processGroupStopped = false;
      runtimeObservation.quiescence.resumedAt = new Date().toISOString();
    }
    return {
      schema: RETURN_COVENANT_STORE_OBSERVATION_SCHEMA,
      status: 'observed',
      failureReason: null,
      source: 'docs-owned-isolated-durable-store-reader',
      runtimeAlive: expectedRuntimeAlive,
      runtimeProcess: runtimeObservation,
      requestedAt,
      snapshotStartedAt,
      snapshotCompletedAt,
      observedAt,
      identity,
      resources,
      sourceBinding,
      rawSnapshotSha256: sha256(canonicalJson({
        identity,
        resources,
        runtimeProcess: runtimeObservation,
        source: sourceBinding,
      })),
    };
  } catch (error) {
    if (processGroupStopped) {
      signalProcessGroup(runtimeProcess?.processGroupId, 'SIGCONT');
      processGroupStopped = false;
      runtimeObservation.quiescence.resumedAt = new Date().toISOString();
    }
    return {
      schema: RETURN_COVENANT_STORE_OBSERVATION_SCHEMA,
      status: 'unverified-resource-retention',
      failureReason: String(error?.message || error).slice(0, 500),
      source: 'docs-owned-isolated-durable-store-reader',
      runtimeAlive: expectedRuntimeAlive,
      runtimeProcess: runtimeObservation,
      requestedAt,
      snapshotStartedAt: null,
      snapshotCompletedAt: null,
      observedAt: new Date().toISOString(),
      identity,
      resources: {
        delegates: null,
        queueItems: null,
        temporarySessions: null,
      },
      sourceBinding: null,
      rawSnapshotSha256: null,
    };
  }
}
