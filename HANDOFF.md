# To do

Last updated at commit: fb7fa14

Keep this a short list. Tick things off, add new ones, and refresh the commit line after every push (`git log -1 --format=%h`).

## Look and feel (needs a human eye)
- [ ] Play it on a phone-width screen: stage, dock, toolbar, command bar and sheet have only been checked on desktop.
- [ ] Restyle the town, parley, title and pack/journal/standing screens to match the pixel theme (they only inherit colours).
- [ ] Doors in vertical walls are drawn front-on like horizontal ones; give them a side-on look.
- [ ] Wall face has no corner pieces for outside corners yet (run ends use a pilaster instead).
- [ ] Beasts (rat, wolf, spider, snake, cat) borrow tinted orc sprites; find or draw real ones.
- [ ] Animate attacks, hits and deaths in a fight (right now: walking, idling, a rotated body when down).
- [ ] Click-to-walk and the explore prompts need a pass on touch screens.

## Art and licences
- [ ] `assets/env/{chest,objects,gold,stairs_down,spikes,plate,stairs}.png` come from the paid Cute Fantasy Dungeons pack, whose licence forbids redistribution: they are git-ignored, so a fresh clone or the Pages build draws those props blank. Replace them with Pixel Crawler or own art, or keep the repo private.
- [ ] Pixel Crawler terms are in `assets/PIXEL-CRAWLER-TERMS.txt`; credit the author in the game's About.

## Game
- [ ] Magic in play: nouns are scarce (books, creation pick) and the Lore/ritual screen exists only in the GM table.
- [ ] Monsters do not move on the map; fleeing returns you to the stairs.
- [ ] Feats that need rules code outside a fight (tracker, appraise, diagnose, alchemy, light fingers) are `auto: false`.
- [ ] No companions, hiring, restocking vendors, torch resource or hunger.
- [ ] Social balance has no sim yet (a bot that tries fight / parley / sneak through the Undercroft).
- [ ] Save format has a version field but no migration.
- [ ] More dungeon maps in the new style; the other three are still the old layouts with no scenery props.

## Done recently
- Top-down map shared by exploring and fighting; fights are played on a 15x10 slice of the dungeon.
- Five-layer tile renderer (`src/ui/game/tilemap.js`): ground, wall base/face, wall top/caps, decor and doors, entities.
- Compact battle screen, character sheet pop-up and character creation with dropdowns and (i) tooltips.
