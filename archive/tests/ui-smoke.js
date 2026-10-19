#!/usr/bin/env node
/*
 * Browser smoke check: opens every tab of the app (fresh example state) and the battle setup,
 * and reports page errors. Needs Playwright with Chromium (not part of `node --test`).
 *   node tests/ui-smoke.js
 */
'use strict';
const path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
(async () => {
  const exe = process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  const b = await chromium.launch(require('fs').existsSync(exe) ? { executablePath: exe } : {});
  const p = await b.newPage({ viewport: { width: 400, height: 1200 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + path.join(__dirname, '..', 'index.html'));
  await p.evaluate(() => localStorage.clear());
  await p.reload();
  const tabs = await p.$$eval('nav button.tab', (bs) => bs.map((x) => x.textContent.trim()));
  for (const t of tabs) {
    await p.click(`nav >> text=${t.replace(/[^A-Za-z ]/g, '')}`);
    await p.waitForTimeout(200);
    const broke = await p.$('text=Something broke');
    console.log(`${t.padEnd(10)} ${broke ? 'BROKEN' : 'ok'}`);
  }
  const setup = await p.$('text=Set up the field');
  if (setup) { await setup.click(); await p.waitForTimeout(200); console.log('battle setup ok'); }
  console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no page errors');
  await b.close();
  process.exit(errs.length ? 1 : 0);
})();
