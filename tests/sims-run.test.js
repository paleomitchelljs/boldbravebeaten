// The sims rebuilt in docs/OVERHAUL.md step D: retired ids fail loudly, every arena combatant builds from real feats,
// and each rebuilt or new sim runs to the end at a tiny n.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { execFileSync } = require('child_process');
const L = require('../sim/lib');

const ROOT = path.join(__dirname, '..');
const sim = (args, timeout) => execFileSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', timeout: timeout || 600000, stdio: ['ignore', 'pipe', 'pipe'] });
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'bbb-sim-'));

test('sims: an unknown feat id fails loudly (Enemies.strict, lib build)', () => {
  assert.equal(L.Enemies.strict, true);
  const c = L.build('militia', { level: 3 });
  assert.throws(() => L.Enemies.chooseFeats(c, ['parry_training'], L.Enemies.makeRng(1)), /no such feat: parry_training/);
  assert.throws(() => L.build('militia', { feats: { shield_training: 1 } }), /no such feat: shield_training/);
  assert.throws(() => L.build(Object.assign({}, L.ARCHETYPES.militia, { feats: ['casting'] })), /no such feat: casting/);
  assert.throws(() => L.build('militia', { feats: { feint: 3 } }), /1 rank/);
  // Explicit feats come with the archetype's skills for the level (they used to fight at skill 0).
  const d = L.build('duelist', { level: 4, feats: { quick_thrust: 1 } });
  assert.ok(L.C.skill(d, 'melee') > 0);
});

test('sims: every arena combatant names real feats and spends (nearly) its budget', () => {
  const A = require('../sim/arena');
  for (const k of A.KEYS) {
    const P = A.plan(...k.split('/'));
    L.checkIds('arena ' + k, P.feats, P.skills);
    const c = A.makeCombatant(...k.split('/'), 'A', { level: 5 });
    assert.ok(L.C.featCount(c) >= L.C.featBudget(c) - 1, `${k}: ${L.C.featCount(c)} of ${L.C.featBudget(c)} feats`);
    assert.ok(c.wield || L.C.attackOptions(c).length, `${k} can fight`);
  }
});

test('sims: the rebuilt and new sims run at a tiny n', { timeout: 1800000 }, () => {
  let out = sim(['sim/arena.js', '--n', '1', '--keys', 'heavy/shield,unarmored/magic,light/cleric', '--out', tmp()]);
  assert.match(out, /# Arena/);
  out = sim(['sim/run.js', '--n', '1', '--only', 'feint,stab', '--out', tmp()]);
  assert.match(out, /graded checks pass/);
  out = sim(['sim/gauntlet.js', '--n', '1', '--only', 'core', '--mode', 'reset', '--level', '2', '--out', tmp()]);
  assert.match(out, /# Gauntlet/);
  out = sim(['sim/partysize.js', 'temple_court', '--sizes', '1,5', '--n', '1', '--jobs', '1']);
  assert.match(out, /temple_court/);
  assert.doesNotMatch(out, /ERROR/);
  out = sim(['sim/aicheck.js', '--hero', 'Beren', '--level', '1', '--change', 'attr:SPD', '--pin', 'noBareApproach', '--n', '1', '--jobs', '1']);
  assert.match(out, /verdict: /);
  assert.doesNotMatch(out, /ERROR/);
  out = sim(['sim/duels.js', '--n', '1', '--mirror', '--metrics']);
  assert.match(out, /first blow landed/);
});
