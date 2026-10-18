# Simulation findings

## The cleric: Restore + Life, Wide and Name (gauntlet)

The cleric is a mage in mail with a mace who knows Life, Light and Force. Its spells are Restore
(plain, Wide and Name) and a Strike bolt; Light doubles against the undead. It was run as the
fourth member with the core trio, 100 runs per mode, paired with the other lineups.

| | Attrition: rooms cleared | Reset: rooms won | Adds (attrition / reset) | Dies |
|---|---|---|---|---|
| + Cleric | 3.10 | 5.14 | +1.19 / +1.55 | 61% of runs / 1.8 per 8 rooms |
| + Mage | 2.81 | 5.23 | +0.90 / +1.64 | 94% / 3.6 |
| + Enchanter | 2.19 | 4.71 | +0.28 / +1.12 | 99% / 5.0 |
| + Duelist | 3.78 | 6.11 | +1.87 / +2.52 | 80% / — |

- **Under attrition, the cleric is the second-best fourth member,** behind the duelist and level
  with the grappler. Healing keeps the party going: 95% clear the kennels, against 85% with the
  mage.
- **It has a room of its own: the crypt.** It wins there 30% of the time, the best of any lineup
  (duelist 25%, mage 11%). Light burns the skeletons.
- **It's weaker than the mage against bands** (the kobold warren: 21% against 42%).
- **It survives where the other casters don't.** It dies about half as often as the mage, because
  it wears mail and its party keeps itself standing.

## The gauntlet: an eight-room crawl (`sim/gauntlet.js`)

A level-5 party fights eight rooms in order, from goblins to the troll chieftain. The rooms have
pillars, pits, rough ground, darkness, hot coals and hidden trap runes. There are two modes, each
with 100 runs per lineup and the same seeds for every lineup:

- **Attrition:** one party goes through all eight rooms. Wounds, spell points, arrows and shield
  damage carry on. There is a breather between rooms and a camp (the long-rest rules) after room 4.
  The run ends at the first room lost.
- **Reset:** a fresh, full-strength party fights every room, with the dead restored. Every room is
  tested, and deaths are recorded room by room.

The lineups are a core trio (knight, mail two-hander, archer), the trio plus each fourth member,
and the mage party with each core member left out.

| Lineup | Attrition: rooms cleared | Reset: rooms won (of 8) |
|---|---|---|
| Core trio | 1.91 | 3.59 |
| + Enchanter | 2.19 | 4.71 |
| + Mage | 2.81 | 5.23 |
| + Grappler | 3.07 | 5.08 |
| + Duelist | 3.78 | 6.11 |

**What a member adds.** Each number is the score with the member minus the score without, paired
on seeds (attrition / reset, ± about 0.15):

| Member | Attrition | Reset |
|---|---|---|
| Two-hander | +1.76 | +3.01 |
| Duelist | +1.87 | +2.52 |
| Knight | +0.99 | +1.84 |
| Mage | +0.90 | +1.64 |
| Grappler | +1.16 | +1.49 |
| Archer | +1.05 | +1.47 |
| Enchanter | +0.28 | +1.12 |

- **The camp barely helps.** Few runs reach room 5, and a long rest heals only one point of CON. It
  adds only 1–3 points to the share of runs that clear the cistern. Attrition is decided by the
  kennels and the trapped corridor.
- **Reset mode shows the differentiation the attrition mode hid.** Each fourth member has a room
  where it is the best pick:
  - Mage: the kobold warren, 42% against 8–22% for the enchanter and grappler. Area spells work
    against a band.
  - Grappler: the cistern, 62%.
  - Enchanter: the chieftain's hall, 44% against 14% for the core trio. Mind spells work against
    a lone big foe.
  - Duelist: best or close to best in every room.
- **The hardest rooms at full strength** are the crypt (skeletons: 4–25% wins) and the kobold
  warren (3–42%). The troll den is easy fresh (86–100%) but a wall under attrition.
- **The casters die.** At full strength, out of eight fights, the enchanter dies 5.0 times, the
  mage 3.6 and the knight 0.5. The enchanter dies even in the gatehouse (60%). Its value is
  real when it's fresh (+1.1 rooms), but it can't keep itself alive, and nothing lets the knight
  protect it.

## Magic phases 2 and 3 (mind, body, venom, light and shadow; rituals)

A new arena style, the **Enchanter**, is a mind mage: Hex and Beguile with Dream, Rage, Calm and
Fear, a Force ward and Blink, with Word Doubling (Dream + Rage confuses). Rituals are out of
combat and not simulated. The baseline is the phase 1 run (`sim/results/arena-r10`).

- **The enchanter is the weakest duelist in the arena.** It wins 24% on average in the open
  field and 27% in close quarters. It wins no matchup on either map, losing 6–10% to sword and
  shield and to rapier and dagger. Against archers it is about even (48% open, 41% close). During
  development it beat archers about 95%. I haven't diagnosed the drop; my best guess is that the
  later changes to read intent and the ward pool cost it its edge. Mind spells use fixed durations
  with no saves each round, so this is a draft number.
- **The other styles barely moved.** Head to head, every matchup among the six old styles is
  within about 5 points of phase 1, which is sampling noise. The armor-by-style averages rose
  2–9 points for most styles because they all get to fight the weak enchanter.
- **Parties: no clear change.** The party with a mage (which still runs the phase 1 mage) and
  the veterans are within about 10 points of phase 1 everywhere. Each cell has 40 fights, so a
  10-point gap is under two standard errors. Kobold band, open field: veterans 53 → 48%, mage
  party 78 → 63%. Froglok patrol, open field: veterans 45 → 57%, mage party 73 → 70%. The
  kobold drop for the mage party is the largest, and it is still within noise.

## Magic overhaul, phase 1 (with wards, blink, bait and read intent)

The arena mage is unarmored or armored like everyone else. It knows Fire, Earth, Vine and Force;
its verbs are Strike, Ward, Launch, Build and Blink, and it has Casting II.

- **One-on-one, the mage is a middling style.** It averages 42% in the open field and 39% in
  close quarters, against 48–60% for the melee styles. It beats archers 80% in the open and 57%
  up close: its ward of force soaks arrows. It loses to sword and shield (18–23%), whose shields
  block bolts.
- **In a party, magic is a force multiplier.** Compare a party with a mage in place of the
  grappler (knight, mail two-hander, archer, mage) with the veterans. Wins in the open field / the
  cramped room:

  | Encounter | Veterans | With a mage |
  |---|---|---|
  | Kobold band | 53 / 45% | 78 / 55% |
  | Froglok patrol | 45 / 50% | 73 / 70% |
  | Wolf pack | 100 / 88% | 100 / 100% |
  | Troll chieftain | 65 / 57% | 85 / 50% |
  | Skeleton squad | 23 / 20% | 30 / 48% |
  | Zombie horde | 55 / 15% | 15 / 28% |

  Deaths per fight drop by about half against the bands. The zombie horde in the open is the
  exception, and I haven't diagnosed it.
- **New actions in use** (240 sample duels): 342 reads of intent, 74 wards, 72 blinks, 28 walls,
  12 baits. Read intent is used almost every round a melee fighter is engaged, which may be too
  automatic for 2 AP. Bait is rare because the AI only baits a foe whose guard it can already see.
- **Engine changes behind this:** square-by-square movement around walls, line of sight for
  missiles and reach, timed conditions, and casting at 2 base AP (bolts at 3 cost a third of a
  sword thrust's value).

## Opposed parries and dodges, parrying dagger, natural weapons from physics

- **Parry and dodge are opposed rolls.** Defender d10 + Training + ⌊(DEX + SPD)/4⌋ (armor-reduced)
  against attacker d10 + ⌊(STR + SPD)/4⌋ + motion penalty. A parry also faces +1 per weight class
  the attacking weapon has over the parrying one. Ties go to the defender, so equal fighters parry
  about 55–65% of the time. A STR-20 troll is much harder to dodge. **A power blow can't be
  parried**, only dodged or blocked. Block keeps its target number.
- **Parrying dagger** (main-gauche, 0.45 kg): held in the off hand (no shield, no two-handed
  weapon). It stabs (off-hand thrust, 2 AP), and its Off-hand parry (2 AP on the sheet, +1)
  meets thrusts only. New arena style **Rapier & dagger** (DEX 7, SPD 7; Parry Training II,
  Riposte, Quick Thrust, Quick Parry, Lunge, Precision).
- **Natural weapons come from physics:** jaw or limb mass and length, teeth depth and width,
  claw edge, fist mass. STR counts in full, since the body drives the blow; the weight class stays
  the catalog's. Bites got lighter (wolf 4 → 3, zombie 3 → 1); fists heavier (troll 7 → 10,
  golem 8 → 11, tail 4 → 6); the displacer's tentacles hit for 2/2/6 rather than 3/2/3.

Arena (now five styles, so averages move with the field), open field / close quarters:
two-handed 52 / 59%; sword and shield 59 / 53%; grappler 35 / 39%; rapier and dagger 47 / 60%;
archery 45 / 29%. Rapier and dagger beats sword and shield 76% in close quarters (its off-hand
parry catches thrusts, and the shield fighter's AI mostly thrusts) but loses 40% in the open.
Successful off-hand parries: 0.15–0.19 per fight for the duelist. Parries with the main weapon
are rare for every style (the AI seldom picks them).

Parties against groups (veterans, open / room), before → after: zombie horde 33/35 → 65/40%
(zombie bites now do 1); displacer pair 75/83 → 83/85%. Light party against the cave troll
85/78 → 73/70% (fists 10 + STR).

## Ready a thrust, fend off, shoves spoil a move

The user asked for a way to hold a foe off. **Ready a thrust:** on your turn you hold a long
thrust ready, paying its AP now and its stamina only if you make it. It lasts the pass. A foe
whose move brings them closer and into its reach is thrust at first, where they enter the reach.
A hit stops the advance, and their guards meet it as usual. **Fend off:** a long weapon shoves
at range 2, and a ready shield adds +1. **A shove that drives a foe back or floors them spoils
their move that pass.**

The AI readies only against a move a foe has already declared this pass. A foe still to act
would see the point and wait: with speculative readies, mirror matches in close quarters stood
off and timed out every fight. So the advantage goes to whoever acts later, as the user wants.
When planning a distance, the AI counts the cost of walking past a long thrust (half its rate,
once). It puts up a guard before stepping onto a point it can see, or doesn't step.

Unarmored sword and two-hander duels (320 fights): fights where someone drew the dagger 240 → 65;
fighters met a readied point 310 times and were stopped 131 times; mean length 1.57 → 1.24
rounds. All unarmored pairings (2,000): both die 2% (34% in the sword-and-shield mirror in the
open, the same pass); no timeouts.

Arena by style, open field / close quarters, weapon pass → now: two-handed 48 → 49 / 47 → 58%;
sword and shield 61 → 59 / 66 → 62%; grappler 33 → 33 / 45 → 41%; archery 49 → 49 / 32 → 32%.
In close quarters the greatsword's reach-3 point holds the line. Parties against groups
recovered some (veterans, open / room): kobold band 60/53 → 80/48%, wolf pack 90/50 → 90/83%.
Skeletons and zombies don't care: they're tireless and immune to the point.

## Weapons from physics and the wound roll (`CONFIG.weaponModel: 'physical'`)

Each weapon has a mass, a length, hands and a point (depth, width), an edge or a head
(`data.js` `phys`). `Items.weaponStats(item)` works out the faces, AP speed, weight class, STR
multiplier and wounds from those. Every rules reader goes through it, so materials and enchantments
can act on its inputs or outputs later. `weaponModel: 'table'` brings back the hand-set values.
A blow that reaches the body rolls a d10 wound roll (vital = ×3 CON, double bleeding; vital cuts
take their damage again from CON), and armor guards the vitals. Baseline: `results/arena-r9base`.

One blow on an unarmored CON-9 target, killed outright / killed if the bleeding goes untended
(4,000 trials per row, engine code):

| | STR 5 | STR 13 | vs mail, STR 13 | Old table, STR 5 |
|---|---|---|---|---|
| Dagger thrust (3 AP) | 10 / 10% | 9 / 9% | 0 / 0% | 0 / 100% |
| Rapier thrust (4) | 20 / 20% | 20 / 100% | 0 / 0% | 0 / 100% |
| Longsword thrust (4) | 20 / 100% | 20 / 100% | 0 / 11% | 0 / 100% |
| Longsword cut (6) | 2 / 26% | 9 / 100% | 0 / 0% | 0 / 55% |
| Greatsword thrust (4) | 31 / 100% | 100 / 100% | 0 / 74% | 0 / 100% |
| Spear thrust (4) | 30 / 100% | 100 / 100% | 0 / 73% | 0 / 100% |
| Warhammer beak (6) | 21 / 21% | 100 / 100% | 0 / 8% | 0 / 100% |

Arena (40 fights per pairing), average win rate by style, open field / close quarters, before →
after: two-handed 45 → 48 / 37 → 47%; sword and shield 57 → 61 / 61 → 66%; grappler 44 → 33 /
60 → 45%; archery 49 → 49 / 36 → 32%. Grapplers lose the most because their dagger now does 3
rather than 5. Letting a pin open the armor's guard on the vitals (`vital.pinnedOpensArmor`) moved
them less than a point.

Unarmored duels (all style pairings, 2,000 fights): both die 2% → 0%; at least one dead counting
untended bleeding 95% → 87%.

Parties against groups got much harder (veterans, open / room): skeleton squad 95/90% → 50/35%,
zombie horde 85/78% → 30/20%, wolf pack 100/100% → 90/50%, kobold band 90/90% → 60/53%. Two
causes. Party blows are weaker: swords cut 6 rather than 7, greatsword cuts are lower, and the
grappler's dagger does 3. And monsters' natural weapons are still on the old table with full STR.
They haven't been given physical descriptions yet.

The AI still steps inside a sword's reach with a dagger. At range 2 its rate is 40 but the foe's
threat is just as high; at range 1 the foe's sword is a half-force blunt jab, and the dagger's
rate is 20 against a threat of 3. That's a reach and positioning rule question, not damage.

## Monster attributes past the human range

Humans run 1–10, 13 with Conditioning feats. Big creatures now go past that (CONFIG.monsterAttrMax 30,
PROVISIONAL): cave troll STR 20 / CON 18, owlbear 18/16, stone golem 22/22, troll chieftain 24/24,
sarnak 12/11, displacer 12/11, rust beetle 10/12, giant spider 8/6, zombie STR 9. Wolves and the small
humanoids stay in the human range. No formula changed: STR 20 gives +7 damage and +10 to grapple.
The chieftain's boss multiplier fell from ×2.5 AP and stamina to ×2 AP only, since CON 24 already
gives it the stamina. Baseline: `results/monsters-r8`.

One-on-one, monster wins (before → after): rust beetle 56 → 89%, displacer 56 → 83%, owlbear
55 → 86%, cave troll 82 → 99%, stone golem 78 → 90%, sarnak 66 → 90%, zombie 51 → 62%, spider
61 → 65%. A troll now beats any lone level-5 human, as it should.

Against parties (party win rate, before → after):

- Veterans still beat every single monster except the chieftain. The chieftain was 95–100% for
  the veterans and is now 40–53%; the light party went from 63–68% to 5–10%. Its multiplier
  variants (veterans open / room): ×2.5 AP ×1.5 stamina 18/18%; ×2 AP 70/50% at n = 40; ×1.5 AP
  70/78%.
- The cave troll drops to 83–90% against the light party (was 100%), and the sarnak to 88–95%.
- Sarnak pair against the light party: 83% → 10–13%. Displacer pair: 90–100% → 38–75%.
- Stone golem against the light party: 100% → 15–18%. That party carries no blunt weapon, and
  they're beaten unconscious over about 14 rounds.
- The zombie horde against the veterans: 78–85% → 50–68%.

## Party arena, tireless undead, scaled humanoids, odd properties

Runs: `node sim/monsters.js` (one-on-one, 30 per pairing per arena), `node sim/party-arena.js`
(40 per cell): two parties (veterans: plate knight with shield, mail two-hander, archer,
grappler; light: leather shield, archer, unarmored grappler) against 19 encounters in an open
field and a cramped 8×4 room. Both sides now pick targets as a team (engaged or hurt foes first).

- **Groups, not single monsters, threaten a party.** Every single creature loses to both parties.
  Against the light party: kobold band 87–90% win, zombie horde 100%, froglok patrol 72–90%,
  skeleton squad 72–85%, wolf pack 25%. Veterans beat every group but lose 55% to frogloks in the
  open and about one person a fight to kobolds.
- **Tireless** (undead, constructs): no stamina, damage to attributes (blunt to CON), no bleeding
  or venom, act on every AP. Skeletons (no piercing, half slashing) beat archers 88–93% and
  dagger grapplers 100%; two-handers beat them. The stone golem loses only to two-handers. Zombies
  (piercing halved) beat archers 68–95%.
- **Humanoids:** kobolds and goblins are weak alone (8–19%) and strong in bands; frogloks
  (leaping, slippery) are the strongest small humanoids; sarnak 63–70% one-on-one.
- **Odd properties:** springy chitin (each landed blow costs the attacker 3 stamina); sticky webs
  (each layer +2 AP and +3 stamina on every action; one layer wears off per round). Webs took the
  spider from 55% to 68–82% one-on-one (and to 60%+ against plate) before the wear-off; with it,
  61–62% (35% against plate). The spider had to stop kiting: with a ranged web the AI treated it
  as an archer and fights ran to timeouts.
- The displacer (attacks roll to find it) and the displacer pair still don't threaten a party.

## Monster draft (`sim/monsters.js`, `sim/monster-party.js`, page `results/monsters/report.html`)

Seven monsters and a boss, each built to beat one kind of fighter, against all 16 level-5 arena
fighters (30 fights per pairing per arena) and two parties of three (40 per arena). "Edge" =
(win rate vs target − own average) − the same for the other single monsters, so fighters' own
strength by armor doesn't mislead.

| Monster | Built to beat | 1v1 open / close | Edge | Vs a party |
|---|---|---|---|---|
| Wolf | (baseline animal) | 38 / 50 | — | 0% |
| Wolf pack (alpha + 2) | anyone alone | 97 / 99 | — | 3–30% |
| Rust beetle | plate | 48 / 55 | +20 / +26 | 0% |
| Displacer beast | archers | 54 / 57 | +7 / −6 | 0% |
| Giant spider | the unarmored | 55 / 56 | +13 / +10 | 0–3% |
| Owlbear | two-handers | 44 / 66 | +15 / +2 | 0% |
| Cave troll | sword and shield | 78 / 87 | +9 / +10 | 0% |
| Troll chieftain (boss) | a whole party | 100 / 100 | — | 30–60% |

- **Action economy dominates.** A lone monster loses to a party of three almost every time, even
  the troll that wins 78–87% one-on-one. A boss needed AP, per-pass allowance and stamina ×2.5 and
  CON 15 to win 23–60% against a party (×2: 0–43%; ×3 with CON 15: 65–83%).
- Rust beetle and giant spider work as counters. Owlbear works in the open; in close quarters it
  beats nearly everyone. Displacer misses: arena archers drop the bow for a dagger as soon as
  anything fast closes, so displacement against arrows rarely matters. The troll beats everyone,
  so it reads as a boss, not a shield counter.
- Engine additions: natural weapons and armor; traits knockdown, pack, venom, rust, displacement,
  shieldCrush, regen, and boss multipliers (apMult raises the pool and per-pass allowance,
  staminaMult). Fixed along the way: natural attacks couldn't be wound up (the wind-up check
  wanted a weapon in hand).

## Round 9: arrows and armor (history), broadheads and bodkins

Changes (PROVISIONAL; the user agreed after a look at the historical record: good plate was close
to arrow-proof, mail over padding was penetrable but wounds were shallow, padded textile was
surprisingly good, arrowheads were specialized):

- Extra piercing protection against arrows only: padded +2, leather / mail / scale +1, plate 0.
- Broadheads: bleed ×1.5, +1 protection for metal armor. Bodkins: −1 damage, −2 protection for
  metal armor. Arena archers carry 20 broadheads and 10 bodkins; the AI picks per target.

Results (against `results/arena-r8/`):

- Archers 46 → 49 (open), 31 → 36 (close); other styles within 2 points.
- Archers vs plate wearers 9 → 15 (open); vs mail unchanged; vs leather 20 → 36 in close quarters,
  almost all from broadhead bleeding (leather two-handers hit hardest). The bleed multiplier is
  the knob if that's too strong.

## Round 8: the grappling ladder, and a grappler style in the arena

Changes (PROVISIONAL, designed with the user): free → clinch (mutual) → hold → pin, plus throw and
break; every step a directly opposed d10 roll (⌊STR/2⌋ + Grappler; breaking may use DEX + Escape
Artist); win by 5+ for two steps, lose by 5+ to reverse. Clinch: no two-handed swings or bows, no
stepping away. Hold: the held fighter is cramped (dagger too) and can't move; the holder keeps a
dagger hand and can drag. Pin: only breaking; piercing and Coup de Grâce go through armor (a mere
hold no longer opens armor). Armor option 4: plate +2 to be grappled or pinned (mail and scale +1),
footing against throws. Guards never meet grapples. Arena: a Grappler style (padded through plate,
dagger, Grappler ×2, Brawler's Wind, Trip, Toughness, Strength at level 5).

- Grapplers average 45% open / 61% close. Close quarters: 69% vs two-handers, 80% vs archers,
  43% vs sword & shield.
- By opponent armor, close / open: plate 48 / 33, mail 70 / 45, leather 63 / 45, unarmored 74 / 53.
- Ladder use per fight with a grappler: clinch 0.43, hold on a big win 0.49, pin 0.34, dagger
  stabs 1.3, successful breaks 0.30, holder too spent to keep the hold 0.23. No throws: the AI pins
  and stabs.
- The other styles moved at most 2 points against the opponents they already had.

## Round 7: steep stand-up cost by armor; exhausting grapples

Changes (PROVISIONAL, the user's calls): getting up from prone costs base AP / stamina 1/1
(none to leather), 2/2 (mail), 3/3 (scale), 4/5 (plate), capped at the AP pool; on the sheet a
plate fighter spends the whole round (8 AP) and about 16 stamina. Grapple 5, takedown 6, escape 3
base stamina, plus 2 base stamina upkeep per round of holding.

Result: **no measurable change** (every style and armor average within 1 point of round 6). The
arena barely exercises these rules: in a 528-fight sample there were 0.011 knockdowns and no
grapples per fight (kicks 0.12 a fight, rarely winning by the 3 needed). Testing them needs a
grappler/tripper fighting style and an AI that goes for knockdowns against plate.

## Round 6: blunt blows inside reach, cheap draws, cramped grapples; magic users dropped

Changes (PROVISIONAL, the user's calls):

- **Inside a long weapon's reach** (range 1), its blows land at half their total force, all blunt
  (`range.closeRule: 'blunt'`). A spear can jab with the shaft again.
- **Drop weapon** costs 0 AP; **drawing** a weapon costs 1 AP on the sheet (was 4). Drawing while
  holding a non-dagger drops it; a dagger is sheathed. Pick up costs 4. Several weapons can lie on
  the ground; they're gathered after the fight.
- **Held in a grapple**, any weapon (dagger included) fights cramped (`grappledWeaponsCramped`).
- **Magic users are out of the arena** for now (`--with-magic` brings them back). Round 5 numbers
  below are recomputed over the same twelve fighters.

| | Open field | Close quarters |
|---|---|---|
| Two-handed | 32 → 40 | 38 → 43 |
| Sword & shield | 64 → 60 | 73 → 64 |
| Archery | 50 → 44 | 33 → 38 |
| Best − worst style | 32 → 20 pts | 40 → 26 pts |
| Heavy armor | 74 → 81 | 71 → 76 |
| Unarmored | 27 → 25 | 29 → 22 |

- Weapon styles are the most even they've been; sword & shield lost most where it relied on
  stepping inside reach with a dagger.
- Cramped blows are rare (about 0.1 a fight); the AI mostly drops the long weapon and draws a
  dagger instead (0.3–0.95 times a fight).
- Armor now dominates: plate fighters win 64–87%, unarmored 11–35%. Likely (not isolated) because
  cramped blows are blunt, which plate soaks, where before a dagger's piercing got through.

## Round 5: guards instead of a defense step

Change (PROVISIONAL): defenses are **guards** readied on your own turn: a block, parry or dodge
that meets the next attack landing on you this pass, or the next from a foe you name. A guard
lapses at the end of the pass (`guardLasts: 'pass'`). A guard that can't meet an attack (a parry
against an arrow) stays up. There is no longer a defense step; the user found one arbitrary,
and wants saved AP (late actions the spent can't answer) to be the main edge.

Results (40 fights per pairing; compared against `results/arena-r4/`), open / close:

| Rules | Two-handed | Sword & shield | Archery | Heavy armor | Spread | Rounds |
|---|---|---|---|---|---|---|
| Round 4 (defense step, cap 4) | 35 / 53 | 63 / 72 | 55 / 43 | 54 / 70 | 28 / 29 | 5.6 / 3.8 |
| **Guards, end of pass (default)** | 35 / 50 | 68 / 78 | 52 / 41 | 53 / 64 | 33 / 37 | 5.9 / 4.3 |
| Guards last the round | 35 / 48 | 69 / 78 | 51 / 41 | 53 / 63 | 34 / 37 | 5.9 / 4.2 |
| Guards, cap 6 | 46 / 51 | 65 / 73 | 57 / 50 | 52 / 64 | 19 / 23 | 5.5 / 4.2 |

- Guards favor sword & shield: a 2–4 AP block can be readied blind and still leave room to attack.
  Defenses rose about 40%, hits fell about 10%, fights got slightly longer.
- Guard duration doesn't matter with this AI (it guards against attacks due this pass).
- Guards with a 6-AP cap are the most even version so far (spread 19 / 23).
- Actions per turn (separate measure, 4 fights per pairing, cap 4): mean 0.82, variance 0.30;
  26% of turns are empty, 66% one action, 8% two. Only sword & shield regularly fits two (17%).

## Round 4: passes resolve one at a time, and a per-pass AP cap (trial)

Changes (PROVISIONAL; see the Rules tab and `src/rules/config.js`):

- **Terms.** A round starts with initiative. Characters take **turns** in initiative order; one
  set of everyone's turns is a **pass**. After the turns comes a defense step, in which anyone
  with an attack landing on them may answer it. Then every action of the pass resolves. Passes
  repeat until no one has actions left (or a pass goes by in which nobody does anything).
  Before this, every pass was declared first and the whole round resolved at the end.
- **AP per pass** (`apPerPass: 2` base AP, 4 on the sheet). A turn may hold several actions up to
  the cap, so cheap, feat-reduced actions fit two to a pass. An action costing more keeps paying
  from the next passes' allowance and lands when fully paid (`spanLands: 'late'`); a 6-AP swing
  lands a pass later, where the target can see it coming. Defenses act at once and borrow the
  overspend from the next pass. Moving and drawing a longbow can no longer share a pass.

Results (40 fights per pairing; `results/arena/report.html`, compared against `results/arena-r3/`).
Style averages, open field / close quarters:

| Rules | Two-handed | Sword & shield | Archery | Heavy armor | Rounds |
|---|---|---|---|---|---|
| Round 3 | 41 / 60 | 68 / 70 | 59 / 44 | 52 / 62 | 5.8 / 4.2 |
| Passes resolve, no cap | 44 / 52 | 63 / 74 | 53 / 45 | 51 / 68 | 5.2 / 3.5 |
| **Cap 4 AP (default)** | 35 / 53 | 63 / 72 | 55 / 43 | 54 / 70 | 5.6 / 3.8 |
| Cap 4, overflow lands at once | 37 / 57 | 61 / 71 | 57 / 42 | 58 / 70 | 5.5 / 3.6 |
| Cap 6 AP | 44 / 54 | 61 / 72 | 54 / 44 | 52 / 69 | 5.4 / 3.7 |

What it means:

- Resolving each pass on its own barely moves the balance. In particular it **does not keep a
  shorter weapon out**: the step in and the dagger thrust still happen with no reaction from the
  reach weapon. Shove use stays near 0.05 a fight. The reach question still needs a rule
  (stop-thrust, extra AP to step into reach, shove costs the target AP, no dagger with a shield).
- The 4-AP cap costs **two-handers** most (−9 points in the open against no cap): their 7–8 AP
  swings span two passes and are telegraphed. Sidearm (dagger) draws rose by about half, because
  dagger thrusts fit inside the cap. If the cap stays, two-handed and power swing costs probably
  need a look (for example, let a heavy swing land in the pass it starts but cost the next pass's
  allowance, as with `spanLands: 'now'`, which recovered 2–4 points).
- A 6-AP cap balanced the open field best (17 points between weapon styles, against 28 at 4 AP),
  but close quarters is unchanged.
- Noise: each style figure averages about 2,400 fights, but they share opponents; treat
  differences under about 3 points as noise.

## Round 3: longbow draw, inside-reach rule, shove, shields vs power, plate retune

Changes (PROVISIONAL; see the Rules tab and `src/rules/config.js`):

- **Longbow draw:** a longbow shot is a wind-up, drawn one round and loosed the next; an archer
  may redraw after loosing. The shortbow stays a single action.
- **Inside a weapon's reach** (range 1), long weapons (rapier, longsword, greatsword, spear)
  can't attack at all; daggers, clubs, maces, hammers, half-swording and the murder stroke can.
  This replaces "half damage up close" (still available as `range.closeRule: 'half'`).
  The spear's shaft strike is gone.
- **Shove** (2 AP, range 1): opposed STR check; pushes the target back 1 square (2 on a big win).
- **Shields vs power attacks:** a blocked power swing breaks the shield if the weapon is at least
  as hard (wood < iron < steel) and the shield isn't masterwork; force above the break threshold
  drives through as blunt. Shields wear twice as fast.
- **Plate retune:** +1 stamina per action (was +2), −3 regen (was −4), chosen from five arena variants.

Results (`results/arena/report.html`, compared against `results/arena-r2/`):

| | Open field | Close quarters |
|---|---|---|
| Heavy armor | 44% → 52% | 49% → 62% |
| Two-handed | 36% → 41% | 42% → 60% |
| Sword & shield | 58% → 68% | 72% → 70% |
| Archery | 63% → 59% | 50% → 44% |
| Magic (deferred) | 32% → 23% | 25% → 17% |
| Best − worst style, leaving out magic | 27 → 26 pts | 30 → 27 pts |
| Average fight length | 3.7 → 5.8 rounds | 2.9 → 4.2 rounds |

- Matchups moved a lot, but overall dominance didn't shrink. **Sword & shield still leads.** Its
  fighters step inside a longer weapon's reach and fight with dagger plus shield. Shove can't
  hold the distance: it is used about 0.04 times a fight, because re-closing costs 1 AP per square.
- Tested: halving movement (Specifics rate) cuts sword & shield to 55% in the open but lifts
  archers to 65%, with no change in close quarters. Faster shield wear changes nothing; fights
  end before shields wear out.
- **Decision needed:** how should a reach weapon keep a shorter one out without attacks of
  opportunity? Options: a set/stop-thrust; extra AP to step into an enemy's reach; a shove that
  also costs the target AP; no dagger in a shield hand.
- Fights got longer, mostly mages and kiting archers in the open.
- Next test worth running: group fights (many-v-1, monster vs heroes), where styles that are weak
  in duels may shine.

---

## Round 2: ranges, wind-ups, archery, magic, and the arena

New rules (all PROVISIONAL, listed on the in-app Rules tab and in `src/rules/config.js`):

- **Range bands.** A grid square is about a pace (1 = clinch, 2 = sword distance). Swings reach
  1 to the weapon's reach; thrusts can reach farther (rapier +1, spear +2), and spears can't
  thrust at 1. Most attacks do half damage at 1; daggers, half-swording and murder strokes don't.
- **Wind-up.** A power swing (and a Strong spell) is wound up one round and released the next.
  While wound up you can't block or parry. The wind-up is lost if you're knocked down, grappled,
  disarmed or drop, or if you don't release it the following round.
- **Spear, shortbow, longbow, and a magic stub** (verbs Attack/Launch, nouns Fire/Force,
  modifier Strong, spell points, backlash) so the arena could test archery and magic.
- **Magic feat tiers count across all four magic sub-trees.** As transcribed, Casting and
  Fire Affinity could never pass rank I. Please confirm this reading.

The arena (`node sim/arena.js`, then `node sim/arena-page.js` for the results page) runs 16
level-5 fighters (heavy/medium/light/unarmored × two-handed/sword & shield/magic/archery) in
an open field and in close quarters, 12,000 fights in all. Full results:
[`results/arena/report.html`](results/arena/report.html); tidy data:
`results/arena/matchups.csv`.

Main findings (details and options are on the results page):

1. **A shield stops anything, and the dagger does the work.** Sword & shield is the best melee
   style (light: 79% open, 90% close). Two-handers win only 25% / 14% against it. A block negates
   any blow, the wind-up tells the defender which strike to block, and the up-close penalty makes
   shield + dagger the best clinch combination.
2. **Heavy armor protects, then exhausts.** Plate wearers almost never die but lose by collapsing
   (0.4–0.6 per fight). Heavy armor averages 44% / 49%, light 58% / 54%. The round-one ×3 stamina
   tuning now looks too harsh on plate. The round-one checks also fell from 87 to 81 of 101
   passing under the new rules.
3. **One arrow decides an open-field fight.** Archers win 63% in the open and about 50% in close
   quarters. Arrows never miss, and a longbow hit kills an unarmored target.
4. **Magic is weak and risky.** Casters average 32% / 25%. They get 1–2 spells a fight, backlash
   on about 40% of casts, and a fire bolt does about 1 CON through leather.
5. **The wind-up works, but power swings rarely land** (0.1–0.6 per fight).
6. Working as intended: short fights, terrain that matters, fighters holding their best range,
   unarmored fighters winning at range rather than in melee.

---

## Round 1

First broad pass over the combat rules, driven by the questions in the Specifics
"Simulation plan" and the targets in the Philosophy doc. Full tables:
[`results/as-written/report.md`](results/as-written/report.md) (Specifics numbers as
written) and [`results/tuned/report.md`](results/tuned/report.md) (current defaults).
Both use 200 fights per matchup.

**Read these numbers with one caveat.** Every fight is played by the built-in AI
(`src/rules/ai.js`). It defends by expected value, picks attacks by damage per AP,
closes distance and switches to its sidearm when that's better. It does not kite,
retreat, flank, use terrain, or plan across rounds. A result like "the duelist wins
65%" means "under these rules, played competently but simply." Pass/fail thresholds
are my numeric readings of qualitative goals; they live in `sim/targets.js`.

## What changed

### Bugs found by the sims (fixed)

- Piercing through armor rounded 0.5 up, so a thrust that barely beat plate always did
  1 CON. That alone let a level-8 duelist beat a level-8 knight 68% of the time.
- After declaring "draw sidearm", later passes still offered attacks with the old
  weapon, which then fizzled. Attack options now reflect declared weapon swaps.
- "Stand up" (and draw/pick up) could be declared twice in one round.
- AI: it read strikes hidden by Feint (cheating); it valued kicks that armor stopped
  completely; it picked defenses in a fixed order rather than by odds; it never
  drew a better sidearm.

### Tuning adopted (all in `src/rules/config.js`, each a single switch)

| Change | Why | Evidence (as written → tuned) |
|---|---|---|
| **Stamina costs ×3** (`staminaScale`) | Outline: early unarmored "tires within a few rounds"; armored "tires much faster"; "2v1 drains stamina". At Specifics numbers an early fighter could attack flat out for 30+ rounds, and turning fatigue off changed fight length by 0.01 rounds. | Rounds of full effort, early unarmored: 30+ → **4**; mid-level with cost feats: 30+ → 30+; plate L5: 6 → **3**. Knight mirror median: 5–6 → **4** rounds. |
| **AP ×2, feats still −1** (`apScale`) | With 4–6 AP pools, a "−1 AP" feat halved a 2-AP thrust or block, so play collapsed into 1-AP thrust/block spam. Outline asks for pools "around 4–10 AP so costs can differ meaningfully". | Without it (all else tuned): 2 sellswords beat an L4 knight 43%, dagger averages 91%. With it: 89%, 79%. |
| **Piercing through armor by roll** (`pierceMode: 'roll'`), the Outline's "coverage-based chance" | With rounding, plate's value hinged on one integer threshold: thrusts did exactly 0 or 1 CON, and armored matchups flipped from trivial to invincible with no setting between. | Smooth response to the pass-through dial instead of cliffs. |
| **Plate pass-through 20%** (`passThroughByArmor.plate: 0.4`) | Philosophy: "full plate is exceedingly good"; "armor is king in melee". | Trained plate's average win rate against other armors: 40% → **77%**. Plate builds now lead the equal-level matrix (knight 75%). |
| **Armor wear ⅓, mitigation floor 75%** | Three fully-absorbed kicks knocked a point off plate's piercing mitigation. | Removing this sends the starting party back to 100% wins against the plate knight. |
| **Block odds by shield size** (buckler 5, round 4, heater 3, tower 2 on d10) | Smaller shields cover less. Placeholder for an Open rule. | Buckler average 89% → 69%. Small effect; see shields below. |

The removal test (`node sim/compare.js` with one change removed at a time) showed
each of the first five matters. Removing stamina ×3 or roll mode alone breaks
several targets.

## Answers to the Specifics questions

| Question | Answer (tuned rules) |
|---|---|
| Does the stamina→AP fatigue link shorten or lengthen fights? | **Neither, measurably.** Fights end in 1–5 rounds, mostly by wounds, before the −1/−2 AP steps bite (knight mirror 4.25 rounds with fatigue, 4.08 without). It matters in long many-on-one fights, where it is how the knight loses. |
| How many rounds does plate + two-hander last? | **3 rounds** of all-out attacking at L1 and L5, **5** at L8. |
| Armored heavy vs. fast unarmored across level gaps (confined space) | L1 plate beats an L1 duelist 67–70%, an L4–L6 duelist about 55%, an L8 duelist 40–45%. Close to your goal but short of "across a large level gap". |
| Does 2v1 end quickly for every build? | Yes. Two sellswords beat a lone knight or heavy 89–100% of the time, median 4–5 rounds. The exception is an L8 duelist, who wins 44% against two L8 sellswords. |
| Is any weapon, armor or shield dominant? | **Armor:** plate leads (77%), as intended; **scale is the worst armor (10%)**, see below. **Weapons:** dagger 79% and longsword 80% lead; maces and club trail. **Shields:** buckler leads, tower is last (11%). |
| Fight length between equals, early vs late | Median 2–4 rounds at every level for every build except militia at L8 (5). Duelist mirrors end in round 1. |
| Mutual kills among unarmored fighters | Duelist mirrors: 0% (the faster one strikes first and the strike kills). Mirrors overall: 3–27% end with both down, highest in plate mirrors. |
| Feint vs Read Attack gap | **0%.** See below; Feint barely does anything as written. |
| Does kick spam dominate? | **Not one-on-one** (a kicker wins 5–52% of mirrors). As written, it did dominate many-on-one against plate. Kicks caused more knockdowns of the knight than trips did, and every point of his CON damage came while prone. With the tuned rules his losses are mostly exhaustion instead. |
| Can a starting party beat a plate-and-tower knight? | **Yes, almost always**: 3 level-1 starters win 97% against a level-6 knight with a steel tower shield, losing 0.3–0.8 of their own per fight. They win by wearing him out (he blocks their trips with a 3-AP tower block and collapses) and by stabbing him while prone. |

## Decisions that need you

The sims can't settle these; each is a rule question, not a number.

1. **What does reach do?** Specifics gives weapons very short / short / medium / long
   reach, but on a 1-square grid the first three are identical. The dagger's
   intended drawback therefore costs nothing, which is a large part of why it leads
   the weapon table (it thrusts the same 5 piercing as a longsword, cheaper).
   Options: longer reach resolves first within a pass; or reach is in half-squares;
   or a shorter weapon must spend AP to close inside a longer one.

2. **Feint has almost no mechanical bite.** It hides an attack's type and AP cost,
   but any declared block, parry or dodge still works against a hidden strike, and
   only parry and dodge odds depend on the motion. Knowing the type barely changes
   the right response, so a 0% gap is the expected result, not an AI artifact. If
   Feint should matter, a defense might need to match the attack (parry vs swings,
   dodge vs thrusts), or a hidden strike might add to the defense's target number.

3. **What are big shields for?** A block negates the whole hit whatever the shield,
   so the only difference in a duel is AP cost, and breakage rarely happens in
   short fights. Even at 40% block odds the buckler beat larger shields. The tower
   shield's stated role ("holds a line") needs rules that don't exist yet: ranged
   fire, formations, Shield Wall, or cover against attacks you didn't declare a
   block for.

4. **Scale armor is strictly worse than mail.** It has more SPD, DEX, stamina and
   regen penalty for one more point of P and B mitigation, and there's no
   Scale Mobility/Endurance feat to train it off. It averaged 10% against the other
   armors. Either give it training feats or lighten its penalties.

5. **How hard should the plate-and-tower knight be?** At 97% for three level-1
   starters, "extremely hard to beat" isn't true in this model. I didn't tune
   further because the levers (plate stamina penalty, stand-up cost, knockdown
   odds) all also shift two-on-one and armored mirrors. Tell me the outcome you
   want (e.g. "three starters win about half the time and usually lose someone")
   and I can tune toward it.

6. **Level-gap target.** L1 plate against an L6–L8 unarmored duelist is about a coin
   flip (40–55%). Raising it further also makes the knight harder for parties, so
   these two targets pull against each other.

7. **Smaller things:** Quick Thrust II–III do nothing for a rapier at the old AP
   numbers (cost already at the 1-AP floor); fixed by the AP scale. The unarmored
   two-handed brute loses to almost everything (18%), as written and tuned. Militia
   mirrors at level 8 run 5 rounds (club against padded and a shield is slow).

## Not tested

Terrain, confined vs open space (in one-on-one fights both sides close in the
first pass, so the "corridor" plays like open ground until terrain and retreat
exist), ranged combat, magic, social, recovery.

## Reproduce

```
node sim/run.js                              # full sweep with current defaults → sim/results/
node sim/run.js --n 60 --only party,gap      # quicker, selected scenarios
node sim/run.js --set staminaScale=1         # any config value can be overridden
node sim/compare.js --n 60                   # side-by-side variants from sim/variants.json
node sim/inspect.js knight:6 militia:1 open 3 1 3   # print one fight's log
```

`results/*/summary.csv` has one row per measured value (scenario, condition,
metric, value, target, verdict) for analysis in R:

```r
s <- read.csv("sim/results/tuned/summary.csv")
subset(s, verdict == "FAIL")
```
