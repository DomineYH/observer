// PROTOTYPE (#58): serves $DATA (the built terrain files) with CORS so `?terrain=http://<host>:4180/jinan-v1.bin` works.
// Usage: node serve.mjs [port=4180]. Binds 0.0.0.0 so Windows Chrome can reach it from WSL. Throwaway.
/* global process, console, URL */
import { createReadStream, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { basename } from 'node:path';
import { DATA } from './lib.mjs';

const port = +(process.argv[2] ?? 4180);
createServer((req, res) => {
  const file = `${DATA}/${basename(decodeURIComponent(new URL(req.url, 'http://x').pathname))}`; // no directories
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (!file.endsWith('.bin') || !existsSync(file)) return res.writeHead(404).end();
  res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
  createReadStream(file).pipe(res);
}).listen(port, '0.0.0.0', () => console.log(`serving ${DATA} on :${port}`));
