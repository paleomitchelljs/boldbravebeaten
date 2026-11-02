setTimeout(() => { const Game = BBB.UI.Game; Game.newGame(BBB.World.presetParty()); Game.travel({to: 'ember_hall', arrive: '<'}); Game.render(); }, 1500);
