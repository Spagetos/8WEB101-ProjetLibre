/* Z-Craft — génération procédurale du monde (déterministe pour une graine donnée) */

window.ZC = window.ZC || {};

(function () {
  const { W, H } = ZC;
  const B = ZC.B;

  ZC.generateWorld = (seed) => {
    const rand = ZC.rng(seed);
    const between = (a, b) => a + Math.floor(rand() * (b - a + 1));
    const hash = (x, y) => {
      const s = Math.sin(x * 127.1 + y * 311.7 + (seed % 1000) * 74.7) * 43758.5453;
      return s - Math.floor(s);
    };
    // Bruit de valeur lissé : des valeurs aléatoires sur une grille, interpolées entre elles
    const noise = (x, y) => {
      const ix = Math.floor(x);
      const iy = Math.floor(y);
      const fx = x - ix;
      const fy = y - iy;
      const sx = fx * fx * (3 - 2 * fx);
      const sy = fy * fy * (3 - 2 * fy);
      const a = hash(ix, iy);
      const b = hash(ix + 1, iy);
      const c = hash(ix, iy + 1);
      const d = hash(ix + 1, iy + 1);
      return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
    };

    const grid = new Uint8Array(W * H);
    const inside = (x, y) => x >= 0 && x < W && y >= 0 && y < H;
    const get = (x, y) => (inside(x, y) ? grid[y * W + x] : B.BEDROCK);
    const set = (x, y, id) => { if (inside(x, y)) grid[y * W + x] = id; };
    const surface = new Int16Array(W);

    // Relief, couches de terre/sable, pierre puis roche abyssale
    for (let x = 0; x < W; x++) {
      const s = Math.floor(20 + noise(x / 28, 0.5) * 14 + noise(x / 9, 3.5) * 4);
      surface[x] = s;
      const desert = noise(x / 40, 9.5) > 0.68;
      const soil = 3 + Math.floor(noise(x / 5, 2) * 3);
      const abyss = 73 + Math.floor(noise(x / 10, 5.5) * 4);
      for (let y = s; y < H; y++) {
        if (y === s) set(x, y, desert ? B.SAND : B.GRASS);
        else if (y < s + soil) set(x, y, desert ? B.SAND : B.DIRT);
        else set(x, y, y >= abyss ? B.ABYSS : B.STONE);
      }
    }

    // Grottes : poches (bruit élevé) et tunnels (bruit proche de 0,5)
    for (let y = 0; y < H - 3; y++) {
      for (let x = 0; x < W; x++) {
        if (y <= surface[x] + 4) continue;
        const blob = noise(x / 12, y / 8) * 0.65 + noise(x / 5, y / 5) * 0.35;
        const tunnel = Math.abs(noise(x / 16 + 50, y / 10) - 0.5);
        if (blob > 0.68 || tunnel < 0.03) set(x, y, B.AIR);
      }
    }

    // Filons de minerais, plus rares et plus précieux en profondeur
    const vein = (id, count, minY, size) => {
      for (let i = 0; i < count; i++) {
        let x = between(0, W - 1);
        let y = between(minY, H - 4);
        for (let k = 0; k < size; k++) {
          if (get(x, y) === B.STONE || get(x, y) === B.ABYSS) set(x, y, id);
          x += between(-1, 1);
          y += between(-1, 1);
        }
      }
    };
    vein(B.COAL, 170, 25, 6);
    vein(B.IRON, 110, 38, 5);
    vein(B.GOLD, 55, 52, 4);
    vein(B.CRYSTAL, 16, 62, 3);

    // --- Structures ---
    const reserved = [];
    const isFree = (x, y, w, h) => x > 2 && x + w < W - 2 && y > 2 && y + h < H - 3 &&
      !reserved.some((r) => x < r.x + r.w + 4 && x + w + 4 > r.x && y < r.y + r.h + 4 && y + h + 4 > r.y);
    const reserve = (x, y, w, h) => reserved.push({ x, y, w, h });
    const place = (tries, w, h, pick) => {
      for (let i = 0; i < tries; i++) {
        const p = pick();
        if (isFree(p.x, p.y, w, h)) {
          reserve(p.x, p.y, w, h);
          return p;
        }
      }
      return null;
    };
    const carveEllipse = (cx, cy, rx, ry, fn) => {
      for (let y = cy - ry - 1; y <= cy + ry + 1; y++) {
        for (let x = cx - rx - 1; x <= cx + rx + 1; x++) {
          const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
          if (d <= 1 + (hash(x * 3, y * 3) - 0.5) * 0.25 && y < H - 3) fn(x, y, d);
        }
      }
    };
    const chests = [];
    const structures = [];
    const addChest = (x, y, loot) => {
      set(x, y, B.CHEST);
      chests.push({ i: y * W + x, loot });
      return y * W + x;
    };

    // Noyau ancien au fond du monde, protégé par une coque
    const core = { x: Math.floor(W / 2), y: H - 7 };
    {
      const x0 = core.x - 6;
      const y0 = H - 13;
      reserve(x0, y0, 13, 8);
      for (let y = y0; y < y0 + 8; y++) {
        for (let x = x0; x < x0 + 13; x++) {
          const edge = x === x0 || x === x0 + 12 || y === y0 || y === y0 + 7;
          set(x, y, edge ? B.SHELL : B.AIR);
        }
      }
      set(core.x, core.y, B.CORE);
      structures.push({ id: 'core', type: 'core', x: core.x, y: core.y, guards: [] });
    }

    // Arène du golem et repaire du roi zombie, de part et d'autre du monde
    const golemLeft = rand() < 0.5;
    const golem = { x: Math.floor(W * (golemLeft ? 0.2 : 0.8)), y: 52 };
    reserve(golem.x - 13, golem.y - 7, 27, 12);
    carveEllipse(golem.x, golem.y, 12, 6, (x, y) => set(x, y, y >= golem.y + 2 ? B.STONE : B.AIR));
    for (let x = golem.x - 10; x <= golem.x + 10; x++) set(x, golem.y + 2, B.STONE);
    // Torches anciennes autour de l'arène
    [-9, -4, 4, 9].forEach((dx) => { if (get(golem.x + dx, golem.y + 1) === B.AIR) set(golem.x + dx, golem.y + 1, B.TORCH); });
    for (let i = 0; i < 10; i++) {
      const x = golem.x + between(-12, 12);
      const y = golem.y + between(-6, 1);
      if (get(x, y) === B.STONE) set(x, y, B.CRYSTAL);
    }
    structures.push({ id: 'golem', type: 'arena', x: golem.x, y: golem.y, guards: [] });

    const king = { x: Math.floor(W * (golemLeft ? 0.78 : 0.22)), y: 66 };
    reserve(king.x - 10, king.y - 6, 21, 11);
    carveEllipse(king.x, king.y, 15, 10, (x, y) => {
      const id = get(x, y);
      if (id !== B.AIR && id !== B.BEDROCK && id !== B.SHELL) set(x, y, B.CORRUPT);
    });
    carveEllipse(king.x, king.y, 9, 5, (x, y) => set(x, y, y >= king.y + 2 ? B.CORRUPT : B.AIR));
    for (let x = king.x - 7; x <= king.x + 7; x++) set(x, king.y + 2, B.CORRUPT);
    structures.push({ id: 'king', type: 'lair', x: king.x, y: king.y, guards: [] });

    // Foyers de corruption initiaux
    for (let i = 0; i < 2; i++) {
      const p = place(20, 10, 10, () => ({ x: between(10, W - 20), y: between(42, 66) }));
      if (!p) continue;
      carveEllipse(p.x + 5, p.y + 5, between(3, 5), between(3, 4), (x, y) => {
        const id = get(x, y);
        if (id === B.STONE || id === B.DIRT || id === B.COAL || id === B.IRON) set(x, y, B.CORRUPT);
      });
    }

    // Cavernes de cristaux lumineux
    for (let i = 0; i < 6; i++) {
      const rx = between(6, 9);
      const ry = between(3, 5);
      const p = place(20, rx * 2, ry * 2, () => ({ x: between(12, W - 30), y: between(38, 66) }));
      if (!p) continue;
      const cx = p.x + rx;
      const cy = p.y + ry;
      carveEllipse(cx, cy, rx, ry, (x, y) => set(x, y, B.AIR));
      // Cristaux sur les parois
      for (let y = cy - ry - 1; y <= cy + ry + 1; y++) {
        for (let x = cx - rx - 1; x <= cx + rx + 1; x++) {
          const id = get(x, y);
          if ((id === B.STONE || id === B.ABYSS) && rand() < 0.3 &&
            (get(x + 1, y) === B.AIR || get(x - 1, y) === B.AIR || get(x, y + 1) === B.AIR || get(x, y - 1) === B.AIR)) {
            set(x, y, B.CRYSTAL);
          }
        }
      }
    }

    // Temples souterrains : coque en briques de temple, entrées latérales, coffre à fragment
    for (let i = 0; i < 2; i++) {
      const p = place(40, 15, 9, () => ({ x: between(10, W - 26), y: between(54, 64) }));
      if (!p) continue;
      const { x: x0, y: y0 } = p;
      for (let y = y0; y < y0 + 9; y++) {
        for (let x = x0; x < x0 + 15; x++) {
          const edge = x === x0 || x === x0 + 14 || y === y0 || y === y0 + 8;
          set(x, y, edge ? B.TEMPLE : B.AIR);
        }
      }
      // Piliers, toit à degrés et torches
      [x0 + 4, x0 + 10].forEach((x) => { for (let y = y0 + 1; y < y0 + 4; y++) set(x, y, B.TEMPLE); });
      for (let x = x0 + 2; x < x0 + 13; x++) set(x, y0 - 1, B.TEMPLE);
      for (let x = x0 + 5; x < x0 + 10; x++) set(x, y0 - 2, B.TEMPLE);
      set(x0 + 2, y0 + 4, B.TORCH);
      set(x0 + 12, y0 + 4, B.TORCH);
      // Entrées et couloirs vers l'extérieur
      for (let y = y0 + 5; y < y0 + 8; y++) {
        for (let k = 0; k < 7; k++) {
          set(x0 - k, y, B.AIR);
          set(x0 + 14 + k, y, B.AIR);
        }
      }
      for (let k = 0; k < 7; k++) {
        if (get(x0 - k, y0 + 8) === B.AIR) set(x0 - k, y0 + 8, B.STONE);
        if (get(x0 + 14 + k, y0 + 8) === B.AIR) set(x0 + 14 + k, y0 + 8, B.STONE);
      }
      const chest = addChest(x0 + 7, y0 + 7, [['fragment', 1], ['gold', 4], ['crystal', 3], ['potion', 1]]);
      structures.push({
        id: 'temple' + i, type: 'temple', x: x0 + 7, y: y0 + 4, chest,
        guards: [{ x: x0 + 3, y: y0 + 7, kind: 'armored' }, { x: x0 + 11, y: y0 + 7, kind: 'classic' }, { x: x0 + 7, y: y0 + 3, kind: 'fast' }],
      });
    }

    // Salles secrètes entièrement fermées
    for (let i = 0; i < 2; i++) {
      const p = place(40, 7, 5, () => ({ x: between(10, W - 18), y: between(40, 70) }));
      if (!p) continue;
      const { x: x0, y: y0 } = p;
      for (let y = y0; y < y0 + 5; y++) {
        for (let x = x0; x < x0 + 7; x++) {
          const edge = x === x0 || x === x0 + 6 || y === y0 || y === y0 + 4;
          set(x, y, edge ? B.BRICK : B.AIR);
        }
      }
      set(x0 + 1, y0 + 2, B.TORCH);
      const chest = addChest(x0 + 3, y0 + 3, [['fragment', 1], ['crystal', 4], ['iron', 4], ['potion', 2]]);
      structures.push({ id: 'secret' + i, type: 'secret', x: x0 + 3, y: y0 + 2, chest, guards: [] });
    }

    // Ruines abandonnées en surface (murs abîmés), gardées par des zombies
    for (let i = 0; i < 4; i++) {
      const p = place(40, 9, 7, () => {
        let x = between(8, W - 18);
        if (Math.abs(x + 4 - W / 2) < 16) x = (x + 40) % (W - 20);
        return { x, y: surface[x + 4] - 6 };
      });
      if (!p) continue;
      const { x: x0, y: y0 } = p;
      const floor = y0 + 6;
      for (let x = x0; x < x0 + 9; x++) {
        for (let y = y0 - 2; y < floor; y++) set(x, y, B.AIR);
        for (let y = floor; y < floor + 3; y++) if (get(x, y) === B.AIR) set(x, y, B.STONE);
        set(x, floor, B.BRICK);
      }
      for (let y = y0 + 1; y < floor; y++) {
        if (rand() > 0.25) set(x0, y, B.BRICK);
        if (rand() > 0.25) set(x0 + 8, y, B.BRICK);
      }
      for (let x = x0; x < x0 + 9; x++) if (rand() > 0.45) set(x, y0 + 1, B.BRICK);
      addChest(x0 + 4, floor - 1, [['iron', 3], ['torch', 6], ['coal', 6], ['planks', 10]]);
      structures.push({
        id: 'ruin' + i, type: 'ruin', x: x0 + 4, y: floor - 2,
        guards: [{ x: x0 + 2, y: floor - 1, kind: 'classic' }, { x: x0 + 6, y: floor - 1, kind: i % 2 ? 'fast' : 'classic' }],
      });
    }

    // Fond indestructible
    for (let x = 0; x < W; x++) {
      set(x, H - 1, B.BEDROCK);
      if (rand() < 0.5 && get(x, H - 2) !== B.SHELL) set(x, H - 2, B.BEDROCK);
      if (rand() < 0.2 && get(x, H - 3) !== B.SHELL) set(x, H - 3, B.BEDROCK);
    }

    // Arbres (jamais sur le point d'apparition ni dans une structure)
    for (let x = 3; x < W - 3; x++) {
      const top = surface[x];
      if (get(x, top) !== B.GRASS || Math.abs(x - W / 2) <= 3 || rand() > 0.18) continue;
      if (!isFree(x - 2, top - 9, 5, 9)) continue;
      const height = between(4, 6);
      for (let i = 1; i <= height; i++) set(x, top - i, B.LOG);
      const cy = top - height;
      for (let dy = -2; dy <= 1; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          if (Math.abs(dx) === 2 && (dy === -2 || dy === 1)) continue;
          if (get(x + dx, cy + dy) === B.AIR) set(x + dx, cy + dy, B.LEAVES);
        }
      }
      x += 4;
    }

    const sx = Math.floor(W / 2);
    let sy = 0;
    while (sy < H && get(sx, sy) === B.AIR) sy++;
    return { grid, surface, chests, structures, golem, king, core, spawn: { x: sx, y: sy } };
  };
})();
