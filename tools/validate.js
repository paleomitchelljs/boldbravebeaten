#!/usr/bin/env node
// Cross-reference check of data/*.yaml. Exits 1 on any problem. Run by CI before deploying.
'use strict';
const fs = require('fs');
const path = require('path');
const B = require('../tests/load.js');
const problems = B.Content.validate();

// Every file a pixellab figure's clips will ask for (as src/ui/game/sprites.js clip() and its preload build them)
// is on disk. Content.validate runs in the browser too, so the file check lives here.
const ROOT = path.join(__dirname, '..');
const DIRS = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];
for (const [id, a] of Object.entries(B.Content.world.art || {})) {
  if (a.type !== 'pixellab' || !a.dir) continue;
  const missing = [];
  const want = (f) => { if (!fs.existsSync(path.join(ROOT, f))) missing.push(f); };
  for (const d of a.rotations || DIRS) want(`${a.dir}/rotations/${d}.png`);
  for (const which of ['walk', 'idle', 'attack', 'thrust', 'death', 'leap']) {
    const v = typeof a[which] === 'string' ? { anim: a[which] } : a[which];
    const c = which === 'walk' ? Object.assign({ dir: a.dir, anim: 'Walking', frames: a.walkFrames || 4, dirs: a.walks || ['east', 'west'] }, v)
      : v ? Object.assign({ dir: a.dir, frames: 4, dirs: DIRS }, v) : null;
    if (!c) continue;
    for (const d of c.dirs) for (let i = 0; i < c.frames; i++) want(`${c.dir}/animations/${c.anim}/${d}/frame_${String(i).padStart(3, '0')}.png`);
  }
  if (missing.length) problems.push(`art.${id}: ${missing.length} file(s) missing, e.g. ${missing[0]}`);
}

if (problems.length) { console.error(problems.join('\n')); console.error(`\n${problems.length} problem(s).`); process.exit(1); }
console.log('data/ is consistent.');
