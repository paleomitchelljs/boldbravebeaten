/*
 * Content: loads the YAML files in data/ and installs them.
 *
 * One registry says which file feeds which catalog. Engine catalogs (armor, weapons, feats,
 * monsters…) are filled in place so every module holding a reference sees the change; game
 * content (items, factions, places…) lands in Content.world. Installing is repeatable: the
 * Bench re-installs edited files without a reload.
 *
 * Node reads the files with fs (Content.loadSync); the browser fetches them (Content.load).
 */
(function (G) {
  'use strict';
  const Y = G.Yaml;

  const replaceObject = (target, src) => {
    for (const k of Object.keys(target)) delete target[k];
    Object.assign(target, src || {});
  };

  // Each entry: file, key (in Content.world for game content), install(data) for engine catalogs.
  const REGISTRY = [
    { file: 'rules.yaml', optional: true, install: (d) => G.Content.applyRules(d) },
    { file: 'armor.yaml', install: (d) => replaceObject(G.DATA.ARMOR, d) },
    { file: 'shields.yaml', install: (d) => { replaceObject(G.DATA.SHIELDS, d.types); replaceObject(G.DATA.SHIELD_MATERIALS, d.materials); } },
    { file: 'materials.yaml', install: (d) => replaceObject(G.DATA.MATERIALS, d) },
    { file: 'origins.yaml', install: (d) => replaceObject(G.DATA.ORIGINS, d) },
    { file: 'crafts.yaml', install: (d) => replaceObject(G.DATA.CRAFTS, d) },
    { file: 'enchantments.yaml', install: (d) => replaceObject(G.DATA.ENCHANTMENTS, d) },
    { file: 'weapons.yaml', install: (d) => replaceObject(G.DATA.WEAPONS, d) },
    { file: 'feats.yaml', install: installFeats },
    { file: 'spells.yaml', install: (d) => replaceObject(G.CONFIG.magic.words, d) },
    { file: 'monsters.yaml', install: (d) => replaceObject(G.Enemies.MONSTERS, d) },
    { file: 'foes.yaml', install: (d) => replaceObject(G.Enemies.TEMPLATES, d) },
    // Game content (kept in Content.world.<key>).
    { file: 'items.yaml', key: 'items' },
    { file: 'skills.yaml', key: 'skills' },
    { file: 'factions.yaml', key: 'factions' },
    { file: 'npcs.yaml', key: 'npcs' },
    { file: 'places.yaml', key: 'places' },
    { file: 'quests.yaml', key: 'quests' },
    { file: 'start.yaml', key: 'start' },
    { file: 'art.yaml', key: 'art' },
    { file: 'tilesets.yaml', key: 'tilesets' },
  ];

  function installFeats(trees) {
    G.DATA.TREES.length = 0;
    for (const k of Object.keys(G.DATA.FEATS)) delete G.DATA.FEATS[k];
    for (const t of trees || []) {
      G.DATA.TREES.push({ id: t.id, name: t.name, attrs: t.attrs });
      for (const id of Object.keys(t.feats || {})) {
        const f = t.feats[id];
        G.DATA.FEATS[id] = Object.assign({ id, tree: t.id, requires: [], effect: '', auto: false }, f);
      }
    }
  }

  // rules.yaml: deep-merged over CONFIG, so a tuned number can live beside the content.
  const base = {};
  function applyRules(d) {
    const merge = (dst, src) => {
      for (const k of Object.keys(src)) {
        if (src[k] && typeof src[k] === 'object' && !Array.isArray(src[k]) && dst[k] && typeof dst[k] === 'object') merge(dst[k], src[k]);
        else dst[k] = src[k];
      }
    };
    if (d) merge(G.CONFIG, d);
  }

  const world = {};
  const sources = {}; // file -> text as loaded or last edited

  function installAll(texts) {
    const errors = [];
    const parsed = {};
    for (const r of REGISTRY) {
      const text = texts[r.file];
      if (text == null) { if (!r.optional && !r.key) errors.push(`${r.file}: missing`); continue; }
      try { parsed[r.file] = Y.parse(text); } catch (e) { errors.push(`${r.file}: ${e.message}`); }
    }
    if (errors.length) return { ok: false, errors };
    for (const r of REGISTRY) {
      if (!(r.file in parsed)) continue;
      sources[r.file] = texts[r.file];
      if (r.key) world[r.key] = parsed[r.file];
      else if (r.install) r.install(parsed[r.file]);
    }
    return { ok: true, errors: [], warnings: validate() };
  }

  // ---- Validation: cross references between files --------------------------
  function validate() {
    const W = world;
    const D = G.DATA;
    const out = [];
    const err = (m) => out.push(m);
    const has = (cat, id) => id in cat;
    const goods = (W.items && W.items.goods) || {};
    const tables = (W.items && W.items.tables) || {};
    const places = W.places || {};
    const factions = W.factions || {};
    const npcs = W.npcs || {};
    const quests = W.quests || {};
    const skills = W.skills || {};
    const goodExists = (id) => has(goods, id);
    // An item's tags: material, origin, craft and enchantments, checked against its kind.
    const tagsOk = (where, kind, type, e) => {
      if (e.name != null && typeof e.name !== 'string') err(`${where}: name must be text`);
      if (e.material) {
        if (kind === 'shield') { if (!has(D.SHIELD_MATERIALS, e.material)) err(`${where}: shield material "${e.material}" unknown`); }
        else if (!has(D.MATERIALS, e.material)) err(`${where}: material "${e.material}" is not in materials.yaml`);
        else if (kind === 'armor' && D.ARMOR[type] && D.ARMOR[type].materials && !D.ARMOR[type].materials.includes(e.material)) err(`${where}: ${type} is not made of ${e.material}`);
      }
      if (e.origin && !has(D.ORIGINS, e.origin)) err(`${where}: origin "${e.origin}" is not in origins.yaml`);
      // Armor: the locations a piece covers (rules.yaml locations), or a coverage keyword.
      if (kind === 'armor') {
        const L = G.CONFIG.locations;
        if (e.covers != null && (!Array.isArray(e.covers) || !e.covers.length)) err(`${where}: covers must be a list of locations`);
        for (const l of e.covers || []) if (L && !L.order.includes(l)) err(`${where}: location "${l}" is not in rules.yaml locations`);
        if (e.coverage && L && !L.coverage[e.coverage]) err(`${where}: coverage "${e.coverage}" is not in rules.yaml locations.coverage`);
        if (e.covers && e.coverage) err(`${where}: give covers or coverage, not both`);
      }
      const craft = e.craft;
      if (craft && !G.Items.craftId(craft)) err(`${where}: craft "${craft}" is not in crafts.yaml`);
      for (const x of e.enchantments || []) {
        if (!has(D.ENCHANTMENTS, x)) err(`${where}: enchantment "${x}" is not in enchantments.yaml`);
        else if (!(D.ENCHANTMENTS[x].kinds || []).includes(kind)) err(`${where}: enchantment "${x}" can't be laid on a ${kind}`);
      }
    };
    // An item's power names spell words that make a spell together.
    const powerOk = (where, p) => {
      const words = G.CONFIG.magic.words;
      if (!p.name) err(`${where}: power needs a name`);
      if (!words[p.verb] || words[p.verb].kind !== 'verb') err(`${where}: power verb "${p.verb}" is not in spells.yaml`);
      else if (!words[p.noun] || words[p.noun].kind !== 'noun') err(`${where}: power noun "${p.noun}" is not in spells.yaml`);
      else if (G.Magic && !G.Magic.combines(p.verb, p.noun, p.mod || null)) err(`${where}: ${p.verb} + ${p.noun}${p.mod ? ' + ' + p.mod : ''} makes no spell`);
    };
    // Effect keys (src/rules/effects.js): a key no rule reads is a typo or a retired mechanic.
    const keysOk = (kind, bag, where) => { if (G.Effects) for (const m of G.Effects.check(kind, bag, where)) err(m); };
    for (const [id, m] of Object.entries(G.Enemies.MONSTERS)) {
      keysOk('traits', m.traits, `monsters.${id}.traits`);
      (m.trinkets || []).forEach((t, i) => keysOk('gearEffects', t.effects, `monsters.${id}.trinkets[${i}].effects`));
    }
    for (const [id, w] of Object.entries(D.WEAPONS)) keysOk('weaponTrait', w.trait, `weapons.${id}.trait`);
    for (const [id, e] of Object.entries(D.ENCHANTMENTS)) { keysOk('gearEffects', e.effects, `enchantments.${id}.effects`); keysOk('strike', e.strike, `enchantments.${id}.strike`); }
    for (const [id, g] of Object.entries(goods)) keysOk('gearEffects', g.effects, `items.goods.${id}.effects`);
    for (const [id, c] of Object.entries(G.CONFIG.conditions || {})) keysOk('condition', c, `conditions.${id}`);
    for (const f of Object.values(D.FEATS)) keysOk('gearEffects', f.effects, `feats.${f.id}.effects`);
    for (const [id, e] of Object.entries(D.ENCHANTMENTS)) {
      if (e.power) powerOk(`enchantments.${id}`, e.power);
      for (const x of (e.strike && e.strike.slay) || []) if (!x.trait) err(`enchantments.${id}: slay needs a trait`);
      if (e.strike && e.strike.onHit && !G.CONFIG.conditions[e.strike.onHit.cond]) err(`enchantments.${id}: condition "${e.strike.onHit.cond}" unknown`);
    }
    const gearSpecOk = (where, e) => {
      if (e.weapon && !has(D.WEAPONS, e.weapon)) err(`${where}: weapon "${e.weapon}" is not in weapons.yaml`);
      if (e.armor && !has(D.ARMOR, e.armor)) err(`${where}: armor "${e.armor}" is not in armor.yaml`);
      if (e.shield && !has(D.SHIELDS, e.shield)) err(`${where}: shield "${e.shield}" is not in shields.yaml`);
      if (e.weapon || e.armor || e.shield) tagsOk(where, e.weapon ? 'weapon' : e.armor ? 'armor' : 'shield', e.weapon || e.armor || e.shield, e);
      if (e.good && !goodExists(e.good)) err(`${where}: good "${e.good}" is not in items.yaml`);
      if (e.table && !has(tables, e.table)) err(`${where}: table "${e.table}" is not in items.yaml`);
    };
    const condOk = (where, c) => {
      if (!c) return;
      if (c.item && !goodExists(c.item)) err(`${where}: condition item "${c.item}" unknown`);
      if (c.standing && !has(factions, c.standing.faction)) err(`${where}: condition faction "${c.standing.faction}" unknown`);
      if (c.quest && !has(quests, String(c.quest).split(':')[0])) err(`${where}: condition quest "${c.quest}" unknown`);
      for (const a of c.any || []) condOk(where, a);
      if (c.not) condOk(where, c.not);
    };

    for (const [id, m] of Object.entries(G.Enemies.MONSTERS)) {
      if (m.group) { for (const k of m.group) if (!has(G.Enemies.MONSTERS, k)) err(`monsters.${id}: group member "${k}" is not a monster`); continue; }
      if (m.armor && !has(D.ARMOR, m.armor)) err(`monsters.${id}: armor "${m.armor}" is not in armor.yaml`);
      if (m.armorItem) { if (!has(D.ARMOR, m.armorItem.type)) err(`monsters.${id}: armor "${m.armorItem.type}" is not in armor.yaml`); else tagsOk(`monsters.${id}.armorItem`, 'armor', m.armorItem.type, m.armorItem); }
      if (m.shieldItem) { if (!has(D.SHIELDS, m.shieldItem.size)) err(`monsters.${id}: shield "${m.shieldItem.size}" is not in shields.yaml`); else tagsOk(`monsters.${id}.shieldItem`, 'shield', m.shieldItem.size, m.shieldItem); }
      for (const w of m.weaponItems || []) { if (!has(D.WEAPONS, w.type)) err(`monsters.${id}: weapon "${w.type}" is not in weapons.yaml`); else tagsOk(`monsters.${id}.weaponItems`, 'weapon', w.type, w); }
      for (const w of m.natural || []) if (!has(D.WEAPONS, w)) err(`monsters.${id}: natural weapon "${w}" is not in weapons.yaml`);
      for (const w of m.weapons || []) if (!has(D.WEAPONS, w)) err(`monsters.${id}: weapon "${w}" is not in weapons.yaml`);
      for (const f of Object.keys(m.feats || {})) if (!has(D.FEATS, f)) err(`monsters.${id}: feat "${f}" is not in feats.yaml`);
      if (m.faction && !has(factions, m.faction)) err(`monsters.${id}: faction "${m.faction}" is not in factions.yaml`);
      if (m.loot && !has(tables, m.loot)) err(`monsters.${id}: loot table "${m.loot}" is not in items.yaml`);
    }
    const art = W.art || {};
    const artOk = (where, sp) => { if (sp && typeof sp === 'object' && sp.art && !has(art, sp.art)) err(`${where}: art "${sp.art}" is not in art.yaml`); };
    const COMPASS = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];
    for (const [id, a] of Object.entries(art)) {
      if (a.type !== 'pixellab') continue;
      const size = (v) => v > 0 || (Array.isArray(v) && v.length === 2 && v.every((x) => x > 0));
      if (!a.dir || !size(a.size)) err(`art.${id}: a pixellab entry needs dir and size (a number, or [width, height])`);
      for (const f of ['walks', 'rotations']) for (const d of a[f] || []) if (!COMPASS.includes(d)) err(`art.${id}.${f}: "${d}" is not a compass direction`);
      for (const f of ['walk', 'idle', 'attack']) {
        const c = a[f];
        if (c == null || typeof c === 'string') continue;
        if (typeof c !== 'object' || (f !== 'walk' && !c.anim)) { err(`art.${id}.${f}: want an animation name, or {anim, dir, frames, dirs}`); continue; }
        if (c.frames != null && !(c.frames > 0)) err(`art.${id}.${f}.frames: want a positive number`);
        for (const d of c.dirs || []) if (!COMPASS.includes(d)) err(`art.${id}.${f}.dirs: "${d}" is not a compass direction`);
      }
      if (a.recolor && !(Array.isArray(a.recolor) && a.recolor.length > 1 && a.recolor.every((r) => Array.isArray(r) && typeof r[0] === 'number' && /^#[0-9a-f]{6}$/i.test(r[1]))))
        err(`art.${id}.recolor: want [[brightness 0..1, "#rrggbb"], ...], at least two stops`);
    }
    for (const [id, m] of Object.entries(G.Enemies.MONSTERS)) artOk(`monsters.${id}.sprite`, m.sprite);
    for (const [id, t] of Object.entries(G.Enemies.TEMPLATES)) artOk(`foes.${id}.sprite`, t.sprite);
    for (const [id, n] of Object.entries(W.npcs || {})) artOk(`npcs.${id}.sprite`, n.sprite);
    for (const [id, t] of Object.entries(G.Enemies.TEMPLATES)) {
      if (t.faction && !has(factions, t.faction)) err(`foes.${id}: faction "${t.faction}" is not in factions.yaml`);
    }
    for (const f of Object.values(D.FEATS)) {
      for (const alt of f.requires) for (const r of alt) { const fid = String(r).split(':')[0]; if (!has(D.FEATS, fid)) err(`feats.${f.id}: requires unknown feat "${fid}"`); }
    }
    for (const [id, s] of Object.entries(skills)) {
      if (id === 'tn') continue;
      for (const f of Object.keys(s.feats || {})) if (!has(D.FEATS, f)) err(`skills.${id}: feat "${f}" is not in feats.yaml`);
    }
    for (const [id, f] of Object.entries(factions)) {
      for (const k of ['allies', 'enemies']) for (const o of f[k] || []) if (!has(factions, o)) err(`factions.${id}.${k}: "${o}" is not a faction`);
    }
    for (const [id, g] of Object.entries(goods)) {
      if (g.kind === 'trinket') {
        const slots = ((G.CONFIG.game || {}).wornSlots || []);
        if (slots.length && !slots.some((w) => w.id === g.slot || w.takes === g.slot)) err(`items.goods.${id}: trinket slot "${g.slot}" is not in rules.yaml game.wornSlots`);
        if (g.power) powerOk(`items.goods.${id}`, g.power);
      }
    }
    for (const [id, t] of Object.entries(tables)) t.forEach((e, i) => gearSpecOk(`items.tables.${id}[${i}]`, e));

    for (const [id, n] of Object.entries(npcs)) {
      if (n.faction && !has(factions, n.faction)) err(`npcs.${id}: faction "${n.faction}" is not in factions.yaml`);
      const seen = new Set();
      for (const t of n.topics || []) {
        if (seen.has(t.id)) err(`npcs.${id}: duplicate topic id "${t.id}"`);
        seen.add(t.id);
        if (t.starts && !has(quests, t.starts)) err(`npcs.${id}.${t.id}: starts unknown quest "${t.starts}"`);
        if (t.gives && t.gives.good && !goodExists(t.gives.good)) err(`npcs.${id}.${t.id}: gives unknown good "${t.gives.good}"`);
        if (t.takes && !goodExists(t.takes)) err(`npcs.${id}.${t.id}: takes unknown good "${t.takes}"`);
        for (const f of Object.keys(t.standing || {})) if (!has(factions, f)) err(`npcs.${id}.${t.id}: standing faction "${f}" unknown`);
        condOk(`npcs.${id}.${t.id}`, t.requires); condOk(`npcs.${id}.${t.id}`, t.hide);
      }
    }

    for (const [id, p] of Object.entries(places)) {
      for (const e of p.exits || []) {
        if (!has(places, e.to)) err(`places.${id}: exit to unknown place "${e.to}"`);
        condOk(`places.${id}.exit`, e.requires);
      }
      for (const loc of p.locations || []) {
        for (const n of loc.npcs || []) if (!has(npcs, n)) err(`places.${id}.${loc.id}: npc "${n}" is not in npcs.yaml`);
        for (const s of loc.services || []) {
          if (s.faction && !has(factions, s.faction)) err(`places.${id}.${loc.id}: service faction "${s.faction}" unknown`);
          (s.stock || []).forEach((e, i) => { gearSpecOk(`places.${id}.${loc.id}.stock[${i}]`, e); condOk(`places.${id}.${loc.id}.stock[${i}]`, e.req); });
        }
      }
      if (p.map) {
        const legend = p.legend || {};
        const rows = p.map;
        const w = rows[0].length;
        rows.forEach((r, y) => { if (r.length !== w) err(`places.${id}: map row ${y + 1} is ${r.length} wide, expected ${w}`); });
        const marks = new Set(rows.join(''));
        const ground = (G.CONFIG.game || {}).ground || {};
        for (const ch of marks) if (!'#. +'.includes(ch) && !(ch in legend) && !(ch in ground)) err(`places.${id}: map character "${ch}" has no legend entry`);
        for (const ch of Object.keys(legend)) if (ch in ground) err(`places.${id}: legend "${ch}" is a ground letter (rules.yaml game.ground)`);
        const look = p.look || {};
        if (look.ground && !(look.ground in ground)) err(`places.${id}.look.ground: "${look.ground}" is not a ground letter`);
        if (look.tileset && !has(W.tilesets || {}, look.tileset)) err(`places.${id}.look.tileset: "${look.tileset}" is not in tilesets.yaml`);
        for (const ch of Object.keys(legend)) if (!marks.has(ch)) err(`places.${id}: legend "${ch}" is not on the map`);
        for (const [ch, def] of Object.entries(legend)) {
          const at = `places.${id}.legend.${ch}`;
          if (def.kind === 'monster' && !(p.encounters && def.encounter in p.encounters) && !has(G.Enemies.MONSTERS, def.encounter)) err(`${at}: encounter "${def.encounter}" unknown`);
          if (def.kind === 'npc' && !has(npcs, def.npc)) err(`${at}: npc "${def.npc}" unknown`);
          if (def.on && !(def.on in ground)) err(`${at}: on "${def.on}" is not a ground letter`);
          if ((def.kind === 'stairs' || def.kind === 'drop') && !has(places, def.to)) err(`${at}: leads to unknown place "${def.to}"`);
          if ((def.kind === 'stairs' || def.kind === 'drop') && def.at && places[def.to] && places[def.to].map && !places[def.to].map.join('').includes(def.at)) err(`${at}: arrival "${def.at}" is not on ${def.to}'s map`);
          if (def.kind === 'chest' && !has(tables, def.loot)) err(`${at}: loot table "${def.loot}" unknown`);
          if (def.kind === 'pickup' && !goodExists(def.good)) err(`${at}: good "${def.good}" unknown`);
          if (def.key && !goodExists(def.key)) err(`${at}: key "${def.key}" unknown`);
          for (const a of def.alt || []) { condOk(at, a.requires); if (a.takes && !goodExists(a.takes)) err(`${at}: takes unknown good "${a.takes}"`); }
        }
        for (const [eid, e] of Object.entries(p.encounters || {})) {
          for (const f of e.foes || []) {
            if (f.monster && !has(G.Enemies.MONSTERS, f.monster)) err(`places.${id}.encounters.${eid}: monster "${f.monster}" unknown`);
            if (f.template && !has(G.Enemies.TEMPLATES, f.template)) err(`places.${id}.encounters.${eid}: template "${f.template}" unknown`);
          }
          if (e.parley && !has(npcs, e.parley)) err(`places.${id}.encounters.${eid}: parley npc "${e.parley}" unknown`);
        }
        for (const [i, w2] of (p.wandering || []).entries()) for (const f of w2.foes || []) if (f.monster && !has(G.Enemies.MONSTERS, f.monster)) err(`places.${id}.wandering[${i}]: monster "${f.monster}" unknown`);
      }
    }
    for (const [id, q] of Object.entries(quests)) {
      if (q.giver && !has(npcs, q.giver)) err(`quests.${id}: giver "${q.giver}" unknown`);
      if (q.faction && !has(factions, q.faction)) err(`quests.${id}: faction "${q.faction}" unknown`);
      for (const x of q.exclusive || []) if (!has(quests, x)) err(`quests.${id}: exclusive quest "${x}" unknown`);
      (q.stages || []).forEach((st, i) => condOk(`quests.${id}.stages[${i}]`, st.done_when));
      for (const f of Object.keys((q.reward || {}).standing || {})) if (!has(factions, f)) err(`quests.${id}: reward faction "${f}" unknown`);
    }
    const BT = (G.CONFIG.game || {}).bounty;
    if (BT) for (const k of ['on', 'payer']) if (BT[k] && !has(factions, BT[k])) err(`rules.yaml game.bounty.${k}: faction "${BT[k]}" unknown`);
    for (const [kind, K] of Object.entries((G.CONFIG.game || {}).companions || {})) for (const r of K.ranks || []) for (const m of r) if (!has(G.Enemies.MONSTERS, m)) err(`rules.yaml game.companions.${kind}: monster "${m}" unknown`);
    for (const [ch, gd] of Object.entries((G.CONFIG.game || {}).ground || {})) {
      if (ch.length !== 1 || '#. +'.includes(ch)) err(`rules.yaml game.ground: "${ch}" must be one character other than # . + and space`);
      if (gd.fight && !(G.CONFIG.terrain || {})[gd.fight]) err(`rules.yaml game.ground."${ch}": fight terrain "${gd.fight}" unknown`);
      if (gd.under && !((G.CONFIG.game.ground || {})[gd.under])) err(`rules.yaml game.ground."${ch}": under "${gd.under}" is not a ground letter`);
    }
    for (const [id, ts] of Object.entries(W.tilesets || {})) {
      const terr = ts.terrains || {};
      if (!Object.keys(terr).length) err(`tilesets.${id}: no terrains`);
      if (ts.floor && !has(terr, ts.floor)) err(`tilesets.${id}: floor "${ts.floor}" is not one of its terrains`);
      for (const [n, own] of Object.entries(terr)) {
        if (own.like && !has(terr, own.like)) err(`tilesets.${id}.${n}: like "${own.like}" is not one of its terrains`);
        const chain = [];
        for (let d = own; d && chain.length < 8; d = d.like ? terr[d.like] : null) chain.unshift(d);
        const t = Object.assign({}, ...chain);
        if (t.wang && !t.over) err(`tilesets.${id}.${n}: a wang set needs \`over\` (the terrain under it)`);
        if (t.over && !has(terr, t.over)) err(`tilesets.${id}.${n}: over "${t.over}" is not one of its terrains`);
        if (t.corners && (t.corners.some((c) => !/^[UL]{4}$/.test(c)) || new Set(t.corners).size !== 16)) err(`tilesets.${id}.${n}: corners must be codes of four U/L letters covering all 16 (repeats are variants)`);
        if (!t.color && !t.tile && !t.wang) err(`tilesets.${id}.${n}: needs a color, a tile or a wang sheet`);
      }
      for (const [n, pr] of Object.entries(ts.props || {})) if (!Array.isArray(pr) || (pr.length !== 5 && pr.length !== 7)) err(`tilesets.${id}.props.${n}: expected [image, x, y, w, h] or [image, x, y, w, h, dx, dy]`);
    }
    const S = W.start || {};
    if (S.place && !has(places, S.place)) err(`start.yaml: place "${S.place}" unknown`);
    for (const k of S.kits || []) {
      if (k.wield && !has(D.WEAPONS, k.wield)) err(`start.kits.${k.id}: weapon "${k.wield}" unknown`);
      if (k.sidearm && !has(D.WEAPONS, k.sidearm)) err(`start.kits.${k.id}: sidearm "${k.sidearm}" unknown`);
    }
    for (const p of S.presets || []) for (const f of p.feats || []) if (!has(D.FEATS, f)) err(`start.presets.${p.name}: feat "${f}" unknown`);
    for (const t of S.trials || []) {
      if (t.go && !has(places, t.go.to)) err(`start.trials.${t.id}: go to unknown place "${t.go.to}"`);
      for (const p of t.party || []) {
        for (const f of p.feats || []) if (!has(D.FEATS, f)) err(`start.trials.${t.id}.${p.name}: feat "${f}" unknown`);
        if (p.kit && !(S.kits || []).some((k) => k.id === p.kit)) err(`start.trials.${t.id}.${p.name}: kit "${p.kit}" unknown`);
        const sp = p.look && p.look.sprite;
        if (typeof sp === 'string' && sp.startsWith('art:') && !has(W.art || {}, sp.slice(4))) err(`start.trials.${t.id}.${p.name}: art "${sp.slice(4)}" unknown`);
      }
    }
    return out;
  }

  // ---- Loading ------------------------------------------------------------
  function loadSync(dir) {
    const fs = require('fs');
    const path = require('path');
    dir = dir || path.join(__dirname, '..', '..', 'data');
    const texts = {};
    for (const r of REGISTRY) {
      const f = path.join(dir, r.file);
      if (fs.existsSync(f)) texts[r.file] = fs.readFileSync(f, 'utf8');
    }
    return installAll(texts);
  }

  async function load(baseUrl) {
    baseUrl = baseUrl || 'data/';
    const texts = {};
    const bundle = G.BUNDLE; // data/bundle.js: lets index.html open straight from disk (file:// cannot fetch)
    await Promise.all(REGISTRY.map(async (r) => {
      try {
        const res = await fetch(baseUrl + r.file, { cache: 'no-cache' });
        if (res.ok) { texts[r.file] = await res.text(); return; }
      } catch (e) { /* fall through to the bundle */ }
      if (bundle && bundle[r.file] != null) texts[r.file] = bundle[r.file];
    }));
    // A saved Bench patch overrides files for this browser only.
    try {
      const patch = JSON.parse(localStorage.getItem('bbb-content-patch') || '{}');
      for (const f of Object.keys(patch)) texts[f] = patch[f];
    } catch (e) { /* no storage */ }
    return installAll(texts);
  }

  G.Content = { REGISTRY, world, sources, installAll, validate, loadSync, load, applyRules };
})(typeof globalThis !== 'undefined' ? (globalThis.BBB = globalThis.BBB || {}) : {});
