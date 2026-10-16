/*
 * Numeric readings of the design docs' qualitative goals. These are judgment
 * calls, not rules: change them when they don't match what you meant.
 */
module.exports = {
  // Philosophy: "Fights between rough equals end quickly at every level."
  length: { medianRoundsMax: 4 },

  // Philosophy: "Heavy armor and a big weapon in a confined space beat an
  // unarmored opponent across a large level gap." Graded for a level-1 plate
  // fighter against an unarmored duelist this many levels up, in a corridor.
  gap: { gapLevel: 6, minWin: 0.6 },

  // Specifics: "Does 2v1 end quickly for every build, including the armored heavy?"
  // Outline: numbers counter the armored heavy.
  twoOnOne: { pairMinWin: 0.7, medianRoundsMax: 5 },

  // Outline stamina curve, in rounds of all-out attacking with nobody hitting back.
  stamina: { earlyMin: 2, earlyMax: 8, midMin: 15, indefinite: 30 },

  // Specifics: "Is any weapon, armor, or shield dominant?"
  dominance: { maxAvgWin: 0.7, maxWeaponAvgWin: 0.7 },

  // Specifics: a large Feint/Read Attack gap means the feat is mandatory.
  feint: { maxGap: 0.15 },

  // Specifics: "Does cheap kick spam for knockdowns dominate?"
  kick: { maxWin: 0.55 },

  // Specifics: can a starting party beat a plate-and-tower knight? Philosophy: such
  // an enemy is "extremely hard to beat and a huge prize" — winnable, not easy.
  party: { minWin: 0.2, maxWin: 0.7 },
};
