/*
 * Sprites: the Pixel Crawler character sheets (assets/sprites), drawn onto canvases.
 *
 * Every sheet is cut into 32x32 frames: idle sheets are 4 frames side by side; run sheets hold 6 frames of
 * 64x64 with the figure in the lower middle 32x32. A sprite is anchored at its feet. Who looks like what
 * is data: a party member's look.sprite and look.tint, a monster's or foe template's `sprite`
 * (a sheet name, or {kind, scale, tint}). In Node (tests, sims) there is no Image: everything here
 * becomes a no-op and the canvases stay blank.
 */
(function (G) {
  'use strict';
  const UI = G.UI;

  const DIR = 'assets/sprites/';
  const HAS_IMG = typeof Image !== 'undefined';

  // Name -> what the sheets are called. All 11 have idle and run sheets.
  const KINDS = ['knight', 'rogue', 'wizard', 'orc', 'orc_rogue', 'orc_shaman', 'orc_warrior', 'skeleton', 'skeleton_mage', 'skeleton_rogue', 'skeleton_warrior'];
  const PARTY_KINDS = [['knight', 'Knight'], ['rogue', 'Rogue'], ['wizard', 'Mage']];
  // Soft colour washes for telling two characters of one kind apart; '' leaves the sheet as drawn.
  const TINTS = [['', 'As drawn', '#9a9a9a'], ['#d98a8a', 'Rose', '#d98a8a'], ['#8ab4d9', 'Sky', '#8ab4d9'], ['#9ad98a', 'Moss', '#9ad98a'], ['#d9c28a', 'Amber', '#d9c28a'], ['#b79ad9', 'Violet', '#b79ad9'], ['#7a7a8a', 'Shade', '#7a7a8a']];
  const KIT_KIND = { sword: 'knight', club: 'knight', spear: 'knight', hammer: 'knight', rapier: 'rogue', bow: 'rogue', staff: 'wizard' };

  const sheets = {};       // `${kind}_${anim}` -> { img, tinted: {color: canvas}, ok }
  const waiting = [];      // callbacks to run when something finishes loading

  function sheet(kind, anim) {
    const key = kind + '_' + anim;
    if (sheets[key]) return sheets[key];
    const s = sheets[key] = { img: null, ok: false, tinted: {} };
    if (!HAS_IMG) return s;
    s.img = new Image();
    s.img.onload = () => { s.ok = true; for (const f of waiting.splice(0)) f(); };
    s.img.src = DIR + key + '.png';
    return s;
  }

  // The sheet as a canvas washed with `color` (multiply, then clipped back to the sprite's own shape).
  function tinted(s, color) {
    if (!color) return s.img;
    if (s.tinted[color]) return s.tinted[color];
    const c = document.createElement('canvas');
    c.width = s.img.width; c.height = s.img.height;
    const x = c.getContext('2d');
    x.drawImage(s.img, 0, 0);
    x.globalCompositeOperation = 'multiply';
    x.fillStyle = color;
    x.fillRect(0, 0, c.width, c.height);
    x.globalCompositeOperation = 'destination-in';
    x.drawImage(s.img, 0, 0);
    return (s.tinted[color] = c);
  }

  const FRAMES = { idle: 4, run: 6 };

  // Source rectangle of a frame in its sheet.
  function frameRect(anim, i) {
    const n = FRAMES[anim];
    const f = ((i % n) + n) % n;
    return anim === 'run' ? [f * 64 + 16, 32, 32, 32] : [f * 32, 0, 32, 32];
  }

  // Draw a sprite with its feet at (x, y). scale = screen pixels per art pixel. Returns false if not yet loaded.
  // opts: flip (face left), tint, alpha, rot (radians: a fallen body), shadow (draw a soft ellipse first), size (multiplier)
  function draw(ctx, kind, anim, frame, x, y, scale, opts) {
    opts = opts || {};
    const s = sheet(kind, anim);
    if (!s.ok) return false;
    const [sx, sy, sw, sh] = frameRect(anim, frame);
    const sz = (opts.size || 1) * scale;
    ctx.save();
    if (opts.alpha != null) ctx.globalAlpha = opts.alpha;
    if (opts.shadow !== false) {
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.beginPath();
      ctx.ellipse(x, y - 1.5 * scale, 7 * sz, 2.6 * sz, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.translate(x, y);
    if (opts.rot) { ctx.translate(0, -3 * sz); ctx.rotate(opts.rot); ctx.translate(0, 3 * sz); }
    if (opts.flip) ctx.scale(-1, 1);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tinted(s, opts.tint), sx, sy, sw, sh, -16 * sz, -31 * sz, 32 * sz, 32 * sz);
    ctx.restore();
    return true;
  }

  // ---- Who looks like what ---------------------------------------------------------------------------
  // Returns { kind, tint, size } for a character (party member or foe).
  function look(c) {
    if (!c) return { kind: 'orc', tint: '', size: 1 };
    const l = c.look || {};
    if (c.side === 'party' || !c.side) {
      const kind = KINDS.includes(l.sprite) ? l.sprite : (KIT_KIND[l.kit] || 'knight');
      return { kind, tint: (TINTS[l.tint] || TINTS[0])[0], size: 1 };
    }
    return fromSpec(c.sprite, c);
  }

  function fromSpec(spec, c) {
    if (spec && typeof spec === 'object') return { kind: KINDS.includes(spec.kind) ? spec.kind : 'orc', tint: spec.tint || '', size: spec.scale || 1 };
    if (typeof spec === 'string' && KINDS.includes(spec)) return { kind: spec, tint: '', size: 1 };
    // Nothing authored: guess from the name so a new creature still shows up as something.
    const n = String((c && c.name) || spec || '').toLowerCase();
    if (/skelet|bone|zombie|dead|revenant|spectre|ghoul|lich/.test(n)) return { kind: 'skeleton', tint: '', size: 1 };
    if (/mage|shaman|witch|priest|cultist/.test(n)) return { kind: 'orc_shaman', tint: '', size: 1 };
    if (/rat|wolf|spider|beetle|snake|constrictor|cat|bear/.test(n)) return { kind: 'orc', tint: '#8a6a4a', size: 0.7 };
    if (/knight|guard|captain|sellsword|militia|soldier/.test(n)) return { kind: 'knight', tint: '#7a6a6a', size: 1 };
    if (/bandit|thief|rogue|cutthroat/.test(n)) return { kind: 'rogue', tint: '#8a7a7a', size: 1 };
    return { kind: 'orc', tint: '', size: 1 };
  }

  // A sprite spec for something on the map that is not in a fight (a monster square, an NPC).
  const lookFor = (spec, name) => fromSpec(spec, { name });

  // How an encounter's first creature looks: a monster's or a foe template's authored sprite.
  function forEncounter(spec) {
    const first = spec && spec.foes && spec.foes[0];
    let sp = null, name = '';
    if (first && first.monster) {
      let m = G.Enemies.MONSTERS[first.monster];
      if (m && m.group) m = G.Enemies.MONSTERS[m.group[0]];
      sp = m && m.sprite; name = (m && m.name) || first.monster;
    } else if (first && first.template) {
      const t = G.Enemies.TEMPLATES[first.template];
      sp = t && t.sprite; name = (t && t.name) || first.template;
    }
    return fromSpec(sp, { name });
  }

  // How many creatures an encounter holds (to draw a small crowd on its square).
  function crowd(spec) {
    let n = 0;
    for (const f of (spec && spec.foes) || []) {
      const m = f.monster ? G.Enemies.MONSTERS[f.monster] : null;
      n += (f.n || 1) * (m && m.group ? m.group.length : 1);
    }
    return Math.max(1, n);
  }

  // ---- Portraits -------------------------------------------------------------------------------------
  // A canvas showing the head and shoulders. Draws now if the sheet is ready, otherwise when it is.
  function portrait(c, size, opts) {
    size = size || 48;
    const cv = document.createElement('canvas');
    cv.width = size; cv.height = size;
    cv.className = 'portrait' + (opts && opts.cls ? ' ' + opts.cls : '');
    if (c && c.name) cv.setAttribute('aria-label', c.name);
    const L = look(c);
    const paint = () => {
      const s = sheet(L.kind, 'idle');
      if (!s.ok) return false;
      const x = cv.getContext('2d');
      x.clearRect(0, 0, size, size);
      x.imageSmoothingEnabled = false;
      // The upper 20 rows of the 32x32 frame, centred on the figure.
      const sw = 22, sh = 22, sx = 5, sy = 0;
      x.drawImage(tinted(s, L.tint), sx, sy, sw, sh, 0, 0, size, size);
      return true;
    };
    const retry = () => { if (!paint()) waiting.push(retry); };
    retry();
    return cv;
  }

  // An idle figure on its own canvas (the sheet's hero image). Loops while attached to the page.
  function figure(c, scale, opts) {
    scale = scale || 4;
    const cv = document.createElement('canvas');
    cv.width = 32 * scale; cv.height = 32 * scale;
    cv.className = 'figure' + (opts && opts.cls ? ' ' + opts.cls : '');
    const L = look(c);
    let t = 0;
    const paint = () => {
      const x = cv.getContext('2d');
      x.clearRect(0, 0, cv.width, cv.height);
      draw(x, L.kind, 'idle', t, 16 * scale, 31 * scale, scale, { tint: L.tint, shadow: false });
    };
    paint();
    if (HAS_IMG) {
      waiting.push(paint);
      const timer = setInterval(() => { if (!cv.isConnected) { if (cv._seen) clearInterval(timer); return; } cv._seen = true; t++; paint(); }, 220);
    }
    return cv;
  }

  UI.Art = UI.Art || {};
  UI.Sprites = { forEncounter, crowd, KINDS, PARTY_KINDS, TINTS, KIT_KIND, draw, look, lookFor, portrait, figure, sheet, whenReady: (f) => waiting.push(f), preload: () => KINDS.forEach((k) => { sheet(k, 'idle'); sheet(k, 'run'); }) };
  // Portraits everywhere in the game are now the sprite's face.
  UI.Art.portrait = (c, px) => portrait(c, px);
})(globalThis.BBB);