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
      nimble: '+n to dodge',
      slippery: '+n against being grappled and to break free',
      grip: '+n to grapple rolls (a huge hand)',
      moveMult: '× squares per move (leapers)',
      apMult: '× the AP pool (a boss acts like several fighters)',
      staminaMult: '× maximum stamina',
      tireless: 'no stamina: damage goes to attributes, actions cost none, dies at CON 0',
      regen: '{con, stamina}: back each round unless burned; a downed regenerator can rise',
      resist: '{keyword: ×}: damage keywords (P, S, B, a spell element); 0 immune, 1.5 weak',
      flying: 'ignores ground, can\'t be tripped',
      incorporeal: 'only magic and magic weapons touch it',
      displacement: '[ranged, melee]: chance a blow strikes an illusion',
      element: 'a spell noun: its melee blows carry that element',
      constrict: '{stamina, con}: squeezes whoever it pins, each round',
      aura: '{name, radius, stamina, cond, element, mag, resisted}: works on foes nearby each round',
      undead: 'a kind: bane and spirit magic, slay',
      dragon: 'a kind: slay',
      noBleed: 'wounds don\'t bleed',
      magicImmune: 'spells wash off (PROVISIONAL: retire in favour of resist keywords)',
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
    // enchantments.yaml `effects` and items.yaml trinkets' `effects`: what worn or wielded gear does.
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
    },
    // CONFIG.conditions fields (src/rules/config.js; rules.yaml may override).
    condition: {
      name: 'shown name',
      type: 'damage keyword: immunity to it stops the condition (default mind for one the will resists)',
      resist: 'the attribute that resists it',
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
      halveFire: 'fire and heat do half',
      halveShadow: 'shadow does half',
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

  G.Effects = { KEYS, check };
})(typeof globalThis !== 'undefined' ? (globalThis.BBB = globalThis.BBB || {}) : {});
