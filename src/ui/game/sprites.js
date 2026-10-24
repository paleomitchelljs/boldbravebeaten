/*
 * Sprites: the Pixel Crawler character sheets (art/characters/pixelcrawler), drawn onto canvases.
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

  const DIR = 'art/characters/pixelcrawler/';
  const HAS_IMG = typeof Image !== 'undefined';

  // Name -> what the sheets are called. All 11 have idle and run sheets.
  const KINDS = ['knight', 'rogue', 'wizard', 'orc', 'orc_rogue', 'orc_shaman', 'orc_warrior', 'skeleton', 'skeleton_mage', 'skeleton_rogue', 'skeleton_warrior'];
  const PARTY_KINDS = [['knight', 'Knight'], ['rogue', 'Rogue'], ['wizard', 'Mage']];
  // Plus the creature art marked party: true in data/art.yaml (value 'art:<key>'), when it is there.
  const partyKinds = () => PARTY_KINDS.concat(Object.entries(artCat()).filter(([, d]) => d.party).map(([k, d]) => ['art:' + k, d.name || k.replace(/-/g, ' ').replace(/^./, (x) => x.toUpperCase())]));
  // Soft colour washes for telling two characters of one kind apart; '' leaves the sheet as drawn.
  const TINTS = [['', 'As drawn', '#9a9a9a'], ['#d98a8a', 'Rose', '#d98a8a'], ['#8ab4d9', 'Sky', '#8ab4d9'], ['#9ad98a', 'Moss', '#9ad98a'], ['#d9c28a', 'Amber', '#d9c28a'], ['#b79ad9', 'Violet', '#b79ad9'], ['#7a7a8a', 'Shade', '#7a7a8a']];
  const KIT_KIND = { sword: 'knight', club: 'knight', spear: 'knight', hammer: 'knight', rapier: 'rogue', bow: 'rogue', staff: 'wizard' };

  const sheets = {};       // `${kind}_${anim}` -> { img, tinted: {color: canvas}, ok }
  const ART_DIR = 'art/characters/creatures/';
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

  // ---- Creature art (data/art.yaml; the files are local only) ------------------------------------------
  // Two-frame sheets of painted creatures, far finer than the 32-pixel Pixel Crawler figures: drawn smoothed and
  // scaled to an authored height in squares. pixellab characters are 64-pixel, 8-direction figures. Where a file
  // is missing (the creature sheets are git-ignored until their licence is settled) the look's Pixel Crawler `kind` is drawn instead.
  const artCat = () => ((G.Content && G.Content.world && G.Content.world.art) || {});
  const artSheets = {};  // `${key}|${anim}` -> { img, ok, failed, tinted }

  function artFile(key, def, anim) {
    if (def.type === 'pixellab') {
      const [dir, n] = anim.split('#');
      return n == null ? `${def.dir}/rotations/${dir}.png` : `${def.dir}/animations/Walking/${dir}/frame_${String(n).padStart(3, '0')}.png`;
    }
    return ART_DIR + key + '-' + anim + '.png';
  }

  function artSheet(key, anim) {
    const k = key + '|' + anim;
    if (artSheets[k]) return artSheets[k];
    const def = artCat()[key];
    const s = artSheets[k] = { img: null, ok: false, failed: !def, tinted: {} };
    if (!HAS_IMG || !def) return s;
    s.img = new Image();
    s.img.onload = () => { s.ok = true; for (const f of waiting.splice(0)) f(); };
    s.img.onerror = () => { s.failed = true; };
    s.img.src = artFile(key, def, anim);
    return s;
  }

  // Which sheet (and frame) shows this art in this animation; null if none of it can be drawn.
  function artPick(key, anim, frame, flip) {
    const def = artCat()[key];
    if (!def) return null;
    if (def.type === 'pixellab') {
      const side = flip ? 'west' : 'east';
      const name = anim === 'run' ? `${side}#${((frame % 4) + 4) % 4}` : flip ? 'south-west' : 'south-east';
      const s = artSheet(key, name);
      return s.ok ? { def, s, sx: 0, sy: 0, sw: def.size, sh: def.size, mirror: false } : null;
    }
    const anims = def.anims || ['idle'];
    const want = anim === 'run' ? (anims.includes('walk') ? 'walk' : anims.includes('fly') ? 'fly' : 'idle') : anims.includes(anim) ? anim : 'idle';
    const s = artSheet(key, want);
    if (!s.ok) return s.failed && want !== 'idle' ? artPick(key, 'idle', frame, flip) : null;
    const fw = def.frame ? def.frame[0] : s.img.width / 2, fh = def.frame ? def.frame[1] : s.img.height;
    // Two frames: idle sways slowly; walks and blows alternate faster.
    const f = anim === 'idle' ? Math.floor(frame / 3) % 2 : ((frame % 2) + 2) % 2;
    return { def, s, sx: f * fw, sy: 0, sw: fw, sh: fh, mirror: def.faces === 'left' ? !flip : !!flip };
  }

  function artReady(key) {
    const def = artCat()[key];
    if (!def) return false;
    return !!artPick(key, 'idle', 0, false);
  }

  // A canvas of the sheet washed with `color` (as tinted() does for the Pixel Crawler sheets).
  function artTinted(s, color) {
    if (!color || typeof document === 'undefined') return s.img;
    if (s.tinted[color]) return s.tinted[color];
    const c = document.createElement('canvas');
    c.width = s.img.width; c.height = s.img.height;
    const x = c.getContext('2d');
    x.drawImage(s.img, 0, 0);
    x.globalCompositeOperation = 'multiply'; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
    x.globalCompositeOperation = 'destination-in'; x.drawImage(s.img, 0, 0);
    return (s.tinted[color] = c);
  }

  // Draw creature art with its feet at (x, y). tile = screen pixels per square. Returns false if not ready.
  function drawArt(ctx, key, anim, frame, x, y, tile, opts) {
    opts = opts || {};
    const p = artPick(key, anim, frame, opts.flip);
    if (!p) return false;
    const { def, s } = p;
    const box = def.box || [0, 0, p.sw, p.sh];
    const bw = box[2] - box[0], bh = box[3] - box[1];
    const k = Math.min(((def.height || 1.3) * (opts.artScale || 1) * tile) / bh, ((def.maxWidth || 1.8) * (opts.artScale || 1) * tile) / bw);
    ctx.save();
    if (opts.alpha != null) ctx.globalAlpha = opts.alpha;
    if (opts.shadow !== false) {
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.beginPath();
      ctx.ellipse(x, y - tile * 0.03, Math.max(tile * 0.25, bw * k * 0.42), tile * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.translate(x, y);
    if (opts.rot) { ctx.translate(0, -tile * 0.15); ctx.rotate(opts.rot); ctx.translate(0, tile * 0.15); }
    if (p.mirror) ctx.scale(-1, 1);
    ctx.imageSmoothingEnabled = true;
    if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'high';
    // The box's bottom centre sits on (0, 0).
    const cx = (box[0] + box[2]) / 2;
    ctx.drawImage(artTinted(s, opts.tint), p.sx, p.sy, p.sw, p.sh, -cx * k, -box[3] * k, p.sw * k, p.sh * k);
    ctx.restore();
    return true;
  }

  // ---- Who looks like what ---------------------------------------------------------------------------
  // Returns { kind, tint, size } for a character (party member or foe).
  // Returns { kind, tint, size } (the Pixel Crawler figure) and, where creature art is authored, { art, artTint,
  // artScale, artSize } (artSize: how tall it stands, in the units of size, for bars and icons over its head).
  function look(c) {
    if (!c) return { kind: 'orc', tint: '', size: 1 };
    const l = c.look || {};
    if ((c.side === 'party' || !c.side) && !c.monster && !c.conjured) {
      const art = typeof l.sprite === 'string' && l.sprite.startsWith('art:') ? l.sprite.slice(4) : null;
      const kind = KINDS.includes(l.sprite) ? l.sprite : (KIT_KIND[l.kit] || 'knight');
      return withArt({ kind, tint: (TINTS[l.tint] || TINTS[0])[0], size: 1 }, art ? { art, artTint: (TINTS[l.tint] || TINTS[0])[0] } : null);
    }
    return fromSpec(c.sprite, c);
  }

  function withArt(L, spec) {
    if (!spec || !spec.art || !artCat()[spec.art]) return L;
    const def = artCat()[spec.art];
    return Object.assign(L, { art: spec.art, artTint: spec.artTint || '', artScale: spec.artScale || 1, artSize: (def.height || 1.3) * (spec.artScale || 1) * 0.8 }); // bars and icons sit over the head at the map's scale 3
  }

  function fromSpec(spec, c) {
    if (spec && typeof spec === 'object') return withArt({ kind: KINDS.includes(spec.kind) ? spec.kind : 'orc', tint: spec.tint || '', size: spec.scale || 1 }, spec);
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
      const x0 = cv.getContext('2d');
      if (L.art) {
        const p = artPick(L.art, 'idle', 0, false);
        if (p) {
          // The head and shoulders: the top of the figure's box, as a square.
          const box = p.def.box || [0, 0, p.sw, p.sh];
          const side = Math.min(box[2] - box[0], (box[3] - box[1]) * 0.55);
          const cx = (box[0] + box[2]) / 2;
          x0.clearRect(0, 0, size, size);
          x0.imageSmoothingEnabled = true;
          x0.save();
          if (p.mirror) { x0.translate(size, 0); x0.scale(-1, 1); }
          x0.drawImage(artTinted(p.s, L.artTint), p.sx + cx - side / 2, p.sy + box[1], side, side, 0, 0, size, size);
          x0.restore();
          return true;
        }
        if (!artSheet(L.art, 'idle').failed) return false;
      }
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
      if (L.art && drawArt(x, L.art, 'idle', t, 16 * scale, 31 * scale, (30 * scale) / Math.max(1, (artCat()[L.art] || {}).height || 1.3), { tint: L.artTint, shadow: false })) return;
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
  UI.Sprites = { forEncounter, crowd, KINDS, PARTY_KINDS, partyKinds, TINTS, KIT_KIND, draw, drawArt, artReady, artSheet, look, lookFor, portrait, figure, sheet, whenReady: (f) => waiting.push(f), preload: () => { KINDS.forEach((k) => { sheet(k, 'idle'); sheet(k, 'run'); }); for (const k of Object.keys(artCat())) artSheet(k, (artCat()[k].type === 'pixellab') ? 'south-east' : 'idle'); } };
  // Portraits everywhere in the game are now the sprite's face.
  UI.Art.portrait = (c, px) => portrait(c, px);
})(globalThis.BBB);