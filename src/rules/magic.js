/*
 * PROVISIONAL magic stub, so casters can be played and simulated.
 *
 * The Mechanics Outline decides the shape (learned words in unordered sets,
 * cost = sum of word costs, spell points with a backlash roll, a free hand to
 * cast, a tired caster draws less power) and leaves the numbers Open. Every
 * number here lives in CONFIG.magic.
 *
 *   verbs       Attack (touch, 1–2 squares), Launch (2–12 squares) — from feats
 *   nouns       Fire, Force — learned in the world (c.nouns)
 *   modifier    Strong (+3 magnitude; must be gathered a round ahead like a power swing)
 */
(function (G) {
  'use strict';
  const CONFIG = G.CONFIG;

  function C() {
    return G.Character;
  }

  function maxSP(c) {
    const r = C().rank(c, 'casting');
    return r > 0 ? C().attr(c, 'INT') + CONFIG.magic.poolPerCasting * r : 0;
  }

  // Points the caster can draw on right now.
  function availableSP(c) {
    const max = maxSP(c);
    let left = Math.max(0, max - (c.spSpent || 0));
    if (CONFIG.magic.staminaLimitsPoints) {
      const ms = C().maxStamina(c);
      const cap = ms > 0 ? Math.floor((max * Math.max(0, c.stamina)) / ms) : 0;
      left = Math.min(left, cap);
    }
    return left;
  }

  function knows(c, key) {
    const w = CONFIG.magic.words[key];
    if (!w) return false;
    if (w.kind === 'noun') return (c.nouns || []).includes(key);
    return !!(w.feat && C().rank(c, w.feat));
  }

  function spellOptions(c) {
    const words = CONFIG.magic.words;
    if (!maxSP(c)) return [];
    const verbs = Object.keys(words).filter((k) => words[k].kind === 'verb' && knows(c, k));
    const nouns = Object.keys(words).filter((k) => words[k].kind === 'noun' && knows(c, k));
    const mods = [null].concat(Object.keys(words).filter((k) => words[k].kind === 'mod' && knows(c, k)));
    const out = [];
    for (const v of verbs) for (const n of nouns) for (const m of mods) out.push(makeOption(c, v, n, m));
    return out;
  }

  function makeOption(c, v, n, m) {
    const W = CONFIG.magic.words;
    const S = C().apScale();
    let magnitude = W[v].magnitude + (m ? W[m].magnitude || 0 : 0);
    if (n === 'fire') magnitude += C().rank(c, 'fire_affinity');
    const cost = W[v].cost + W[n].cost + (m ? W[m].cost : 0);
    const windUp = !!(m && W[m].windUp && CONFIG.windUp && CONFIG.windUp.spells);
    let ap = CONFIG.magic.castAP * S - C().rank(c, 'quick_casting');
    if (windUp) ap -= CONFIG.windUp.ap * S;
    ap = Math.max(CONFIG.minActionAP, ap);
    const label = [W[v].name, W[n].name, m ? W[m].name : null].filter(Boolean).join(' + ');
    return {
      kind: 'strike', motion: 'spell', spellKey: [v, n, m].filter(Boolean).join('+'), label,
      spell: { verb: v, noun: n, mod: m, element: W[n].element, magnitude, cost },
      ap, stamina: 0, spCost: cost, windUp,
      minRange: W[v].range[0], maxRange: W[v].range[1], reach: W[v].range[1],
      closePenalty: false, ranged: W[v].range[0] > 1,
      damage: W[n].element === 'force' ? [0, 0, magnitude] : [0, 0, 0],
    };
  }

  // Backlash: d10 + Control vs the spell's cost; stamina lost per point short.
  async function backlash(c, cost, roller) {
    const control = C().rank(c, 'control');
    const r = (await roller({ actorId: c.id, sides: 10, count: 1, label: `${c.name}: backlash`, detail: `d10 + ${control} ≥ ${cost} to cast safely` }))[0];
    const short = cost - (r + control);
    if (short <= 0) return 0;
    return short * CONFIG.magic.backlashPerPoint;
  }

  G.Magic = { maxSP, availableSP, spellOptions, knows, backlash };
})(typeof globalThis !== 'undefined' ? (globalThis.BBB = globalThis.BBB || {}) : {});
