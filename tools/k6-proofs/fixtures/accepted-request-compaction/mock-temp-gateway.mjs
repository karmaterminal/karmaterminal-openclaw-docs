#!/usr/bin/env node
import http from 'node:http';
import process from 'node:process';

function parseArgs(argv) {
  const out = {
    host: '127.0.0.1',
    mode: 'healthy',
    port: null,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--host') out.host = argv[++i];
    else if (arg === '--mode') out.mode = argv[++i];
    else if (arg === '--port') out.port = Number(argv[++i]);
    else throw new Error(`unknown arg: ${arg}`);
  }
  if (!Number.isInteger(out.port) || out.port <= 0) {
    throw new Error('--port must be a positive integer');
  }
  return out;
}

const args = parseArgs(process.argv);

if (args.mode === 'exit-immediately') {
  console.error('mock temp gateway: exiting immediately');
  process.exit(17);
}

const server = http.createServer((request, response) => {
  if (request.url === '/health') {
    response.writeHead(args.mode === 'health-fail' ? 503 : 200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ ok: args.mode !== 'health-fail' }));
    return;
  }
  if (request.url === '/status') {
    response.writeHead(args.mode === 'status-fail' ? 503 : 200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ ok: args.mode !== 'status-fail' }));
    return;
  }
  response.writeHead(200, { 'content-type': 'application/json' });
  response.end(JSON.stringify({ ok: true, path: request.url }));
});

server.listen(args.port, args.host, () => {
  process.stdout.write(`mock temp gateway listening on ${args.host}:${args.port}\n`);
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
