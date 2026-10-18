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
          h('label', { class: 'inline', for: 'set-ai' }, h('input', { id: 'set-ai', type: 'checkbox', checked: st.aiEnemies, onchange: (e) => { st.aiEnemies = e.target.checked; app.save(); } }), 'AI takes turns for characters set to roll automatically'),
          h('label', { class: 'inline', for: 'set-gm' }, h('input', { id: 'set-gm', type: 'checkbox', checked: st.gmView, onchange: (e) => { st.gmView = e.target.checked; app.save(); } }), 'GM view: show everyone\'s remaining AP and hidden attacks'))),
      h('div', { class: 'grid-2' },
        h('section', { class: 'panel' }, h('h2', null, 'A round'),
          h('ol', { class: 'stack tight', style: { paddingLeft: '1.2em', margin: 0 } },
            h('li', null, `Initiative: d10 + SPD (in armor). AP pool = (3 + ⌊SPD/2⌋, −1 below half stamina, −2 below a quarter)${CONFIG.apScale > 1 ? ` × ${CONFIG.apScale}; base action costs are × ${CONFIG.apScale} too, while feats cut a flat 1` : ''}.`),
            h('li', null, 'Turns: in initiative order each character takes a turn. A turn can hold several actions' + (CONFIG.apPerPass ? `, up to ${CONFIG.apPerPass * (CONFIG.apScale || 1)} AP per pass` : '') + '. An action costing more than the AP left in the pass keeps paying from the next passes and lands when it is fully paid.'),
            h('li', null, 'A pass is one set of everyone\'s turns. Strikes are visible to everyone (type and AP) unless the attacker\'s Feint rank beats your Read Attack.'),
            h('li', null, 'Guards: on your turn you can ready a block, parry or dodge. It meets the next attack that lands on you this pass, or the next from a foe you name, and lapses at the end of the pass. A parry can\'t meet an arrow or spell; it waits for the next blow.'),
            h('li', null, 'Ready a thrust: hold a sword, rapier or spear point ready (its AP now, its stamina only if made). The first foe (or the one you name) whose move this pass brings them closer and into its reach is thrust at where they enter; a hit stops the advance. Their guards meet it as usual.'),
            h('li', null, 'Fend off: with a long weapon a shove reaches 2 squares (a ready shield adds +1). A foe shoved back or floored can\'t make their move that pass.'),
            h('li', null, 'When everyone has had a turn the pass resolves: its actions land together, in initiative order, so two killing blows both land. A strike whose target is down or out of reach fizzles. Moves land last.'),
            h('li', null, 'Passes repeat while anyone has AP and something to do. Those who spend early sit out the last passes; unspent AP is lost when the round ends.'),
            h('li', null, 'Range: each attack has a band of squares it works at (1 = clinch, 2 = sword distance). Inside a long weapon\'s reach you can\'t use it: shove the enemy back, grapple, or draw a dagger.'),
            h('li', null, 'Power swings and longbow shots are wound up (drawn) the round before. While wound up you can\'t block or parry.'),
            h('li', null, 'End of round: bleeding ticks into CON, then stamina regenerates if you took no stamina damage.'))),
        h('section', { class: 'panel' }, h('h2', null, 'One hit'),
          CONFIG.staminaScale > 1 ? h('p', { class: 'small muted' }, `Every action's base stamina cost is × ${CONFIG.staminaScale}, so exertion matters.`) : null,
          h('ol', { class: 'stack tight', style: { paddingLeft: '1.2em', margin: 0 } },
            h('li', null, 'Damage (P/S/B) = striking face × motion multiplier, + STR bonus and quality on the main type.'),
            h('li', null, CONFIG.pierceMode === 'roll'
              ? 'Armored: subtract mitigation per type (scaled by durability). Each leftover point of piercing rolls a d10 and reaches CON on 5 or less (2 or less against plate). Leftover slashing converts to blunt (thrust 0.2, swing 0.33, two-handed 0.5, power 0.66). Blunt hits stamina.'
              : 'Armored: subtract mitigation per type (scaled by durability). Half the leftover piercing reaches CON. Leftover slashing converts to blunt (thrust 0.2, swing 0.33, two-handed 0.5, power 0.66). Blunt hits stamina.'),
            h('li', null, 'Unarmored: piercing to CON; each point of slashing rolls a d4 (1 STR, 2 CON, 3 SPD, 4 DEX); blunt to stamina.'),
            h('li', null, 'At 0 stamina everything goes straight to attributes. CON 0 is death.'),
            h('li', null, 'P and S that reach attributes bleed: the wound costs its damage again in CON over 3 rounds unless bandaged.')))),
      h('section', { class: 'panel' }, h('h2', null, 'Armor'),
        table(['Armor', 'Mit. P', 'Mit. S', 'Mit. B', 'SPD −', 'DEX −', 'Stamina +', 'Regen −', 'Durability'],
          Object.entries(D.ARMOR).filter(([, a]) => !a.natural).map(([k, a]) => [a.name, a.mit.P, a.mit.S, a.mit.B, a.spd, a.dex, a.stamina, a.regen, CONFIG.armorDurability[k]]))),
      h('div', { class: 'grid-2' },
        h('section', { class: 'panel' }, h('h2', null, 'Weapons'),
          table(['Weapon', 'Hands', 'Mass', 'Weight', 'Reach', 'Faces P/S/B', 'Vital (d10)', 'STR ×'],
            Object.entries(D.WEAPONS).filter(([, w]) => !w.natural).map(([k, w]) => {
              const s = Items.weaponStats(k);
              const vital = Object.entries(s.wound).filter(([, x]) => G.Combat.vitalNeed(x.vital) > 0).map(([f, x]) => `${f} ≤${G.Combat.vitalNeed(x.vital)}`).join(', ') || '—';
              const str = [...new Set(w.motions.filter((m) => m !== 'shoot').map((m) => (s.strMult[m] != null ? s.strMult[m] : 1).toFixed(1)))].join('–') || '—';
              return [w.name, w.hands === 1.5 ? '1½' : w.hands, w.phys && w.phys.mass ? w.phys.mass + ' kg' : '—', s.weight, w.reachName, Object.entries(s.faces).map(([f, v]) => `${f} ${v.join('/')}`).join(', '), vital, str];
            })),
          CONFIG.weaponModel === 'physical' ? h('p', { class: 'small muted' }, 'Worked out from each weapon\'s mass, length and point, edge or head. Vital: a blow that reaches the body rolls a d10; at or under the number it is a vital wound (armor lowers the odds). STR ×: how much of the STR bonus the blow gets.') : null),
        h('section', { class: 'panel' }, h('h2', null, 'Shields'),
          table(['Shield', 'Block AP', 'Break above', 'Durability'], Object.values(D.SHIELDS).map((s) => [s.name, s.blockAP, s.threshold, s.durability])),
          h('p', { class: 'small muted' }, 'Material multiplies threshold and durability: wood ×1.0, hide-faced ×1.2, iron-rimmed ×1.5, steel ×2.0. Quality: crude ×0.6, fine ×1.3, masterwork ×1.6.'))),
      h('section', { class: 'panel' },
        h('div', { class: 'panel-head' }, h('h2', null, 'Placeholder rulings'), h('span', { class: 'small muted' }, 'Edit in src/rules/config.js')),
        h('p', { class: 'small muted' }, 'The Mechanics Outline marks these as Open. The platform needs some answer to run, so it uses these until playtesting or simulation settles them.'),
        h('ul', { class: 'stack tight', style: { paddingLeft: '1.2em', margin: 0 } }, CONFIG.provisional.map((p) => h('li', null, p)))),
      h('section', { class: 'panel' }, h('h2', null, 'Not in the platform yet'),
        h('p', { class: 'small' }, 'Rituals, information magic (reading, divining, speaking with the dead), the mind spells, the social system, stealth, and feats marked "table ruling" on the sheet. Feats from those systems can still be recorded on sheets and ruled by the GM.')));
  }

  UI.Views.rules = view;
})(globalThis.BBB);
