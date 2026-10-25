// Every tiled place's walls can be drawn: no corner that no cliff tile fits exactly (tools/walls.js lists them,
// tools/squarewalls.js squares most of them off). And no walkable squares that touch only at a corner
// (tools/diagonals.js): drawn, they look like a way through.
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

test('maps: no walkable squares meet only at a corner', () => {
  let out = '';
  try { out = execFileSync('node', [path.join(__dirname, '../tools/diagonals.js')], { encoding: 'utf8' }); } catch (e) { out = e.stdout; }
  const bad = out.split('\n').filter((l) => /: [1-9]\d* corner/.test(l));
  assert.deepEqual(bad, [], out);
});
