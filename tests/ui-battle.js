#!/usr/bin/env node
/*
 * Browser check of the battle command bar: starts a fight with the example party, walks the
 * type and action dropdowns (Martial, Magic, Move, Other), opens the ⓘ pop-ups, declares and ends
 * turns for a few passes, and reports page errors. Needs Playwright with Chromium.
 *   node tests/ui-battle.js [--shots dir]
 */
'use strict';
const path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const shots = process.argv.includes('--shots') ? process.argv[process.argv.indexOf('--shots') + 1] : null;
(async () => {
  const exe = process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  const b = await chromium.launch(require('fs').existsSync(exe) ? { executablePath: exe } : {});
  const p = await b.newPage({ viewport: { width: 400, height: 1400 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + path.join(__dirname, '..', 'index.html'));
  await p.evaluate(() => localStorage.clear());
  await p.reload();
  await p.evaluate(() => { const app = BBB.UI.app; app.state.settings.autoRoll = 'all'; app.save(); });
  await p.click('nav >> text=Battle');
  const boxes = await p.$$('input[type=checkbox][id^=pick-]');
  for (const x of boxes.slice(0, boxes.length)) await x.check();
  await p.click('text=Set up the field');
  await p.click('text=Roll initiative');
  await p.waitForTimeout(800);
  let declared = 0, seen = new Set();
  for (let step = 0; step < 40 && !errs.length; step++) {
    await p.waitForTimeout(500);
    const type = await p.$('#cmd-type');
    if (!type) {
      const roll = await p.$('text=Roll initiative');
      if (roll) { await roll.click(); continue; }
      if (await p.$('text=Deciding')) continue;
      continue;
    }
    const types = await type.$$eval('option', (os) => os.map((o) => o.value));
    for (const t of types) {
      await p.selectOption('#cmd-type', t);
      seen.add(t);
      if (t === 'magic') {
        const verbs = await p.$$eval('#cmd-verb option', (os) => os.map((o) => o.value));
        for (const v of verbs) { await p.selectOption('#cmd-verb', v); seen.add('verb:' + v); }
      }
      const info = await p.$('.cmd-go .info-btn');
      if (info) { await info.click(); await p.waitForSelector('.info-pop'); await p.keyboard.press('Escape'); }
      if (shots && (step < 3 || t === 'magic')) await p.screenshot({ path: path.join(shots, `cmd-${step}-${t}.png`), fullPage: false, clip: await (await p.$('.cmd')).boundingBox() });
    }
    await p.selectOption('#cmd-type', types[0]);
    const go = await p.$('.cmd-go .primary:not([disabled])');
    if (go) { await go.click(); declared++; await p.waitForTimeout(150); }
    const end = await p.$('.cmd-foot .end');
    if (end) await end.click();
  }
  if (shots) await p.screenshot({ path: path.join(shots, 'battle-full.png'), fullPage: true });
  console.log(`declared ${declared}; saw ${[...seen].join(', ')}`);
  console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no page errors');
  await b.close();
  process.exit(errs.length || !declared ? 1 : 0);
})();
