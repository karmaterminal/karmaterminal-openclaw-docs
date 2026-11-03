/**
 * Read-only observation of one disposable gateway process: /proc listener ownership and process
 * identity, the loopback HTTP probes, and one authenticated WebSocket connection. Used by
 * scripts/run-fresh-install-control.mjs. Nothing here signals a process.
 *
 * The restart control (scripts/run-return-covenant-restart-control.mjs) carries its own copies
 * of these helpers; they are kept apart so a change here cannot move that row's control.
 */
import { randomBytes } from 'node:crypto';
import { readdirSync, readFileSync, readlinkSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';

/** Inodes of every socket listening on `port` (IPv4 and IPv6), sorted. */
export function listenInodes(port, procRoot = '/proc') {
  const inodes = new Set();
  const hexPort = port.toString(16).toUpperCase().padStart(4, '0');
  for (const table of ['net/tcp', 'net/tcp6']) {
    let text;
    try {
      text = readFileSync(path.join(procRoot, table), 'utf8');
    } catch {
      continue;
    }
    for (const line of text.split('\n').slice(1)) {
      const fields = line.trim().split(/\s+/u);
      if (fields.length < 10) continue;
      const local = fields[1];
      if (fields[3] === '0A' && local.slice(local.lastIndexOf(':') + 1).toUpperCase() === hexPort) {
        const inode = Number(fields[9]);
        if (Number.isSafeInteger(inode) && inode > 0) inodes.add(inode);
      }
    }
  }
  return [...inodes].sort((a, b) => a - b);
}

export function socketInodesOf(pid, procRoot = '/proc') {
  const inodes = new Set();
  let entries = [];
  try {
    entries = readdirSync(path.join(procRoot, String(pid), 'fd'));
  } catch {
    return inodes;
  }
  for (const entry of entries) {
    try {
      const match = /^socket:\[(\d+)\]$/u.exec(readlinkSync(path.join(procRoot, String(pid), 'fd', entry)));
      if (match) inodes.add(Number(match[1]));
    } catch {
      // A descriptor closed between readdir and readlink.
    }
  }
  return inodes;
}

export function procStat(pid, procRoot = '/proc') {
  try {
    const text = readFileSync(path.join(procRoot, String(pid), 'stat'), 'utf8');
    const fields = text.slice(text.lastIndexOf(')') + 2).split(' ');
    // Fields after the command: [0]=state (3), [1]=ppid (4), [2]=pgrp (5) ... [19]=starttime (22).
    return { state: fields[0], ppid: Number(fields[1]), pgrp: Number(fields[2]), startTicks: Number(fields[19]) };
  } catch {
    return null;
  }
}

/** A process's command line, split; empty when unreadable. */
export function procArgs(pid, procRoot = '/proc') {
  try {
    return readFileSync(path.join(procRoot, String(pid), 'cmdline')).toString('utf8').split('\0').filter(Boolean);
  } catch {
    return [];
  }
}

function environEntries(pid, procRoot) {
  return readFileSync(path.join(procRoot, String(pid), 'environ')).toString('utf8').split('\0');
}

export function procEnvironHas(pid, entry, procRoot = '/proc') {
  try {
    return environEntries(pid, procRoot).includes(entry);
  } catch {
    return false;
  }
}

/** The keys (never the values) a running process's environment sets non-empty; null when unreadable. */
export function environKeysOf(pid, procRoot = '/proc') {
  try {
    return [...new Set(environEntries(pid, procRoot)
      .filter((entry) => entry.includes('=') && entry.slice(entry.indexOf('=') + 1).trim() !== '')
      .map((entry) => entry.slice(0, entry.indexOf('='))))].sort();
  } catch {
    return null;
  }
}

/** One environment value of a running process, or null. */
export function environValueOf(pid, key, procRoot = '/proc') {
  try {
    const entry = environEntries(pid, procRoot).find((candidate) => candidate.startsWith(`${key}=`));
    return entry === undefined ? null : entry.slice(key.length + 1);
  } catch {
    return null;
  }
}

/**
 * Every live process carrying a run marker. The marker is a fresh 128-bit run id, so a match is a
 * process the control started or its descendant, detached or not. Only same-user environ files are
 * readable, and only those can be ours.
 */
export function processesWithMarker(marker, procRoot = '/proc', selfPid = process.pid) {
  const found = [];
  for (const entry of readdirSync(procRoot)) {
    if (!/^\d+$/u.test(entry) || Number(entry) === selfPid) continue;
    const stat = procStat(Number(entry), procRoot);
    if (stat && stat.state !== 'Z' && procEnvironHas(Number(entry), marker, procRoot)) found.push(Number(entry));
  }
  return found.sort((a, b) => a - b);
}

export function httpProbe(port, pathname, timeoutMs) {
  return new Promise((resolve) => {
    const request = http.get({ host: '127.0.0.1', port, path: pathname, agent: false, timeout: timeoutMs, headers: { connection: 'close' } }, (response) => {
      const chunks = [];
      let size = 0;
      response.on('data', (chunk) => {
        size += chunk.length;
        if (size <= 65_536) chunks.push(chunk);
      });
      response.on('end', () => resolve({ status: response.statusCode, body: Buffer.concat(chunks).toString('utf8'), error: null }));
      response.on('error', (error) => resolve({ status: null, body: null, error: error.code ?? 'response-error' }));
    });
    request.on('timeout', () => request.destroy(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' })));
    request.on('error', (error) => resolve({ status: null, body: null, error: error.code ?? 'request-error' }));
  });
}

export function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * The product CLI writes machine JSON with JSON.stringify(value, null, 2), possibly after log
 * lines. Take the last block that starts with a bare `{` line and parses.
 */
export function parseTrailingJson(text) {
  const whole = parseJson(String(text ?? '').trim());
  if (whole && typeof whole === 'object') return whole;
  const lines = String(text ?? '').split('\n');
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (lines[index].trim() !== '{') continue;
    const parsed = parseJson(lines.slice(index).join('\n').trim());
    if (parsed && typeof parsed === 'object') return parsed;
  }
  return null;
}

/**
 * One authenticated gateway connection: wait for connect.challenge, connect as the local CLI
 * client with the given scopes, then run calls in order. Every response frame is kept for the
 * caller's private record.
 */
export function gatewayRpc({ port, token, scopes, calls, timeoutMs, client }) {
  return new Promise((resolve) => {
    const result = { hello: null, connectFrame: null, results: [], error: null };
    let socket;
    let settled = false;
    let index = -1;
    let pendingId = null;
    const connectId = `fic-connect-${randomBytes(6).toString('hex')}`;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) result.error = error;
      try {
        socket?.close();
      } catch {
        // Closing a failed transport cannot change the recorded outcome.
      }
      resolve(result);
    };
    const timer = setTimeout(() => finish(index < 0 ? 'connect-timeout' : `call-timeout:${calls[index]?.method}`), timeoutMs);
    const next = () => {
      index += 1;
      if (index >= calls.length) return finish(null);
      pendingId = `fic-${index}-${randomBytes(6).toString('hex')}`;
      socket.send(JSON.stringify({ type: 'req', id: pendingId, method: calls[index].method, params: calls[index].params ?? {} }));
    };
    try {
      socket = new WebSocket(`ws://127.0.0.1:${port}`);
    } catch {
      finish('connect-failed');
      return;
    }
    socket.onerror = () => finish(index < 0 ? 'connect-failed' : `transport-error:${calls[index]?.method}`);
    socket.onclose = () => finish(index < calls.length ? `closed-before-response:${calls[Math.max(index, 0)]?.method ?? 'connect'}` : null);
    socket.onmessage = (event) => {
      const frame = parseJson(String(event.data));
      if (!frame) return finish('frame-invalid');
      if (frame.type === 'event' && frame.event === 'connect.challenge' && index < 0 && !result.connectFrame) {
        result.connectFrame = 'sent';
        socket.send(JSON.stringify({
          type: 'req',
          id: connectId,
          method: 'connect',
          params: {
            minProtocol: 4,
            maxProtocol: 4,
            client,
            role: 'operator',
            scopes,
            caps: [],
            commands: [],
            permissions: {},
            auth: { token },
            userAgent: client.version,
          },
        }));
        return;
      }
      if (frame.type !== 'res') return;
      if (frame.id === connectId) {
        if (frame.ok !== true || frame.payload?.type !== 'hello-ok') {
          result.connectFrame = frame;
          return finish('connect-rejected');
        }
        result.hello = frame.payload;
        return next();
      }
      if (frame.id === pendingId) {
        result.results.push({ method: calls[index].method, frame });
        return next();
      }
    };
  });
}
