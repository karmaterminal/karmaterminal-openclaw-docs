export const TASK_PAGE_LIMIT = 100;
export const MAX_TASK_PAGES = 1000;

export function createTaskPagination() {
  return {
    pending: false,
    pages: 0,
    cursorSeen: {},
    records: [],
    error: null,
  };
}

export function beginTaskPagination(state) {
  if (state.pending) return null;
  state.pending = true;
  state.pages = 0;
  state.cursorSeen = {};
  state.records = [];
  state.error = null;
  return { limit: TASK_PAGE_LIMIT };
}

export function consumeTaskPage(state, payload) {
  if (!state.pending || !payload || !Array.isArray(payload.tasks)) {
    state.pending = false;
    state.error = 'invalid tasks.list page';
    return { error: state.error };
  }
  state.pages += 1;
  state.records.push(...payload.tasks);
  const cursor = payload.nextCursor;
  if (cursor == null || cursor === '') {
    state.pending = false;
    return { complete: true, pages: state.pages, tasks: state.records };
  }
  if (typeof cursor !== 'string' || !cursor.trim()) {
    state.pending = false;
    state.error = 'invalid tasks.list nextCursor';
    return { error: state.error };
  }
  if (state.pages >= MAX_TASK_PAGES) {
    state.pending = false;
    state.error = `tasks.list exceeded ${MAX_TASK_PAGES} pages`;
    return { error: state.error };
  }
  if (state.cursorSeen[cursor]) {
    state.pending = false;
    state.error = 'tasks.list cursor loop detected';
    return { error: state.error };
  }
  state.cursorSeen[cursor] = true;
  return { next: { limit: TASK_PAGE_LIMIT, cursor } };
}
