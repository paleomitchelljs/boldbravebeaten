// sim/lib.js's archetypes name only feats and skills that exist, and each builds holding what it asked for
// (a retired id used to be skipped without a word; docs/PLAN.md step 9).
const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('./load');
const L = require('../sim/lib');

test('sim/lib archetypes: every feat and skill id is real, and each build holds its feats', () => {
  const skills = B.Content.world.skills.skills;
  for (const [k, A] of Object.entries(L.ARCHETYPES)) {
    for (const f of A.feats) assert.ok(B.DATA.FEATS[f], `${k}: feat ${f}`);
    for (const stage of A.skills) for (const s of Object.keys(stage)) assert.ok(skills[s], `${k}: skill ${s}`);
    const c = L.build(k, { level: 5 });
    assert.equal(B.Character.featCount(c), B.Character.featBudget(c), `${k} spends its feats`);
    assert.ok(B.Character.skillsSpent(c) <= B.Character.skillBudget(c), `${k} skills within budget`);
  }
});
