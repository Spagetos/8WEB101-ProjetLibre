/* Z-Craft — monde vivant : ciel, lumière, corruption, instabilité, événements, machines */

window.ZC = window.ZC || {};

(function () {
  const { T, W, H, CHUNK } = ZC;
  const B = ZC.B;
  const BLOCKS = ZC.BLOCKS;
  const CW = Math.ceil(W / CHUNK);
  const CH = Math.ceil(H / CHUNK);
  const CORRUPT_CAP = 3000;
  const SPREADABLE = new Set([B.STONE, B.DIRT, B.GRASS, B.SAND, B.COAL, B.IRON, B.ABYSS]);
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const DRILLABLE = new Set([B.LEAVES, B.LOG, B.CORRUPT, B.CRYSTAL, B.METEOR]);

  const mix = (a, b, t) => {
    const ca = Phaser.Display.Color.ValueToColor(a);
    const cb = Phaser.Display.Color.ValueToColor(b);
    return Phaser.Display.Color.GetColor(
      Math.round(ca.red + (cb.red - ca.red) * t),
      Math.round(ca.green + (cb.green - ca.green) * t),
      Math.round(ca.blue + (cb.blue - ca.blue) * t));
  };

  const SKY = {
    day: [0x4a9be0, 0xa8dcf5], dusk: [0x3a3f8a, 0xf29a5a], night: [0x05081a, 0x1a2448], blood: [0x1a0306, 0x6a1018],
  };

  ZC.LivingMixin = {
    initLiving() {
      this.instab = this.instab || new Float32Array(CW * CH);
      this.event = null;
      this.bloodMoon = false;
      this.eventRoll = 30;
      this.corruptTick = 0;
      this.machineTick = 0;
      this.lightTick = 0;
      this.moteTick = 0;
      this.lightDirty = true;
      this.visibleCorrupt = 0;
      this.light = null;
      this.lightRect = null;
      this.extraLights = [];
      this.buildSky();
      // Texture d'ombre (64×48 blocs couvrent l'écran et sa marge)
      if (!this.textures.exists('zc-light')) this.textures.createCanvas('zc-light', 64, 48);
      this.lightTex = this.textures.get('zc-light');
      this.lightData = this.lightTex.getContext().createImageData(64, 48);
      for (let k = 0; k < this.lightData.data.length; k += 4) {
        this.lightData.data[k] = 4;
        this.lightData.data[k + 1] = 5;
        this.lightData.data[k + 2] = 12;
      }
      this.lightImg = this.add.image(0, 0, 'zc-light').setOrigin(0).setScale(T).setDepth(30);
      this.bloodTint = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0xff1020, 0.1)
        .setOrigin(0).setScrollFactor(0).setDepth(29).setVisible(false);

      // Particules : éclats (avec gravité) et poussières flottantes (au-dessus de l'ombre)
      this.fxTint = 0xffffff;
      this.fx = this.add.particles(0, 0, 'zc-px', {
        lifespan: { min: 300, max: 700 }, speed: { min: 40, max: 140 }, angle: { min: 200, max: 340 },
        gravityY: 500, scale: { start: 1, end: 0.3 }, alpha: { start: 1, end: 0 },
        tint: { onEmit: () => this.fxTint }, emitting: false, maxAliveParticles: 160,
      }).setDepth(25);
      this.motes = this.add.particles(0, 0, 'zc-px', {
        lifespan: { min: 1200, max: 2200 }, speedX: { min: -12, max: 12 }, speedY: { min: -30, max: -10 },
        scale: { start: 0.8, end: 0 }, alpha: { start: 0.9, end: 0 },
        tint: { onEmit: () => this.moteTint }, emitting: false, maxAliveParticles: 60,
      }).setDepth(31);
      this.moteTint = 0xc070ff;
    },

    burst(x, y, color, n = 6) {
      this.fxTint = color;
      this.fx.explode(n, x, y);
    },

    mote(x, y, color) {
      this.moteTint = color;
      this.motes.explode(1, x, y);
    },

    // --- Ciel : dégradé, étoiles, soleil, lune, nuages ---
    buildSky() {
      const { width: w, height: h } = this.scale;
      this.skyG = this.add.graphics().setScrollFactor(0).setDepth(-20);
      this.stars = this.add.image(0, 0, 'zc-stars').setOrigin(0).setScrollFactor(0).setDepth(-19);
      const r = ZC.rng(this.seed);
      this.sun = this.add.circle(0, 0, 26, 0xfff3a0).setScrollFactor(0).setDepth(-18);
      this.moon = this.add.circle(0, 0, 20, 0xe6e9ff).setScrollFactor(0).setDepth(-18);
      if (!this.textures.exists('zc-cloud')) {
        const g = this.make.graphics({ add: false });
        g.fillStyle(0xffffff, 1).fillRect(12, 8, 60, 16).fillRect(0, 16, 90, 14).fillRect(24, 0, 30, 10);
        g.generateTexture('zc-cloud', 90, 30);
        g.destroy();
      }
      this.clouds = [];
      for (let i = 0; i < 6; i++) {
        const c = this.add.image(0, 30 + r() * 140, 'zc-cloud').setScrollFactor(0).setDepth(-17).setAlpha(0.75).setScale(1 + r());
        c.bx = r() * (w + 200);
        this.clouds.push(c);
      }
      this.skyColors = null;
    },

    updateSky(dt, phase, light) {
      const { width: w, height: h } = this.scale;
      const night = this.bloodMoon ? SKY.blood : SKY.night;
      let cols;
      if (light >= 0.5) cols = [mix(SKY.dusk[0], SKY.day[0], (light - 0.5) * 2), mix(SKY.dusk[1], SKY.day[1], (light - 0.5) * 2)];
      else cols = [mix(night[0], SKY.dusk[0], light * 2), mix(night[1], SKY.dusk[1], light * 2)];
      const key = cols.join();
      if (key !== this.skyColors) {
        this.skyColors = key;
        this.skyG.clear().fillGradientStyle(cols[0], cols[0], cols[1], cols[1], 1).fillRect(0, 0, w, h);
      }
      this.stars.setAlpha(1 - light);
      // Le soleil traverse le ciel pendant la journée, la lune pendant la nuit
      const arc = (t, obj) => obj.setPosition(w * (0.08 + 0.84 * t), h * 0.45 - Math.sin(Math.PI * t) * h * 0.33);
      const sunT = phase < 0.6 ? phase / 0.6 : -1;
      const moonT = phase >= 0.55 ? (phase - 0.55) / 0.45 : -1;
      this.sun.setVisible(sunT >= 0);
      this.moon.setVisible(moonT >= 0).setFillStyle(this.bloodMoon ? 0xff5050 : 0xe6e9ff);
      if (sunT >= 0) arc(sunT, this.sun);
      if (moonT >= 0) arc(moonT, this.moon);
      const camX = this.cameras.main.scrollX;
      // Nuages en léger parallaxe
      this.clouds.forEach((c, i) => {
        c.bx -= dt * (6 + i * 2);
        c.setX(Phaser.Math.Wrap(c.bx - camX * 0.1, -100, w + 100)).setAlpha(0.05 + light * 0.7);
      });
      // Le ciel n'est visible que près de la surface
      const depth = this.cameras.main.scrollY / T;
      const show = depth < 50;
      [this.skyG, this.stars, this.sun, this.moon].forEach((o) => o.setVisible(show && (o !== this.sun || sunT >= 0) && (o !== this.moon || moonT >= 0)));
    },

    // --- Jour et nuit ---
    updateDay(dt) {
      this.clock += dt;
      const phase = (this.clock % ZC.DAY_LENGTH) / ZC.DAY_LENGTH;
      // Jour 0–0,5 ; coucher 0,5–0,6 ; nuit 0,6–0,92 ; lever 0,92–1
      let light = 1;
      if (phase >= 0.5 && phase < 0.6) light = 1 - (phase - 0.5) / 0.1;
      else if (phase >= 0.6 && phase < 0.92) light = 0;
      else if (phase >= 0.92) light = (phase - 0.92) / 0.08;
      this.daylight = light;
      this.updateSky(dt, phase, light);

      const night = light < 0.3;
      // Au chargement (isNight === null), on ne déclenche pas de transition
      if (this.isNight !== null) {
        if (night && !this.isNight) this.onNightfall();
        if (!night && this.isNight) this.onDawn();
      }
      this.isNight = night;
      this.day = Math.floor(this.clock / ZC.DAY_LENGTH) + 1;
    },

    onNightfall() {
      if (this.coreActive && Math.random() < 0.5) return;
      const r = Math.random();
      if (this.nights >= 1 && r < 0.22) {
        this.bloodMoon = true;
        this.banner('Nuit rouge', 'La lune saigne… les morts se lèvent en nombre.', '#ff4d5e');
      } else if (this.nights >= 2 && this.basePos && r < 0.42) {
        this.startInvasion();
      }
    },

    onDawn() {
      this.nights++;
      let bonus = 50;
      if (this.bloodMoon) {
        this.bloodMoon = false;
        bonus = 150;
        this.banner('Fin de la Nuit rouge', `Vous avez survécu ! +${bonus} points`, '#ffd166');
      } else {
        this.toast('Nuit survécue !');
      }
      if (this.event && this.event.type === 'invasion') this.endEvent('Les envahisseurs fuient la lumière du jour.');
      this.addScore(bonus, this.player.x, this.player.y - 40);
    },

    // --- Lumière ---
    lightAt(x, y) {
      const r = this.lightRect;
      if (!r || x < r.x || y < r.y || x >= r.x + r.w || y >= r.y + r.h) return 0;
      return this.light[(y - r.y) * r.w + (x - r.x)];
    },

    computeLight() {
      const cam = this.cameras.main;
      const view = cam.worldView;
      const M = 5;
      const x0 = Math.max(0, Math.floor(view.x / T) - M);
      const y0 = Math.max(0, Math.floor(view.y / T) - M);
      const x1 = Math.min(W, Math.ceil(view.right / T) + M, x0 + 64);
      const y1 = Math.min(H, Math.ceil(view.bottom / T) + M, y0 + 48);
      const w = x1 - x0;
      const h = y1 - y0;
      if (!this.light || this.light.length < w * h) this.light = new Float32Array(w * h);
      const L = this.light;
      L.fill(0, 0, w * h);
      this.lightRect = { x: x0, y: y0, w, h };
      const sky = this.bloodMoon && this.isNight ? 0.28 : 0.32 + 0.68 * this.daylight;

      // Lumière du ciel, qui descend un peu dans les puits et entrées de grottes
      for (let x = x0; x < x1; x++) {
        for (let y = y0; y < y1; y++) {
          let best = 0;
          for (let dx = -3; dx <= 3; dx++) {
            const sx = x + dx;
            if (sx < 0 || sx >= W) continue;
            const below = Math.max(0, y - this.skyline[sx] + 1);
            const v = 1 - (below + Math.abs(dx)) / 6;
            if (v > best) best = v;
          }
          L[(y - y0) * w + (x - x0)] = sky * best;
        }
      }

      // Sources : torches, cristaux, lampes, noyau… (recherchées un peu au-delà de l'écran)
      const apply = (sx, sy, radius, strength) => {
        const r = Math.ceil(radius);
        for (let y = Math.max(y0, sy - r); y < Math.min(y1, sy + r + 1); y++) {
          for (let x = Math.max(x0, sx - r); x < Math.min(x1, sx + r + 1); x++) {
            const d = Math.hypot(x - sx, y - sy);
            const v = strength * (1 - d / (radius + 1));
            const k = (y - y0) * w + (x - x0);
            if (v > L[k]) L[k] = v;
          }
        }
      };
      let corrupt = 0;
      const S = 11;
      for (let y = Math.max(0, y0 - S); y < Math.min(H, y1 + S); y++) {
        for (let x = Math.max(0, x0 - S); x < Math.min(W, x1 + S); x++) {
          const id = this.grid[y * W + x];
          if (!id) continue;
          if (id === B.CORRUPT) {
            // Faible lueur violette
            corrupt++;
            if ((x + y) % 2 === 0) apply(x, y, 1.5, 0.3);
            continue;
          }
          const l = BLOCKS[id].light;
          if (l) apply(x, y, l, 1);
        }
      }
      this.visibleCorrupt = corrupt;
      apply(Math.floor(this.player.x / T), Math.floor(this.player.y / T), 3.5, 0.6);
      this.extraLights.forEach((s) => apply(Math.floor(s.x / T), Math.floor(s.y / T), s.r, s.v));

      // Ombre : un pixel par bloc dans une petite texture, agrandie avec un filtrage doux
      const data = this.lightData.data;
      const LW = this.lightData.width;
      for (let k = 3; k < data.length; k += 4) data[k] = 240;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const open = y < this.skyline[x];
          const v = Math.min(1, L[(y - y0) * w + (x - x0)]);
          data[((y - y0) * LW + (x - x0)) * 4 + 3] = Math.round((1 - v) * (open ? 0.5 : 0.94) * 255);
        }
      }
      this.lightTex.getContext().putImageData(this.lightData, 0, 0);
      this.lightTex.refresh();
      this.lightImg.setPosition(x0 * T, y0 * T);
      this.bloodTint.setVisible(this.bloodMoon && this.isNight);
    },

    // --- Corruption et instabilité ---
    chunkOf(x, y) {
      return Math.floor(y / CHUNK) * CW + Math.floor(x / CHUNK);
    },

    addInstability(x, y, amount) {
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      const c = this.chunkOf(x, y);
      this.instab[c] = Math.min(60, this.instab[c] + amount);
    },

    localInstability() {
      return this.instab[this.chunkOf(Phaser.Math.Clamp(Math.floor(this.player.x / T), 0, W - 1), Phaser.Math.Clamp(Math.floor(this.player.y / T), 0, H - 1))];
    },

    isProtected(x, y) {
      for (const i of this.purifiers) {
        if (Math.abs((i % W) - x) <= 7 && Math.abs(Math.floor(i / W) - y) <= 7) return true;
      }
      return false;
    },

    canCorrupt(x, y) {
      const i = y * W + x;
      return x >= 0 && y >= 0 && x < W && y < H - 3 && SPREADABLE.has(this.grid[i]) && !this.placed.has(i) && !this.isProtected(x, y);
    },

    corruptionStep() {
      if (this.coreActive) return;
      const list = this.corruptList;
      // Propagation : un petit nombre de tirages par seconde (croissance lente et bornée)
      let tries = this.bloodMoon ? 9 : this.isNight ? 5 : 2;
      if (this.corruptCount >= CORRUPT_CAP) tries = 0;
      while (tries-- > 0 && list.length) {
        const j = Math.floor(Math.random() * list.length);
        const i = list[j];
        if (this.grid[i] !== B.CORRUPT) {
          list[j] = list[list.length - 1];
          list.pop();
          continue;
        }
        const [dx, dy] = DIRS[Math.floor(Math.random() * 4)];
        const x = (i % W) + dx;
        const y = Math.floor(i / W) + dy;
        if (Math.random() < 0.6 && this.canCorrupt(x, y)) this.setB(x, y, B.CORRUPT);
      }

      // Régions instables : la corruption y progresse plus vite, voire apparaît
      for (let c = 0; c < this.instab.length; c++) {
        const v = this.instab[c];
        if (v <= 0) continue;
        this.instab[c] = Math.max(0, v - 0.08);
        if (v < 25 || this.corruptCount >= CORRUPT_CAP) continue;
        const cx = (c % CW) * CHUNK;
        const cy = Math.floor(c / CW) * CHUNK;
        if (Math.random() < 0.5) {
          const x = cx + Math.floor(Math.random() * CHUNK);
          const y = cy + Math.floor(Math.random() * CHUNK);
          if (this.canCorrupt(x, y) && y > this.surface[Math.min(x, W - 1)] + 3 &&
            (DIRS.some(([dx, dy]) => this.getB(x + dx, y + dy) === B.CORRUPT) || Math.random() < 0.08)) {
            this.setB(x, y, B.CORRUPT);
          }
        }
        if (v >= 45) this.instabilityEvent(c);
      }

      // Purificateurs : chacun nettoie jusqu'à 2 blocs corrompus par seconde
      this.purifiers.forEach((i) => {
        const px = i % W;
        const py = Math.floor(i / W);
        let n = 0;
        for (let y = py - 6; y <= py + 6 && n < 2; y++) {
          for (let x = px - 6; x <= px + 6 && n < 2; x++) {
            if (this.getB(x, y) === B.CORRUPT) {
              this.setB(x, y, B.STONE);
              this.burst((x + 0.5) * T, (y + 0.5) * T, 0x9ef0ff, 4);
              this.score += 2;
              n++;
            }
          }
        }
        if (n) ZG.setScore(this.score);
      });
    },

    // Phénomène d'instabilité : éboulement et germe de corruption
    instabilityEvent(c) {
      this.instab[c] -= 22;
      const cx = (c % CW) * CHUNK + CHUNK / 2;
      const cy = Math.floor(c / CW) * CHUNK + CHUNK / 2;
      const px = this.player.x / T;
      const py = this.player.y / T;
      const near = Math.abs(px - cx) < CHUNK * 1.2 && Math.abs(py - cy) < CHUNK * 1.2;
      // Germe de corruption dans la région
      for (let k = 0; k < 12; k++) {
        const x = Math.floor(cx + (Math.random() - 0.5) * CHUNK);
        const y = Math.floor(cy + (Math.random() - 0.5) * CHUNK);
        if (this.canCorrupt(x, y) && y > this.surface[Phaser.Math.Clamp(x, 0, W - 1)] + 3) {
          this.setB(x, y, B.CORRUPT);
          DIRS.forEach(([dx, dy]) => { if (this.canCorrupt(x + dx, y + dy)) this.setB(x + dx, y + dy, B.CORRUPT); });
          break;
        }
      }
      if (!near) return;
      this.banner('Instabilité !', 'Vous avez trop creusé ici : la roche cède et la corruption s\'éveille.', '#c070ff');
      this.cameras.main.shake(500, 0.006);
      // Éboulement : quelques rochers tombent du plafond autour du joueur (jamais pile dessus)
      for (let k = 0; k < 4; k++) {
        const x = Math.floor(px) + Phaser.Math.Between(-6, 6);
        if (Math.abs(x - px) < 1.5) continue;
        let y = Math.floor(py);
        while (y > 0 && !BLOCKS[this.getB(x, y)].solid && Math.floor(py) - y < 10) y--;
        this.spawnProjectile('rock', (x + 0.5) * T, (y + 1.2) * T, 0, 40, { g: 700, dmg: 3, life: 3 });
      }
      if (Math.random() < 0.6) this.spawnNear('corrupt', true);
    },

    // --- Événements aléatoires ---
    updateEvents(dt) {
      this.eventRoll -= dt;
      if (this.eventRoll <= 0) {
        this.eventRoll = 45;
        if (!this.event && this.day >= 2 && !this.dead) {
          const r = Math.random();
          if (r < 0.12) this.startMeteors();
          else if (r < 0.22) this.startQuake();
        }
      }
      const ev = this.event;
      if (!ev) return;
      ev.t -= dt;
      if (ev.type === 'meteors') {
        ev.next -= dt;
        if (ev.next <= 0) {
          ev.next = Phaser.Math.FloatBetween(1.1, 2);
          this.dropMeteor();
        }
        if (ev.t <= 0) this.endEvent('La pluie de météorites est terminée. Allez récolter les fragments célestes !');
      } else if (ev.type === 'quake') {
        ev.next -= dt;
        if (ev.next <= 0) {
          ev.next = 0.6;
          this.cameras.main.shake(450, 0.0035);
          for (let k = 0; k < 3; k++) {
            const x = this.player.x + Phaser.Math.Between(-300, 300);
            this.burst(x, this.player.y - Phaser.Math.Between(80, 220), 0x8a7a66, 3);
          }
        }
        if (ev.t <= 0) this.endEvent('Le séisme s\'est calmé.');
      } else if (ev.type === 'invasion') {
        const left = this.mobs.getChildren().filter((m) => m.invader).length;
        if (!left && ev.spawned) {
          this.addScore(200, this.player.x, this.player.y - 40);
          this.endEvent('Invasion repoussée ! +200 points');
        } else if (ev.t <= 0) {
          this.endEvent('La horde s\'essouffle et se disperse.');
        }
      }
    },

    endEvent(msg) {
      if (!this.event) return;
      this.banner('Événement terminé', msg, '#9ef0ff');
      this.event = null;
    },

    startMeteors() {
      this.event = { type: 'meteors', t: 20, next: 2 };
      this.banner('Pluie de météorites', 'Des roches célestes s\'écrasent : surveillez les marques rouges au sol !', '#ff9a4d');
    },

    dropMeteor() {
      const ptx = Math.floor(this.player.x / T);
      let x = ptx + Phaser.Math.Between(6, 26) * (Math.random() < 0.5 ? -1 : 1);
      x = Phaser.Math.Clamp(x, 3, W - 4);
      const y = this.skyline[x];
      if (y >= H - 4) return;
      // Marque d'avertissement au point d'impact
      const mark = this.add.rectangle((x + 0.5) * T, y * T - 2, T * 2, 4, 0xff4d4d).setDepth(32);
      this.tweens.add({ targets: mark, alpha: 0.2, duration: 200, yoyo: true, repeat: 3, onComplete: () => mark.destroy() });
      const tx = (x + 0.5) * T;
      const ty = y * T;
      const sx = tx + Phaser.Math.Between(-220, 220);
      const sy = Math.min(ty, this.cameras.main.worldView.y) - 120;
      const t = 1.4;
      this.spawnProjectile('meteor', sx, sy, (tx - sx) / t, (ty - sy) / t, { g: 0, dmg: 0, life: 4, delay: 0 });
    },

    meteorImpact(x, y) {
      const cx = Math.floor(x / T);
      const cy = Math.floor(y / T);
      this.cameras.main.shake(300, 0.008);
      this.burst(x, y, 0xff9a4d, 16);
      for (let ty = cy - 2; ty <= cy + 2; ty++) {
        for (let tx = cx - 2; tx <= cx + 2; tx++) {
          if (Math.hypot(tx - cx, ty - cy) > 2.3) continue;
          const id = this.getB(tx, ty);
          const i = ty * W + tx;
          if (id && !this.placed.has(i) && (BLOCKS[id].natural || id === B.LEAVES || id === B.LOG || id === B.CORRUPT)) this.setB(tx, ty, B.AIR);
        }
      }
      // La météorite reste au fond du cratère
      let by = cy;
      while (by < H - 2 && !BLOCKS[this.getB(cx, by + 1)].solid) by++;
      if (!this.getB(cx, by)) this.setB(cx, by, B.METEOR);
      if (!this.getB(cx + 1, by) && BLOCKS[this.getB(cx + 1, by + 1)].solid) this.setB(cx + 1, by, B.METEOR);
      this.addInstability(cx, cy, 3);
      if (Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) < T * 2.6) this.hurt(4, null);
    },

    startQuake() {
      this.event = { type: 'quake', t: 8, next: 0 };
      this.banner('Tremblement de terre', 'La terre gronde… de nouvelles cavités apparaissent.', '#d6b98a');
      // Révèle quelques petites cavités garnies de minerais autour du joueur
      const ptx = Math.floor(this.player.x / T);
      const pty = Math.floor(this.player.y / T);
      let made = 0;
      for (let k = 0; k < 30 && made < 3; k++) {
        const x = ptx + Phaser.Math.Between(-16, 16);
        const y = pty + Phaser.Math.Between(3, 16);
        if (this.getB(x, y) !== B.STONE || y >= H - 5) continue;
        made++;
        const ore = y > 55 ? B.GOLD : y > 40 ? B.IRON : B.COAL;
        for (let ty = y - 2; ty <= y + 2; ty++) {
          for (let tx = x - 2; tx <= x + 2; tx++) {
            const d = Math.hypot(tx - x, ty - y);
            const id = this.getB(tx, ty);
            if (d <= 1.5 && (id === B.STONE || id === B.DIRT)) this.setB(tx, ty, B.AIR);
            else if (d <= 2.3 && id === B.STONE && Math.random() < 0.4) this.setB(tx, ty, Math.random() < 0.15 ? B.CRYSTAL : ore);
          }
        }
        this.addInstability(x, y, 4);
      }
    },

    startInvasion() {
      this.event = { type: 'invasion', t: 90, spawned: false };
      this.banner('Invasion !', 'Une horde marche sur votre base. Défendez-la !', '#ff4d5e');
      const count = Math.min(8, 4 + this.nights);
      const bx = this.basePos ? this.basePos.x : Math.floor(this.player.x / T);
      for (let k = 0; k < count; k++) {
        const side = k % 2 ? 1 : -1;
        const x = Phaser.Math.Clamp(bx + side * Phaser.Math.Between(18, 26), 2, W - 3);
        const kind = this.chooseKind({ underground: false, invasion: true });
        this.time.delayedCall(k * 900, () => {
          if (this.dead || !this.event || this.event.type !== 'invasion') return;
          const m = this.spawnMob(kind, x, this.skyline[x], { invader: true, force: true });
          if (m) this.event.spawned = true;
        });
      }
    },

    // --- Machines et électricité (simulation légère, 2 fois par seconde) ---
    newMachine(type) {
      return { type, fuel: 0, powered: false, depth: 1, t: 0, buffer: {}, load: 0 };
    },

    machineStep(dt) {
      const gens = [];
      const cons = [];
      this.machines.forEach((m, i) => {
        m.x = i % W;
        m.y = Math.floor(i / W);
        if (m.type === 'gen') {
          m.load = 0;
          gens.push(m);
        } else {
          cons.push(m);
        }
      });
      // Chaque consommateur se branche sur le générateur alimenté le plus proche qui a de la capacité
      cons.forEach((m) => {
        const need = -ZC.MACHINE_POWER[m.type];
        let best = null;
        let bestD = Infinity;
        gens.forEach((g) => {
          const d = Math.max(Math.abs(g.x - m.x), Math.abs(g.y - m.y));
          if (g.fuel > 0 && d <= ZC.POWER_RANGE && ZC.MACHINE_POWER.gen - g.load >= need && d < bestD) {
            best = g;
            bestD = d;
          }
        });
        m.powered = !!best;
        if (best) best.load += need;
      });
      gens.forEach((g) => {
        const running = g.fuel > 0 && g.load > 0;
        if (running) g.fuel = Math.max(0, g.fuel - dt);
        g.powered = running;
        this.setB(g.x, g.y, running ? B.GEN_ON : B.GEN, { keep: true });
        if (running && Math.random() < 0.3) this.mote((g.x + 0.5) * T, g.y * T, 0xffb050);
      });
      const ptx = this.player.x / T;
      const pty = this.player.y / T;
      cons.forEach((m) => {
        if (m.type === 'lamp') {
          this.setB(m.x, m.y, m.powered ? B.LAMP_ON : B.LAMP, { keep: true });
        } else if (m.type === 'door' && m.powered) {
          // Porte automatique : s'ouvre à l'approche du joueur, se referme derrière lui
          const near = Math.abs(ptx - (m.x + 0.5)) < 2.2 && Math.abs(pty - (m.y + 0.5)) < 2.5;
          const inside = Math.abs(ptx - (m.x + 0.5)) < 0.9 && Math.abs(pty - (m.y + 0.5)) < 1.5;
          this.setB(m.x, m.y, near || inside ? B.DOOR_OPEN : B.DOOR, { keep: true });
        } else if (m.type === 'drill' && m.powered) {
          m.t += dt;
          if (m.t >= 2.5) {
            m.t = 0;
            this.drillStep(m);
          }
        }
      });
    },

    // La foreuse creuse la colonne sous elle et stocke ce qu'elle récupère
    drillStep(m) {
      const stored = Object.values(m.buffer).reduce((a, b) => a + b, 0);
      if (stored >= 200 || m.depth > 24) return;
      while (m.depth <= 24) {
        const y = m.y + m.depth;
        const id = this.getB(m.x, y);
        const blk = BLOCKS[id];
        // On traverse l'air et les objets non solides ; on s'arrête sur les blocs trop durs ou construits
        if (!id || !blk.solid) {
          m.depth++;
          continue;
        }
        if (blk.tier > 3 || !(blk.natural || DRILLABLE.has(id))) {
          m.depth = 99;
          return;
        }
        this.setB(m.x, y, B.AIR);
        const drops = Array.isArray(blk.drop) ? blk.drop : blk.drop ? [[blk.drop, 1]] : [];
        drops.forEach(([item, n]) => { m.buffer[item] = (m.buffer[item] || 0) + n; });
        this.addInstability(m.x, y, 0.5);
        if (Math.abs(m.x * T - this.player.x) < 600) this.burst((m.x + 0.5) * T, (y + 0.5) * T, 0xd0c090, 5);
        m.depth++;
        return;
      }
    },

    // --- Mise à jour périodique du monde vivant ---
    updateLiving(time, dt) {
      this.updateDay(dt);
      this.updateEvents(dt);
      this.corruptTick += dt;
      if (this.corruptTick >= 1) {
        this.corruptTick = 0;
        this.corruptionStep();
      }
      this.machineTick += dt;
      if (this.machineTick >= 0.5) {
        this.machineStep(this.machineTick);
        this.machineTick = 0;
      }
      this.lightTick += dt;
      if (this.lightTick >= 0.12) {
        this.lightTick = 0;
        this.computeLight();
      }
      // Poussières violettes au-dessus de la corruption visible
      this.moteTick += dt;
      if (this.moteTick >= 0.15 && this.lightRect && this.visibleCorrupt) {
        this.moteTick = 0;
        const r = this.lightRect;
        for (let k = 0; k < 6; k++) {
          const x = r.x + Math.floor(Math.random() * r.w);
          const y = r.y + Math.floor(Math.random() * r.h);
          if (this.getB(x, y) === B.CORRUPT && !BLOCKS[this.getB(x, y - 1)].solid) {
            this.mote((x + Math.random()) * T, y * T, 0xc070ff);
            break;
          }
        }
      }
    },
  };
})();
