/*
 * Effects: the keys the rules understand in each bag of extra effects, in one place.
 *
 * Content carries effects in several bags (a monster's traits, a weapon's trait, an enchantment's effects and
 * strike, a trinket's effects, a condition's fields). Content.validate() rejects any key not listed here, so a
 * misspelt or retired key fails loudly instead of doing nothing (a leg wound once checked traits.flier; the trait
 * is flying). tests/effects.test.js checks the other way: every trait and condition flag the code reads is listed.
 *
 * Each entry is key: what it does. Adding a mechanic that reads a new key means adding it here.
 */
(function (G) {
  'use strict';

  const KEYS = {
    // monsters.yaml `traits` (copied onto the character as c.traits).
    traits: {
      size: 'body size (1 a person): fewer vital wounds, less bleeding per wound, harder to shove',
      pack: '+1 damage per packmate beside the target, up to n',
      dodge: '+n to dodge',
      slippery: '+n against being grappled and to break free',
      grip: '+n to grapple rolls (a huge hand; Grappler)',
      moveMult: '× squares per move (leapers)',
      apMult: '× the AP pool (a boss acts like several fighters)',
      staminaMult: '× maximum stamina',
      tireless: 'no stamina: damage goes to attributes, actions cost none, dies at CON 0',
      regrow: '{con, stamina}: back each round unless burned; a downed regrower can rise',
      resist: '{keyword: ×}: damage keywords (P, S, B, a spell element, magic for every spell); 0 immune, 1.5 weak',
      flying: 'ignores ground, can\'t be tripped',
      incorporeal: 'only magic and magic weapons touch it',
      displacement: '[ranged, melee]: chance a blow strikes an illusion',
      element: 'a spell noun: its melee blows carry that element',
      constrict: '{stamina, con}: squeezes whoever it pins, each round',
      aura: '{name, radius, stamina, cond, element, mag, resisted}: works on foes nearby each round',
      undead: 'a kind: bane and spirit magic, slay',
      dragon: 'a kind: slay',
      golem: 'a kind: slay (golem-bane oil)',
      noBleed: 'wounds don\'t bleed',
    },
    // weapons.yaml `trait` (a natural or odd weapon's extra).
    weaponTrait: {
      knockdown: 'a heavy blow can knock the target down',
      shieldCrush: 'a block with a shield costs the shield more',
      venom: '{dc, …}: a landed blow can poison',
      web: 'a landed shot webs the target',
      rust: 'a landed blow eats metal armor',
      sap: '{stamina}: a landed blow drinks stamina back into the wielder',
    },
    // enchantments.yaml `effects`, items.yaml trinkets' `effects` and feats.yaml `effects` (per rank).
    gearEffects: {
      attrs: '{STR: n}: attribute bonus',
      ap: 'sheet AP added to the pool',
      costMult: '× every action\'s AP cost (not the trait apMult, which multiplies the pool)',
      stamina: 'maximum stamina',
      regen: 'stamina regeneration',
      sp: 'spell points',
      mag: '{noun: n, "*": n}: spell magnitude',
      init: 'initiative',
      hit: 'to beat a defence',
      dodge: '+n to dodge (Dodge Training)',
      parry: '+n to parry (Parry Training)',
      block: '+n to block (Shield Training)',
      grip: '+n to grapple rolls',
      feint: 'Feint: to bait, and blows a lower Read Attack can\'t read',
      readAttack: 'Read Attack: to see through bait and read intent',
      move: 'squares per move',
      resist: '{keyword: ×}: as the trait',
      aura: 'as the trait',
      retaliate: '{noun, mag}: an element\'s blow at whoever lands a melee blow on the wearer',
      slay: '[{trait, damage}]: extra damage to foes with that trait',
      heal: 'extra points back each long rest',
      standing: 'parley disposition with everyone',
      standingWith: '{faction: n}: parley disposition with one faction',
    },
    // enchantments.yaml `strike`: what a weapon's blows carry.
    strike: {
      sap: '{stamina}: drinks stamina from whoever it hits',
      armorWear: 'extra durability off the armor it hits',
      slay: '[{trait, damage}]: extra damage to foes with that trait',
      onHit: '{cond, rounds, chance}: a condition on a landed blow',
      riled: 'a landed blow riles the target',
      element: '{noun, mag}: an element\'s blow on a landed blow',
      parrySpells: 'the weapon can parry a spell bolt',
    },
    // CONFIG.conditions fields (src/rules/config.js; rules.yaml may override).
    condition: {
      name: 'shown name',
      type: 'damage keyword: immunity to it stops the condition (default mind for one the will resists)',
      resistedBy: 'the attribute that resists it',
      resist: '{keyword: ×}: as the trait (a frost ward: {fire: 0.5})',
      ap: 'AP pool change per magnitude',
      attrs: 'combat attribute changes per magnitude',
      mit: '{P, S, B}: mitigation per magnitude',
      defense: 'change to defence rolls',
      dot: '{CON|stamina|attr: n}: loss each round end per magnitude',
      regen: 'stamina regeneration per magnitude',
      moveMult: '× squares per move',
      drainAP: 'AP lost at once when it lands',
      noMove: 'can\'t move',
      breakAttr: 'the attribute rolled to break free (with noMove)',
      noAct: 'no actions at all',
      noAttack: 'won\'t attack',
      noGuard: 'no blocks, parries or dodges',
      helpless: 'blows find the gaps as on the pinned',
      blind: 'strikes only at arm\'s reach',
      unseen: 'can\'t be picked out beyond arm\'s reach; ends when the bearer attacks',
      confused: 'half the time strikes whoever is near, friend or foe',
      berserk: 'strikes the nearest body, friend or foe',
      control: 'fights for the caster',
      fearOf: 'won\'t close with or strike the source',
      freedom: 'ignores difficult ground, ice and roots',
      free: 'the caster needn\'t concentrate to hold it',
      kindled: 'the bearer\'s melee blows set the target burning',
      vsUndead: 'its mit counts only against the undead',
      mindWard: 'a ward against mind magic',
      noFear: 'can\'t be frightened',
      immune: '[condition keys]: these can\'t land on the bearer',
      breakOnHarm: 'ends when the bearer is harmed',
      persist: 'outlasts the fight (until cured or run its course)',
      living: 'the tireless (undead, constructs) can\'t take it',
      read: '+n to defend against and to beat the defence of `vs`',
      shroud: 'chance a missile at the bearer misses',
      all: 'with read: against every foe, not only `vs`',
    },
  };

  // Problems with one bag: keys not in KEYS[kind]. `where` names the bag for the message.
  function check(kind, bag, where) {
    const known = KEYS[kind];
    if (!bag || typeof bag !== 'object' || Array.isArray(bag)) return [];
    return Object.keys(bag).filter((k) => !(k in known)).map((k) => `${where}: "${k}" is not a known ${kind} key (src/rules/effects.js)`);
  }

  // ---- The lookup: one question, every source --------------------------------------------------
  // What a character has from its own traits, the gear it wears and wields (Character.gearSources), its
  // conditions and its feats, asked with one vocabulary. A condition's numbers count once per magnitude and a feat's once per rank; multipliers and flags once.
  function sources(c) {
    const out = [];
    if (c.traits) out.push({ from: 'traits', effects: c.traits, mag: 1 });
    if (G.Character) for (const s of G.Character.gearSources(c)) out.push({ from: s.item, effects: s.effects, mag: 1 });
    if (G.Conditions) for (const x of G.Conditions.list(c)) { const d = (G.CONFIG.conditions || {})[x.key]; if (d) out.push({ from: x, effects: d, mag: x.mag || 1 }); }
    // A feat's effects count once per rank (feats.yaml `effects`).
    const F = G.DATA && G.DATA.FEATS;
    if (F) for (const id in c.feats || {}) { const f = F[id]; if (f && f.effects && c.feats[id] > 0) out.push({ from: f, effects: f.effects, mag: c.feats[id] }); }
    return out;
  }

  // The sum of a number (or of one key of an object: sum(c, 'attrs', 'STR')).
  function sum(c, key, sub) {
    let n = 0;
    for (const s of sources(c)) {
      const v = s.effects[key];
      if (v == null) continue;
      const x = sub != null ? (v && typeof v === 'object' ? v[sub] : 0) : v;
      if (typeof x === 'number') n += x * s.mag;
    }
    return n;
  }

  // The product of a multiplier (or of one key of a map: mult(c, 'resist', 'fire')). Missing counts 1.
  function mult(c, key, sub) {
    let m = 1;
    for (const s of sources(c)) {
      const v = s.effects[key];
      if (v == null) continue;
      const x = sub != null ? (v && typeof v === 'object' ? v[sub] : null) : v;
      if (typeof x === 'number') m *= x;
    }
    return m;
  }

  // Whether anything gives it (a flag: flying, freedom, noAct…).
  function has(c, key) {
    return sources(c).some((s) => !!s.effects[key]);
  }

  // Every value of an object effect (aura, retaliate), each tagged with where it came from.
  function list(c, key) {
    return sources(c).filter((s) => s.effects[key] && typeof s.effects[key] === 'object' && !Array.isArray(s.effects[key])).map((s) => Object.assign({ from: s.from }, s.effects[key]));
  }

  G.Effects = { KEYS, check, sources, sum, mult, has, list };
})(typeof globalThis !== 'undefined' ? (globalThis.BBB = globalThis.BBB || {}) : {});
