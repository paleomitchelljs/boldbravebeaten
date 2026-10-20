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
            h('li', null, CONFIG.apCurve
              ? `Initiative: d10 + SPD (in armor). AP pool = ${CONFIG.apBase} + SPD/${CONFIG.apSpdDivisor} (6 at SPD 5; −1 below half stamina, −2 below a quarter). Quick actions cost 2 (thrust, parry, dodge, block, a move of up to (1 + ⌊SPD/4⌋) × ${CONFIG.moveScale} squares), a swing 4, a two-handed or power swing 6; weapon speed scales them. Armor adds ${Math.round(CONFIG.armorActionAP * 100) / 100} AP per point of its SPD penalty to every action. Quick feats take up to ${Math.round(CONFIG.quickCut * 100)}% off at their top rank. With nothing spent this round, one action may cost more than the whole pool and take the whole turn.`
              : `Initiative: d10 + SPD (in armor). AP pool = (3 + ⌊SPD/2⌋, −1 below half stamina, −2 below a quarter)${CONFIG.apScale > 1 ? ` × ${CONFIG.apScale}; base action costs are × ${CONFIG.apScale} too, while feats cut a flat 1` : ''}.`),
            h('li', null, 'Turns: in initiative order each character takes one turn and may spend as much of their AP as they like on it. Every action resolves as it is taken.'),
            h('li', null, 'Reactions: when a blow comes at you, you may block, parry or dodge, paying the AP from your pool on the spot. AP you spent on your turn is AP you cannot defend with; out of AP, your armor takes it. A parry cannot meet an arrow, a spell or a power blow.'),
            h('li', null, 'Feint: if the attacker\'s Feint beats your Read Attack you cannot read the blow, so you defend blind, and a defence that cannot meet it is wasted.'),
            h('li', null, 'Opportunity strikes: a step that starts inside a foe\'s melee reach lets them strike at you as you go (once per move, from their AP); a hit stops you. Backing away from a foe provokes; walking up to a sword does not; walking up to a spear does.'),
            h('li', null, 'Fend off: with a long weapon a shove reaches 2 squares (a ready shield adds +1).'),
            h('li', null, 'The round ends when everyone has had their turn; unspent AP is lost. Then bleeding, regeneration and the rest.'),
            h('li', null, 'Range: each attack has a band of squares it works at. Daggers and one-handed swings reach 1; one-handed thrusts and two-handed swings 2; two-handed thrusts 3; spears 4. Inside a long weapon\'s reach, or in a clinch with a sword or spear, its blows are cramped: shove the enemy back, grapple, or draw a dagger.'),
            h('li', null, 'Power swings and longbow shots are wound up (drawn) the round before. While wound up you can\'t block or parry.'),
            h('li', null, 'End of round: bleeding ticks into CON, then stamina regenerates if you took no stamina damage.'))),
        h('section', { class: 'panel' }, h('h2', null, 'One hit'),
          CONFIG.staminaScale > 1 ? h('p', { class: 'small muted' }, `Every action's base stamina cost is × ${CONFIG.staminaScale}, so exertion matters.`) : null,
          h('ol', { class: 'stack tight', style: { paddingLeft: '1.2em', margin: 0 } },
            h('li', null, 'Damage (P/S/B) = striking face × motion multiplier (× origin and enchantment), + STR bonus on the main type.'),
            CONFIG.pierce ? h('li', null, 'A point against armor: if its punch (the weight behind it, × the motion, × STR) reaches the armor\'s resistance it bursts through and the piercing past the armor\'s P mitigation reaches CON. Otherwise d10 + ⌊DEX/4⌋ + Find the Gap / Spot Weakness must reach the armor\'s gap number (a 10 always does; a pinned foe always gives one): all the piercing reaches CON. Failing that the armor turns the point: half its piercing lands as blunt, and the weapon wears hard.') : null,
            h('li', null, CONFIG.pierce ? 'Slashing and blunt: subtract mitigation per type (scaled by durability). Leftover slashing converts to blunt (thrust 0.2, swing 0.33, two-handed 0.5, power 0.66). Blunt hits stamina.' : CONFIG.pierceMode === 'roll'
              ? 'Armored: subtract mitigation per type (scaled by durability). Each leftover point of piercing rolls a d10 and reaches CON on 5 or less (2 or less against plate). Leftover slashing converts to blunt (thrust 0.2, swing 0.33, two-handed 0.5, power 0.66). Blunt hits stamina.'
              : 'Armored: subtract mitigation per type (scaled by durability). Half the leftover piercing reaches CON. Leftover slashing converts to blunt (thrust 0.2, swing 0.33, two-handed 0.5, power 0.66). Blunt hits stamina.'),
            h('li', null, 'Unarmored: piercing to CON; each point of slashing rolls a d4 (1 STR, 2 CON, 3 SPD, 4 DEX); blunt to stamina.'),
            h('li', null, 'At 0 stamina everything goes straight to attributes. CON 0 is death.'),
            h('li', null, 'P and S that reach attributes bleed: the wound costs its damage again in CON over 3 rounds unless bandaged.')))),
      h('section', { class: 'panel' }, h('h2', null, 'Armor'),
        table(['Armor', 'Usual material', 'Mit. P', 'Mit. S', 'Mit. B', 'SPD −', 'DEX −', 'Stamina +', 'Regen −', 'Durability', 'Points burst at', 'Gap'],
          Object.entries(D.ARMOR).filter(([, a]) => !a.natural).map(([k, a]) => [a.name, (D.MATERIALS[a.material] || {}).name || '—', a.mit.P, a.mit.S, a.mit.B, a.spd, a.dex, a.stamina, a.regen, a.durability, a.pierce ? a.pierce.resist : '—', a.pierce ? a.pierce.gap : '—'])),
        h('p', { class: 'small muted' }, 'Every piece is a type plus a material, an origin, a craftsmanship and (rarely) enchantments. Material and origin scale protection (P and S mitigation, the punch needed to burst it) and weight (the penalties); craftsmanship sets how fast it wears and how easily it breaks. Half coverage: −1 mitigation and penalties, gap −2; partial −2 and −4.'),
        table(['Material', 'Protection', 'Weight', 'Toughness', 'Hardness'], Object.values(D.MATERIALS).filter((m) => m.metal || ['cloth', 'leather'].includes(m.name.toLowerCase()) || m.exotic).map((m) => [m.name + (m.exotic ? ' (exotic)' : ''), '×' + m.protect, '×' + m.weight, '×' + m.toughness, m.hardness])),
        table(['Origin', 'Weight', 'Protection', 'Damage', 'Durability'], Object.values(D.ORIGINS).map((o) => [o.name || 'Common', '×' + o.weight, '×' + o.protect, '×' + o.damage, '×' + o.durability])),
        table(['Craftsmanship', 'Durability', 'Wear taken', 'Shield break threshold'], Object.values(D.CRAFTS).map((c) => [c.name || 'Average', '×' + c.durability, '×' + c.wear, '×' + c.break + (c.unbreakable ? ', a power blow cannot shatter it' : '')]))),
      h('div', { class: 'grid-2' },
        h('section', { class: 'panel' }, h('h2', null, 'Weapons'),
          table(['Weapon', 'Hands', 'Mass', 'Weight', 'Reach', 'Faces P/S/B', 'Punch', 'Vital (d10)', 'STR ×'],
            Object.entries(D.WEAPONS).filter(([, w]) => !w.natural).map(([k, w]) => {
              const s = Items.weaponStats(k);
              const vital = Object.entries(s.wound).filter(([, x]) => G.Combat.vitalNeed(x.vital) > 0).map(([f, x]) => `${f} ≤${G.Combat.vitalNeed(x.vital)}`).join(', ') || '—';
              const str = [...new Set(w.motions.filter((m) => m !== 'shoot').map((m) => (s.strMult[m] != null ? s.strMult[m] : 1).toFixed(1)))].join('–') || '—';
              const punch = Object.entries(s.punch || {}).map(([f, x]) => `${f} ${x}`).join(', ') || '—';
              return [w.name, w.hands === 1.5 ? '1½' : w.hands, w.phys && w.phys.mass ? w.phys.mass + ' kg' : '—', s.weight, w.reachName, Object.entries(s.faces).map(([f, v]) => `${f} ${v.join('/')}`).join(', '), punch, vital, str];
            })),
          CONFIG.weaponModel === 'physical' ? h('p', { class: 'small muted' }, 'Worked out from each weapon\'s mass, length and point, edge or head. Vital: a blow that reaches the body rolls a d10; at or under the number it is a vital wound (armor lowers the odds). STR ×: how much of the STR bonus the blow gets.') : null),
        h('section', { class: 'panel' }, h('h2', null, 'Shields'),
          table(['Shield', 'Block AP', 'Break above', 'Durability'], Object.values(D.SHIELDS).map((s) => [s.name, s.blockAP, s.threshold, s.durability])),
          h('p', { class: 'small muted' }, 'Material multiplies threshold and durability: wood ×1.0, hide-faced ×1.2, iron-rimmed ×1.5, steel ×2.0, adamant ×3.5. Craftsmanship multiplies durability and the break threshold (poor ×0.7, masterwork ×1.4); origin protection multiplies the threshold.'))),
      h('section', { class: 'panel' },
        h('div', { class: 'panel-head' }, h('h2', null, 'Placeholder rulings'), h('span', { class: 'small muted' }, 'Edit in src/rules/config.js')),
        h('p', { class: 'small muted' }, 'The Mechanics Outline marks these as Open. The platform needs some answer to run, so it uses these until playtesting or simulation settles them.'),
        h('ul', { class: 'stack tight', style: { paddingLeft: '1.2em', margin: 0 } }, CONFIG.provisional.map((p) => h('li', null, p)))),
      h('section', { class: 'panel' }, h('h2', null, 'Not in the platform yet'),
        h('p', { class: 'small' }, 'Rituals, information magic (reading, divining, speaking with the dead), the mind spells, the social system, stealth, and feats marked "table ruling" on the sheet. Feats from those systems can still be recorded on sheets and ruled by the GM.')));
  }

  UI.Views.rules = view;
})(globalThis.BBB);
