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
  // scaled to an authored height in squares. pixellab characters are 8-direction figures: standing views and
  // animations by direction. Where a file is missing (the creature sheets are git-ignored until their licence is
  // settled) the look's Pixel Crawler `kind` is drawn instead.
  const artCat = () => ((G.Content && G.Content.world && G.Content.world.art) || {});
  const artSheets = {};  // `${key}|${anim}` -> { img, ok, failed, tinted }

  // pixellab sheets are keyed by their file (a standing view or one animation frame); creature sheets by anim.
  function artFile(key, def, anim) {
    return def.type === 'pixellab' ? anim : ART_DIR + key + '-' + anim + '.png';
  }

  function artSheet(key, anim) {
    const k = key + '|' + anim;
    if (artSheets[k]) return artSheets[k];
    const def = artCat()[key];
    const s = artSheets[k] = { img: null, ok: false, failed: !def, tinted: {} };
    if (!HAS_IMG || !def) return s;
    s.img = new Image();
    s.img.onload = () => { if (def.recolor) s.img = recolored(s.img, def.recolor); s.ok = true; for (const f of waiting.splice(0)) f(); };
    s.img.onerror = () => { s.failed = true; };
    s.img.src = artFile(key, def, anim);
    return s;
  }

  // A canvas of the image with each pixel's brightness mapped onto a colour ramp ([[brightness 0..1, '#rrggbb'], ...],
  // ascending): one figure in another material, its shading kept. Or a list of rules {hue, sat, light, ramp}: a pixel
  // takes the first rule whose ranges it falls in ([lo, hi]; a hue range may wrap past 360), and keeps its colour if
  // none does, so one part of a figure (its eyes, its scales) can change on its own.
  function recolored(img, recolor) {
    if (typeof document === 'undefined') return img;
    const rules = (Array.isArray(recolor[0]) ? [{ ramp: recolor }] : recolor).map((r) => ({
      ...r, stops: r.ramp.map(([at, hex]) => [at, [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))]),
    }));
    const inside = (v, r) => !r || (r[0] <= r[1] ? v >= r[0] && v <= r[1] : v >= r[0] || v <= r[1]);
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height), px = d.data;
    for (let i = 0; i < px.length; i += 4) {
      if (!px[i + 3]) continue;
      const [h, s, li] = hsl(px[i], px[i + 1], px[i + 2]);
      const rule = rules.find((r) => inside(h, r.hue) && inside(s, r.sat) && inside(li, r.light));
      if (!rule) continue;
      const stops = rule.stops, l = (0.3 * px[i] + 0.59 * px[i + 1] + 0.11 * px[i + 2]) / 255;
      let j = 1;
      while (j < stops.length - 1 && l > stops[j][0]) j++;
      const [a, ca] = stops[j - 1], [b, cb] = stops[j], t = Math.max(0, Math.min(1, (l - a) / Math.max(1e-6, b - a)));
      for (let k = 0; k < 3; k++) px[i + k] = Math.round(ca[k] + (cb[k] - ca[k]) * t);
    }
    x.putImageData(d, 0, 0);
    return c;
  }

  // Hue in degrees, saturation and lightness 0..1 (HSL).
  function hsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, dd = mx - mn;
    if (!dd) return [0, 0, l];
    const s = l > 0.5 ? dd / (2 - mx - mn) : dd / (mx + mn);
    const h = mx === r ? (g - b) / dd + (g < b ? 6 : 0) : mx === g ? (b - r) / dd + 2 : (r - g) / dd + 4;
    return [h * 60, s, l];
  }

  // The eight compass directions, clockwise from east (screen y points down), and the one nearest a vector.
  const DIRS = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];
  const dirOf = (dx, dy) => DIRS[((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) % 8) + 8) % 8];
  // Of the directions a character has, the one nearest `want`.
  function nearestDir(want, have) {
    const i = DIRS.indexOf(want);
    if (i < 0 || have.includes(want)) return have.includes(want) ? want : have[0];
    let best = have[0], bd = 9;
    for (const d of have) { const j = DIRS.indexOf(d), k = Math.min((i - j + 8) % 8, (j - i + 8) % 8); if (k < bd) { bd = k; best = d; } }
    return best;
  }
  const MIRROR = { east: 'west', 'south-east': 'south-west', south: 'south', 'south-west': 'south-east', west: 'east', 'north-west': 'north-east', north: 'north', 'north-east': 'north-west' };
  // Which of a clip's directions to play for `want`, and whether mirrored: [dir, mirror], or null if none will do.
  // `near` (walks) also takes the nearest direction one step (45 degrees) off.
  function clipDir(want, have, near) {
    if (have.includes(want)) return [want, false];
    if (have.includes(MIRROR[want])) return [MIRROR[want], true];
    if (!near || !have.length) return null;
    const d = nearestDir(want, have), k = Math.abs(DIRS.indexOf(d) - DIRS.indexOf(want));
    return Math.min(k, 8 - k) <= 1 ? [d, false] : null;
  }

  // An animation of a pixellab entry (art.yaml `walk`, `idle`, `attack`): { dir, anim, frames, dirs }. The walk is
  // built from the entry's own fields (walkFrames, walks) unless given as an object; a string names the animation.
  function clip(def, which) {
    const c = typeof def[which] === 'string' ? { anim: def[which] } : def[which];
    if (which === 'walk') return Object.assign({ dir: def.dir, anim: 'Walking', frames: def.walkFrames || 4, dirs: def.walks || ['east', 'west'] }, c);
    return c ? Object.assign({ dir: def.dir, frames: 4, dirs: DIRS }, c) : null;
  }

  // A pixellab sheet as artPick returns it. Every file of a character (a standing view, or a frame on a larger
  // canvas, or another state's on another) is centred on the entry's `size` canvas, where `box` is measured: ox, oy
  // place the file's top-left on that canvas.
  function framed(def, s, mirror) {
    if (!s.ok) return null;
    const [w, h] = Array.isArray(def.size) ? def.size : [def.size, def.size];
    return { def, s, sx: 0, sy: 0, sw: s.img.width, sh: s.img.height, ox: (w - s.img.width) / 2, oy: (h - s.img.height) / 2, mirror };
  }

  // Which sheet (and frame) shows this art in this animation; null if none of it can be drawn.
  // dir: the compass direction the figure faces (pixellab art has eight standing and some walking).
  function artPick(key, anim, frame, flip, dir, progress) {
    const def = artCat()[key];
    if (!def) return null;
    if (def.type === 'pixellab') {
      const want = DIRS.includes(dir) ? dir : flip ? 'south-west' : 'south-east';
      const stand = () => framed(def, artSheet(key, `${def.dir}/rotations/${nearestDir(want, def.rotations || DIRS)}.png`), false);
      // A clip plays in the direction asked, or mirrored from its twin; a walk also takes a direction one step off.
      // Anything else (no clip, no such direction, frames missing) shows the standing view.
      let c = anim === 'run' ? clip(def, 'walk') : anim === 'idle' || anim === 'attack' || anim === 'death' ? clip(def, anim) : null;
      let d = c && clipDir(want, c.dirs, anim === 'run');
      // A death is one picture (the clip's last frame), drawn whichever way the figure faced: a body lies as it fell.
      if (c && anim === 'death') { d = d || [c.dirs[0], !!flip]; frame = c.frames - 1; }
      // No walk this way: its standing animation, if it has one there.
      if (!d && anim === 'run' && (c = clip(def, 'idle'))) d = clipDir(want, c.dirs, false);
      if (!d) return stand();
      // An idle plays forward then back (`pingpong`), so a clip that drifts from its first pose never jumps back to it.
      const n = c.frames, m = c.pingpong && n > 2 ? 2 * n - 2 : n, k = ((frame % m) + m) % m;
      const i = anim === 'attack' && progress != null ? Math.min(n - 1, Math.floor(progress * n)) : k < n ? k : m - k;
      const s = artSheet(key, `${c.dir}/animations/${c.anim}/${d[0]}/frame_${String(i).padStart(3, '0')}.png`);
      return s.ok ? framed(def, s, d[1]) : stand();  // the standing view until the frame loads, or if it is missing
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

  // The sheet that decides whether a character's art is there at all.
  // Whether a pixellab entry has this clip (`death`: a fallen figure shows it instead of its standing view on its side).
  const hasClip = (key, which) => { const def = artCat()[key]; return !!(def && def.type === 'pixellab' && def[which]); };
  const artProbe = (key) => { const def = artCat()[key] || {}; return artSheet(key, def.type === 'pixellab' ? `${def.dir}/rotations/south-east.png` : 'idle'); };

  // A figure that floats (floats: true in art.yaml) plays its walk standing still too.
  const floats = (key) => !!(artCat()[key] || {}).floats;

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
    const p = artPick(key, anim, frame, opts.flip, opts.dir, opts.progress);
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
    ctx.drawImage(artTinted(s, opts.tint), p.sx, p.sy, p.sw, p.sh, ((p.ox || 0) - cx) * k, ((p.oy || 0) - box[3]) * k, p.sw * k, p.sh * k);
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
        const p = artPick(L.art, 'stand', 0, false); // a standing view (pixellab), or the idle sheet
        if (p) {
          // The head and shoulders: the top of the figure's box, as a square.
          const box = p.def.box || [0, 0, p.sw, p.sh];
          const side = Math.min(box[2] - box[0], (box[3] - box[1]) * 0.55);
          const cx = (box[0] + box[2]) / 2;
          x0.clearRect(0, 0, size, size);
          x0.imageSmoothingEnabled = true;
          x0.save();
          if (p.mirror) { x0.translate(size, 0); x0.scale(-1, 1); }
          x0.drawImage(artTinted(p.s, L.artTint), p.sx + cx - side / 2 - (p.ox || 0), p.sy + box[1] - (p.oy || 0), side, side, 0, 0, size, size);
          x0.restore();
          return true;
        }
        if (!artProbe(L.art).failed) return false;
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
  UI.Sprites = { DIRS, dirOf, hasClip, forEncounter, crowd, KINDS, PARTY_KINDS, partyKinds, TINTS, KIT_KIND, draw, drawArt, floats, artReady, artSheet, look, lookFor, portrait, figure, sheet, whenReady: (f) => waiting.push(f), preload: () => { KINDS.forEach((k) => { sheet(k, 'idle'); sheet(k, 'run'); }); for (const k of Object.keys(artCat())) artProbe(k); } };
  // Portraits everywhere in the game are now the sprite's face.
  UI.Art.portrait = (c, px) => portrait(c, px);
})(globalThis.BBB);