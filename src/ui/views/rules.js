/* Rules reference and table settings. */
(function (G) {
  'use strict';
  const UI = G.UI;
  const { h, select } = UI;
  const D = G.DATA;
  const CONFIG = G.CONFIG;
  const Items = G.Items;

  function table(head, rows) {
    return h('div', { class: 'scroll-x' }, h('table', { class: 'data' },
      h('thead', null, h('tr', null, head.map((x, i) => h('th', { class: i ? 'n' : '' }, x)))),
      h('tbody', null, rows.map((r) => h('tr', null, r.map((x, i) => h('td', { class: i ? 'n' : '' }, x)))))));
  }

  function view(app) {
    const st = app.state.settings;
    return h('div', { class: 'stack', style: { gap: '20px' } },
      h('div', { class: 'view-head' }, h('div', { class: 'stack tight' }, h('h1', null, 'Rules & table'),
        h('p', { class: 'muted' }, 'How the platform runs a round, the numbers it uses, and every placeholder ruling standing in for a rule the design docs leave open.'))),
      h('section', { class: 'panel' },
        h('h2', null, 'Table settings'),
        h('div', { class: 'row', style: { gap: '18px' } },
          h('label', { class: 'field', for: 'set-dice' }, h('span', { class: 'label' }, 'Dice'),
            select('set-dice', st.autoRoll, [['auto-only', 'Players enter their own rolls; auto characters roll themselves'], ['none', 'Everyone enters rolls (GM too)'], ['all', 'Roll everything automatically']], (v) => { st.autoRoll = v; app.save(); app.render(); })),
          h('label', { class: 'inline', for: 'set-ai' }, h('input', { id: 'set-ai', type: 'checkbox', checked: st.aiEnemies, onchange: (e) => { st.aiEnemies = e.target.checked; app.save(); } }), 'AI declares for characters set to roll automatically'),
          h('label', { class: 'inline', for: 'set-gm' }, h('input', { id: 'set-gm', type: 'checkbox', checked: st.gmView, onchange: (e) => { st.gmView = e.target.checked; app.save(); } }), 'GM view: show everyone\'s remaining AP and hidden attacks'))),
      h('div', { class: 'grid-2' },
        h('section', { class: 'panel' }, h('h2', null, 'A round'),
          h('ol', { class: 'stack tight', style: { paddingLeft: '1.2em', margin: 0 } },
            h('li', null, 'Initiative: d10 + SPD (in armor). AP pool = 3 + ⌊SPD/2⌋, −1 below half stamina, −2 below a quarter.'),
            h('li', null, 'Declaration passes in initiative order. Each character declares one action and pays its AP, or ends their round. No holding AP.'),
            h('li', null, 'Strikes are visible to everyone (type and AP) unless the attacker\'s Feint rank beats your Read Attack.'),
            h('li', null, 'To defend, answer a specific declared strike with block, parry or dodge.'),
            h('li', null, 'Resolution replays pass by pass. Actions in the same pass are simultaneous, so two killing blows both land. A strike whose target is down or out of reach fizzles.'),
            h('li', null, 'End of round: bleeding ticks into CON, then stamina regenerates if you took no stamina damage.'))),
        h('section', { class: 'panel' }, h('h2', null, 'One hit'),
          h('ol', { class: 'stack tight', style: { paddingLeft: '1.2em', margin: 0 } },
            h('li', null, 'Damage (P/S/B) = striking face × motion multiplier, + STR bonus and quality on the main type.'),
            h('li', null, 'Armored: subtract mitigation per type (scaled by durability). Half the leftover piercing reaches CON. Leftover slashing converts to blunt (thrust 0.2, swing 0.33, two-handed 0.5, power 0.66). Blunt hits stamina.'),
            h('li', null, 'Unarmored: piercing to CON; each point of slashing rolls a d4 (1 STR, 2 CON, 3 SPD, 4 DEX); blunt to stamina.'),
            h('li', null, 'At 0 stamina everything goes straight to attributes. CON 0 is death.'),
            h('li', null, 'P and S that reach attributes bleed: the wound costs its damage again in CON over 3 rounds unless bandaged.')))),
      h('section', { class: 'panel' }, h('h2', null, 'Armor'),
        table(['Armor', 'Mit. P', 'Mit. S', 'Mit. B', 'SPD −', 'DEX −', 'Stamina +', 'Regen −', 'Durability'],
          Object.entries(D.ARMOR).map(([k, a]) => [a.name, a.mit.P, a.mit.S, a.mit.B, a.spd, a.dex, a.stamina, a.regen, CONFIG.armorDurability[k]]))),
      h('div', { class: 'grid-2' },
        h('section', { class: 'panel' }, h('h2', null, 'Weapons'),
          table(['Weapon', 'Hands', 'Weight', 'Reach', 'Faces P/S/B'],
            Object.values(D.WEAPONS).map((w) => [w.name, w.hands === 1.5 ? '1½' : w.hands, w.weight, w.reachName, Object.entries(w.faces).map(([f, v]) => `${f} ${v.join('/')}`).join(', ')]))),
        h('section', { class: 'panel' }, h('h2', null, 'Shields'),
          table(['Shield', 'Block AP', 'Break above', 'Durability'], Object.values(D.SHIELDS).map((s) => [s.name, s.blockAP, s.threshold, s.durability])),
          h('p', { class: 'small muted' }, 'Material multiplies threshold and durability: wood ×1.0, hide-faced ×1.2, iron-rimmed ×1.5, steel ×2.0. Quality: crude ×0.6, fine ×1.3, masterwork ×1.6.'))),
      h('section', { class: 'panel' },
        h('div', { class: 'panel-head' }, h('h2', null, 'Placeholder rulings'), h('span', { class: 'small muted' }, 'Edit in src/rules/config.js')),
        h('p', { class: 'small muted' }, 'The Mechanics Outline marks these as Open. The platform needs some answer to run, so it uses these until playtesting or simulation settles them.'),
        h('ul', { class: 'stack tight', style: { paddingLeft: '1.2em', margin: 0 } }, CONFIG.provisional.map((p) => h('li', null, p)))),
      h('section', { class: 'panel' }, h('h2', null, 'Not in the platform yet'),
        h('p', { class: 'small' }, 'Magic (words, spell points, backlash), the social system, terrain and stealth, and feats marked "table ruling" on the sheet. Feats from those systems can still be recorded on sheets and ruled by the GM.')));
  }

  UI.Views.rules = view;
})(globalThis.BBB);
