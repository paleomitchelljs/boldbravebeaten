// Stamina each preset party member spends or loses in a fight (every authored encounter, 4 runs each), as a share of
// fresh stamina: the evidence for CONFIG.weariness.perStamina.  node sim/effort.js
const B = require('../tests/load.js');
const { World, Battle, Auto, Rand, Character: C, Content, CONFIG } = B;
CONFIG.weariness = { perRound: 0, perStamina: 1, perHour: 0, cap: 100 };
(async () => {
  const rows = [];
  for (const [pid, p] of Object.entries(Content.world.places)) for (const [eid, e] of Object.entries(p.encounters || {})) {
    Rand.seed(5);
    for (let i = 0; i < 4; i++) {
      const w = World.create(World.presetParty(), { log: false });
      Battle.start(w, e);
      const enc = await Auto.battle(w, { maxRounds: 40 });
      for (const c of World.party(w)) rows.push({ k: `${pid}/${eid}`, name: c.name, r: enc.round, spent: c.weary, fresh: C.freshStamina(c) });
    }
  }
  const by = {};
  for (const r of rows) { const b = by[r.name] ||= { n: 0, r: 0, s: 0, f: r.fresh, list: [] }; b.n++; b.r += r.r; b.s += r.spent; b.list.push(r.spent / r.fresh); }
  for (const [n, b] of Object.entries(by)) { b.list.sort((a, c) => a - c); const q = (x) => b.list[Math.floor(x * (b.list.length - 1))].toFixed(2);
    console.log(n.padEnd(10), 'fresh', b.f, 'rounds', (b.r / b.n).toFixed(1), 'spent/fight', (b.s / b.n).toFixed(1), 'spent/fresh q10/50/90', q(0.1), q(0.5), q(0.9)); }
})();
