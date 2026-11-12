#!/usr/bin/env node
// tools/shot.sh by Playwright, for where headless Chrome's --virtual-time-budget never ends (the cloud container).
//   node tools/shot-pw.js out.png "Game.newGame(BBB.World.presetParty()); Game.travel({to: 'temple_court', arrive: '<'});"
// SIZE=w,h sets the viewport (default 1280,900; a phone: SIZE=390,844). Serves this folder on port 8765 (starts a server
// if none is there). The script runs in the page as the body of an async function (so it may `await`), with
// Game = BBB.UI.Game; the page renders after it. Lines it logs starting "SHOT" are printed here, with page errors.
// Needs the pre-installed Playwright (require('playwright')); not a dependency of the game.
const { chromium } = require('playwright');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

const [out, js] = process.argv.slice(2);
if (!out) { console.error('usage: node tools/shot-pw.js out.png "<js>"'); process.exit(2); }
const [w, h] = (process.env.SIZE || '1280,900').split(',').map(Number);
const root = path.join(__dirname, '..');

const up = () => new Promise((res) => http.get('http://localhost:8765/index.html', (r) => { r.resume(); res(r.statusCode === 200); }).on('error', () => res(false)));

(async () => {
  let server = null;
  if (!(await up())) {
    server = spawn('python3', ['-m', 'http.server', '8765'], { cwd: root, stdio: 'ignore' });
    for (let i = 0; i < 30 && !(await up()); i++) await new Promise((r) => setTimeout(r, 200));
  }
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: Number(process.env.SCALE || 1) });
    const notes = [];
    page.on('pageerror', (e) => notes.push('page error: ' + e.message));
    page.on('console', (m) => { if (m.text().startsWith('SHOT')) notes.push(m.text()); });
    await page.goto('http://localhost:8765/index.html');
    await page.waitForFunction(() => window.BBB && BBB.UI && BBB.UI.Game, null, { timeout: 15000 });
    await page.waitForTimeout(800);
    await page.evaluate(`(async () => { const Game = BBB.UI.Game; ${js || ''}; Game.render(); })()`);
    await page.waitForTimeout(600);
    await page.screenshot({ path: out });
    for (const n of notes) console.log(n);
    console.log(out);
  } finally {
    await browser.close();
    if (server) server.kill();
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
