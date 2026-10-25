// Every tiled place's walls can be drawn: no corner whose best cliff tile gets one of its own four squares wrong
// (tools/walls.js lists them, tools/squarewalls.js squares most of them off).
const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('child_process');
const path = require('path');

test('walls: every corner in every tiled place has a tile that fits it', () => {
  let out = '';
  try { out = execFileSync('node', [path.join(__dirname, '../tools/walls.js')], { encoding: 'utf8' }); } catch (e) { out = e.stdout; }
  const broken = out.split('\n').filter((l) => /: [1-9]\d* corner/.test(l));
  assert.deepEqual(broken, [], out);
});
