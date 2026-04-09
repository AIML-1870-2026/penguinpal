// LLM Switchboard — Local Server + Anthropic Proxy
// --------------------------------------------------
// 1. Set your Anthropic API key:
//      export ANTHROPIC_API_KEY="sk-ant-..."
// 2. Run:
//      node proxy.js
// 3. Open http://localhost:3001 in your browser
// --------------------------------------------------

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');

const PORT    = 3001;
const API_KEY = process.env.ANTHROPIC_API_KEY || '';
const DIR     = __dirname;

if (!API_KEY) {
  console.warn('⚠  No ANTHROPIC_API_KEY found. Set it before using Anthropic.\n   export ANTHROPIC_API_KEY="sk-ant-..."');
}

const MIME = {
  '.html': 'text/html',
  '.css':  'text/css',
  '.js':   'application/javascript'
};

const server = http.createServer((req, res) => {

  // ── Anthropic proxy ──────────────────────────────────
  if (req.url === '/v1/messages') {
    res.setHeader('Access-Control-Allow-Origin',  '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, anthropic-version, x-api-key');

    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      let parsed;
      try { parsed = JSON.parse(body); } catch { parsed = {}; }
      const apiKey = (parsed.__apiKey || API_KEY).replace(/['"]/g, '').trim();
      delete parsed.__apiKey;
      body = JSON.stringify(parsed);
      console.log('Key received:', apiKey ? '...'+apiKey.slice(-6) : 'EMPTY');
      const options = {
        hostname: 'api.anthropic.com',
        path:     '/v1/messages',
        method:   'POST',
        headers: {
          'Content-Type':      'application/json',
          'Content-Length':    Buffer.byteLength(body, 'utf8'),
          'x-api-key':         apiKey,
          'anthropic-version': '2023-06-01'
        }
      };

      const proxyReq = https.request(options, proxyRes => {
        res.writeHead(proxyRes.statusCode, { 'Content-Type': 'application/json' });
        proxyRes.pipe(res);
      });

      proxyReq.on('error', err => {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: err.message } }));
      });

      proxyReq.write(body);
      proxyReq.end();
    });
    return;
  }

  // ── Static file server ────────────────────────────────
  // Serve llm-switchboard.html at root /
  let urlPath = req.url === '/' ? '/llm-switchboard.html' : req.url;
  const filePath = path.join(DIR, urlPath);
  const ext      = path.extname(filePath);

  // Only allow the three app files
  const allowed = ['llm-switchboard.html', 'llm-switchboard.css', 'llm-switchboard.js'];
  if (!allowed.includes(path.basename(filePath))) {
    res.writeHead(404); res.end('Not found'); return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`✓ Server running — open http://localhost:${PORT} in your browser`);
  console.log(`  Anthropic key: ${API_KEY ? '********' + API_KEY.slice(-4) : 'NOT SET'}`);
});
