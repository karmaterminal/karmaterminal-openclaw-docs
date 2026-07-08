#!/usr/bin/env node
import { createServer } from 'node:http';
import process from 'node:process';

function parsePort(argv) {
  const index = argv.indexOf('--port');
  if (index >= 0 && argv[index + 1]) return Number(argv[index + 1]);
  return Number(process.env.OPENCLAW_GATEWAY_PORT || 0);
}

const port = parsePort(process.argv.slice(2));
if (!Number.isInteger(port) || port <= 0 || port > 65_535) {
  console.error('mock temp gateway requires --port <1-65535>');
  process.exit(2);
}

const server = createServer((req, res) => {
  if (req.url === '/health') {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ ok: true, fixture: 'accepted-compaction-temp-gateway' }));
    return;
  }
  if (req.url === '/status') {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ status: 'ok', fixture: 'accepted-compaction-temp-gateway' }));
    return;
  }
  res.statusCode = 404;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ error: 'not found' }));
});

server.listen({ host: '127.0.0.1', port }, () => {
  console.log(`mock temp gateway ready on ${port}`);
});

const stop = () => server.close(() => process.exit(0));
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
