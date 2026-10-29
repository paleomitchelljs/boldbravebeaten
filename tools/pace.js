#!/usr/bin/env node
/*
 * How long it takes to see every dungeon: walks each dungeon area with no fights, always to the nearest square not yet
 * seen, until nothing reachable is left unseen, and counts the steps: the floor under rules.yaml game.exploreDay (a
 * thorough exploration of the temple, with no fights, should take close to one waking day). Also counts the open
 * squares, which is what walking every one of them would take.
 * Locked and hidden doors count as open (the whole dungeon is the measure); a monster's square is in the way.
 *   node tools/pace.js            every dungeon area
 *   node tools/pace.js temple_maze
 */
'use strict';
const B = require('../tests/load.js');
const { World, Explore, Content, CONFIG, Rand } = B;

const DIRS = Explore.DIRS;
const key = (x, y) => x + ',' + y;

function walkable(w, x, y) {
  const c = Explore.cell(w, x, y);
  if (c.kind === 'wall' || c.kind === 'rock' || c.kind === 'water') return c.hidden || c.kind === 'locked';
  if (c.kind === 'door' || c.kind === 'locked' || c.hidden) return true;
  return !c.solid || c.kind === 'stairs' || c.kind === 'drop';
}

// Steps to see all of one place from its first stairs.
function pace(id) {
  Rand.seed(1);
  const w = World.create(World.presetParty(), { log: false });
  w.peaceful = true;
  Explore.enter(w, id, '<');
  if (!w.explore) return null;
  const g = Explore.here(w);
  // Start on a way in (stairs or a drop), else the first open square.
  let start = null;
  for (let y = 0; y < g.h && !start; y++) for (let x = 0; x < g.w && !start; x++) { const k = Explore.cell(w, x, y).kind; if (k === 'stairs' || k === 'drop') start = [x, y]; }
  for (let y = 0; y < g.h && !start; y++) for (let x = 0; x < g.w && !start; x++) if (!Explore.cell(w, x, y).solid) start = [x, y];
  w.explore.x = start[0]; w.explore.y = start[1];
  Explore.markSeen(w);
  const ms = World.mapState(w, id);
  let steps = 0;
  for (let guard = 0; guard < 100000; guard++) {
    const ex = w.explore;
    // Nearest reachable walkable square not yet seen (breadth first over walkable squares).
    const prev = { [key(ex.x, ex.y)]: null }, q = [[ex.x, ex.y]];
    let goal = null;
    while (q.length) {
      const [x, y] = q.shift();
      if (!ms.seen[key(x, y)]) { goal = [x, y]; break; }
      for (const [dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy, k = key(nx, ny);
        if (k in prev || nx < 0 || ny < 0 || nx >= g.w || ny >= g.h || !walkable(w, nx, ny)) continue;
        prev[k] = key(x, y);
        q.push([nx, ny]);
      }
    }
    if (!goal) break;
    const route = [];
    for (let k = key(goal[0], goal[1]); prev[k]; k = prev[k]) route.unshift(k);
    for (const k of route) {
      const [x, y] = k.split(',').map(Number);
      ex.x = x; ex.y = y; steps++;
      Explore.markSeen(w);
      if (!ms.seen[key(goal[0], goal[1])]) continue;
      break;
    }
    ms.seen[key(goal[0], goal[1])] = 1;
  }
  let open = 0, seen = 0;
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (walkable(w, x, y)) { open++; if (ms.seen[key(x, y)]) seen++; }
  return { steps, open, seen };
}

const only = process.argv.slice(2);
const places = Object.entries(Content.world.places).filter(([id, p]) => p.kind === 'dungeon' && p.map && (!only.length || only.includes(id)));
let total = 0, squares = 0;
for (const [id, p] of places) {
  const r = pace(id);
  if (!r) continue;
  total += r.steps; squares += r.open;
  console.log(`${id.padEnd(22)} ${String(r.steps).padStart(6)} steps   ${r.seen}/${r.open} walkable squares seen`);
}
const day = CONFIG.game.exploreDay || 960;
const s = CONFIG.game.stepSeconds;
const hours = (n) => (n * s / 3600).toFixed(1);
console.log(`${'all'.padEnd(22)} ${String(total).padStart(6)} steps   ${squares} open squares`);
console.log(`At ${s} s a step: seeing everything ${hours(total)} h, walking every square ${hours(squares)} h (a day is ${day / 60} h).`);
