#!/usr/bin/env node
/**
 * Local development server for the dashboard
 * Run: node server.js
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

config({ path: path.join(__dirname, '.env') });

const PORT = process.env.PORT || 3000;
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || '';

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  let filePath;

  if (req.url === '/' || req.url === '/index.html') {
    filePath = path.join(__dirname, 'src', 'index.html');
  } else {
    filePath = path.join(__dirname, 'src', req.url);
  }

  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'text/plain';

  // Serve config endpoint for frontend
  if (req.url === '/api/config') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ supabaseUrl: SUPABASE_URL, supabaseKey: SUPABASE_ANON_KEY }));
    return;
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404);
        res.end('File not found');
      } else {
        res.writeHead(500);
        res.end('Server error');
      }
    } else {
      // Inject Supabase credentials into HTML
      if (ext === '.html') {
        let html = content.toString();
        html = html.replace("const SUPABASE_URL = 'YOUR_SUPABASE_URL';", `const SUPABASE_URL = '${SUPABASE_URL}';`);
        html = html.replace("const SUPABASE_KEY = 'YOUR_SUPABASE_ANON_KEY';", `const SUPABASE_KEY = '${SUPABASE_ANON_KEY}';`);
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(html);
      } else {
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║          Sales Dashboard                                  ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║   Dashboard running at: http://localhost:${PORT}             ║
║                                                           ║
║   Press Ctrl+C to stop                                    ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
});
