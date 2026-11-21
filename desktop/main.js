// Atlas Imperium desktop shell: serves the game from a private local web server so the
// local AI (Ollama on localhost:11434) and live data feeds accept requests, then opens a window.
const { app, BrowserWindow, shell, Menu } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, 'game');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon', '.svg': 'image/svg+xml' };

function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent((req.url || '/').split('?')[0]);
      if (p === '/') p = '/index.html';
      const f = path.normalize(path.join(ROOT, p));
      if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
      fs.readFile(f, (err, data) => {
        if (err) { res.writeHead(404); return res.end('not found'); }
        res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
        res.end(data);
      });
    });
    // fixed port keeps saves (IndexedDB is per-origin) between launches; fall back to a random one
    srv.once('error', () => srv.listen(0, '127.0.0.1', () => resolve(srv.address().port)));
    srv.listen(47821, '127.0.0.1', () => resolve(srv.address().port));
  });
}

async function start() {
  const port = await serve();
  const win = new BrowserWindow({
    width: 1600, height: 950, minWidth: 900, minHeight: 600, backgroundColor: '#0a1424', title: 'Atlas Imperium',
    icon: path.join(__dirname, 'icon.png'), autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true },
  });
  Menu.setApplicationMenu(null);
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('http://127.0.0.1:' + port)) { e.preventDefault(); shell.openExternal(url); } });
  win.webContents.on('before-input-event', (e, input) => { if (input.key === 'F11' && input.type === 'keyDown') win.setFullScreen(!win.isFullScreen()); });
  await win.loadURL('http://127.0.0.1:' + port + '/');
}
app.whenReady().then(start);
app.on('window-all-closed', () => app.quit());
