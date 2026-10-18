/*
 * App state and persistence. Everything lives in this browser's localStorage;
 * Export/Import moves a whole table (characters + current battle) between devices.
 */
(function (G) {
  'use strict';
  const UI = G.UI;
  const C = G.Character;
  const Items = G.Items;
  const KEY = 'bbb-table-v1';

  function emptyState() {
    return {
      version: 1,
      characters: {},
      order: [],
      encounter: null,
      settings: { autoRoll: 'auto-only', aiEnemies: true, gmView: false },
      selected: null,
      tab: 'roster',
    };
  }

  function sampleState() {
    const s = emptyState();
    const add = (c) => { s.characters[c.id] = c; s.order.push(c.id); return c; };

    const wren = C.newCharacter({ name: 'Wren Halloway', base: { STR: 4, CON: 5, DEX: 7, SPD: 6, INT: 5, WIL: 4, WIS: 4, CHA: 5 }, starterGear: false });
    wren.armor = Items.makeArmor('leather', 'half', 'standard');
    wren.shield = Items.makeShield('buckler', 'wood', 'standard');
    const rapier = Items.makeWeapon('rapier', 'standard');
    const wd = Items.makeWeapon('dagger', 'standard');
    wren.weapons.push(rapier, wd);
    wren.wield = rapier.id;
    wren.sidearm = wd.id;
    wren.feats = { quick_thrust: 1, precision: 1, dodge_training: 1 };
    wren.notes = 'Example character. Edit or delete freely.';

    const osk = C.newCharacter({ name: 'Brother Osk', base: { STR: 6, CON: 6, DEX: 4, SPD: 4, INT: 5, WIL: 6, WIS: 6, CHA: 4 } });
    osk.weapons = [];
    const mace = Items.makeWeapon('spikedMace', 'standard');
    const od = Items.makeWeapon('dagger', 'crude');
    osk.weapons.push(mace, od);
    osk.wield = mace.id;
    osk.sidearm = od.id;
    osk.feats = { shield_training: 1, field_dressing: 1, wound_tending: 1 };
    osk.inventory.bandages = 4;
    osk.notes = 'Example character. Edit or delete freely.';

    const hale = C.newCharacter({ name: 'Hale Ashdown', base: { STR: 6, CON: 5, DEX: 5, SPD: 5, INT: 4, WIL: 5, WIS: 5, CHA: 5 } });
    hale.weapons = [];
    const ls = Items.makeWeapon('longsword', 'standard');
    const hd = Items.makeWeapon('dagger', 'standard');
    hale.weapons.push(ls, hd);
    hale.wield = ls.id;
    hale.sidearm = hd.id;
    hale.feats = { parry_training: 1, read_attack: 1, strength: 1 };
    hale.notes = 'Example character. Edit or delete freely.';

    const ysolde = C.newCharacter({ name: 'Ysolde Marr', base: { STR: 4, CON: 5, DEX: 5, SPD: 5, INT: 8, WIL: 6, WIS: 5, CHA: 4 }, starterGear: false });
    ysolde.armor = Items.makeArmor('padded', 'full', 'standard');
    const yd = Items.makeWeapon('dagger', 'standard');
    ysolde.weapons.push(yd);
    ysolde.sidearm = yd.id;
    ysolde.feats = { casting: 2, verb_strike: 1, verb_hex: 1, verb_build: 1, verb_cover: 1, mod_strong: 1 };
    ysolde.level = 3;
    ysolde.nouns = ['fire', 'earth', 'vine'];
    ysolde.notes = 'Example caster: Fire, Earth and Vine. Walls, roots, burning ground. Edit or delete freely.';

    [wren, osk, hale, ysolde].forEach((c) => { c.stamina = C.maxStamina(c); add(c); });
    add(G.Enemies.generate('bandit', 1, { seed: 11, name: 'Gorm the bandit' }));
    add(G.Enemies.generate('bandit', 1, { seed: 23, name: 'Fenna the bandit' }));
    add(G.Enemies.generate('sellsword', 2, { seed: 5, name: 'Rurik the sellsword' }));
    s.selected = wren.id;
    return s;
  }

  function load() {
    let s = null;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) s = JSON.parse(raw);
    } catch (e) {
      s = null;
    }
    if (!s || !s.characters) return sampleState();
    return normalizeState(s);
  }

  function normalizeState(s) {
    const base = emptyState();
    s = Object.assign(base, s);
    s.settings = Object.assign(emptyState().settings, s.settings || {});
    for (const id in s.characters) C.normalize(s.characters[id]);
    s.order = (s.order || []).filter((id) => s.characters[id]);
    for (const id in s.characters) if (!s.order.includes(id)) s.order.push(id);
    if (s.encounter) {
      s.encounter.ids = s.encounter.ids.filter((id) => s.characters[id]);
      if (s.encounter.phase === 'initiative') {
        s.encounter.round -= 1;
        s.encounter.phase = s.encounter.round ? 'roundEnd' : 'setup';
      }
      if (!s.encounter.spent) {
        // Saved before passes resolved one at a time: pick up at the next round.
        Object.assign(s.encounter, { spent: {}, turnDone: {} });
        if (['declare', 'resolve', 'resolving'].includes(s.encounter.phase)) {
          s.encounter.phase = s.encounter.round ? 'roundEnd' : 'setup';
          s.encounter.decls = [];
          s.encounter.log.push({ round: s.encounter.round, text: 'The round rules changed since this battle was saved; continue with the next round.', cls: 'fizzle' });
        }
      }
      // Saved with defenses tied to one strike (before guards): drop them.
      if (s.encounter.decls && s.encounter.decls.some((d) => d.answers != null)) {
        s.encounter.decls = s.encounter.decls.filter((d) => d.answers == null);
      }
      if (s.encounter.phase === 'resolving') {
        s.encounter.phase = 'roundEnd';
        s.encounter.log.push({ round: s.encounter.round, text: 'The page was closed while a pass was resolving; continue with the next round.', cls: 'fizzle' });
      }
    }
    return s;
  }

  function save(s) {
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
      return true;
    } catch (e) {
      return false;
    }
  }

  function exportJSON(s) {
    return JSON.stringify({ app: 'bold-brave-beaten', version: s.version, characters: s.characters, order: s.order, encounter: s.encounter, settings: s.settings }, null, 1);
  }

  function importJSON(text) {
    const d = JSON.parse(text);
    if (!d || typeof d.characters !== 'object') throw new Error('That text has no characters in it.');
    return normalizeState(Object.assign(emptyState(), d, { tab: 'roster', selected: null }));
  }

  UI.Store = { load, save, sampleState, emptyState, exportJSON, importJSON };
})(globalThis.BBB);
