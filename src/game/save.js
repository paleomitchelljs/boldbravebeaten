/*
 * Saving. A save is the whole world as JSON (keys starting with "_" are runtime-only and dropped).
 * Slots live in localStorage; the same text can be exported and imported as a file.
 *
 * Versions. world.version says which shape a save is in. When the shape changes, VERSION goes up by one and a step
 * goes into CHAR_STEPS or WORLD_STEPS that brings a save from the version before. Loading runs every step from the
 * save's version up, then Character.normalize fills in fields that are simply missing. The rules read only the
 * current shape; old shapes are known here and nowhere else.
 */
(function (G) {
  'use strict';
  const PREFIX = 'bbb-save-';
  const SLOTS = ['auto', '1', '2', '3'];

  const store = () => { try { return globalThis.localStorage || null; } catch (e) { return null; } };

  const VERSION = 9;

  // An item from before version 3: quality became craft; scale armor (no longer a tier) became steel mail; a
  // drinking blade's own `enchant: {drain}` became the drinking enchantment; `magical` (from the testbed) is dropped,
  // since any enchantment now makes a weapon magical.
  function upgradeItem(it) {
    if (!it || typeof it !== 'object') return;
    if (it.quality != null) { if (!it.craft) it.craft = G.Items.craftId(it.quality) || 'average'; delete it.quality; }
    if (it.kind === 'armor' && it.type === 'scale') { it.type = 'mail'; it.material = 'steel'; }
    if (it.enchant) {
      if (it.enchant.drain && !(it.enchantments || []).includes('drinking')) it.enchantments = (it.enchantments || []).concat('drinking');
      delete it.enchant;
    }
    delete it.magical;
  }

  // Four hit locations (docs/OVERHAUL.md step A): an armor piece's hands are its arms, its feet its legs.
  const FOLD = { hands: 'arms', feet: 'legs' };
  function foldCovers(it) {
    if (it && it.kind === 'armor' && Array.isArray(it.covers)) it.covers = [...new Set(it.covers.map((l) => FOLD[l] || l))];
  }

  // A worn thing's power in the spell words of 2026-11-08 (the goods that had one).
  const POWERS = { 'bless+veil': { verb: 'give', noun: 'shadow', aim: 'ally' }, 'beguile+rage': { verb: 'take', noun: 'mind' }, 'strike+spirit': { verb: 'take', noun: 'death', aim: 'foe' }, 'beguile+fear': { verb: 'give', noun: 'fear' }, 'hex+might': { verb: 'take', noun: 'might' } };
  function resayPower(t) {
    const p = t && t.power;
    if (p && POWERS[`${p.verb}+${p.noun}`]) Object.assign(p, POWERS[`${p.verb}+${p.noun}`]);
  }

  // An encounter saved with rounds and AP (before version 9: docs/OVERHAUL.md step F) goes onto the clock where everyone
  // stands: the old round's state dropped, phase 'setup' so the clock starts afresh (the game starts it by itself).
  function toClock(enc) {
    if (!enc || enc.clock) return enc;
    for (const k of ['round', 'initiative', 'order', 'ap', 'apStart', 'conceded', 'pass', 'turn', 'step', 'spent', 'turnDone', 'owed', 'hitThisRound', 'staminaAtStart', 'awayChecked']) delete enc[k];
    const beat = (G.CONFIG.clock && G.CONFIG.clock.beat) || 14;
    Object.assign(enc, { now: 0, beat: 0, nextBeat: beat, clock: {}, tie: {}, pending: [], committed: {}, waits: {}, actor: null, struck: {}, decls: [] });
    if (enc.phase !== 'over') enc.phase = 'setup';
    (enc.log || (enc.log = [])).push({ tick: 0, beat: 0, text: 'This fight was saved with rounds and AP; it goes on by the clock from here.', cls: 'fizzle' });
    return enc;
  }

  // Steps for one character (a party member, a companion, a foe in a saved fight), keyed by the version they leave.
  const CHAR_STEPS = {
    // The clock (step F): a wind-up is gone (an action's lead is the encounter's); conditions, prepared spells and a
    // collapse or a death count beats, not rounds.
    8: (c) => {
      const st = c.status || {};
      delete st.windUp;
      for (const x of st.conds || []) if (x.rounds != null) { x.beats = x.rounds; delete x.rounds; }
      for (const p of c.prepared || []) if (p.rounds != null) { p.beats = p.rounds; delete p.rounds; }
      if (st.collapsed && st.collapsed.round != null) { st.collapsed.beat = 0; delete st.collapsed.round; }
      if (st.diedRound != null) { st.diedBeat = 0; delete st.diedRound; }
      if (typeof st.charging === 'number') st.charging = null;
      if (typeof st.counterStep === 'number') st.counterStep = null;
      if (c.conjured && c.conjured.rounds != null) { c.conjured.beats = c.conjured.rounds; delete c.conjured.rounds; }
    },
    // Wounds (step E): attribute damage becomes harm where wounds.attrPlace puts each attribute (STR and DEX the arms,
    // SPD the legs, CON the torso, the rest the head), one wound a place by the severity thresholds; old bleeding is
    // taken as stopped. A creature's traits: regrow's con is mend, constrict's con is harm.
    7: (c) => {
      const P = G.CONFIG.wounds.attrPlace;
      const by = {};
      for (const [a, n] of Object.entries(c.damage || {})) if (n > 0) by[P[a] || 'torso'] = (by[P[a] || 'torso'] || 0) + n;
      c.wounds = Array.isArray(c.wounds) ? c.wounds : [];
      for (const [place, n] of Object.entries(by)) G.Character.harm(c, n, place, 'old');
      c.wounds = c.wounds.filter((w) => w.sev > 0).map((w) => { delete w.ongoing; return w; });
      delete c.damage;
      delete c.bleeds;
      const T = c.traits;
      if (T && T.regrow && T.regrow.con != null) { T.regrow.mend = T.regrow.con; delete T.regrow.con; }
      if (T && T.constrict && T.constrict.con != null) { T.constrict.harm = T.constrict.con; delete T.constrict.con; }
      if (c.companion) CHAR_STEPS[7](c.companion);
    },
    // Four hit locations (step A): pieces fold hands into arms and feet into legs; where two worn pieces now cover the
    // same place, Character.normalize takes the later one off into the pack.
    6: (c) => {
      for (const it of [c.armor].concat(c.pieces || [], (c.inventory && c.inventory.items) || [])) foldCovers(it);
      if (c.companion) CHAR_STEPS[6](c.companion);
    },
    // The spell words (the user, 2026-11-08): retired verbs and modifiers become the word that took their place
    // (verb_build, the older verb_bind, is now Raise; Beguile became Bind), retired nouns theirs, and worn powers are
    // said in the new words.
    5: (c) => {
      const WORDS = { verb_hex: 'verb_take', verb_bless: 'verb_give', verb_restore: 'verb_give', verb_cover: 'verb_give', verb_increase: 'verb_give', verb_decrease: 'verb_take', verb_transfer: 'verb_move', verb_launch: 'mod_far', verb_build: 'verb_raise', verb_open: 'verb_take', verb_inscribe: 'mod_hidden', verb_blink: 'verb_move', verb_burst: 'mod_wide', verb_beguile: 'verb_bind', verb_conjure: 'verb_summon', mod_launch: 'mod_far', mod_burst: 'mod_wide', mod_lingering: 'mod_long', mod_name: 'verb_bind', word_doubling: 'mod_strong' };
      const F = c.feats || {};
      for (const [from, to] of Object.entries(WORDS)) if (F[from]) { F[to] = Math.max(F[to] || 0, F[from]); delete F[from]; }
      const NOUNS = { lightning: 'storm', venom: 'decay', acid: 'decay', plague: 'decay', bone: 'death', spirit: 'death', veil: 'shadow', light: 'life', wind: 'force', vine: 'earth', swiftness: 'speed', calm: 'mind', dream: 'mind', rage: 'mind', will: 'mind', charm: 'mind', stillness: 'mind' };
      if (Array.isArray(c.nouns)) c.nouns = [...new Set(c.nouns.map((n) => NOUNS[n] || n))];
      for (const t of c.trinkets || []) resayPower(t);
    },
    // Skills (the user, 2026-11-07): feats that were only a number became skills (rules.yaml skills.retired); each rank
    // held becomes perRank ranks of its skill (to the top), the feat goes, and Feint is one rank now. Points left over
    // wait to be spent.
    4: (c) => {
      const R = (G.CONFIG.skills && G.CONFIG.skills.retired) || { feats: {}, perRank: 2 };
      const F = c.feats || {};
      c.skills = c.skills || {};
      for (const [f, sk] of Object.entries(R.feats || {})) {
        if (!F[f]) continue;
        c.skills[sk] = Math.min((G.CONFIG.skills.max || 10), (c.skills[sk] || 0) + F[f] * (R.perRank || 2));
        delete F[f];
      }
      if (F.feint > 1) F.feint = 1;
    },
    // The preset party's colour washes (there to tell stock figures apart) came off members drawn with their own art.
    3: (c) => {
      const L = c.look;
      if (!L || !L.tint || typeof L.sprite !== 'string' || !L.sprite.startsWith('art:')) return;
      const presets = ((G.Content && G.Content.world.start) || {}).presets || [];
      if (presets.some((p) => p.name === c.name && p.look && p.look.sprite === L.sprite)) L.tint = 0;
    },
    2: (c) => {
      const st = c.status || {};
      // A grapple was five fields over the two fighters.
      if ('grappledBy' in st || 'grappling' in st || 'clinch' in st || 'pinned' in st) {
        if (!st.grapple) {
          if (st.clinch) st.grapple = { partner: st.clinch, level: 'clinch', role: 'mutual' };
          else if (st.grappling) st.grapple = { partner: st.grappling, level: st.grapplingPin ? 'pin' : 'hold', role: 'holder' };
          else if (st.grappledBy && st.grappledBy.length) st.grapple = { partner: st.grappledBy[0], level: st.pinned ? 'pin' : 'hold', role: 'held' };
        }
        for (const k of ['clinch', 'grappling', 'grappledBy', 'pinned', 'grapplingPin']) delete st[k];
      }
      // Weapons on the ground were a single id (and the wield pointer stayed on it).
      if (st.dropped != null && !Array.isArray(st.dropped)) st.dropped = [st.dropped];
      if (c.wield != null && Array.isArray(st.dropped) && st.dropped.includes(c.wield)) c.wield = null;
      // WIL was split from WIS: older characters keep their WIS value for it.
      if (c.base && c.base.WIL == null && c.base.WIS != null) c.base.WIL = c.base.WIS;
      // The magic overhaul renamed the verbs.
      const RENAMED = { verb_attack: 'verb_strike', verb_mend: 'verb_bless', verb_ward: 'verb_bless', verb_calm: 'verb_hex', verb_hold: 'verb_hex', verb_bind: 'verb_build', verb_reveal: 'verb_inscribe', verb_explode: 'verb_burst' };
      const F = c.feats || {};
      for (const [from, to] of Object.entries(RENAMED)) if (F[from]) { F[to] = Math.max(F[to] || 0, F[from]); delete F[from]; }
      for (const it of [c.armor, c.shield].concat(c.pieces || [], c.weapons || [], (c.inventory && c.inventory.items) || [])) upgradeItem(it);
      // Worn things: the charm slot is the neck; gear's apMult (× each action's cost) is costMult.
      for (const t of c.trinkets || []) {
        if (t.slot === 'charm') t.slot = 'neck';
        if (t.effects && t.effects.apMult != null) { t.effects.costMult = t.effects.apMult; delete t.effects.apMult; }
      }
      // A monster's traits in a saved fight: regen is regrow, nimble is dodge, magicImmune is resist {magic: 0}.
      const T = c.traits;
      if (T) {
        if (T.regen && typeof T.regen === 'object') { T.regrow = T.regen; delete T.regen; }
        if (T.nimble != null) { T.dodge = T.nimble; delete T.nimble; }
        if (T.magicImmune) { T.resist = Object.assign({}, T.resist, { magic: 0 }); delete T.magicImmune; }
      }
      delete c.gold; // the party's gold is world.gold
      if (c.companion) CHAR_STEPS[2](c.companion);
    },
  };

  // Steps for the world around the characters.
  const WORLD_STEPS = {
    8: (w) => { if (w.battle) toClock(w.battle.enc); },
    6: (w) => { for (const it of (w.pack && w.pack.gear) || []) foldCovers(it); },
    5: (w) => { for (const it of (w.pack && w.pack.gear) || []) resayPower(it); },
    2: (w) => {
      for (const it of (w.pack && w.pack.gear) || []) upgradeItem(it);
      // Supplies dealt out for a fight used to stay in the pool too; now they leave it. A save made mid-fight holds
      // them in the members' hands, so the pool's copy goes.
      if (w.battle && w.supplies) Object.assign(w.supplies, { bandages: 0, arrows: 0, bodkins: 0, components: {} });
    },
  };

  // Bring a character from version `from` (default: the last unversioned shape, 2) to VERSION.
  function upgradeCharacter(c, from) {
    for (let v = from || 2; v < VERSION; v++) if (CHAR_STEPS[v]) CHAR_STEPS[v](c);
    return c;
  }

  function upgrade(w) {
    const from = w.version || 2;
    const chars = Object.values(w.chars || {}).concat(Object.values((w.battle && w.battle.foes) || {}));
    for (let v = from; v < VERSION; v++) {
      if (CHAR_STEPS[v]) for (const c of chars) CHAR_STEPS[v](c);
      if (WORLD_STEPS[v]) WORLD_STEPS[v](w);
    }
    w.version = VERSION;
    return w;
  }

  function serialize(world) {
    return JSON.stringify({ app: 'bold-brave-beaten', saved: Date.now(), world }, (k, v) => (k[0] === '_' ? undefined : v));
  }

  function deserialize(text) {
    const d = JSON.parse(text);
    if (!d || !d.world || !d.world.chars) throw new Error('That is not a save file.');
    const w = d.world;
    if (w.version > VERSION) throw new Error('That save is from a newer version of the game.');
    upgrade(w);
    for (const id of Object.keys(w.chars)) G.Character.normalize(w.chars[id]);
    if (w.battle) for (const id of Object.keys(w.battle.foes || {})) G.Character.normalize(w.battle.foes[id]);
    w.settings = Object.assign({ autoRoll: 'all', aiEnemies: true, gmView: false }, w.settings || {});
    w.secrets = w.secrets || [];
    w.npcs = w.npcs || {};
    w.maps = w.maps || {};
    w.pack = w.pack || { gear: [], goods: {} };
    for (const it of w.pack.gear || []) G.Items.normalizeItem(it);
    w.rep = w.rep || { renown: 0, notoriety: 0 };
    return w;
  }

  function summary(world) {
    const p = G.World.party(world);
    return {
      names: p.map((c) => c.name).join(', '), day: world.day, gold: world.gold,
      level: Math.max(...p.map((c) => c.level)), place: (G.Content.world.places[world.place] || {}).name || world.place,
    };
  }

  function write(slot, world, storage) {
    const s = storage || store();
    if (!s) return false;
    try { s.setItem(PREFIX + slot, serialize(world)); return true; } catch (e) { return false; }
  }

  function read(slot, storage) {
    const s = storage || store();
    if (!s) return null;
    try { const t = s.getItem(PREFIX + slot); return t ? deserialize(t) : null; } catch (e) { return null; }
  }

  function list(storage) {
    return SLOTS.map((slot) => {
      const w = read(slot, storage);
      return { slot, world: w, info: w ? summary(w) : null };
    });
  }

  function remove(slot, storage) {
    const s = storage || store();
    if (s) try { s.removeItem(PREFIX + slot); } catch (e) { /* ignore */ }
  }

  G.Save = { SLOTS, VERSION, toClock, upgrade, upgradeCharacter, serialize, deserialize, summary, write, read, list, remove };
})(typeof globalThis !== 'undefined' ? (globalThis.BBB = globalThis.BBB || {}) : {});
