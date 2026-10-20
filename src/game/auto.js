/*
 * Letting the AI play: a whole battle for both sides. Used by the Auto-battle button (a fight you
 * would rather not play out), by the Bench's simulations and by the headless play-through bot.
 */
(function (G) {
  'use strict';
  const Combat = G.Combat;
  const R = G.Rand;

  // Every turn and every reaction decided by the AI; actions resolve as they are taken.
  async function playRound(enc, chars, roller) {
    const io = { roller };
    let guard = 2000;
    while (enc.phase === 'turn' && guard-- > 0) {
      const id = Combat.currentActor(enc);
      await Combat.submit(enc, chars, G.AI.choose(enc, chars, id, () => R.rng(), chars[id].policy), io);
    }
    if (guard <= 0) throw new Error('round did not finish');
  }

  // Play the current world.battle to its end (or maxRounds). Returns the encounter.
  async function battle(world, opts) {
    opts = opts || {};
    const b = world.battle;
    const chars = G.Battle.table(world).characters;
    const roller = G.Town.autoRoller;
    const max = opts.maxRounds || 30;
    while (b.enc.phase !== 'over' && b.enc.round < max) {
      await Combat.startRound(b.enc, chars, roller);
      await playRound(b.enc, chars, roller);
    }
    return b.enc;
  }

  G.Auto = { playRound, battle };
})(typeof globalThis !== 'undefined' ? (globalThis.BBB = globalThis.BBB || {}) : {});
