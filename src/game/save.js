/*
 * Saving. A save is the whole world as JSON (keys starting with "_" are runtime-only and dropped).
 * Slots live in localStorage; the same text can be exported and imported as a file.
 */
(function (G) {
  'use strict';
  const PREFIX = 'bbb-save-';
  const SLOTS = ['auto', '1', '2', '3'];

  const store = () => { try { return globalThis.localStorage || null; } catch (e) { return null; } };

  function serialize(world) {
    return JSON.stringify({ app: 'bold-brave-beaten', saved: Date.now(), world }, (k, v) => (k[0] === '_' ? undefined : v));
  }

  function deserialize(text) {
    const d = JSON.parse(text);
    if (!d || !d.world || !d.world.chars) throw new Error('That is not a save file.');
    const w = d.world;
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

  G.Save = { SLOTS, serialize, deserialize, summary, write, read, list, remove };
})(typeof globalThis !== 'undefined' ? (globalThis.BBB = globalThis.BBB || {}) : {});
