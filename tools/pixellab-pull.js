#!/usr/bin/env node
// Fetch PixelLab character exports into art/characters/pixellab/<Folder>, replacing what is there.
//   node tools/pixellab-pull.js                 every folder in art/characters/pixellab/exports.json
//   node tools/pixellab-pull.js Gorilla Singe   just these (names from exports.json)
//   node tools/pixellab-pull.js New=<id>        a character not in exports.json yet (add it there to keep it)
// Prints each state's size, standing views and animations (directions x frames): what art.yaml needs.
// Needs `unzip` on the PATH (macOS and most Linux have it).
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..', 'art', 'characters', 'pixellab');
const URL = (id) => `https://api.pixellab.ai/mcp/characters/${id}/download`;
const COMPASS = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'exports.json'), 'utf8'));
delete manifest._;

function targets(args) {
  if (!args.length) return Object.entries(manifest);
  return args.map((a) => {
    const [name, id] = a.includes('=') ? a.split('=') : [a, manifest[a]];
    if (!id) throw new Error(`${name}: not in exports.json (give it as ${name}=<id>)`);
    return [name, id];
  });
}

// An export can hold two versions of one direction (`east-0d05e068`, `east-22608964`): keep the first as `east`.
function tidyDirections(animDir, notes) {
  for (const anim of fs.readdirSync(animDir)) {
    const a = path.join(animDir, anim);
    const extra = fs.readdirSync(a).filter((d) => !COMPASS.includes(d)).sort();
    for (const d of extra) {
      const base = COMPASS.find((c) => d.startsWith(c + '-') && /^[0-9a-f]+$/.test(d.slice(c.length + 1)));
      if (!base) continue;
      if (fs.existsSync(path.join(a, base))) { fs.rmSync(path.join(a, d), { recursive: true }); notes.push(`${anim}: dropped ${d}`); }
      else { fs.renameSync(path.join(a, d), path.join(a, base)); notes.push(`${anim}: ${d} -> ${base}`); }
    }
  }
}

function describe(folder) {
  const out = [];
  for (const st of fs.readdirSync(folder).filter((f) => fs.statSync(path.join(folder, f)).isDirectory()).sort()) {
    const s = path.join(folder, st);
    const rot = fs.existsSync(path.join(s, 'rotations')) ? fs.readdirSync(path.join(s, 'rotations')).length : 0;
    const anims = fs.existsSync(path.join(s, 'animations')) ? fs.readdirSync(path.join(s, 'animations')).sort().map((an) => {
      const dirs = fs.readdirSync(path.join(s, 'animations', an)).filter((d) => COMPASS.includes(d));
      const n = dirs.length ? fs.readdirSync(path.join(s, 'animations', an, dirs[0])).length : 0;
      return `${an} [${dirs.sort((x, y) => COMPASS.indexOf(x) - COMPASS.indexOf(y)).join(', ')}] x${n}`;
    }) : [];
    out.push(`  ${st}: ${rot} standing views${anims.map((a) => '\n    ' + a).join('')}`);
  }
  return out.join('\n');
}

async function pull(name, id) {
  if (!ID.test(id) || !/^[A-Za-z0-9_-]+$/.test(name)) throw new Error(`${name}=${id}: want Folder=<uuid>`);
  const res = await fetch(URL(id));
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pixellab-'));
  try {
    const zip = path.join(tmp, 'x.zip'), dir = path.join(tmp, 'x');
    fs.writeFileSync(zip, Buffer.from(await res.arrayBuffer()));
    execFileSync('unzip', ['-q', zip, '-d', dir]);
    const notes = [];
    for (const st of fs.readdirSync(dir)) if (fs.existsSync(path.join(dir, st, 'animations'))) tidyDirections(path.join(dir, st, 'animations'), notes);
    const dest = path.join(ROOT, name);
    fs.rmSync(dest, { recursive: true, force: true });
    fs.cpSync(dir, dest, { recursive: true });
    console.log(`${name} (${id})\n${describe(dest)}${notes.map((n) => '\n  note: ' + n).join('')}`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

(async () => {
  let failed = 0;
  for (const [name, id] of targets(process.argv.slice(2))) {
    try { await pull(name, id); } catch (e) { failed++; console.error(String(e.message || e)); }
  }
  if (failed) process.exit(1);
})();
