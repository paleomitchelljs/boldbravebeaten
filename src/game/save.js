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

  const VERSION = 3;

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

  // Steps for one character (a party member, a companion, a foe in a saved fight), keyed by the version they leave.
  const CHAR_STEPS = {
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

  G.Save = { SLOTS, VERSION, upgrade, upgradeCharacter, serialize, deserialize, summary, write, read, list, remove };
})(typeof globalThis !== 'undefined' ? (globalThis.BBB = globalThis.BBB || {}) : {});
