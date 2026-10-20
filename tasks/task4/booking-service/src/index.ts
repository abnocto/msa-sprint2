import http from 'node:http';

const PORT = Number(process.env.PORT || 8080);
const ENABLE_FEATURE_X = process.env.ENABLE_FEATURE_X === 'true';

const server = http.createServer((req, res) => {
  // liveness
  if (req.url === '/ping') return send(res, 200, 'pong');

  // readiness
  if (req.url === '/ready') return send(res, 200, 'ready');

  // фича-флаг
  if (req.url === '/feature' && ENABLE_FEATURE_X) return send(res, 200, 'Feature X is enabled!');

  send(res, 404, 'not found');
});

function send(res: http.ServerResponse, status: number, body: string) {
  res.writeHead(status, { 'content-type': 'text/plain' });
  res.end(body);
}

server.listen(PORT, () => {
  console.log(`booking-service on :${PORT}, ENABLE_FEATURE_X=${ENABLE_FEATURE_X}`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down');
  server.close(() => process.exit(0));
});
