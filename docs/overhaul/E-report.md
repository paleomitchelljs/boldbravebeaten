# Step E report: wounds and life (in progress)

Branch `overhaul/E-wounds`, from `778db7a4`.

## Progress notes
- Before-measurements: run from an untouched copy, output in the scratchpad (`E-out/before`).
- Done: stamina fold. `staminaScale` (×3) folded into every base stamina cost (data.js MOTIONS and ACTIONS, weapons
  `shootStamina` and `draw`, standUp, grappling, holdUpkeep, windUp, dodgeStamina, web, armor recoil); a scripted check
  of every preset's and five monsters' action costs gave identical numbers before and after. Regeneration's ×3 folded:
  armor `regen` penalties, `armorAdjust`, conditions, gear and hero `regen` ×3; regen = ⌊(CON + WIL) × 0.75⌋.
  Max stamina = 20 + STR + SPD + DEX (no CON).
- Next: wounds core (character.js), applyHit, endRound, AI, magic, monsters, UI, tests, sims.
