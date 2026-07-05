CREATE TABLE task_runs (
  task_id TEXT NOT NULL PRIMARY KEY,
  runtime TEXT NOT NULL,
  task_kind TEXT,
  source_id TEXT,
  requester_session_key TEXT,
  owner_key TEXT NOT NULL,
  scope_kind TEXT NOT NULL,
  child_session_key TEXT,
  parent_flow_id TEXT,
  parent_task_id TEXT,
  agent_id TEXT,
  run_id TEXT,
  label TEXT,
  task TEXT NOT NULL,
  status TEXT NOT NULL,
  delivery_status TEXT NOT NULL,
  notify_policy TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  started_at INTEGER,
  ended_at INTEGER,
  last_event_at INTEGER,
  cleanup_after INTEGER,
  error TEXT,
  progress_summary TEXT,
  terminal_summary TEXT,
  terminal_outcome TEXT
, requester_agent_id TEXT);
CREATE INDEX idx_task_runs_run_id ON task_runs(run_id);
CREATE INDEX idx_task_runs_status ON task_runs(status);
CREATE INDEX idx_task_runs_runtime_status ON task_runs(runtime, status);
CREATE INDEX idx_task_runs_cleanup_after ON task_runs(cleanup_after);
CREATE INDEX idx_task_runs_last_event_at ON task_runs(last_event_at);
CREATE INDEX idx_task_runs_owner_key ON task_runs(owner_key);
CREATE INDEX idx_task_runs_parent_flow_id ON task_runs(parent_flow_id);
CREATE INDEX idx_task_runs_child_session_key ON task_runs(child_session_key);
