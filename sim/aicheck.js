#!/usr/bin/env node
/*
 * Is it the AI or the rule? (docs/OVERHAUL.md step D.) A change to a hero that a sim says hurts may hurt because the
 * rule is bad, or because the AI plays the change badly. This runs the paired duels of sim/feats.js (a start.yaml hero
 * grown to a level, the gear ladder, against the other presets of that level and three monsters for it, the same seeds
 * in every arm) four ways:
 *
 *   base, as is        the hero as planned, the AI as it is
 *   changed, as is     the hero with the change, the AI as it is
 *   base, pinned       the hero as planned, the suspect choice pinned by a scripted policy (only where the pin can
 *                      touch the hero as planned; otherwise it is the first arm)
 *   changed, pinned    the hero with the change, the suspect choice pinned
 *
 * and reports the change's effect with the AI as is (Δ as is) and with the choice pinned (Δ pinned), each the paired
 * difference in win rate (a win 1, a loss 0, a timeout ½) with its standard error, and their difference (the part
 * of the change's effect that is the AI's choice, ± its paired standard error).
 *
 * Pins (a scripted policy laid over the AI; the rules are untouched):
 *   hide              every AI decision (both sides': choose and react) is made as if the change were not there; the
 *                     rules apply it. What the change does by itself, with the decisions of the hero as planned.
 *   noBareApproach    the hero never ends a move inside a standing foe's reach without the AP left for a blow at it from
 *                     there; it holds its ground instead (ends its turn, keeping the AP for its defences).
 *
 * Verdict: "the AI" when Δ pinned − Δ as is is above two standard errors and Δ pinned is not below −2 SE; "the rule"
 * when Δ pinned is below −2 SE and the difference is within 2 SE; "both" when both are beyond 2 SE; "undetermined"
 * otherwise (the evidence doesn't separate them).
 *
 *   node sim/aicheck.js spd|anticipation|rally [--n 40] [--seed 700] [--jobs 4] [--json file]
 *   node sim/aicheck.js --hero Beren --level 3 --change attr:SPD|skill:anticipation|feat:rally|lab:rally --pin hide|noBareApproach
 *
 * The three named checks are HANDOFF.md's step-9 "AI findings": +1 SPD on Beren at level 3 (−9.9 ± 3.5), +1
 * Anticipation on Beren at level 3 (−6.8 ± 1.9), Rally held by Cyrus at level 5 (the lab hero, −11.7 ± 4.2).
 */
'use strict';
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const N = Number(opt('n', 40)), SEED = Number(opt('seed', 700));
const JOBS = Number(opt('jobs', Math.max(1, Math.min(4, os.cpus().length - 1))));

const NAMED = {
  spd: { label: '+1 SPD on Beren at level 3', hero: 'Beren', level: 3, change: 'attr:SPD', pins: ['noBareApproach', 'hide'] },
  anticipation: { label: '+1 Anticipation on Beren at level 3', hero: 'Beren', level: 3, change: 'skill:anticipation', pins: ['hide'] },
  rally: { label: 'Rally held by Cyrus at level 5 (lab: the feat and the skill it needs)', hero: 'Cyrus', level: 5, change: 'lab:rally', pins: ['hide'] },
};
// Monsters that stand for a level (sim/feats.js's list).
const MONSTERS = { 1: ['goblinWarrior', 'scaleward', 'fireGoblin'], 2: ['goblinWarrior', 'scaleward', 'orcCenturion'], 3: ['orcCenturion', 'gnomeWarrior', 'koboldSpearman'], 4: ['orcCenturion', 'koboldChampion', 'sarnak'], 5: ['koboldChampion', 'sarnakKnight', 'orcWarlord'] };

function load() {
  const B = require(path.join(__dirname, '..', 'tests', 'load.js'));
  const L = require('./lib');
  const { gear } = require('./grow');
  return { B, L, gear };
}

// A change: 'attr:SPD', 'skill:anticipation', 'feat:rally' (one more rank, the budget ignored), 'lab:rally' (the feat and
// the skills and feats it needs, as sim/feats.js --lab).
function applyChange(env, c, change) {
  const { B } = env, { Character: C, DATA, CONFIG } = B;
  const [kind, id] = change.split(':');
  if (kind === 'attr') { if (c.base[id] == null) throw new Error('no attribute ' + id); c.base[id] += 1; return; }
  if (kind === 'skill') { if (!B.Content.world.skills.skills[id]) throw new Error('no skill ' + id); C.raiseSkill(c, id); return; }
  if (!DATA.FEATS[id]) throw new Error('no feat ' + id);
  if (kind === 'feat') { C.addFeat(c, id); return; }
  if (kind !== 'lab') throw new Error('no such change kind ' + kind);
  const grant = (fid, depth) => {
    const f = DATA.FEATS[fid];
    if (!f || depth > 6 || C.rank(c, fid) >= f.ranks.length) return;
    const sk = C.featSkill(f), need = CONFIG.skills.tiers[f.ranks[C.rank(c, fid)]] || 0;
    if (sk && C.skill(c, sk) < need) c.skills[sk] = need;
    for (const group of f.requires) {
      const first = group.find((r) => C.reqMet(c, r)) || group[0], r = C.parseReq(first);
      if (r.skill) { if (C.skill(c, r.skill) < r.rank) c.skills[r.skill] = r.rank; } else while (C.rank(c, r.id) < r.rank) grant(r.id, depth + 1), C.rank(c, r.id) < r.rank && C.addFeat(c, r.id);
    }
    C.addFeat(c, fid);
  };
  grant(id, 0);
}

function makeHero(env, name, level) {
  const { B, gear } = env, { World } = B;
  const spec = World.heroes().find((h) => h.name === name);
  if (!spec) throw new Error('no start.yaml hero ' + name);
  const w = World.create([gear(World.settle(spec, level), level)], { log: false });
  World.loadSupplies(w);
  const c = World.party(w)[0];
  c.policy = undefined;
  return c;
}

// ---- Pins: a scripted policy over B.AI (patched in this process only) -------------------------------------------
function installPin(env, pin, ctx) {
  const { B } = env, AI = B.AI, C = B.Character, Combat = B.Combat;
  const choose0 = AI.choose, react0 = AI.react;
  if (pin === 'hide') {
    // Swap the hero's base, skills and feats for the planned ones while any AI decides.
    const wrap = (fn) => function (...args) {
      const c = ctx.hero(), plain = ctx.plain;
      if (!c || !plain) return fn.apply(this, args);
      const keep = { base: c.base, skills: c.skills, feats: c.feats };
      c.base = plain.base; c.skills = plain.skills; c.feats = plain.feats;
      try { return fn.apply(this, args); } finally { c.base = keep.base; c.skills = keep.skills; c.feats = keep.feats; }
    };
    AI.choose = wrap(choose0); AI.react = wrap(react0);
  } else if (pin === 'noBareApproach') {
    AI.choose = function (enc, chars, id, rng, policy) {
      const d = choose0.call(this, enc, chars, id, rng, policy);
      const c = chars[id];
      if (!ctx.hero() || id !== ctx.hero().id || !d || d.type !== 'move' || !d.to) return d;
      const from = enc.pos[id];
      const left = Combat.apLeft(enc, id) - C.moveCost(c, Combat.dist(from, d.to));
      const reachOf = (f) => Math.max(0, ...C.attackOptions(f).filter((o) => !o.ranged && !o.spell).map((o) => o.maxRange || 1));
      const foes = Object.values(chars).filter((f) => f.side !== c.side && C.isActive(f) && enc.pos[f.id]);
      const into = foes.filter((f) => Combat.dist(d.to, enc.pos[f.id]) <= reachOf(f));
      if (!into.length) return d;
      const canStrike = into.some((f) => C.attackOptions(c).some((o) => !o.windUp && C.inRange(o, Combat.dist(d.to, enc.pos[f.id])) && o.ap <= left));
      if (canStrike) return d;
      ctx.pinned++;
      return { actor: id, type: 'endTurn' };
    };
  } else if (pin !== 'none') throw new Error('no such pin ' + pin);
}

// ---- One arm: the hero (changed or not, pinned or not) against every foe, n seeds each (a worker) ------------------
async function runArm(task) {
  const env = load();
  const { B, L } = env;
  const ctx = { current: null, plain: null, pinned: 0, hero() { return this.current; } };
  installPin(env, task.pin, ctx);
  const foes = B.World.heroes().filter((x) => ['Beren', 'Cyrus', 'Lorc', 'Jabiku'].includes(x.name) && x.name !== task.hero).map((h) => ({ hero: h.name }))
    .concat(MONSTERS[Math.min(5, Math.max(1, task.level))].map((m) => ({ monster: m })));
  const out = { win: [], dead: [], rounds: [], taken: [], dealt: [], foe: [], pinned: 0, uses: {} };
  const harm = (c) => Object.values(c.damage || {}).reduce((t, x) => t + x, 0) + (B.Character.maxStamina(c) > 0 ? 1 - Math.max(0, c.stamina) / B.Character.maxStamina(c) : 0);
  let k = 0;
  for (const f of foes) {
    for (let i = 0; i < N; i++, k++) {
      const A = makeHero(env, task.hero, task.level);
      const plain = { base: JSON.parse(JSON.stringify(A.base)), skills: JSON.parse(JSON.stringify(A.skills)), feats: JSON.parse(JSON.stringify(A.feats)) };
      if (task.changed) { applyChange(env, A, task.change); A.stamina = B.Character.maxStamina(A); }
      ctx.current = A; ctx.plain = plain;
      const Bc = f.hero ? makeHero(env, f.hero, task.level) : B.Enemies.makeMonster(f.monster, {})[0];
      const r = await L.fight({
        A: [A], B: [Bc], grid: { w: 12, h: 6 }, seed: SEED + k, maxRounds: 30,
        watch: (enc) => ({ poll() { for (const d of enc.decls) if (d.actor === A.id && !d.reaction && !d._seen) { d._seen = true; out.uses[d.type] = (out.uses[d.type] || 0) + 1; } }, end() {} }),
      });
      out.win.push(r.winner === 'A' ? 1 : r.winner === 'B' ? 0 : 0.5);
      out.dead.push(r.deadA); out.rounds.push(r.rounds); out.taken.push(harm(A)); out.dealt.push(harm(Bc)); out.foe.push(f.hero || f.monster);
    }
  }
  out.pinned = ctx.pinned;
  return out;
}

// ---- Statistics ------------------------------------------------------------------------------------------------------
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
function paired(d) {
  const m = mean(d), n = d.length;
  const sd = n > 1 ? Math.sqrt(d.reduce((t, x) => t + (x - m) ** 2, 0) / (n - 1)) : 0;
  return { mean: m, se: sd / Math.sqrt(n || 1), n };
}
const diff = (a, b) => a.map((x, i) => x - b[i]);
function verdict(asis, pinned, did) {
  const sigDid = Math.abs(did.mean) > 2 * did.se, pinNeg = pinned.mean < -2 * pinned.se;
  if (sigDid && did.mean > 0 && !pinNeg) return 'the AI';
  if (pinNeg && !sigDid) return 'the rule';
  if (pinNeg && sigDid && did.mean > 0) return 'both (the AI makes it worse; the rule hurts too)';
  return 'undetermined';
}

if (process.env.AICHECK_TASK) {
  runArm(JSON.parse(process.env.AICHECK_TASK)).then((r) => process.stdout.write('\n@@' + JSON.stringify(r) + '\n')).catch((e) => { console.error(e); process.exit(1); });
} else {
  const named = argv[0] && !argv[0].startsWith('--') ? argv[0].split(',') : null;
  const checks = named ? named.map((k) => { if (!NAMED[k]) { console.error('no named check ' + k + ' (spd, anticipation, rally)'); process.exit(1); } return Object.assign({ key: k }, NAMED[k]); })
    : [{ key: 'custom', label: 'custom', hero: opt('hero', 'Beren'), level: Number(opt('level', 3)), change: opt('change', 'attr:SPD'), pins: [opt('pin', 'hide')] }];
  if (named && opt('pin', null)) for (const c of checks) c.pins = opt('pin').split(',');
  const tasks = [];
  const BASE_TOUCHING = new Set(['noBareApproach']); // pins that can change what the hero as planned does
  for (const c of checks) {
    const add = (changed, pin) => tasks.push({ check: c.key, hero: c.hero, level: c.level, change: c.change, changed, pin });
    add(false, 'none'); add(true, 'none');
    for (const p of c.pins) { if (BASE_TOUCHING.has(p)) add(false, p); add(true, p); }
  }
  const results = new Array(tasks.length);
  let next = 0, done = 0;
  const run = (t) => new Promise((resolve) => {
    execFile(process.execPath, ['--max-old-space-size=3000', __filename, ...argv], { env: Object.assign({}, process.env, { AICHECK_TASK: JSON.stringify(t) }), maxBuffer: 1 << 26 }, (err, out, errout) => {
      if (err) { resolve({ error: String(errout || err).slice(0, 500) }); return; }
      const m = out.split('\n@@')[1];
      resolve(m ? JSON.parse(m) : { error: 'no result' });
    });
  });
  const worker = async () => { while (next < tasks.length) { const i = next++; results[i] = await run(tasks[i]); process.stderr.write(`\r${++done}/${tasks.length} `); } };
  Promise.all(Array.from({ length: Math.min(JOBS, tasks.length) }, worker)).then(() => {
    process.stderr.write('\n');
    const pts = (x) => `${x.mean >= 0 ? '+' : ''}${(100 * x.mean).toFixed(1)} ± ${(100 * x.se).toFixed(1)}`;
    let failed = false;
    for (const c of checks) {
      const get = (changed, pin) => results[tasks.findIndex((t) => t.check === c.key && t.changed === changed && t.pin === pin)];
      const b0 = get(false, 'none'), c0 = get(true, 'none');
      console.log(`${c.label}: ${c.hero}, level ${c.level}, change ${c.change}; ${N} seeds a foe (${b0 && b0.win ? b0.win.length : '?'} fights an arm), seed ${SEED}`);
      if (!b0 || b0.error || !c0 || c0.error) { console.log('  ERROR ' + ((b0 && b0.error) || (c0 && c0.error))); failed = true; continue; }
      const asis = paired(diff(c0.win, b0.win));
      console.log(`  base, as is:      win ${(100 * mean(b0.win)).toFixed(1)}%`);
      console.log(`  changed, as is:   win ${(100 * mean(c0.win)).toFixed(1)}%   Δ as is ${pts(asis)} points (harm taken ${pts(paired(diff(c0.taken, b0.taken))).replace(/(\d)\.(\d)/g, '$1.$2')} ×0.01 pt)`);
      const usesLine = (r) => Object.entries(r.uses).filter(([k]) => !['move', 'strike', 'endTurn'].includes(k)).map(([k, v]) => `${k} ${v}`).join(', ');
      console.log(`    the hero's other actions, base: ${usesLine(b0) || 'none'}; changed: ${usesLine(c0) || 'none'}`);
      for (const p of c.pins) {
        const bp = BASE_TOUCHING.has(p) ? get(false, p) : b0, cp = get(true, p);
        if (!bp || bp.error || !cp || cp.error) { console.log(`  pin ${p}: ERROR ${(bp && bp.error) || (cp && cp.error)}`); failed = true; continue; }
        const pinned = paired(diff(cp.win, bp.win));
        const did = paired(diff(diff(cp.win, bp.win), diff(c0.win, b0.win)));
        console.log(`  pin ${p}:`);
        if (BASE_TOUCHING.has(p)) console.log(`    base, pinned:    win ${(100 * mean(bp.win)).toFixed(1)}% (the pin overrode ${bp.pinned} choices)`);
        console.log(`    changed, pinned: win ${(100 * mean(cp.win)).toFixed(1)}%${BASE_TOUCHING.has(p) ? ` (overrode ${cp.pinned})` : ''}   Δ pinned ${pts(pinned)} points; Δ pinned − Δ as is ${pts(did)}`);
        console.log(`    verdict: ${verdict(asis, pinned, did)}`);
        // By foe: where the change's effect sits.
        const foes = [...new Set(b0.foe)];
        console.log('    by foe (Δ as is / Δ pinned): ' + foes.map((f) => { const ix = b0.foe.map((x, i) => (x === f ? i : -1)).filter((i) => i >= 0); const pick = (r) => ix.map((i) => r.win[i]); return `${f} ${pts(paired(diff(pick(c0), pick(b0))))} / ${pts(paired(diff(pick(cp), pick(bp))))}`; }).join('; '));
        if (opt('json', null)) require('fs').appendFileSync(opt('json'), JSON.stringify({ sim: 'aicheck', check: c.key, hero: c.hero, level: c.level, change: c.change, pin: p, n: N, seed: SEED, fights: b0.win.length, base: mean(b0.win), changed: mean(c0.win), basePinned: mean(bp.win), changedPinned: mean(cp.win), asis, pinned, did, verdict: verdict(asis, pinned, did) }) + '\n');
      }
      console.log('');
    }
    if (failed) process.exitCode = 1;
  });
}

module.exports = { NAMED, applyChange, installPin, verdict, paired };
