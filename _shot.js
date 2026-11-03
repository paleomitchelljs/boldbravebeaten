setTimeout(() => { const Game = BBB.UI.Game; Game.draft = null; Game.go('heroes'); Game.draft.picked = ['beren'];; Game.render(); }, 1500);
