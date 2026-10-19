/*
 * The Test Bench: the alternate frame for working on the game itself.
 *   Content   edit any data/*.yaml in the browser, validate, apply live, keep as a local patch
 *   Simulate  run many AI-vs-AI fights from the real content, to see how a style fares in a setting
 *   Tools     links to the GM table, debug mode, and moving a saved party into the GM table
 * Nothing here changes the files on disk. Edit in the browser, then copy or download the file into data/.
 */
(function (G) {
  'use strict';
  const UI = G.UI;
  const { h, toast } = UI;
  const C = G.Character;

  const PATCH_KEY = 'bbb-content-patch';
  const bench = { tab: 'content', file: 'monsters.yaml', draft: {}, msgs: [], sim: { running: false, rows: [], progress: 0 } };

  const readPatch = () => { try { return JSON.parse(localStorage.getItem(PATCH_KEY) || '{}'); } catch (e) { return {}; } };
  const writePatch = (p) => { try { localStorage.setItem(PATCH_KEY, JSON.stringify(p)); return true; } catch (e) { return false; } };
  const files = () => G.Content.REGISTRY.map((r) => r.file).filter((f) => G.Content.sources[f] != null);

  function render() {
    const root = document.getElementById('app');
    root.innerHTML = '';
    document.documentElement.dataset.mode = 'bench';
    const tabs = [['content', 'Content'], ['sim', 'Simulate'], ['tools', 'Tools']];
    root.appendChild(h('div', { class: 'bench shell' },
      h('div', { class: 'view-head' }, h('div', { class: 'stack tight' }, h('span', { class: 'label' }, 'Test bench'), h('h1', null, 'Edit, check, simulate'),
        h('p', { class: 'muted' }, 'The game is its data. Change a monster, an item, a faction or a map here, see whether it holds together, and run it against a party before you commit it.')),
        h('div', { class: 'row' }, h('a', { class: 'button', href: 'index.html' }, '← The game'), h('a', { class: 'button', href: 'gm.html' }, 'GM table'))),
      h('div', { class: 'tabs' }, tabs.map(([id, l]) => h('button', { class: `tab ${bench.tab === id ? 'active' : ''}`, onclick: () => { bench.tab = id; render(); } }, l))),
      bench.tab === 'content' ? contentTab() : bench.tab === 'sim' ? simTab() : toolsTab()));
  }

  // ---- Content -----------------------------------------------------------------------------------------------
  function contentTab() {
    const list = files();
    const patch = readPatch();
    const cur = bench.file;
    const text = bench.draft[cur] != null ? bench.draft[cur] : G.Content.sources[cur] || '';
    const warnings = G.Content.validate();
    return h('div', { class: 'stack' },
      h('div', { class: 'row' },
        h('label', { class: 'inline' }, h('span', { class: 'label' }, 'File'),
          h('select', { id: 'bench-file', onchange: (e) => { bench.file = e.target.value; bench.msgs = []; render(); } }, list.map((f) => h('option', { value: f, selected: f === cur }, f + (patch[f] ? ' (patched)' : ''))))),
        h('button', { onclick: () => check(false) }, 'Check'),
        h('button', { class: 'primary', onclick: () => check(true) }, 'Apply to this browser'),
        h('button', { onclick: () => download(cur, document.getElementById('bench-text').value) }, 'Download'),
        h('button', { onclick: () => { const p = readPatch(); delete p[cur]; writePatch(p); delete bench.draft[cur]; toast('Patch removed; reload to use the file on disk'); render(); } }, 'Drop this patch'),
        h('button', { onclick: () => upload() }, 'Load from a file…')),
      h('textarea', { id: 'bench-text', class: 'yaml', spellcheck: 'false', value: text, oninput: (e) => { bench.draft[cur] = e.target.value; } }),
      bench.msgs.length ? h('div', { class: 'panel stack tight' }, bench.msgs.map((m) => h('p', { class: `small ${m.cls || ''}` }, m.text))) : null,
      h('details', { class: 'panel', open: warnings.length > 0 }, h('summary', null, h('h3', null, warnings.length ? `Cross-reference problems (${warnings.length})` : 'Cross-references: all good')),
        warnings.length ? h('ul', null, warnings.map((w) => h('li', { class: 'mono small' }, w))) : h('p', { class: 'small muted' }, 'Every id used in one file exists in the file it points to; every map is rectangular and fully reachable by its legend.')),
      h('p', { class: 'small muted' }, 'Applying replaces the catalog in this tab right away and keeps your edit in this browser (a "patch") across reloads. The files on disk are untouched. To make a change permanent, download the file and put it in data/.'));
  }

  function check(apply) {
    const cur = bench.file;
    const text = document.getElementById('bench-text').value;
    bench.draft[cur] = text;
    const texts = {};
    for (const f of files()) texts[f] = f === cur ? text : G.Content.sources[f];
    // Parse alone first, so a syntax error leaves the live content alone.
    try { G.Yaml.parse(text); } catch (e) { bench.msgs = [{ text: e.message, cls: 'bad' }]; render(); return; }
    if (!apply) { bench.msgs = [{ text: 'Valid YAML.', cls: 'good' }]; render(); return; }
    const before = Object.assign({}, G.Content.sources);
    const res = G.Content.installAll({ [cur]: text });
    if (!res.ok) { bench.msgs = res.errors.map((t) => ({ text: t, cls: 'bad' })); render(); return; }
    const p = readPatch(); p[cur] = text; writePatch(p);
    G.Content.sources[cur] = text;
    delete bench.draft[cur];
    bench.msgs = [{ text: `Applied ${cur}. ${res.warnings.length ? res.warnings.length + ' cross-reference problem(s) below.' : 'Everything still lines up.'}`, cls: res.warnings.length ? 'warn' : 'good' }];
    render();
  }

  function download(name, text) {
    const a = h('a', { href: URL.createObjectURL(new Blob([text], { type: 'text/yaml' })), download: name });
    document.body.appendChild(a); a.click(); setTimeout(() => a.remove(), 1000);
  }
  function upload() {
    const input = h('input', { type: 'file', accept: '.yaml,.yml,text/yaml', style: { display: 'none' }, onchange: async (e) => { const f = e.target.files[0]; if (f) { bench.draft[bench.file] = await f.text(); render(); } } });
    document.body.appendChild(input); input.click(); setTimeout(() => input.remove(), 60000);
  }

  // ---- Simulate --------------------------------------------------------------------------------------------------
  const ARMORS = [['', 'as they are'], ['none', 'none'], ['padded', 'padded'], ['leather', 'leather'], ['mail', 'mail'], ['scale', 'scale'], ['plate', 'plate']];

  function foeOptions() {
    const out = [];
    for (const [id, m] of Object.entries(G.Enemies.MONSTERS)) out.push([`m:${id}`, m.name + (m.group ? ' (group)' : '')]);
    for (const [id, t] of Object.entries(G.Enemies.TEMPLATES)) out.push([`t:${id}`, t.name + ' (human, by level)']);
    return out;
  }

  function simSetup() {
    return bench.simCfg || (bench.simCfg = { foe: 'm:wolfPack', level: 2, n: 30, armor: '', plev: 1, shield: true });
  }

  function foeSpec(sel, level) {
    const [kind, id] = sel.split(':');
    return kind === 'm' ? { foes: [{ monster: id }] } : { foes: [{ template: id, level, n: 2 }] };
  }

  async function runSim() {
    const cfg = simSetup();
    const S = bench.sim;
    if (S.running) return;
    S.running = true; S.progress = 0; render();
    const results = { n: 0, won: 0, lost: 0, draw: 0, rounds: 0, dead: 0, down: 0, hurt: 0 };
    const spec = foeSpec(cfg.foe, cfg.level);
    G.Rand.seed(12345);
    for (let i = 0; i < cfg.n; i++) {
      const w = G.World.create(G.World.presetParty(), { log: false });
      const party = G.World.party(w);
      if (cfg.plev > 1) G.World.grantXP(w, G.World.xpFor(cfg.plev));
      for (const c of party) {
        if (cfg.armor === 'none') c.armor = null;
        else if (cfg.armor) c.armor = G.Items.makeArmor(cfg.armor, 'full', 'standard');
        if (!cfg.shield) c.shield = null;
        c.stamina = C.maxStamina(c);
      }
      G.Battle.start(w, spec);
      const enc = await G.Auto.battle(w, { maxRounds: 40 });
      results.n++;
      results.rounds += enc.round;
      results[enc.winner === 'party' ? 'won' : enc.winner === 'enemy' ? 'lost' : 'draw']++;
      results.dead += party.filter((c) => c.status.dead).length;
      results.down += party.filter((c) => !C.isActive(c)).length;
      results.hurt += party.reduce((t, c) => t + C.totalDamage(c), 0);
      if (i % 3 === 2) { S.progress = (i + 1) / cfg.n; render(); await new Promise((r) => setTimeout(r, 0)); }
    }
    S.running = false;
    const label = (foeOptions().find((o) => o[0] === cfg.foe) || [0, cfg.foe])[1];
    S.rows.unshift({ label: `${label}${cfg.foe[0] === 't' ? ' L' + cfg.level : ''}`, armor: (ARMORS.find((a) => a[0] === cfg.armor) || [0, ''])[1], shield: cfg.shield ? 'shields' : 'no shields', plev: cfg.plev, r: results });
    S.rows = S.rows.slice(0, 40);
    render();
  }

  function simTab() {
    const cfg = simSetup();
    const S = bench.sim;
    const set = (k, conv) => (e) => { cfg[k] = conv ? conv(e.target.value) : e.target.value; };
    const pct = (a, n) => Math.round(100 * a / Math.max(1, n)) + '%';
    return h('div', { class: 'stack' },
      h('p', { class: 'muted' }, 'The example party (a shield-and-sword fighter, an archer, a hammer fighter, a caster) against an encounter, played out by the AI on both sides. Use it to ask where a thing matters: what changes when the whole party wears plate, or loses its shields, or meets a foe built to counter them. Wins are not meant to be even.'),
      h('div', { class: 'row' },
        h('label', { class: 'inline' }, h('span', { class: 'label' }, 'Foe'), h('select', { onchange: set('foe') }, foeOptions().map(([v, l]) => h('option', { value: v, selected: v === cfg.foe }, l)))),
        h('label', { class: 'inline' }, h('span', { class: 'label' }, 'Foe level'), h('input', { type: 'number', value: cfg.level, min: 1, max: 12, onchange: set('level', Number) })),
        h('label', { class: 'inline' }, h('span', { class: 'label' }, 'Party level'), h('input', { type: 'number', value: cfg.plev, min: 1, max: 10, onchange: set('plev', Number) })),
        h('label', { class: 'inline' }, h('span', { class: 'label' }, 'Party armor'), h('select', { onchange: set('armor') }, ARMORS.map(([v, l]) => h('option', { value: v, selected: v === cfg.armor }, l)))),
        h('label', { class: 'inline' }, h('input', { type: 'checkbox', checked: cfg.shield, onchange: (e) => { cfg.shield = e.target.checked; } }), 'Shields'),
        h('label', { class: 'inline' }, h('span', { class: 'label' }, 'Fights'), h('input', { type: 'number', value: cfg.n, min: 5, max: 400, onchange: set('n', Number) })),
        h('button', { class: 'primary', disabled: S.running, onclick: runSim }, S.running ? `Running ${Math.round(S.progress * 100)}%` : 'Run')),
      S.rows.length ? h('table', { class: 'data' }, h('thead', null, h('tr', null, ['Foe', 'Party', 'Fights', 'Won', 'Lost', 'Draw', 'Rounds', 'Dead / fight', 'Wounds / fight'].map((t, i) => h('th', { class: i > 1 ? 'n' : '' }, t)))),
        h('tbody', null, S.rows.map((x) => h('tr', null,
          h('td', null, x.label), h('td', null, `L${x.plev}, ${x.armor} armor, ${x.shield}`), h('td', { class: 'n' }, x.r.n), h('td', { class: 'n' }, pct(x.r.won, x.r.n)), h('td', { class: 'n' }, pct(x.r.lost, x.r.n)), h('td', { class: 'n' }, pct(x.r.draw, x.r.n)),
          h('td', { class: 'n' }, (x.r.rounds / x.r.n).toFixed(1)), h('td', { class: 'n' }, (x.r.dead / x.r.n).toFixed(2)), h('td', { class: 'n' }, (x.r.hurt / x.r.n).toFixed(1)))))) : null);
  }

  // ---- Tools ----------------------------------------------------------------------------------------------------------
  function toolsTab() {
    const auto = G.Save.read('auto');
    return h('div', { class: 'stack' },
      h('section', { class: 'panel stack' }, h('h3', null, 'Play with debug tools'),
        h('p', { class: 'muted' }, 'Opens the game with the debug panel (Menu → Debug): gold, XP, teleport, any monster, faction standing, reveal map. Your content patches apply.'),
        h('div', { class: 'row' }, h('button', { onclick: () => { try { localStorage.setItem('bbb-debug', '1'); } catch (e) { /* none */ } location.href = 'index.html?debug=1'; } }, 'Open the game in debug mode'))),
      h('section', { class: 'panel stack' }, h('h3', null, 'The GM table'),
        h('p', { class: 'muted' }, 'The original tabletop tools: sheets, enemy generator, a battle with typed dice, the Lore tab for rituals, and the Rules tab listing every provisional number.'),
        h('div', { class: 'row' }, h('a', { class: 'button', href: 'gm.html' }, 'Open the GM table'),
          h('button', { disabled: !auto, onclick: () => sendToTable(auto.world) }, auto ? 'Copy my autosave party into the GM table' : 'No autosave to copy'))),
      h('section', { class: 'panel stack' }, h('h3', null, 'Content patches'),
        h('p', { class: 'muted' }, Object.keys(readPatch()).length ? 'Patched files: ' + Object.keys(readPatch()).join(', ') : 'No patches: the game reads data/ as it is.'),
        h('div', { class: 'row' }, UI.confirmButton('Drop all patches', 'Drop all?', () => { writePatch({}); toast('Patches dropped; reload'); render(); }))),
      h('section', { class: 'panel stack' }, h('h3', null, 'On the command line'),
        h('pre', { class: 'mono small' }, 'node --test                 # rules, content and game tests\nnode tools/validate.js      # cross-reference check of data/\nnode tools/bundle.js        # data/bundle.js, so index.html opens from disk\nnode tools/playthrough.js   # a bot plays the first dungeon\nnode sim/arena.js           # the armor-by-style arena (rules sims)')));
  }

  function sendToTable(world) {
    const s = UI.Store.emptyState();
    for (const id of world.partyIds) { s.characters[id] = JSON.parse(JSON.stringify(world.chars[id])); s.order.push(id); }
    s.selected = s.order[0];
    UI.Store.save(s);
    toast('Copied. Open the GM table.');
  }

  UI.Bench = { render, bench };
  window.addEventListener('DOMContentLoaded', () => {});
})(globalThis.BBB);
