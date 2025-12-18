import http from 'node:http';
import { URL } from 'node:url';
import { handleAssessmentRequest } from './routes/assessment.js';

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '', 'http://localhost');

  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  if (url.pathname.startsWith('/assessment')) {
    await handleAssessmentRequest(req, res);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not Found' }));
});

server.listen(PORT, () => {
  console.log(`Kneez assessment server listening on port ${PORT}`);
});
