/*
 * Random numbers for the game layer. One place to seed them, so tests and the Bench can replay a run.
 * (The rules engine rolls through the roller it is given; the UI's roller uses Math.random.)
 */
(function (G) {
  'use strict';

  const Rand = {
    rng: Math.random,
    seed(n) {
      let a = n >>> 0;
      Rand.rng = () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    },
    unseed() { Rand.rng = Math.random; },
    d(sides) { return 1 + Math.floor(Rand.rng() * sides); },
    int(lo, hi) { return lo + Math.floor(Rand.rng() * (hi - lo + 1)); },
    chance(p) { return Rand.rng() < p; },
    pick(list) { return list[Math.floor(Rand.rng() * list.length)]; },
    // Pick from [{w, ...}] by weight.
    weighted(list) {
      const total = list.reduce((t, x) => t + (x.w == null ? 1 : x.w), 0);
      let r = Rand.rng() * total;
      for (const x of list) {
        r -= x.w == null ? 1 : x.w;
        if (r < 0) return x;
      }
      return list[list.length - 1];
    },
    // An integer or a [min, max] range.
    amount(v) { return Array.isArray(v) ? Rand.int(v[0], v[1]) : (v == null ? 1 : v); },
  };

  G.Rand = Rand;
})(typeof globalThis !== 'undefined' ? (globalThis.BBB = globalThis.BBB || {}) : {});
