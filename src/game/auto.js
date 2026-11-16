/*
 * Letting the AI play: a whole battle for both sides. Used by the Auto-battle button (a fight you
 * would rather not play out), by the Bench's simulations and by the headless play-through bot.
 */
(function (G) {
  'use strict';
  const Combat = G.Combat;
  const R = G.Rand;

  // Every action and every reaction decided by the AI, one at a time, until the fight is over, stops (got away) or
  // maxBeats beats have passed.
  async function play(enc, chars, io, maxBeats) {
    let guard = 20000;
    while (enc.phase === 'act' && enc.beat < (maxBeats || 20) && guard-- > 0) {
      const id = Combat.currentActor(enc);
      await Combat.submit(enc, chars, G.AI.choose(enc, chars, id, () => R.rng(), chars[id].policy), io);
    }
    if (guard <= 0) throw new Error('the fight did not finish');
  }

  // Play the current world.battle to its end (or maxBeats). Returns the encounter.
  async function battle(world, opts) {
    opts = opts || {};
    const b = world.battle;
    const chars = G.Battle.table(world).characters;
    const io = { roller: G.Town.autoRoller, onBeat: G.Battle.onBeat(world) };
    if (b.enc.phase === 'setup') await Combat.begin(b.enc, chars, io.roller, io);
    await play(b.enc, chars, io, opts.maxBeats || 20);
    return b.enc;
  }

  G.Auto = { play, battle };
})(typeof globalThis !== 'undefined' ? (globalThis.BBB = globalThis.BBB || {}) : {});
