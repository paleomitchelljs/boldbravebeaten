// Helpers for tests on the clock (docs/OVERHAUL.md step F): start a fight, make someone the one to act, let committed
// actions land, wait out a beat.
const B = require('./load');
const { Combat, CONFIG, Character: C } = B;

// Combat.begin, then (optionally) `first` acts now.
async function start(enc, chars, roller, first, io) {
  await Combat.begin(enc, chars, roller, io);
  if (first && enc.phase === 'act') actNow(enc, first);
}
// Make `id` the one who acts now: everyone else's clock a tick later at least, no one waiting.
function actNow(enc, id) {
  for (const o of enc.ids) if (o !== id && (enc.clock[o] == null || enc.clock[o] <= enc.now)) enc.clock[o] = enc.now + 1;
  enc.clock[id] = enc.now;
  enc.waits = {};
  enc.actor = id;
  enc.phase = 'act';
}
// An action by decl.actor, made the one to act now first.
async function act(enc, chars, decl, io) {
  actNow(enc, decl.actor);
  return Combat.act(enc, chars, decl, io);
}
// An action that lands within the call: the others' clocks just past its lead (they can still react to it).
async function actLand(enc, chars, decl, io) {
  actNow(enc, decl.actor);
  const o = decl.option || {};
  const lead = o.lead != null ? o.lead : (C.actionCost(chars[decl.actor], decl.type).lead || 0);
  for (const id of enc.ids) if (id !== decl.actor && enc.clock[id] <= enc.now + lead) enc.clock[id] = enc.now + lead + 1;
  return Combat.act(enc, chars, decl, io);
}
// Let committed actions land: whoever acts meanwhile waits a tick at a time.
async function land(enc, chars, io) {
  let guard = 100;
  while (enc.pending.length && enc.phase === 'act' && guard-- > 0) await Combat.submit(enc, chars, { actor: Combat.currentActor(enc), type: 'wait', ticks: 1 }, io);
}
// Everyone waits until the next beat (bleeding, regeneration, conditions counting down).
async function toBeat(enc, chars, io) {
  const b = enc.beat;
  let guard = 50;
  while (enc.phase === 'act' && enc.beat === b && guard-- > 0) await Combat.submit(enc, chars, { actor: Combat.currentActor(enc), type: 'wait', ticks: Math.max(1, enc.nextBeat - enc.now) }, io);
}
// A fighter too far ahead on the clock to react (CONFIG.clock.overreach), or (free) as near as can be.
function far(enc, id) { enc.clock[id] = (enc.now || 0) + CONFIG.clock.overreach + 20; }
function free(enc, id) { enc.clock[id] = enc.now || 0; }
// A hand-built encounter on the clock at tick 0 (tests that call Combat functions without begin).
function onClock(enc) {
  enc.now = enc.now || 0; enc.beat = enc.beat || 0; enc.clock = enc.clock || {}; enc.tie = enc.tie || {};
  enc.pending = enc.pending || []; enc.committed = enc.committed || {}; enc.waits = enc.waits || {};
  enc.nextBeat = enc.nextBeat || CONFIG.clock.beat; enc.decls = enc.decls || []; enc.struck = enc.struck || {};
  for (const id of enc.ids || []) if (enc.clock[id] == null) enc.clock[id] = 0;
  return enc;
}

module.exports = { start, actNow, act, actLand, land, toBeat, far, free, onClock };
