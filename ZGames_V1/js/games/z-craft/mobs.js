/* Z-Craft — zombies évolutifs, boss souterrains et projectiles */

window.ZC = window.ZC || {};

(function () {
  const { T, W, H } = ZC;
  const B = ZC.B;
  const BLOCKS = ZC.BLOCKS;
  const MOBS = ZC.MOBS;

  // Blocs qu'un fouisseur peut creuser (naturels et peu durs)
  const diggable = (id) => id && BLOCKS[id].natural && BLOCKS[id].tier <= 2 || id === B.LEAVES || id === B.CORRUPT;

  ZC.MobsMixin = {
    initMobs() {
      this.mobs = this.physics.add.group();
      this.physics.add.collider(this.mobs, this.layer);
      this.physics.add.overlap(this.player, this.mobs, (p, m) => this.hurt(m.dmg, m));
      this.projectiles = [];
      this.boss = null;
      this.spawnT = 3;
      this.guardT = 0;
      this.nextAttack = 0;
      this.bossG = this.add.graphics().setScrollFactor(0).setDepth(110).setVisible(false);
      this.bossName = this.add.text(this.scale.width / 2, 14, '', {
        fontFamily: ZG.FONT, fontSize: '15px', fontStyle: 'bold', color: '#ffffff', stroke: '#000000', strokeThickness: 4,
      }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(111).setVisible(false);
    },

    mobCap() {
      return this.bloodMoon || (this.event && this.event.type === 'invasion') ? 12 : 8;
    },

    // Choix du type selon la progression du joueur, les nuits et l'état du monde
    chooseKind(ctx) {
      const n = this.nights;
      const tier = this.pickTier();
      const corrupt = this.corruptCount / 3000;
      const w = {
        classic: 10,
        fast: n >= 2 || tier >= 2 ? 4 : 0,
        climber: n >= 2 ? 3 : 0,
        armored: n >= 3 || tier >= 3 ? 3 + n * 0.3 : 0,
        burrower: ctx.underground ? 5 : 0,
        corrupt: ctx.nearCorrupt ? 10 : corrupt > 0.15 && n >= 4 ? 2 : 0,
      };
      if (this.bloodMoon || ctx.invasion) {
        w.fast *= 2;
        w.armored = Math.max(w.armored * 2, 2);
        w.corrupt += 2;
      }
      const total = Object.values(w).reduce((a, b) => a + b, 0);
      let r = Math.random() * total;
      for (const k of Object.keys(w)) {
        r -= w[k];
        if (r <= 0) return k;
      }
      return 'classic';
    },

    spawnMob(kind, tx, ty, opts = {}) {
      if (!opts.force && this.mobs.countActive() >= this.mobCap()) return null;
      const def = MOBS[kind];
      const m = this.mobs.create((tx + 0.5) * T, ty * T - 22, 'zc-mob-' + kind, 'f0').setDepth(9);
      m.body.setSize(14, 42);
      m.setCollideWorldBounds(true).setMaxVelocity(400, 650);
      // Les zombies deviennent un peu plus robustes au fil des nuits
      const scale = 1 + Math.min(this.nights, 12) * 0.06;
      Object.assign(m, {
        kind, def, hp: Math.round(def.hp * scale), maxHp: Math.round(def.hp * scale), dmg: def.dmg + (this.nights >= 6 ? 1 : 0),
        stunUntil: 0, burn: 0, burnMax: Phaser.Math.FloatBetween(2, 7), digT: 0, animT: 0, frame2: false,
        guard: !!opts.guard, invader: !!opts.invader, summoned: !!opts.summoned,
        noBurn: !!def.noBurn || !!opts.guard,
      });
      if (kind === 'corrupt') this.burst(m.x, m.y, 0xc070ff, 8);
      return m;
    },

    // Cherche un endroit sombre et libre près du joueur pour faire apparaître un zombie
    spawnNear(kind, force = false) {
      const ptx = Math.floor(this.player.x / T);
      const pty = Math.floor(this.player.y / T);
      for (let k = 0; k < 14; k++) {
        const x = ptx + Phaser.Math.Between(10, 20) * (Math.random() < 0.5 ? -1 : 1);
        const y = pty + Phaser.Math.Between(-8, 8);
        if (x < 2 || x >= W - 2 || y < 2 || y >= H - 3) continue;
        if (this.getB(x, y) || this.getB(x, y - 1) || !BLOCKS[this.getB(x, y + 1)].solid) continue;
        if (this.lightAt(x, y) > 0.35) continue;
        return this.spawnMob(kind, x, y + 1, { force });
      }
      return null;
    },

    spawnTick() {
      const ptx = Phaser.Math.Clamp(Math.floor(this.player.x / T), 0, W - 1);
      const pty = Math.floor(this.player.y / T);
      const underground = pty > this.surface[ptx] + 8;
      const nearCorrupt = this.visibleCorrupt >= 10;
      const ctx = { underground, nearCorrupt };
      if (this.coreActive && Math.random() < 0.5) return;
      if (underground) {
        // Les grottes sombres sont dangereuses à toute heure, surtout près de la corruption
        if (Math.random() < (this.isNight ? 0.8 : 0.5) || nearCorrupt) this.spawnNear(this.chooseKind(ctx));
      } else if (this.isNight) {
        const side = Math.random() < 0.5 ? -1 : 1;
        const x = Phaser.Math.Clamp(ptx + side * Phaser.Math.Between(16, 24), 2, W - 3);
        const y = this.skyline[x];
        if (y < H - 3) this.spawnMob(this.chooseKind(ctx), x, y);
      }
    },

    // Gardiens des structures : apparaissent une seule fois, quand le joueur approche
    guardTick() {
      const ptx = this.player.x / T;
      const pty = this.player.y / T;
      this.structures.forEach((s) => {
        const d = Math.hypot(s.x - ptx, s.y - pty);
        if (!s.found && d < 9) {
          s.found = true;
          const names = { ruin: 'Ruines abandonnées', temple: 'Temple souterrain', secret: 'Salle secrète', arena: 'Grande caverne du Golem', lair: 'Cœur de la corruption', core: 'Le Noyau ancien' };
          this.banner('Découverte', names[s.type], '#9ef0ff');
          this.addScore(100, this.player.x, this.player.y - 40);
        }
        if (!s.spawned && s.guards.length && d < 20) {
          s.spawned = true;
          s.guards.forEach((g) => this.spawnMob(g.kind, g.x, g.y, { guard: true, force: true }));
          this.toast('Des gardiens protègent ce lieu !');
        }
      });
    },

    updateMobs(time, dt) {
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        this.spawnT = this.bloodMoon ? 2 : 4;
        this.spawnTick();
      }
      this.guardT -= dt;
      if (this.guardT <= 0) {
        this.guardT = 0.5;
        this.guardTick();
        this.bossTriggers();
      }
      const p = this.player;
      this.mobs.getChildren().slice().forEach((m) => {
        const mtx = Phaser.Math.Clamp(Math.floor(m.x / T), 0, W - 1);
        const headY = Math.floor((m.y - 18) / T);
        // Brûlent au soleil (sauf les corrompus et les gardiens)
        if (!this.isNight && !m.noBurn && headY < this.skyline[mtx]) {
          m.burn += dt;
          m.setTint(Math.floor(time / 120) % 2 ? 0xff9a4d : 0xffffff);
          if (Math.random() < 0.1) this.mote(m.x, m.y - 20, 0xff9a4d);
          if (m.burn >= m.burnMax) {
            this.killMob(m, false);
            return;
          }
        }
        if (Math.abs(m.x - p.x) > 45 * T || Math.abs(m.y - p.y) > 30 * T) {
          m.destroy();
          return;
        }
        if (time < m.stunUntil) return;
        let targetX = p.x;
        if (m.invader && this.basePos && Math.abs(p.x - m.x) > 12 * T) targetX = (this.basePos.x + 0.5) * T;
        const dx = targetX - m.x;
        const dir = Math.abs(dx) < 6 ? 0 : Math.sign(dx);
        const speed = m.def.speed * (this.bloodMoon ? 1.15 : 1);
        m.setVelocityX(dir * speed);
        if (dir) m.setFlipX(dir < 0);
        const body = m.body;
        const blocked = (dir < 0 && body.blocked.left) || (dir > 0 && body.blocked.right);
        if (blocked) {
          if (m.def.climb) m.setVelocityY(-150);
          else if (body.blocked.down) m.setVelocityY(-310);
          // Fouisseurs et envahisseurs percent les obstacles
          if (m.def.dig || m.invader) {
            m.digT += dt;
            if (m.digT >= (m.def.dig ? 1 : 1.6)) {
              m.digT = 0;
              this.mobDig(m, mtx + dir);
            }
          }
        } else {
          m.digT = 0;
        }
        // Le fouisseur creuse vers le bas si le joueur est en dessous
        if (m.def.dig && body.blocked.down && p.y - m.y > 3 * T && Math.abs(dx) < T) {
          m.digT += dt;
          if (m.digT >= 1) {
            m.digT = 0;
            const fy = Math.floor((m.y + 24) / T);
            if (diggable(this.getB(mtx, fy))) this.setB(mtx, fy, B.AIR);
          }
        }
        // Animation de marche
        m.animT += dt;
        if (!body.blocked.down) m.setFrame('f2');
        else if (Math.abs(body.velocity.x) > 10 && m.animT > 0.16) {
          m.animT = 0;
          m.frame2 = !m.frame2;
          m.setFrame(m.frame2 ? 'f1' : 'f0');
        }
      });
    },

    mobDig(m, x) {
      for (const y of [Math.floor((m.y + 10) / T), Math.floor((m.y - 12) / T)]) {
        const id = this.getB(x, y);
        if (!id) continue;
        const i = y * W + x;
        const ok = m.invader ? (this.placed.has(i) && BLOCKS[id].tier <= 3) || diggable(id) : diggable(id) && !this.placed.has(i);
        if (ok) {
          this.setB(x, y, B.AIR);
          this.burst((x + 0.5) * T, (y + 0.5) * T, 0x8a7a66, 5);
          if (!m.invader) this.addInstability(x, y, 0.3);
        }
        return;
      }
    },

    // --- Combat ---
    enemyAt(wx, wy) {
      const hit = (s, pad) => s && s.active && Phaser.Geom.Rectangle.Inflate(s.getBounds(), pad, pad).contains(wx, wy);
      if (hit(this.boss, 6)) return this.boss;
      return this.mobs.getChildren().find((m) => hit(m, 4)) || null;
    },

    attack(enemy) {
      const sword = this.bestTool('sword');
      let dmg = sword ? sword.dmg : 2;
      if (sword && sword.purify && (enemy.kind === 'corrupt' || enemy === this.boss && this.boss.type === 'king')) dmg *= 2;
      this.swing('sword');
      if (enemy === this.boss) {
        this.damageBoss(dmg);
        return;
      }
      dmg = Math.max(1, dmg - (enemy.def.armor || 0));
      enemy.hp -= dmg;
      this.floatText(enemy.x, enemy.y - 30, String(dmg), '#ffffff', 14);
      enemy.setTint(0xff5555);
      this.time.delayedCall(140, () => { if (enemy.active) enemy.clearTint(); });
      enemy.stunUntil = this.time.now + 280;
      enemy.setVelocity(Math.sign(enemy.x - this.player.x || 1) * 240, -200);
      if (enemy.hp <= 0) this.killMob(enemy, true);
    },

    killMob(m, byPlayer) {
      if (byPlayer) {
        this.addScore(m.summoned ? Math.round(m.def.points / 2) : m.def.points, m.x, m.y - 30);
        const loot = { corrupt: ['crystal', 0.3], armored: ['iron', 0.6], burrower: ['iron_ore', 0.4] }[m.kind] || ['coal', 0.2];
        if (Math.random() < loot[1]) this.giveItem(loot[0], 1, m.x, m.y - 50);
      }
      this.burst(m.x, m.y, m.kind === 'corrupt' ? 0xc070ff : byPlayer ? 0x9ab07a : 0xff9a4d, 12);
      m.destroy();
    },

    // --- Projectiles (déplacement manuel, sans corps physique) ---
    spawnProjectile(kind, x, y, vx, vy, opts) {
      const looks = {
        rock: () => this.add.rectangle(x, y, 10, 10, 0x8a8a90).setStrokeStyle(2, 0x55555c),
        orb: () => this.add.circle(x, y, 7, 0xc070ff).setStrokeStyle(2, 0xffb0ff),
        wave: () => this.add.rectangle(x, y, 22, 12, 0xbfb6a0, 0.9),
        meteor: () => this.add.circle(x, y, 10, 0xff8a3a).setStrokeStyle(3, 0xffd166),
      };
      const obj = looks[kind]().setDepth(26);
      this.projectiles.push(Object.assign({ kind, obj, vx, vy, g: 0, dmg: 2, life: 3, r: 8 }, opts));
    },

    updateProjectiles(dt) {
      const pb = this.player.getBounds();
      for (let k = this.projectiles.length - 1; k >= 0; k--) {
        const p = this.projectiles[k];
        p.life -= dt;
        p.vy += p.g * dt;
        p.obj.x += p.vx * dt;
        p.obj.y += p.vy * dt;
        if (p.kind === 'rock' || p.kind === 'meteor') p.obj.rotation += dt * 6;
        if (p.kind === 'meteor' && Math.random() < 0.6) this.mote(p.obj.x, p.obj.y, 0xffb050);
        const tx = Math.floor(p.obj.x / T);
        const ty = Math.floor(p.obj.y / T);
        let done = p.life <= 0;
        const solid = BLOCKS[this.getB(tx, ty)].solid;
        if (solid && p.kind !== 'meteor') done = true;
        if (p.kind === 'meteor' && (solid || p.obj.y >= this.skyline[Phaser.Math.Clamp(tx, 0, W - 1)] * T)) {
          this.meteorImpact(p.obj.x, p.obj.y);
          done = true;
        }
        if (!done && p.dmg && Phaser.Geom.Rectangle.Contains(Phaser.Geom.Rectangle.Inflate(Phaser.Geom.Rectangle.Clone(pb), p.r, p.r), p.obj.x, p.obj.y)) {
          if (!p.groundOnly || this.player.body.blocked.down) {
            this.hurt(p.dmg, p.obj);
            done = true;
          }
        }
        if (done) {
          if (p.kind === 'rock') this.burst(p.obj.x, p.obj.y, 0x8a8a90, 5);
          if (p.kind === 'orb') this.burst(p.obj.x, p.obj.y, 0xc070ff, 6);
          p.obj.destroy();
          this.projectiles.splice(k, 1);
        }
      }
    },

    // --- Boss ---
    bossTriggers() {
      if (this.boss || this.dead) return;
      const ptx = this.player.x / T;
      const pty = this.player.y / T;
      if (!this.bosses.golem && Math.hypot(ptx - this.golemPos.x, pty - this.golemPos.y) < 13) this.spawnBoss('golem');
      else if (!this.bosses.king && Math.hypot(ptx - this.kingPos.x, pty - this.kingPos.y) < 11) this.spawnBoss('king');
    },

    spawnBoss(type) {
      const pos = type === 'golem' ? this.golemPos : this.kingPos;
      const golem = type === 'golem';
      const b = this.physics.add.sprite((pos.x + 0.5) * T, (pos.y - 1) * T, golem ? 'zc-golem' : 'zc-king', 'f0').setDepth(11);
      if (golem) b.body.setSize(36, 56);
      else b.body.setSize(24, 50);
      b.setCollideWorldBounds(true).setMaxVelocity(500, 700);
      const corruptBonus = golem ? 1 : 1 + Math.min(0.5, this.corruptCount / 3000);
      const maxHp = Math.round((golem ? 160 : 220) * corruptBonus);
      Object.assign(b, {
        type, hp: maxHp, maxHp, phase: 1, slamT: 3, rockT: 2, summonT: 4, orbT: 2.5, dashT: 6, dashUntil: 0, airborne: false,
        name: golem ? 'Golem de pierre' : 'Roi zombie', dmg: 4,
      });
      b.collider = this.physics.add.collider(b, this.layer);
      b.overlap = this.physics.add.overlap(this.player, b, () => this.hurt(b.dashUntil > this.time.now ? 6 : b.dmg, b));
      this.boss = b;
      this.cameras.main.shake(600, 0.01);
      this.burst(b.x, b.y, golem ? 0x9ef0ff : 0xc070ff, 24);
      this.banner(b.name, golem ? 'Le gardien de pierre se réveille !' : 'Le seigneur de la corruption se dresse devant vous !', golem ? '#9ef0ff' : '#c070ff');
      this.bossG.setVisible(true);
      this.bossName.setVisible(true);
    },

    damageBoss(dmg) {
      const b = this.boss;
      b.hp -= dmg;
      this.floatText(b.x, b.y - 40, String(dmg), '#ffe066', 16);
      b.setTintFill(0xffffff);
      this.time.delayedCall(80, () => {
        if (!b.active) return;
        b.clearTint();
        if (b.phase === 2) b.setTint(b.type === 'golem' ? 0xffb0a0 : 0xff80ff);
      });
      this.burst(b.x, b.y, b.type === 'golem' ? 0xa0a0a8 : 0xc070ff, 5);
      if (b.phase === 1 && b.hp < b.maxHp / 2) {
        b.phase = 2;
        b.setTint(b.type === 'golem' ? 0xffb0a0 : 0xff80ff);
        this.banner(b.type === 'golem' ? 'Le Golem enrage !' : 'Le Roi zombie entre en fureur !', 'Ses attaques deviennent plus rapides.', '#ff9a4d');
        this.cameras.main.shake(400, 0.01);
      }
      if (b.hp <= 0) this.defeatBoss();
    },

    defeatBoss() {
      const b = this.boss;
      const golem = b.type === 'golem';
      this.bosses[b.type] = true;
      this.cameras.main.shake(900, 0.015);
      this.cameras.main.flash(400, 255, 255, 255);
      for (let k = 0; k < 4; k++) this.time.delayedCall(k * 150, () => this.burst(b.x + Phaser.Math.Between(-20, 20), b.y + Phaser.Math.Between(-20, 20), golem ? 0x9ef0ff : 0xc070ff, 20));
      this.addScore(golem ? 500 : 800, b.x, b.y - 60);
      this.giveItem('fragment', 1, b.x, b.y - 80);
      this.maxHp += 4;
      this.hp = this.maxHp;
      if (golem) {
        this.addItem('iron', 10);
        this.addItem('gold', 4);
      } else {
        this.addItem('gold', 6);
        this.addItem('crystal', 4);
        // La mort du roi purifie son repaire
        for (let y = this.kingPos.y - 12; y <= this.kingPos.y + 12; y++) {
          for (let x = this.kingPos.x - 16; x <= this.kingPos.x + 16; x++) if (this.getB(x, y) === B.CORRUPT) this.setB(x, y, B.STONE);
        }
      }
      this.banner(`${b.name} vaincu !`, `${golem ? 'Cœur de pierre' : 'Couronne maudite'} : +2 cœurs max · Fragment ancien obtenu`, '#ffd166');
      this.mobs.getChildren().slice().forEach((m) => { if (m.summoned) this.killMob(m, false); });
      this.removeBoss();
      this.drawHearts();
      this.writeSave();
    },

    removeBoss() {
      const b = this.boss;
      if (!b) return;
      b.collider.destroy();
      b.overlap.destroy();
      b.destroy();
      this.boss = null;
      this.extraLights = [];
      this.bossG.setVisible(false);
      this.bossName.setVisible(false);
    },

    updateBoss(time, dt) {
      const b = this.boss;
      if (!b) return;
      const p = this.player;
      const dx = p.x - b.x;
      const dir = Math.abs(dx) < 16 ? 0 : Math.sign(dx);
      // Le boss retourne à son sommeil si le joueur s'enfuit (on peut réessayer plus tard)
      if (Math.abs(dx) > 34 * T || Math.abs(p.y - b.y) > 24 * T) {
        this.toast(`${b.name} retourne à son sommeil…`);
        this.removeBoss();
        return;
      }
      if (dir) b.setFlipX(dir < 0);
      if (b.type === 'golem') this.updateGolem(b, dir, dx, dt);
      else this.updateKing(b, dir, dx, dt, time);
      this.extraLights = [{ x: b.x, y: b.y, r: 4, v: 0.6 }];

      // Barre de vie
      const w = 300;
      const x = (this.scale.width - w) / 2;
      const g = this.bossG.clear();
      g.fillStyle(0x000000, 0.6).fillRect(x - 3, 33, w + 6, 14);
      g.fillStyle(b.type === 'golem' ? 0x6fd3e8 : 0xa050e0, 1).fillRect(x, 36, w * Math.max(0, b.hp) / b.maxHp, 8);
      this.bossName.setText(`${b.name}${b.phase === 2 ? ' — enragé' : ''}`);
    },

    updateGolem(b, dir, dx, dt) {
      const fast = b.phase === 2;
      const body = b.body;
      if (!b.airborne) b.setVelocityX(dir * (fast ? 62 : 45));
      if (body.blocked.down && (body.blocked.left || body.blocked.right) && !b.airborne) b.setVelocityY(-320);
      // Saut puis onde de choc au sol (on l'évite en sautant)
      b.slamT -= dt;
      if (b.slamT <= 0 && body.blocked.down) {
        b.slamT = fast ? 3.5 : 5;
        b.setVelocityY(-430);
        b.airborne = true;
        b.setFrame('f1');
      } else if (b.airborne && body.blocked.down && body.velocity.y >= 0 && b.slamT < (fast ? 3.3 : 4.8)) {
        b.airborne = false;
        b.setFrame('f0');
        this.cameras.main.shake(300, 0.012);
        this.burst(b.x, b.y + 28, 0x8a8a90, 14);
        [-1, 1].forEach((s) => this.spawnProjectile('wave', b.x + s * 24, b.y + 22, s * 260, 0, { dmg: 4, life: 1.3, groundOnly: true, r: 6 }));
      }
      // Lancer de rocher en cloche vers le joueur
      b.rockT -= dt;
      if (b.rockT <= 0) {
        b.rockT = fast ? 2.2 : 3.5;
        const t = 1.1;
        const g = 600;
        const ddy = this.player.y - (b.y - 30);
        this.spawnProjectile('rock', b.x, b.y - 30, dx / t, (ddy - 0.5 * g * t * t) / t, { g, dmg: 3, life: 3, r: 6 });
      }
    },

    updateKing(b, dir, dx, dt, time) {
      const fast = b.phase === 2;
      const body = b.body;
      if (time >= b.dashUntil) b.setVelocityX(dir * (fast ? 95 : 60));
      if (body.blocked.down && (body.blocked.left || body.blocked.right)) b.setVelocityY(-340);
      b.animT = (b.animT || 0) + dt;
      if (b.animT > 0.2) {
        b.animT = 0;
        b.setFrame(b.frame.name === 'f0' ? 'f1' : 'f0');
      }
      if (Math.random() < 0.15) this.mote(b.x + Phaser.Math.Between(-12, 12), b.y, 0xc070ff);
      // Invocation de zombies corrompus
      b.summonT -= dt;
      if (b.summonT <= 0) {
        b.summonT = fast ? 6 : 9;
        const summoned = this.mobs.getChildren().filter((m) => m.summoned).length;
        for (let k = 0; k < 2 && summoned + k < 4; k++) {
          const sx = Phaser.Math.Clamp(Math.floor(b.x / T) + (k ? 3 : -3), 2, W - 3);
          const m = this.spawnMob('corrupt', sx, Math.floor(b.y / T) + 1, { summoned: true, force: true });
          if (m) this.burst(m.x, m.y, 0xc070ff, 10);
        }
      }
      // Salve d'orbes
      b.orbT -= dt;
      if (b.orbT <= 0) {
        b.orbT = fast ? 2.5 : 4;
        const n = fast ? 5 : 3;
        const base = Math.atan2(this.player.y - (b.y - 10), this.player.x - b.x);
        for (let k = 0; k < n; k++) {
          const a = base + (k - (n - 1) / 2) * 0.3;
          this.spawnProjectile('orb', b.x, b.y - 10, Math.cos(a) * 230, Math.sin(a) * 230, { dmg: 3, life: 3, r: 6 });
        }
      }
      // Charge (seconde phase)
      if (fast) {
        b.dashT -= dt;
        if (b.dashT <= 0) {
          b.dashT = 6;
          b.dashUntil = time + 600;
          b.setVelocityX(Math.sign(dx || 1) * 380);
          this.burst(b.x, b.y + 20, 0xc070ff, 10);
        }
      }
    },
  };
})();
