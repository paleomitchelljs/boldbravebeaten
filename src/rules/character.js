/*
 * Characters: creation, feats, and every derived number the sheet and the
 * combat engine need (effective attributes, stamina, AP, costs, damage).
 */
(function (G) {
  'use strict';
  const CONFIG = G.CONFIG;
  const { FEATS, TREES, WEAPONS, MOTIONS, ACTIONS, ARMOR } = G.DATA;
  const Items = G.Items;
  const ATTRS = CONFIG.attributes;

  // ---- Creation ----------------------------------------------------------
  function newCharacter(opts) {
    opts = opts || {};
    const base = {};
    ATTRS.forEach((a) => (base[a] = 5));
    const damage = {};
    ATTRS.forEach((a) => (damage[a] = 0));
    const c = {
      id: Items.uid('chr'),
      name: opts.name || 'New adventurer',
      side: opts.side || 'party',
      level: 1,
      bonusFeats: 0,
      control: opts.side === 'enemy' ? 'auto' : 'manual',
      notes: '',
      base: Object.assign(base, opts.base || {}),
      damage,
      stamina: 0,
      bleeds: [],
      feats: {},
      armor: null,
      shield: null,
      weapons: [],
      wield: null,
      sidearm: null,
      offhand: null, // a parrying dagger held in the off hand
      inventory: { bandages: 2, gold: 10, arrows: 0, bodkins: 0, items: [], components: {} },
      prepared: [], // rituals laid in advance (Ritual.applyPrepared at the next fight)
      nouns: [], // magic nouns learned in the world (Fire, Force…)
      spSpent: 0, // spell points used since the last rest
      status: freshStatus(),
    };
    if (opts.starterGear !== false) {
      // Philosophy: everyone starts in padded armor with a wooden shield.
      c.armor = Items.makeArmor('padded', 'full', 'average');
      c.shield = Items.makeShield('round', 'wood', 'average');
      const club = Items.makeWeapon('club', 'average');
      const dagger = Items.makeWeapon('dagger', 'average');
      c.weapons.push(club, dagger);
      c.wield = club.id;
      c.sidearm = dagger.id;
    }
    c.stamina = maxStamina(c);
    return c;
  }

  function freshStatus() {
    return { prone: false, grappledBy: [], grappling: null, clinch: null, pinned: false, webbed: 0, unconscious: false, dead: false, dropped: [], windUp: null, conds: [] };
  }

  // Bring older saves up to the current shape.
  function normalize(c) {
    c.status = Object.assign(freshStatus(), c.status || {});
    // Weapons on the ground used to be a single id (and the wield pointer stayed on it).
    if (!Array.isArray(c.status.dropped)) c.status.dropped = c.status.dropped ? [c.status.dropped] : [];
    if (c.wield != null && c.status.dropped.includes(c.wield)) c.wield = null;
    c.damage = c.damage || {};
    c.base = c.base || {};
    // WIL was split from WIS: older characters keep their WIS value for it.
    if (c.base.WIL == null && c.base.WIS != null) c.base.WIL = c.base.WIS;
    ATTRS.forEach((a) => {
      if (c.damage[a] == null) c.damage[a] = 0;
      if (c.base[a] == null) c.base[a] = 5;
    });
    c.feats = c.feats || {};
    // The magic overhaul renamed the verbs.
    const RENAMED = { verb_attack: 'verb_strike', verb_mend: 'verb_bless', verb_ward: 'verb_bless', verb_calm: 'verb_hex', verb_hold: 'verb_hex', verb_bind: 'verb_build', verb_reveal: 'verb_inscribe', verb_explode: 'verb_burst' };
    for (const [from, to] of Object.entries(RENAMED)) if (c.feats[from]) { c.feats[to] = Math.max(c.feats[to] || 0, c.feats[from]); delete c.feats[from]; }
    c.weapons = c.weapons || [];
    // Items carry craft (not quality), and scale armor is now steel mail.
    for (const it of [c.armor, c.shield].concat(c.weapons)) if (it) Items.normalizeItem(it);
    c.bleeds = c.bleeds || [];
    if (c.offhand === undefined) c.offhand = null;
    c.inventory = Object.assign({ bandages: 0, gold: 0, arrows: 0, bodkins: 0, items: [], components: {} }, c.inventory || {});
    if (!c.inventory.components) c.inventory.components = {};
    if (!c.prepared) c.prepared = [];
    c.nouns = c.nouns || [];
    if (c.spSpent == null) c.spSpent = 0;
    if (c.level == null) c.level = 1;
    if (c.bonusFeats == null) c.bonusFeats = 0;
    return c;
  }

  // ---- Feats -------------------------------------------------------------
  function rank(c, id) {
    return (c.feats && c.feats[id]) || 0;
  }

  function featCount(c) {
    let n = 0;
    for (const id in c.feats) n += c.feats[id];
    return n;
  }

  function featBudget(c) {
    return CONFIG.startingFeats + (c.level - 1) * CONFIG.featsPerLevel + (c.bonusFeats || 0);
  }

  function treeCount(c, treeId) {
    let n = 0;
    for (const id in c.feats) if (FEATS[id] && FEATS[id].tree === treeId) n += c.feats[id];
    return n;
  }

  // Feats that count toward a tree's tier (trees in the same tier group count together).
  function tierCount(c, treeId) {
    const groups = CONFIG.featTierGroups || {};
    const g = groups[treeId];
    if (!g) return treeCount(c, treeId);
    let n = 0;
    for (const t in groups) if (groups[t] === g) n += treeCount(c, t);
    return n;
  }

  function tierName(count) {
    const t = CONFIG.tierThresholds;
    let name = 'novice';
    for (const k of Object.keys(t)) if (count >= t[k]) name = k;
    return name;
  }

  function parseReq(s) {
    const [id, r] = s.split(':');
    return { id, rank: Number(r || 1) };
  }

  function reqText(group) {
    return group
      .map((s) => {
        const r = parseReq(s);
        const f = FEATS[r.id];
        const name = f ? f.name : r.id;
        return f && f.ranks.length > 1 ? name + ' ' + roman(r.rank) : name;
      })
      .join(' or ');
  }

  function roman(n) {
    return ['', 'I', 'II', 'III', 'IV', 'V'][n] || String(n);
  }

  // Can the character take the next rank of this feat?
  function canTakeFeat(c, id, ignoreBudget) {
    const f = FEATS[id];
    if (!f) return { ok: false, reason: 'Unknown feat' };
    const have = rank(c, id);
    if (have >= f.ranks.length) return { ok: false, reason: 'Max rank' };
    if (!ignoreBudget && featCount(c) >= featBudget(c)) return { ok: false, reason: 'No feats left' };
    const needTier = f.ranks[have];
    const inTree = tierCount(c, f.tree);
    if (inTree < CONFIG.tierThresholds[needTier]) {
      return { ok: false, reason: `Needs ${needTier} tier (${CONFIG.tierThresholds[needTier]} feats in tree)` };
    }
    for (const group of f.requires) {
      if (!group.some((s) => rank(c, parseReq(s).id) >= parseReq(s).rank)) {
        return { ok: false, reason: 'Requires ' + reqText(group) };
      }
    }
    return { ok: true };
  }

  // Removing a rank must not break the prerequisites or tiers of other feats.
  function canRemoveFeat(c, id) {
    if (!rank(c, id)) return { ok: false, reason: 'Not taken' };
    const test = JSON.parse(JSON.stringify(c));
    test.feats[id] -= 1;
    if (!test.feats[id]) delete test.feats[id];
    for (const other in test.feats) {
      const f = FEATS[other];
      const r = test.feats[other];
      // Re-check every held rank by rebuilding it.
      const probe = JSON.parse(JSON.stringify(test));
      probe.feats[other] = r - 1;
      if (!probe.feats[other]) delete probe.feats[other];
      // The tier check for this rank should count the tree without this rank.
      const chk = canTakeFeat(probe, other, true);
      if (!chk.ok) return { ok: false, reason: `${f.name} depends on it` };
    }
    return { ok: true };
  }

  function addFeat(c, id) {
    c.feats[id] = rank(c, id) + 1;
  }

  function removeFeat(c, id) {
    c.feats[id] = rank(c, id) - 1;
    if (c.feats[id] <= 0) delete c.feats[id];
  }

  // ---- Attributes --------------------------------------------------------
  function conditioning(c, attr) {
    for (const id in FEATS) {
      if (FEATS[id].attr === attr) return Math.min(CONFIG.conditioningCap, rank(c, id));
    }
    return 0;
  }

  // Natural attribute: base + Conditioning − damage. Used for stamina and death.
  function attr(c, a) {
    // Conditions (enfeebled, deft, resolute…) shift every attribute but CON, the body's life.
    const cond = a !== 'CON' && G.Conditions ? G.Conditions.attrMod(c, a) : 0;
    return Math.max(0, c.base[a] + conditioning(c, a) + trinketMod(c, a) - (c.damage[a] || 0) + cond);
  }

  function attrMax(c, a) {
    return c.base[a] + conditioning(c, a) + trinketMod(c, a);
  }

  // Worn trinkets (a sash, a ring…): c.trinkets = [{ name, attrs: { SPD: 1 }, ap: 1 }] (PROVISIONAL).
  function trinketMod(c, a) {
    let n = 0;
    for (const t of c.trinkets || []) n += (t.attrs && t.attrs[a]) || 0;
    return n;
  }

  function trinketAP(c) {
    return (c.trinkets || []).reduce((n, t) => n + (t.ap || 0), 0);
  }

  // ---- Armor & shield ----------------------------------------------------
  function armorInfo(c) {
    if (!c.armor) {
      return { type: 'none', mit: { P: 0, S: 0, B: 0 }, effMit: { P: 0, S: 0, B: 0 }, spd: 0, dex: 0, stamina: 0, regen: 0, standUp: 0, passThrough: 1, durability: 0, maxDurability: 0, pierce: null, passBurst: 1, transmit: 1, cutThrough: null, dissipate: null, metal: false, material: null };
    }
    const a = c.armor;
    const b = Items.armorBase(a);
    let spd = b.spd, dex = b.dex, stamina = b.stamina;
    if ((a.type === 'padded' || a.type === 'leather') && rank(c, 'light_armor_training')) {
      spd = Math.floor(spd / 2 * 10) / 10;
      dex = Math.floor(dex / 2 * 10) / 10;
    }
    if (a.type === 'mail') {
      spd = Math.max(0, spd - rank(c, 'mail_mobility'));
      dex = Math.max(0, dex - rank(c, 'mail_mobility'));
      if (rank(c, 'mail_endurance')) stamina = 0;
    }
    if (a.type === 'plate') {
      spd = Math.max(0, spd - rank(c, 'plate_mobility'));
      dex = Math.max(0, dex - rank(c, 'plate_mobility'));
      stamina = Math.max(0, stamina - rank(c, 'plate_endurance'));
    }
    const frac = b.maxDurability ? Math.max(0, a.durability) / b.maxDurability : 0;
    const effMit = {};
    const fl = CONFIG.durabilityMitigationFloor || 0;
    const scale = a.durability <= 0 ? 0 : fl + (1 - fl) * frac;
    for (const k of ['P', 'S', 'B']) effMit[k] = Math.round(b.mit[k] * scale);
    return {
      type: a.type, mit: b.mit, effMit, spd, dex, stamina, regen: b.regen, standUp: b.standUp,
      passThrough: b.passThrough, durability: a.durability, maxDurability: b.maxDurability,
      pierce: b.pierce, metal: b.metal, material: b.material, passBurst: b.passBurst, transmit: b.transmit,
      cutThrough: b.cutThrough != null ? b.cutThrough * scale : null, // a worn coat gives way to a cut sooner
      // Like mitigation, it fades as the armor wears.
      dissipate: { glancing: b.dissipate.glancing * scale, crushing: b.dissipate.crushing * scale },
    };
  }

  // A broken weapon is no weapon: it can't strike or parry, and the hand is free.
  function wieldedWeapon(c) {
    if (c.wield == null) return null;
    if (c.status && Array.isArray(c.status.dropped) && c.status.dropped.includes(c.wield)) return null;
    const w = c.weapons.find((x) => x.id === c.wield) || null;
    return w && Items.weaponBroken(w) ? null : w;
  }

  // The parrying dagger in the off hand: needs the hand free (no shield on the arm, no two-handed
  // weapon) and a weapon made for it.
  function offhandWeapon(c) {
    if (c.offhand == null || c.offhand === c.wield) return null;
    if (c.status && Array.isArray(c.status.dropped) && c.status.dropped.includes(c.offhand)) return null;
    const w = c.weapons.find((x) => x.id === c.offhand);
    if (!w || !WEAPONS[w.type].offhand || Items.weaponBroken(w)) return null;
    if (c.shield && c.shield.durability > 0) return null;
    const main = wieldedWeapon(c);
    if (main && WEAPONS[main.type].hands === 2) return null;
    return w;
  }

  // A shield can block only when it isn't broken and no two-handed weapon is held.
  function shieldReady(c) {
    if (!c.shield || c.shield.durability <= 0) return false;
    const w = wieldedWeapon(c);
    if (w && WEAPONS[w.type].hands === 2) return false;
    return true;
  }

  function shieldInfo(c) {
    if (!c.shield) return null;
    const s = Items.shieldStats(c.shield);
    return Object.assign({}, s, { durability: c.shield.durability, ready: shieldReady(c) });
  }

  // Combat-effective SPD/DEX after armor penalties.
  function combatAttr(c, a) {
    const ai = armorInfo(c);
    let v = attr(c, a);
    if (a === 'SPD') v -= ai.spd;
    if (a === 'DEX') v -= ai.dex;
    return Math.max(0, v);
  }

  // ---- Stamina & AP ------------------------------------------------------
  function maxStamina(c) {
    if (tireless(c)) return freshStamina(c); // nominal: tireless creatures never spend or lose it
    return Math.max(1, freshStamina(c) - (c.weary || 0));
  }

  // Max stamina before weariness (CONFIG.weariness).
  function freshStamina(c) {
    let s = 0;
    for (const a in CONFIG.staminaWeights) s += CONFIG.staminaWeights[a] * attr(c, a);
    if (tireless(c)) return Math.max(1, s);
    // Monster trait: a big creature (a boss) has more to give.
    return Math.round(s * ((c.traits && c.traits.staminaMult) || 1));
  }

  // A round of combat wears a fighter down: maximum stamina falls (CONFIG.weariness) until a long rest.
  function wearyRound(c) {
    const W = CONFIG.weariness;
    if (!W || tireless(c)) return 0;
    const cap = Math.floor(freshStamina(c) * W.cap);
    const before = c.weary || 0;
    c.weary = Math.min(cap, before + W.perRound);
    c.stamina = Math.min(c.stamina, maxStamina(c));
    return c.weary - before;
  }

  function regen(c) {
    if (tireless(c)) return 0;
    return Math.floor((attr(c, 'CON') + attr(c, 'WIL')) / CONFIG.regenDivisor) - armorInfo(c).regen + (G.Conditions ? G.Conditions.regenMod(c) : 0);
  }

  // Tireless (undead, constructs): no stamina at all. Damage goes straight to attributes,
  // actions cost no stamina, and only AP limits them.
  function tireless(c) {
    return !!(c.traits && c.traits.tireless);
  }

  function fatiguePenalty(c) {
    if (tireless(c)) return 0;
    const max = maxStamina(c);
    if (max <= 0) return 0;
    const frac = c.stamina / max;
    let p = 0;
    for (const step of CONFIG.fatigueSteps) if (frac < step.below) p = Math.max(p, step.ap);
    return p;
  }

  function apPool(c) {
    const mult = (c.traits && c.traits.apMult) || 1; // monster trait: a boss acts like several fighters
    const cond = G.Conditions ? G.Conditions.apMod(c) : 0; // slowed, hasted, shocked…
    // With armorActionAP, armor makes each action dearer instead of shrinking the pool.
    const spd = CONFIG.armorActionAP ? attr(c, 'SPD') : combatAttr(c, 'SPD');
    const fromSpd = CONFIG.apSpdContinuous ? spd / CONFIG.apSpdDivisor : Math.floor(spd / CONFIG.apSpdDivisor);
    return Math.max(0, Math.round((CONFIG.apBase + fromSpd - fatiguePenalty(c) + cond + trinketAP(c)) * apScale() * mult));
  }

  function apScale() {
    return CONFIG.apScale || 1;
  }

  // Multiplies every base action cost, as apScale does the pool (CONFIG.costScale; defaults to apScale).
  function costScale() {
    return CONFIG.costScale || apScale();
  }

  // AP as the sheet shows them: internal units over CONFIG.apDisplay (tenths of an AP), to one decimal.
  function fmtAP(n) {
    return String(Math.round((n / (CONFIG.apDisplay || 1)) * 10) / 10);
  }

  // The fewest AP an action costs (CONFIG.minActionAP is in sheet AP).
  function minAP() {
    return Math.max(1, Math.round(CONFIG.minActionAP * apScale()));
  }

  // A cost from the action tables (Specifics AP), in internal units. The turn-budget curve
  // (CONFIG.apCurve) leaves quick actions as they are and makes every AP above its knee cost more.
  function baseAP(x) {
    const K = CONFIG.apCurve;
    return (K && x > K.knee ? K.knee + (x - K.knee) * K.above : x) * costScale();
  }

  // What armor adds to every action: CONFIG.armorActionAP per point of its SPD penalty (which the
  // mobility feats lower).
  function armorAP(c) {
    return Math.round((CONFIG.armorActionAP || 0) * armorInfo(c).spd * costScale());
  }

  // AP a Quick feat (Quick Thrust, Quick Parry, Heavy Tempo…) takes off an action whose cost is
  // `full`. With CONFIG.quickCut the top rank takes that share of it and each rank its part;
  // as written, a flat 1 per rank.
  function quickCut(c, feat, full) {
    const r = rank(c, feat);
    if (!r || CONFIG.quickCut == null) return r;
    const max = (G.DATA.FEATS[feat] && G.DATA.FEATS[feat].ranks.length) || r;
    return Math.round((full * CONFIG.quickCut * Math.min(r, max)) / max);
  }

  // AP to move d squares. With CONFIG.moveAP, a move is a quick action: moveAP for each stretch of
  // up to squaresPerAP squares (plus armor). As written, 1 AP per squaresPerAP squares.
  function moveCost(c, d) {
    const per = squaresPerAP(c);
    if (CONFIG.moveAP) return Math.ceil(d / per) * Math.round(CONFIG.moveAP * costScale()) + armorAP(c);
    return Math.max(minAP(), Math.ceil((d * costScale()) / per));
  }

  // How far `ap` AP can carry this character in one move.
  function squaresFor(c, ap) {
    const per = squaresPerAP(c);
    if (CONFIG.moveAP) return Math.max(0, Math.floor((ap - armorAP(c)) / Math.round(CONFIG.moveAP * costScale()))) * per;
    return Math.floor((ap * per) / costScale());
  }

  function squaresPerAP(c) {
    let s = CONFIG.moveBase + Math.floor(combatAttr(c, 'SPD') / CONFIG.moveSpdDivisor) + rank(c, 'fleet_foot');
    if (c.shield && c.shield.size === 'tower' && c.shield.durability > 0) s -= CONFIG.towerMovePenalty;
    // Monster trait: leapers (bogfolk) cover more ground per AP.
    return Math.round(Math.max(1, s) * (CONFIG.moveScale || 1) * ((c.traits && c.traits.moveMult) || 1));
  }

  function strOffset(c) {
    return Math.max(0, Math.floor((attr(c, 'STR') - CONFIG.strOffsetPivot) / CONFIG.strOffsetDivisor));
  }

  // Stamina per action = base × weight factor + armor stamina penalty,
  // with STR offsetting the weight and armor parts, then feat reductions.
  function staminaCost(c, base, weight, reduction) {
    if (tireless(c)) return 0;
    base = base * (CONFIG.staminaScale || 1);
    const factor = weight ? CONFIG.weightFactor[weight] : 1;
    let penalty = base * (factor - 1) + armorInfo(c).stamina;
    penalty = Math.max(0, penalty - strOffset(c));
    return Math.max(0, Math.round(base + penalty - (reduction || 0)));
  }

  function effectiveWeight(c, weapon) {
    const w = Items.weaponStats(weapon).weight;
    const order = CONFIG.weightOrder;
    const i = Math.max(order.indexOf('light'), order.indexOf(w) - rank(c, 'heavy_weapon_training'));
    return order.indexOf(w) <= order.indexOf('light') ? w : order[i];
  }

  function isLightWeapon(weapon) {
    const w = Items.weaponStats(weapon).weight;
    return w === 'very light' || w === 'light';
  }

  // ---- Damage ------------------------------------------------------------
  function mainIndex(v) {
    let best = 0;
    for (let i = 1; i < 3; i++) if (v[i] > v[best]) best = i;
    return best;
  }

  function strBonus(c) {
    return Math.floor((attr(c, 'STR') - CONFIG.strBonusPivot) / CONFIG.strBonusDivisor);
  }

  function weaponDamage(c, weapon, face, motion) {
    const def = Items.weaponStats(weapon);
    const raw = def.faces[face];
    let mult = CONFIG.motionMultiplier[motion] || 1;
    // Table model only: the physical model already counts mass.
    if (def.model === 'table' && def.weight === 'heavy') mult += CONFIG.heavyMultiplierAdjust[motion] || 0;
    const v = raw.map((x) => Math.round(x * mult));
    const main = mainIndex(raw);
    // STR counts for as much as the blow needs it: little behind a sharp point, a lot behind a
    // mace (physical model; the table model adds it in full).
    const str = Math.trunc(strBonus(c) * (def.strMult[motion] != null ? def.strMult[motion] : 1));
    let bonus = motion === 'shoot' && !CONFIG.archery.strBonus ? 0 : str;
    if (isLightWeapon(weapon) && motion !== 'shoot') bonus += rank(c, 'precision');
    if (motion === 'twoHanded' || motion === 'power') bonus += rank(c, 'weight_of_the_blow');
    v[main] = Math.max(0, v[main] + bonus);
    // A worn weapon (CONFIG.weaponWear) hits softer: a dull edge, a bent point, a loose head.
    const eff = weapon.natural ? 1 : Items.weaponEfficacy(weapon);
    return eff < 1 ? v.map((x) => Math.round(x * eff)) : v;
  }

  // ---- Action catalog for one character --------------------------------
  // Returns every attack the character could declare right now (ignoring AP).
  function attackOptions(c) {
    const opts = [];
    const st = c.status || freshStatus();
    // Holding or held: only grapple-usable weapons (a dagger) and no two-handed blows. In a clinch
    // long weapons are merely cramped (range 1), but there's no room to swing two-handed or shoot.
    // Pinned: nothing but trying to break free.
    const grappling = !!st.grappling || (st.grappledBy && st.grappledBy.length > 0);
    const tangled = grappling || !!st.clinch;
    if (st.pinned) return opts;
    const w = wieldedWeapon(c);
    if (w) {
      const def = Items.weaponStats(w);
      const usable = !grappling || def.grappleUsable;
      if (usable) {
        for (const motion of def.motions) {
          const m = MOTIONS[motion];
          if (m.requiresFeat && !rank(c, m.requiresFeat)) continue;
          if (motion === 'shoot' && (tangled || st.prone)) continue;
          // Lean: no two-handed attacks while carrying a shield.
          const twoHands = m.twoHands || (motion === 'power' && def.hands > 1) || def.hands === 2;
          if (twoHands && c.shield && c.shield.durability > 0 && def.hands !== 2) continue;
          if (twoHands && tangled) continue;
          for (const face of m.faces) {
            if (!def.faces[face]) continue;
            if (face === 'hilt' && !(def.sword && rank(c, 'murder_stroke'))) continue;
            if (motion === 'shoot') {
              // One option per arrowhead carried (broadheads if none at all).
              const heads = Object.values(CONFIG.archery.heads);
              const carried = heads.filter((hd) => (c.inventory && c.inventory[hd.ammo]) > 0);
              for (const hd of carried.length ? carried : heads.slice(0, 1)) opts.push(arrowOption(c, strikeOption(c, w, face, motion), hd));
            } else opts.push(strikeOption(c, w, face, motion));
          }
        }
        if (def.sword && rank(c, 'half_swording') && !grappling) {
          // Gripping the blade shortens the sword: a close-range technique with no penalty.
          const o = strikeOption(c, w, 'point', 'thrust');
          o.halfSword = true;
          o.ap += Math.round(costScale());
          o.label = 'Half-sword thrust';
          o.minRange = 1;
          o.maxRange = o.reach = 1;
          o.closePenalty = false;
          o.clinchPenalty = false;
          if (o.punch) o.punch = Math.round(o.punch * CONFIG.weaponPhysics.grip * 100) / 100; // both hands on the blade
          opts.push(o);
        }
      }
    }
    // The off-hand parrying dagger stabs too.
    const off = offhandWeapon(c);
    if (off && !st.prone) {
      const o = strikeOption(c, off, 'point', 'thrust');
      o.offhand = true;
      o.label = 'Off-hand thrust';
      opts.push(o);
    }
    // Natural weapons (monsters): always ready; a held monster keeps only its grapple-usable ones.
    for (const type of c.natural || []) {
      const def = WEAPONS[type] && Items.weaponStats(type);
      if (!def || (grappling && !def.grappleUsable)) continue;
      const pseudo = { id: 'nat-' + type, type, craft: 'average', natural: true };
      for (const motion of def.motions) {
        const m = MOTIONS[motion];
        if (m.requiresFeat && !rank(c, m.requiresFeat)) continue;
        if (tangled && (m.twoHands || motion === 'power')) continue;
        for (const face of m.faces) if (def.faces[face]) opts.push(strikeOption(c, pseudo, face, motion));
      }
    }
    if (!c.noUnarmed) {
      // Unarmed: a punch needs a free hand.
      if (handsBusy(c) < 2) opts.push(unarmedOption(c, 'punch'));
      if (!grappling && !st.prone) opts.push(unarmedOption(c, 'kick'));
      if (shieldReady(c) && rank(c, 'shield_bash') && !grappling) opts.push(unarmedOption(c, 'shieldBash'));
      // Spells need a free hand (see magic.js).
      // Bolts (Strike, Launch) are attacks; the other spells are cast actions (Combat.legalActions).
      if (G.Magic && castingHands(c) && !grappling) for (const o of G.Magic.spellOptions(c)) if (o.kind === 'strike') opts.push(o);
    }
    const t = webTax(c);
    if (t.ap || t.stamina) for (const o of opts) { o.ap += t.ap; o.stamina += t.stamina; }
    return opts.filter((o) => !o.tooHeavy);
  }

  // A free hand to cast with, or Battle Casting (cast with sword and shield in hand).
  function castingHands(c) {
    return handsBusy(c) < 2 || rank(c, 'battle_casting') > 0;
  }

  function handsBusy(c) {
    const w = wieldedWeapon(c);
    return (w ? Math.ceil(WEAPONS[w.type].hands === 1.5 ? 1 : WEAPONS[w.type].hands) : 0) + (shieldReady(c) || offhandWeapon(c) ? 1 : 0);
  }

  // Is a target at grid distance d inside this attack's range band?
  function inRange(opt, d) {
    return d >= (opt.minRange || 1) && d <= (opt.maxRange != null ? opt.maxRange : opt.reach || 1);
  }

  // Identifies the attack a wind-up is preparing.
  function optionKey(o) {
    return [o.weaponId || o.spellKey || o.unarmed || '', o.motion, o.face || '', o.label].join('|');
  }

  function needsWindUp(motion) {
    return ((CONFIG.windUp && CONFIG.windUp.motions) || []).includes(motion);
  }

  // How hard this weapon is for this wielder in this motion: load / capacity (1 = at the limit
  // of a functional swing). Natural weapons are the body itself: 0.
  function weaponStrain(c, w, motion) {
    const def = Items.weaponStats(w);
    const X = CONFIG.weaponPhysics;
    if (def.model !== 'physical' || def.natural || !def.load || !X.strain) return 0;
    const raw = G.DATA.WEAPONS[w.type] || {};
    const twoHands = raw.hands === 2 || motion === 'twoHanded' || motion === 'power';
    const cap = Math.max(0.1, attr(c, 'STR')) * X.strain.kgPerStr * (twoHands ? X.grip : 1) * (1 + X.strain.perTraining * rank(c, 'heavy_weapon_training'));
    return (motion === 'thrust' ? def.load.thrust : def.load.swing) / cap;
  }

  function strikeOption(c, w, face, motion) {
    const def = Items.weaponStats(w);
    const m = MOTIONS[motion];
    const windUp = needsWindUp(motion) || (motion === 'shoot' && !!def.drawWindUp);
    const W = CONFIG.windUp || { ap: 0, stamina: 0 };
    let base = motion === 'shoot' && def.shootAP ? def.shootAP : m.ap;
    let baseSt = motion === 'shoot' && def.shootStamina != null ? def.shootStamina : m.stamina;
    if (windUp) { base -= W.ap; baseSt -= W.stamina; }
    let ap = baseAP(base);
    let strain = 0, strainF = 1;
    if (def.model === 'physical') {
      // Natural speed, then strain: the weapon's load against this wielder's strength.
      if (motion !== 'shoot') {
        strain = weaponStrain(c, w, motion);
        strainF = strain > 1 ? Math.pow(strain, CONFIG.weaponPhysics.strain.exp) : 1;
        ap = Math.round(ap * (motion === 'thrust' ? def.speed.thrust : def.speed.swing) * strainF);
      }
    } else if (def.weight === 'very light' && (motion === 'thrust' || motion === 'swing')) ap -= CONFIG.veryLightApDiscount * costScale();
    ap = Math.round(ap);
    const floor = Math.max(minAP(), Math.round((CONFIG.minStrikeAP || 0) * apScale()));
    const full = Math.max(floor, ap);
    const quick = motion === 'thrust' ? 'quick_thrust' : motion === 'twoHanded' || motion === 'power' ? 'heavy_tempo' : null;
    if (quick) ap -= quickCut(c, quick, full);
    ap = Math.max(floor, ap) + armorAP(c);
    let red = 0;
    if (isLightWeapon(w) && (motion === 'thrust' || motion === 'swing')) red += rank(c, 'light_touch');
    const stamina = Math.round(strainF * Math.max(CONFIG.minStrikeStamina || 0, staminaCost(c, Math.max(0, baseSt), effectiveWeight(c, w), red)));
    // Range band: the motion's reach (weapons.yaml), cramped inside reach.min; in a clinch, cramped
    // unless the weapon is closeOK (computeHit).
    let minRange = Items.reachMin(def), maxRange = Items.reachOf(def, motion === 'thrust' ? 'thrust' : 'swing') || 1, closePenalty = false, ranged = false;
    if (motion === 'thrust' && rank(c, 'lunge')) maxRange += 1;
    let clinchPenalty = !def.closeOK && !def.natural;
    if (motion === 'shoot') {
      minRange = def.ranged.min;
      maxRange = def.ranged.max;
      closePenalty = false;
      clinchPenalty = false;
      ranged = true;
    }
    if (face === 'hilt') { closePenalty = false; clinchPenalty = false; minRange = 1; } // the murder stroke is a close technique
    if (minRange > 1 && !ranged && CONFIG.range.closeRule !== 'cannot') {
      // Inside the weapon's reach (a spear's point at 1): it can still be jabbed with the shaft or
      // swung from the haft, penalized ('blunt' or 'half'); under 'cannot' it can't be used there.
      minRange = 1;
      closePenalty = true;
    }
    const trait = def.trait || {};
    if (def.natural && motion === 'shoot') { minRange = def.ranged.min; maxRange = def.ranged.max; ranged = true; closePenalty = false; }
    // Punch (CONFIG.pierce): what drives the point into armor. Heavier motions drive harder, and STR
    // puts the body behind a hand-driven point (not behind an arrow).
    let punch = (def.punch && def.punch[face]) || 0;
    if (punch && motion !== 'shoot') {
      punch *= (CONFIG.motionMultiplier[motion] || 1) * Math.max(0.5, 1 + ((CONFIG.pierce && CONFIG.pierce.strPer) || 0) * strBonus(c));
      if (face === 'point' && def.punch.pointMax != null) punch = Math.min(punch, def.punch.pointMax);
      punch = Math.round(punch * Items.weaponEfficacy(w) * 100) / 100;
    }
    return {
      kind: 'strike', weaponId: w.id, weaponType: w.type, face, motion, ap, stamina, punch, clinchPenalty,
      natural: !!def.natural, knockdown: trait.knockdown || null, venom: trait.venom || null, rust: trait.rust || null, shieldCrush: !!trait.shieldCrush, web: trait.web || null,
      reach: maxRange, minRange, maxRange, closePenalty, ranged, longRange: ranged ? def.ranged.long : null,
      strain: Math.round(strain * 100) / 100, tooHeavy: strain > CONFIG.weaponPhysics.strain.max,
      windUp, damage: weaponDamage(c, w, face, motion), wound: def.wound[face] || null,
      label: def.natural ? `${def.name}${motion === 'power' ? ' (power)' : ''}` : `${m.name} (${face})`,
    };
  }

  // A shot with a particular arrowhead.
  function arrowOption(c, o, hd) {
    o.arrowHead = hd.name;
    o.ammo = hd.ammo;
    if (o.punch && hd.punch != null) o.punch = Math.round(o.punch * hd.punch * 100) / 100;
    o.damage = o.damage.slice();
    const i = mainIndex(o.damage);
    o.damage[i] = Math.max(0, o.damage[i] + hd.damage);
    o.label = `Shoot (${hd.name})`;
    return o;
  }

  // Arrows left for this option (broadheads are 'arrows', bodkins 'bodkins').
  function ammoLeft(c, o) {
    return (c.inventory && c.inventory[o.ammo || 'arrows']) || 0;
  }

  function unarmedOption(c, kind) {
    const a = ACTIONS[kind];
    let ap = Math.round(baseAP(a.ap));
    const full = Math.max(minAP(), ap);
    let red = 0;
    if (kind === 'punch' || kind === 'kick') {
      ap -= quickCut(c, 'quick_hands', full);
      red += rank(c, 'brawlers_wind');
    }
    ap = Math.max(minAP(), ap) + armorAP(c);
    const dmg = a.damage.slice();
    if (kind === 'punch' || kind === 'kick') dmg[2] += rank(c, 'heavy_hands');
    dmg[2] = Math.max(0, dmg[2] + strBonus(c));
    return {
      kind: 'strike', unarmed: kind, motion: kind === 'shieldBash' ? 'swing' : 'unarmed', ap,
      stamina: staminaCost(c, a.stamina, null, red), reach: 1, minRange: 1, maxRange: CONFIG.range.maneuverMax,
      closePenalty: false, damage: dmg, label: a.name,
    };
  }

  // AP and stamina for non-attack actions (before webs).
  function baseActionCost(c, kind, extra) {
    const st = c.status || freshStatus();
    const a = ACTIONS[kind];
    const S = costScale();
    let ap = baseAP(a.ap), red = 0, quick = null, stBase = a.stamina;
    const grappled = st.grappledBy && st.grappledBy.length > 0;
    switch (kind) {
      case 'block': {
        const s = shieldInfo(c);
        ap = baseAP(s ? s.blockAP : 2);
        quick = 'quick_block';
        red = rank(c, 'economical_block');
        break;
      }
      case 'parry':
      case 'offParry':
        quick = 'quick_parry';
        red = rank(c, 'economical_parry');
        break;
      case 'dodge':
        quick = 'quick_dodge';
        red = rank(c, 'light_on_your_feet');
        if (CONFIG.defense.dodgeStamina != null) stBase = CONFIG.defense.dodgeStamina;
        break;
      case 'standUp': {
        const curve = CONFIG.standUp;
        const type = armorInfo(c).type;
        const k = curve && curve.ap[type] != null ? type : 'none';
        ap = rank(c, 'kip_up') ? baseAP(1) : curve ? baseAP(curve.ap[k]) : baseAP(a.ap + armorInfo(c).standUp);
        ap = Math.min(Math.round(ap) + armorAP(c), Math.max(minAP(), apPool(c)));
        if (curve) return { ap, stamina: staminaCost(c, curve.stamina[k], null, 0) };
        break;
      }
      case 'clinch':
      case 'grapple':
      case 'pin':
      case 'throw':
      case 'break': {
        if (kind !== 'break') red = rank(c, 'brawlers_wind');
        const g = CONFIG.grappling;
        if (g) return { ap: Math.max(minAP(), Math.round(ap)) + armorAP(c), stamina: staminaCost(c, g.stamina[kind], null, red) };
        break;
      }
      case 'bandage':
        ap = rank(c, 'field_dressing') ? baseAP(1) : baseAP(a.ap);
        break;
      case 'move':
        ap = (extra && extra.ap) || moveCost(c, 1); // moveCost holds the armor's share
        red = rank(c, 'light_on_your_feet');
        break;
      case 'windUp': {
        const W = CONFIG.windUp;
        ap = Math.round(baseAP(W.ap)) + armorAP(c);
        const o = extra && extra.option;
        if (o && o.spell) return { ap, stamina: 0 };
        const wpn = o && o.weaponId ? c.weapons.find((x) => x.id === o.weaponId) : null;
        return { ap, stamina: staminaCost(c, W.stamina, wpn ? effectiveWeight(c, wpn) : null, 0) };
      }
    }
    if (kind === 'block' || kind === 'parry' || kind === 'dodge') {
      if (st.prone) ap += CONFIG.maneuver.proneDefenseExtraAP * S;
      if (grappled) ap += CONFIG.maneuver.grappledDefenseExtraAP * S;
    }
    const stamina = staminaCost(c, stBase, null, red);
    if (kind === 'dropWeapon') return { ap: 0, stamina };
    if (kind === 'move') return { ap: Math.round(ap), stamina };
    const full = Math.max(minAP(), Math.round(ap));
    ap = Math.max(minAP(), full - (quick ? quickCut(c, quick, full) : 0)) + armorAP(c);
    return { ap, stamina };
  }

  // Webs (monster ability): each layer makes every action cost more AP and stamina.
  function webTax(c) {
    const n = (c.status && c.status.webbed) || 0;
    if (!n) return { ap: 0, stamina: 0 };
    const W = CONFIG.web || { ap: 1, stamina: 1 };
    return { ap: Math.round(n * W.ap * costScale()), stamina: tireless(c) ? 0 : n * W.stamina * (CONFIG.staminaScale || 1) };
  }

  function actionCost(c, kind, extra) {
    const cost = baseActionCost(c, kind, extra);
    if (kind === 'dropWeapon') return cost;
    const t = webTax(c);
    return { ap: cost.ap + t.ap, stamina: cost.stamina + t.stamina };
  }

  // ---- Health ------------------------------------------------------------
  // Apply attribute damage, lowering current stamina by the drop in max stamina.
  function damageAttr(c, a, n) {
    if (n <= 0) return;
    const before = maxStamina(c);
    c.damage[a] = (c.damage[a] || 0) + n;
    const after = maxStamina(c);
    c.stamina = Math.max(0, Math.min(after, c.stamina - (before - after)));
  }

  function healAttr(c, a, n) {
    const before = maxStamina(c);
    c.damage[a] = Math.max(0, (c.damage[a] || 0) - n);
    const after = maxStamina(c);
    if (after > before) c.stamina = Math.min(after, c.stamina + (after - before));
  }

  function totalDamage(c) {
    let n = 0;
    ATTRS.forEach((a) => (n += c.damage[a] || 0));
    return n;
  }

  function updateCondition(c) {
    const st = c.status;
    if (tireless(c)) {
      // No stamina to run out of: a tireless creature fights until its body is destroyed.
      c.stamina = maxStamina(c);
      if (attr(c, 'CON') <= 0) { st.dead = true; st.unconscious = true; }
      return st;
    }
    if (attr(c, 'CON') <= 0) {
      st.dead = true;
      st.unconscious = true;
    } else if (c.stamina <= 0) {
      st.unconscious = true;
    }
    return st;
  }

  function isActive(c) {
    return !c.status.dead && !c.status.unconscious;
  }

  function bleedPerRound(c) {
    let n = 0;
    for (const b of c.bleeds) n += b.remaining / b.rounds;
    return n;
  }

  G.Character = {
    newCharacter, normalize, freshStatus,
    rank, featCount, featBudget, treeCount, tierCount, tierName, canTakeFeat, canRemoveFeat, addFeat, removeFeat, reqText, roman,
    conditioning, attr, attrMax, combatAttr, armorInfo, shieldInfo, shieldReady, wieldedWeapon, offhandWeapon,
    maxStamina, freshStamina, wearyRound, regen, fatiguePenalty, apPool, apScale, costScale, fmtAP, minAP, baseAP, armorAP, quickCut, moveCost, squaresFor, squaresPerAP, handsBusy, castingHands, trinketAP, weaponStrain, inRange, optionKey, needsWindUp, strOffset, staminaCost, effectiveWeight, isLightWeapon,
    strBonus, weaponDamage, mainIndex, attackOptions, actionCost, ammoLeft, tireless, webTax,
    damageAttr, healAttr, totalDamage, updateCondition, isActive, bleedPerRound,
    TREES, ARMOR,
  };
})(typeof globalThis !== 'undefined' ? (globalThis.BBB = globalThis.BBB || {}) : {});
