/* Z-Craft — textures pixel art générées par le code (aucune image externe) */

window.ZC = window.ZC || {};

(function () {
  const T = ZC.T;
  const B = ZC.B;

  // Générateur pseudo-aléatoire déterministe (mêmes textures et même monde pour une graine donnée)
  ZC.rng = (seed) => {
    let s = seed | 0;
    return () => {
      s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  const shade = (c, f) => c.map((v) => Math.max(0, Math.min(255, Math.round(v * f))));
  const css = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;

  // Crée une texture canvas découpée en frames nommées (chaînes)
  function canvasTex(scene, key, w, h, frames, draw) {
    if (scene.textures.exists(key)) return;
    const tex = scene.textures.createCanvas(key, w * frames.length, h);
    const ctx = tex.getContext();
    frames.forEach((name, i) => {
      draw(ctx, i * w, name, i);
      tex.add(name, 0, i * w, 0, w, h);
    });
    tex.refresh();
    tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }

  // Dessine un motif 8×8 (une lettre = une couleur de la palette, « . » = transparent)
  function pattern(ctx, ox, oy, size, rows, palette, r, noise = 0.08) {
    const p = size / 8;
    rows.forEach((row, y) => {
      for (let x = 0; x < 8; x++) {
        const c = palette[row[x]];
        if (!c) continue;
        ctx.fillStyle = css(noise ? shade(c, 1 + (r() - 0.5) * noise) : c);
        ctx.fillRect(ox + x * p, oy + y * p, p, p);
      }
    });
  }

  function noiseFill(ctx, ox, size, base, spread, r) {
    const p = size / 8;
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        ctx.fillStyle = css(shade(base, 1 + (r() - 0.5) * spread));
        ctx.fillRect(ox + x * p, y * p, p, p);
      }
    }
  }

  const C = {
    dirt: [134, 96, 67], grass: [96, 166, 56], stone: [128, 128, 132], log: [104, 82, 50],
    leaves: [56, 128, 42], sand: [220, 208, 146], planks: [166, 134, 80], bedrock: [70, 70, 74],
    abyss: [44, 44, 62], corrupt: [74, 38, 104],
  };

  const PATTERNS = {
    [B.BRICK]: {
      rows: ['BBBMBBBB', 'BLBMBLBB', 'MMMMMMMM', 'BMBBBBMB', 'BMBLBBMB', 'MMMMMMMM', 'BBBMBBBB', 'BLBMBBLB'],
      pal: { B: [150, 140, 118], M: [92, 86, 78], L: [176, 166, 140] }, noise: 0.14,
    },
    [B.TEMPLE]: {
      rows: ['TTTTTTTM', 'TMMMMMTM', 'TMTTTMTM', 'TMTGTMTM', 'TMTTTMTM', 'TMMMMMTM', 'TTTTTTTM', 'MMMMMMMM'],
      pal: { T: [58, 96, 90], M: [28, 48, 46], G: [222, 182, 72] }, noise: 0.1,
    },
    [B.SHELL]: {
      rows: ['SSSDSSSS', 'SCSDSCCS', 'SSCDCSSS', 'DDDCDDDD', 'SSCDCSSS', 'SCSDSCSS', 'SSSDSSCS', 'DDDDDDDD'],
      pal: { S: [34, 52, 110], C: [90, 200, 240], D: [20, 30, 70] }, noise: 0.1,
    },
    [B.CORE]: {
      rows: ['..DDDD..', '.DCCCCD.', 'DCCWWCCD', 'DCWWWWCD', 'DCWWWWCD', 'DCCWWCCD', '.DCCCCD.', '..DDDD..'],
      pal: { D: [20, 60, 120], C: [70, 170, 230], W: [170, 230, 255] }, noise: 0.05,
    },
    [B.CORE_ON]: {
      rows: ['..DDDD..', '.DCCCCD.', 'DCCWWCCD', 'DCWWWWCD', 'DCWWWWCD', 'DCCWWCCD', '.DCCCCD.', '..DDDD..'],
      pal: { D: [80, 200, 255], C: [170, 250, 255], W: [255, 255, 255] }, noise: 0.03,
    },
    [B.TORCH]: {
      rows: ['........', '...YY...', '..YFFY..', '..OFFO..', '...SS...', '...SS...', '...SS...', '...SS...'],
      pal: { Y: [255, 240, 150], F: [255, 196, 60], O: [255, 120, 30], S: [120, 85, 45] }, noise: 0.05,
    },
    [B.BENCH]: {
      rows: ['........', '.T....T.', 'PPPPPPPP', 'DDDDDDDD', '.D....D.', '.D....D.', '.D....D.', '.D....D.'],
      pal: { P: [176, 136, 80], D: [110, 80, 45], T: [150, 150, 160] }, noise: 0.08,
    },
    [B.FURNACE]: {
      rows: ['SSSSSSSS', 'SLSSSSLS', 'SSDDDDSS', 'SDDDDDDS', 'SDYFFYDS', 'SDFFFFDS', 'SSSSSSSS', 'SLSSSSLS'],
      pal: { S: [118, 118, 122], L: [150, 150, 154], D: [52, 52, 56], F: [255, 140, 40], Y: [255, 214, 96] }, noise: 0.1,
    },
    [B.CHEST]: {
      rows: ['........', 'DDDDDDDD', 'DWWWWWWD', 'DWWWWWWD', 'DDDGGDDD', 'DWWGGWWD', 'DWWWWWWD', 'DDDDDDDD'],
      pal: { W: [156, 104, 52], D: [92, 60, 30], G: [242, 202, 64] }, noise: 0.08,
    },
    [B.PURIFIER]: {
      rows: ['....W...', '...WCC..', '...CWC..', '..CCWCC.', '..DCCCD.', '...DCD..', '.BBBBBB.', 'BBBBBBBB'],
      pal: { W: [255, 255, 255], C: [150, 240, 255], D: [60, 140, 210], B: [110, 110, 130] }, noise: 0.05,
    },
    [B.GEN]: {
      rows: ['MMMMMMMM', 'MDDDDDDM', 'MDDDYDDM', 'MDDYYDDM', 'MDYYYYDM', 'MDDYDDDM', 'MDDDDDDM', 'MMMMMMMM'],
      pal: { M: [110, 115, 125], D: [56, 58, 66], Y: [130, 110, 50] }, noise: 0.06,
    },
    [B.GEN_ON]: {
      rows: ['MMMMMMMM', 'MDDDDDDM', 'MDDDYDDM', 'MDDYYDDM', 'MDYYYYDM', 'MDDYDDDM', 'MDDDDDDM', 'MMMMMMMM'],
      pal: { M: [120, 125, 135], D: [96, 52, 30], Y: [255, 226, 70] }, noise: 0.06,
    },
    [B.LAMP]: {
      rows: ['..MMMM..', '.MGGGGM.', '.MGWGGM.', '.MGGGGM.', '.MGGGGM.', '..MMMM..', '...MM...', '..MMMM..'],
      pal: { M: [100, 104, 114], G: [86, 86, 70], W: [120, 120, 100] }, noise: 0.05,
    },
    [B.LAMP_ON]: {
      rows: ['..MMMM..', '.MGGGGM.', '.MGWGGM.', '.MGGGGM.', '.MGGGGM.', '..MMMM..', '...MM...', '..MMMM..'],
      pal: { M: [120, 124, 134], G: [255, 236, 140], W: [255, 255, 230] }, noise: 0.04,
    },
    [B.DRILL]: {
      rows: ['MMMMMMMM', 'MYDYDYDM', 'MDYDYDYM', 'MMMMMMMM', '..MBBM..', '...BB...', '...BB...', '....B...'],
      pal: { M: [110, 115, 125], D: [50, 52, 60], Y: [232, 182, 40], B: [190, 190, 200] }, noise: 0.06,
    },
    [B.DOOR]: {
      rows: ['DIIIIIID', 'DILLLLID', 'DIIIIIID', 'DIIIIKID', 'DIIIIIID', 'DILLLLID', 'DIIIIIID', 'DDDDDDDD'],
      pal: { I: [140, 145, 155], D: [76, 80, 92], L: [190, 195, 205], K: [250, 210, 60] }, noise: 0.06,
    },
    [B.DOOR_OPEN]: {
      rows: ['DI......', 'DI......', 'DI......', 'DI......', 'DI......', 'DI......', 'DI......', 'DD......'],
      pal: { I: [140, 145, 155], D: [76, 80, 92] }, noise: 0.06,
    },
  };

  const OVERLAYS = {
    [B.CRYSTAL]: {
      base: [72, 72, 88],
      rows: ['........', '..W.....', '..CW..C.', '.CCC.CW.', '.CDC.CC.', '..C..CD.', '......C.', '........'],
      pal: { C: [80, 220, 240], W: [220, 255, 255], D: [40, 140, 180] },
    },
    [B.CORRUPT]: {
      base: C.corrupt,
      rows: ['.V......', '..V...V.', '...V.V..', '....V...', '...V....', '.VV...V.', 'V.....V.', '.....V..'],
      pal: { V: [196, 110, 255] },
    },
    [B.METEOR]: {
      base: [56, 40, 40],
      rows: ['........', '.O...Y..', '..O.O...', '...O....', '..OYO...', '.O...O..', 'O.....O.', '........'],
      pal: { O: [255, 130, 40], Y: [255, 214, 96] },
    },
  };

  const ORES = { [B.COAL]: [28, 28, 30], [B.IRON]: [216, 175, 147], [B.GOLD]: [252, 228, 70] };
  const ORE_SPOTS = [[1, 1], [2, 1], [1, 2], [5, 2], [6, 2], [5, 3], [2, 5], [3, 5], [3, 6], [6, 6]];

  function paintBlock(ctx, ox, id) {
    const r = ZC.rng(id * 977 + 13);
    const p = T / 8;
    const px = (x, y, c) => {
      ctx.fillStyle = css(c);
      ctx.fillRect(ox + x * p, y * p, p, p);
    };
    if (PATTERNS[id]) {
      const pt = PATTERNS[id];
      pattern(ctx, ox, 0, T, pt.rows, pt.pal, r, pt.noise);
      return;
    }
    if (OVERLAYS[id]) {
      const ov = OVERLAYS[id];
      noiseFill(ctx, ox, T, ov.base, 0.25, r);
      pattern(ctx, ox, 0, T, ov.rows, ov.pal, r, 0.1);
      return;
    }
    if (ORES[id]) {
      noiseFill(ctx, ox, T, C.stone, 0.25, r);
      ORE_SPOTS.forEach(([x, y]) => px(x, y, shade(ORES[id], 0.9 + r() * 0.2)));
      return;
    }
    switch (id) {
      case B.GRASS:
        noiseFill(ctx, ox, T, C.dirt, 0.3, r);
        for (let x = 0; x < 8; x++) {
          px(x, 0, shade(C.grass, 1.05 + (r() - 0.5) * 0.25));
          px(x, 1, shade(C.grass, 0.9 + (r() - 0.5) * 0.25));
          if (r() < 0.5) px(x, 2, shade(C.grass, 0.8));
        }
        break;
      case B.DIRT: noiseFill(ctx, ox, T, C.dirt, 0.3, r); break;
      case B.STONE: noiseFill(ctx, ox, T, C.stone, 0.25, r); break;
      case B.SAND: noiseFill(ctx, ox, T, C.sand, 0.12, r); break;
      case B.BEDROCK: noiseFill(ctx, ox, T, C.bedrock, 0.9, r); break;
      case B.ABYSS:
        noiseFill(ctx, ox, T, C.abyss, 0.3, r);
        for (let i = 0; i < 4; i++) px(Math.floor(r() * 8), Math.floor(r() * 8), [86, 64, 120]);
        break;
      case B.LOG:
        for (let y = 0; y < 8; y++) {
          for (let x = 0; x < 8; x++) {
            const f = x === 0 || x === 7 ? 0.7 : x % 3 === 1 ? 0.85 : 1;
            px(x, y, shade(C.log, f * (1 + (r() - 0.5) * 0.15)));
          }
        }
        break;
      case B.LEAVES:
        for (let y = 0; y < 8; y++) {
          for (let x = 0; x < 8; x++) px(x, y, r() < 0.18 ? [30, 75, 22] : shade(C.leaves, 1 + (r() - 0.5) * 0.45));
        }
        break;
      case B.PLANKS:
        for (let y = 0; y < 8; y++) {
          for (let x = 0; x < 8; x++) {
            const seam = y % 4 === 3 || (y < 4 && x === 2) || (y >= 4 && x === 6);
            px(x, y, shade(C.planks, (seam ? 0.72 : 1) * (1 + (r() - 0.5) * 0.1)));
          }
        }
        break;
      default: break;
    }
  }

  // --- Icônes d'objets (hors blocs) ---
  const PICK = ['........', '.HHHHH..', 'H...SHH.', '...S..HH', '..S....H', '.S......', 'S.......', '........'];
  const SWORD = ['......WH', '.....WHD', '....WHD.', '.S.WHD..', '..SHD...', '..SS....', '.S..S...', 'S.......'];
  const INGOT = ['........', '........', '..HHHH..', '.HWWWHH.', 'HHHHHHD.', 'DDDDDDD.', '........', '........'];
  const CHUNK = ['........', '..GGG...', '.GHHGG..', '.GHGGHG.', '..GGHHG.', '...GGG..', '........', '........'];
  const GEM = ['...W....', '..WH....', '..HHH.W.', '.HHDH.H.', '.HDDHHH.', '..HDDH..', '...HH...', '........'];
  const STICK = ['......S.', '.....S..', '....S...', '...S....', '..S.....', '.S......', '........', '........'];
  const ARMOR = ['.HH..HH.', 'HHHHHHHH', 'HHWHHWHH', '.HHHHHH.', '.HHHHHH.', '.HHDDHH.', '.HH..HH.', '........'];
  const POTION = ['...SS...', '...WW...', '..W..W..', '.WHHHHW.', '.WHHWHW.', '.WHHHHW.', '..WWWW..', '........'];
  const HEART = ['.HH.HH..', 'HWHHHHH.', 'HHHHHHH.', 'HHHHHHH.', '.HHHHH..', '..HHH...', '...H....', '........'];
  const CROWN = ['........', 'H..H..H.', 'HH.H.HH.', 'HHHHHHH.', 'HWHDHWH.', 'HHHHHHH.', '........', '........'];

  const tool = (rows, mat) => {
    const c = ZC.MATERIAL_COLORS[mat];
    return { rows, pal: { H: c, W: shade(c, 1.3), D: shade(c, 0.65), S: [120, 85, 45] } };
  };
  const ICONS = {
    coal: { rows: CHUNK, pal: { G: [50, 50, 54], H: [20, 20, 22] } },
    iron_ore: { rows: CHUNK, pal: { G: [128, 128, 132], H: [216, 175, 147] } },
    gold_ore: { rows: CHUNK, pal: { G: [128, 128, 132], H: [252, 228, 70] } },
    iron: { rows: INGOT, pal: { H: [200, 200, 210], W: [240, 240, 248], D: [130, 130, 140] } },
    gold: { rows: INGOT, pal: { H: [240, 200, 50], W: [255, 240, 140], D: [170, 130, 30] } },
    crystal: { rows: GEM, pal: { H: [90, 225, 240], W: [230, 255, 255], D: [40, 140, 190] } },
    fragment: { rows: GEM, pal: { H: [250, 200, 80], W: [255, 250, 210], D: [80, 200, 230] } },
    stick: { rows: STICK, pal: { S: [130, 92, 50] } },
    armor_iron: { rows: ARMOR, pal: { H: [190, 192, 202], W: [240, 240, 248], D: [110, 110, 120] } },
    armor_crystal: { rows: ARMOR, pal: { H: [100, 220, 240], W: [220, 255, 255], D: [40, 120, 170] } },
    potion: { rows: POTION, pal: { S: [130, 92, 50], W: [210, 230, 240], H: [230, 60, 80] } },
    golem_heart: { rows: HEART, pal: { H: [140, 140, 150], W: [90, 230, 255] } },
    crown: { rows: CROWN, pal: { H: [240, 196, 60], W: [200, 110, 255], D: [230, 60, 80] } },
  };
  ['wood', 'stone', 'iron', 'gold', 'crystal'].forEach((m) => {
    ICONS['pick_' + m] = tool(PICK, m);
    ICONS['sword_' + m] = tool(SWORD, m);
  });
  ZC.ICON_IDS = Object.keys(ICONS);

  // Texture et frame d'un objet pour l'affichage
  ZC.itemIcon = (id) => {
    const it = ZC.ITEMS[id];
    if (it && it.block !== undefined) return { key: 'zc-tiles', frame: 'b' + it.block };
    return { key: 'zc-items', frame: 'i-' + id };
  };

  // --- Personnages ---
  function drawHuman(ctx, ox, o, frame) {
    const rect = (c, x, y, w, h) => {
      ctx.fillStyle = typeof c === 'number' ? '#' + c.toString(16).padStart(6, '0') : c;
      ctx.fillRect(ox + x, y, w, h);
    };
    // Jambes : immobile, foulée, saut
    const legs = [[3, 9, 42], [1, 11, 42], [0, 12, 40]][frame];
    rect(o.pants, legs[0], 29, 6, legs[2] - 29);
    rect(o.pants, legs[1], 29, 6, legs[2] - 29);
    rect(o.shoes || 0x333333, legs[0], legs[2], 6, 2);
    rect(o.shoes || 0x333333, legs[1], legs[2], 6, 2);
    rect(o.shirt, 1, 14, 16, 16);
    // Tête et visage (orienté vers la droite)
    rect(o.skin, 1, 0, 16, 14);
    rect(o.hair, 1, 0, 16, 4);
    rect(o.hair, 1, 4, 3, 3);
    rect(0xffffff, 9, 6, 3, 2);
    rect(0xffffff, 14, 6, 3, 2);
    rect(o.eye || 0x1d1f3a, 10, 6, 2, 2);
    rect(o.eye || 0x1d1f3a, 15, 6, 2, 2);
    if (o.mouth) rect(o.mouth, 11, 10, 5, 1);
    if (o.helmet) {
      rect(o.helmet, 0, 0, 18, 5);
      rect(o.helmet, 0, 5, 3, 4);
    }
    if (o.lamp) rect(o.lamp, 12, 1, 4, 3);
    // Bras
    const dark = Phaser.Display.Color.ValueToColor(o.shirt).darken(18).color;
    if (o.arms === 'forward') {
      const swing = frame === 1 ? 1 : 0;
      rect(dark, 7, 16 + swing, 8, 5);
      rect(o.skin, 15, 16 + swing, 3, 5);
    } else if (o.arms === 'up') {
      rect(dark, 6, 4 + frame, 6, 12);
      rect(o.skin, 6, 1 + frame, 6, 4);
    } else {
      const swing = frame === 1 ? 2 : 0;
      rect(dark, 6 + swing, 14, 6, 10);
      rect(o.skin, 6 + swing, 24, 6, 4);
    }
    if (o.belt) rect(o.belt, 1, 27, 16, 2);
  }

  const HUMANS = {
    'zc-player': { skin: 0xc99a74, hair: 0x4a3222, shirt: 0x2fa7b5, pants: 0x3b47a8, belt: 0x6b4a2a },
    'zc-mob-classic': { skin: 0x5f9e4a, hair: 0x3f7a30, shirt: 0x2b9da0, pants: 0x3f3f9e, arms: 'forward', mouth: 0x2d4a22 },
    'zc-mob-fast': { skin: 0x84b86a, hair: 0x507a3a, shirt: 0xb03a3a, pants: 0x4a3a3a, arms: 'forward', eye: 0xffe14d },
    'zc-mob-armored': { skin: 0x5f9e4a, hair: 0x3f7a30, shirt: 0x9aa3ad, pants: 0x6d7580, arms: 'forward', helmet: 0xb6bec8, shoes: 0x50555c },
    'zc-mob-climber': { skin: 0x4e8a3c, hair: 0x2f5a24, shirt: 0x7a5a32, pants: 0x4a3a28, arms: 'up' },
    'zc-mob-burrower': { skin: 0x7a8a4a, hair: 0x4a4a28, shirt: 0x8a6440, pants: 0x5a4a30, arms: 'forward', helmet: 0xe08a2a, lamp: 0xfff2a0 },
    'zc-mob-corrupt': { skin: 0x8a4fc9, hair: 0x4a2470, shirt: 0x3a1c5a, pants: 0x281440, arms: 'forward', eye: 0xff4dff, mouth: 0xff4dff },
  };

  function drawGolem(ctx, ox, frame) {
    const r = ZC.rng(77 + frame);
    const rect = (c, x, y, w, h) => {
      ctx.fillStyle = css(c);
      ctx.fillRect(ox + x, y, w, h);
    };
    const stone = [118, 118, 128];
    // Corps en blocs de pierre
    for (let y = 12; y < 50; y += 4) {
      for (let x = 8; x < 36; x += 4) rect(shade(stone, 0.85 + r() * 0.3), x, y, 4, 4);
    }
    for (let y = 0; y < 14; y += 4) {
      for (let x = 12; x < 32; x += 4) rect(shade(stone, 0.9 + r() * 0.25), x, y, 4, 4);
    }
    rect([40, 220, 255], 16, 5, 4, 3);
    rect([40, 220, 255], 25, 5, 4, 3);
    rect([30, 160, 200], 18, 24, 8, 8);
    rect([160, 250, 255], 20, 26, 4, 4);
    // Bras (levés pendant la frappe)
    const ay = frame === 1 ? 0 : 14;
    rect(shade(stone, 0.75), 0, ay, 8, 30);
    rect(shade(stone, 0.75), 36, ay, 8, 30);
    rect(shade(stone, 0.6), 0, ay + 26, 8, 4);
    rect(shade(stone, 0.6), 36, ay + 26, 8, 4);
    rect(shade(stone, 0.7), 10, 50, 10, 8);
    rect(shade(stone, 0.7), 24, 50, 10, 8);
  }

  function drawKing(ctx, ox, frame) {
    const rect = (c, x, y, w, h) => {
      ctx.fillStyle = typeof c === 'number' ? '#' + c.toString(16).padStart(6, '0') : c;
      ctx.fillRect(ox + x, y, w, h);
    };
    rect(0x3a1250, 0, 18, 10, 30); // cape
    const legs = frame === 1 ? [[6, 12], [18, 12]] : [[8, 12], [16, 12]];
    legs.forEach(([x]) => rect(0x281440, x, 38, 7, 14));
    legs.forEach(([x]) => rect(0x1a0c28, x, 52, 7, 2));
    rect(0x4a1e6e, 4, 20, 22, 20);
    rect(0xf2c440, 4, 34, 22, 3);
    rect(0x8a4fc9, 6, 6, 18, 15);
    rect(0xf2c440, 5, 0, 20, 6);
    rect(0xf2c440, 5, -2, 3, 4);
    rect(0xff4d6a, 13, 1, 4, 3);
    rect(0xffffff, 15, 11, 3, 3);
    rect(0xffffff, 21, 11, 3, 3);
    rect(0xff4dff, 16, 11, 2, 3);
    rect(0xff4dff, 22, 11, 2, 3);
    rect(0x2a0c40, 15, 17, 8, 2);
    rect(0x5e2c8a, 14, 22 + frame * 2, 14, 6);
    rect(0x8a4fc9, 26, 22 + frame * 2, 4, 6);
  }

  // Parois de fond (derrière les grottes), placées après les blocs dans la même bande
  ZC.WALL_DIRT = ZC.BLOCKS.length;
  ZC.WALL_STONE = ZC.BLOCKS.length + 1;

  ZC.makeTextures = (scene) => {
    const frames = ZC.BLOCKS.map((b, id) => 'b' + id).concat(['w-dirt', 'w-stone']);
    canvasTex(scene, 'zc-tiles', T, T, frames, (ctx, ox, name, id) => {
      if (name === 'w-dirt') noiseFill(ctx, ox, T, [58, 42, 30], 0.25, ZC.rng(501));
      else if (name === 'w-stone') noiseFill(ctx, ox, T, [44, 44, 52], 0.25, ZC.rng(502));
      else if (id > 0) paintBlock(ctx, ox, id);
    });
    canvasTex(scene, 'zc-items', T, T, ZC.ICON_IDS.map((id) => 'i-' + id), (ctx, ox, name, i) => {
      const icon = ICONS[ZC.ICON_IDS[i]];
      pattern(ctx, ox, 0, T, icon.rows, icon.pal, ZC.rng(i * 31 + 7), 0.06);
    });
    Object.keys(HUMANS).forEach((key) => {
      canvasTex(scene, key, 18, 44, ['f0', 'f1', 'f2'], (ctx, ox, name, i) => drawHuman(ctx, ox, HUMANS[key], i));
    });
    canvasTex(scene, 'zc-golem', 44, 58, ['f0', 'f1'], (ctx, ox, name, i) => drawGolem(ctx, ox, i));
    canvasTex(scene, 'zc-king', 30, 54, ['f0', 'f1'], (ctx, ox, name, i) => drawKing(ctx, ox, i));
    canvasTex(scene, 'zc-px', 4, 4, ['p'], (ctx, ox) => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(ox, 0, 4, 4);
    });
    // Cœurs de l'interface : plein, moitié, vide (avec contour sombre)
    const HEART_ROWS = ['.RR.RR..', 'RWRRRRR.', 'RRRRRRR.', 'RRRRRRR.', '.RRRRR..', '..RRR...', '...R....', '........'];
    canvasTex(scene, 'zc-heart', 18, 18, ['full', 'half', 'empty'], (ctx, ox, name) => {
      const red = { R: [255, 77, 94], W: [255, 200, 205] };
      const grey = { R: [58, 61, 92], W: [80, 84, 120] };
      const shadow = { R: [0, 0, 0], W: [0, 0, 0] };
      ctx.globalAlpha = 0.5;
      pattern(ctx, ox + 2, 2, 16, HEART_ROWS, shadow, Math.random, 0);
      ctx.globalAlpha = 1;
      pattern(ctx, ox, 0, 16, HEART_ROWS, name === 'full' ? red : grey, Math.random, 0);
      if (name === 'half') {
        const left = HEART_ROWS.map((row) => row.slice(0, 4) + '....');
        pattern(ctx, ox, 0, 16, left, red, Math.random, 0);
      }
    });
    // Ciel étoilé (dessiné une fois)
    canvasTex(scene, 'zc-stars', 960, 420, ['s'], (ctx) => {
      const r = ZC.rng(4242);
      for (let i = 0; i < 110; i++) {
        ctx.fillStyle = `rgba(255,255,255,${0.4 + r() * 0.6})`;
        const size = r() < 0.2 ? 2 : 1;
        ctx.fillRect(Math.floor(r() * 960), Math.floor(r() * 420), size, size);
      }
    });
  };
})();
