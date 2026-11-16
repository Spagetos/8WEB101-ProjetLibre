/* Z-Craft — Le Monde Vivant : survie, construction et exploration en 2D
   Modules chargés avant ce fichier (voir catalogue.js) : data, textures, world, inventory, living, mobs, save */

(function () {
  const { T, W, H, REACH } = ZC;
  const B = ZC.B;
  const BLOCKS = ZC.BLOCKS;
  const ITEMS = ZC.ITEMS;

  const KEYS = {
    left: ['ArrowLeft', 'KeyA'],
    right: ['ArrowRight', 'KeyD'],
    jump: ['Space', 'ArrowUp', 'KeyW'],
  };

  // Couleur des éclats de minage
  const DUST = {
    [B.GRASS]: 0x6aa040, [B.DIRT]: 0x86603f, [B.SAND]: 0xdccf92, [B.LOG]: 0x6a5232, [B.LEAVES]: 0x3a8a2a,
    [B.PLANKS]: 0xa6864f, [B.CORRUPT]: 0xa050e0, [B.CRYSTAL]: 0x80e0f0, [B.GOLD]: 0xf0d040, [B.METEOR]: 0xff8a3a,
  };

  const fmtTime = (s) => (s >= 60 ? `${Math.floor(s / 60)} min ${Math.floor(s % 60)} s` : `${Math.floor(s)} s`);

  class CraftScene extends Phaser.Scene {
    constructor() {
      super('z-craft');
    }

    create() {
      ZC.makeTextures(this);
      this.resetState();
      const save = this.loadSave();
      this.seed = save ? save.seed : Math.floor(Math.random() * 1e9);

      const world = ZC.generateWorld(this.seed);
      this.grid = world.grid;
      this.surface = world.surface;
      this.chests = new Map(world.chests.map((c) => [c.i, c.loot]));
      this.structures = world.structures.map((s) => Object.assign({ spawned: false, found: false }, s));
      this.golemPos = world.golem;
      this.kingPos = world.king;
      this.corePos = world.core;
      this.spawnPos = world.spawn;
      if (save) this.applySaveWorld(save);
      this.indexWorld();
      this.buildTilemap();
      this.initInventory();
      if (save) this.applySaveState(save);

      this.createPlayer(save);
      this.initLiving();
      this.initMobs();
      this.buildHud();
      this.buildHotbar();
      this.buildInventoryUI();
      this.buildTouch();
      this.bindInput();

      // Sauvegarde automatique, et à la fermeture de la page ou au redémarrage de la scène
      this.time.addEvent({ delay: 30000, loop: true, callback: () => this.writeSave() });
      const onUnload = () => this.writeSave();
      window.addEventListener('beforeunload', onUnload);
      this.events.once('shutdown', () => {
        window.removeEventListener('beforeunload', onUnload);
        this.writeSave();
      });

      ZG.setScore(this.score);
      this.updateDay(0);
      this.computeLight();
      if (this.saveError) this.time.delayedCall(400, () => this.banner('Sauvegarde illisible', 'Elle a été ignorée : un nouveau monde a été créé.', '#ff9a4d'));
      else if (save) this.time.delayedCall(300, () => this.banner('Partie chargée', `Jour ${this.day} · Fragments ${this.countItem('fragment')}/${ZC.FRAGMENTS_NEEDED}`, '#9ef0ff'));
      else this.showIntro();
    }

    resetState() {
      Object.assign(this, {
        dead: false, skipSave: false, saveError: false, saveWarned: false, cinematic: false,
        diff: new Map(), placed: new Set(), looted: new Set(), machines: new Map(), purifiers: new Set(),
        corruptList: [], corruptCount: 0, instab: new Float32Array(Math.ceil(W / ZC.CHUNK) * Math.ceil(H / ZC.CHUNK)),
        score: 0, clock: ZC.DAY_LENGTH * 0.08, nights: 0, day: 1, maxHp: 20, hp: 20,
        bosses: { golem: false, king: false }, coreActive: false, isNight: null, daylight: 1, basePos: null,
        mining: null, keys: new Set(), uiOpen: false, invulnUntil: 0, knockUntil: 0, lastVy: 0, lastHurt: 0,
        regenT: 0, corruptHurtT: 0, touchMode: 'mine', touch: {}, worldPointer: null, swingT: 0, swingKind: 'pick',
        hudT: 0, equipDirty: true, animT: 0, frame2: false,
      });
    }

    // --- Accès au monde ---
    getB(x, y) {
      if (x < 0 || y < 0 || x >= W || y >= H) return B.BEDROCK;
      return this.grid[y * W + x];
    }

    opaque(id) {
      return BLOCKS[id].solid && id !== B.LEAVES;
    }

    updateSkyline(x) {
      let y = 0;
      while (y < H && !this.opaque(this.grid[y * W + x])) y++;
      this.skyline[x] = y;
    }

    // Légères variations de teinte pour les blocs naturels
    tileTint(x, y, id) {
      if (!BLOCKS[id].natural && id !== B.LOG && id !== B.LEAVES) return 0xffffff;
      const h = (((x * 73856093) ^ (y * 19349663)) >>> 0) % 1000 / 1000;
      const v = Math.round(255 * (0.9 + h * 0.1));
      return (v << 16) | (v << 8) | v;
    }

    // Modifie un bloc et tient à jour toutes les structures dérivées
    setB(x, y, id, opts = {}) {
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      const i = y * W + x;
      const old = this.grid[i];
      if (old === id) return;
      this.grid[i] = id;
      this.diff.set(i, id);
      if (id === B.AIR) this.layer.removeTileAt(x, y);
      else this.layer.putTileAt(id, x, y).tint = this.tileTint(x, y, id);
      if (old === B.CORRUPT) this.corruptCount--;
      if (id === B.CORRUPT) {
        this.corruptCount++;
        this.corruptList.push(i);
      }
      if (old === B.PURIFIER) this.purifiers.delete(i);
      if (id === B.PURIFIER) this.purifiers.add(i);
      const om = BLOCKS[old].machine;
      const nm = BLOCKS[id].machine;
      if (om && om !== nm) this.machines.delete(i);
      if (nm && !this.machines.has(i)) this.machines.set(i, this.newMachine(nm));
      if (opts.placed) this.placed.add(i);
      else if (id === B.AIR) this.placed.delete(i);
      if (this.opaque(old) !== this.opaque(id)) this.updateSkyline(x);
    }

    indexWorld() {
      this.skyline = new Int16Array(W);
      for (let x = 0; x < W; x++) this.updateSkyline(x);
      for (let i = 0; i < W * H; i++) {
        const id = this.grid[i];
        if (id === B.CORRUPT) {
          this.corruptList.push(i);
          this.corruptCount++;
        } else if (id === B.PURIFIER) {
          this.purifiers.add(i);
        } else if (BLOCKS[id].machine) {
          this.machines.set(i, this.newMachine(BLOCKS[id].machine));
        }
      }
    }

    buildTilemap() {
      this.map = this.make.tilemap({ tileWidth: T, tileHeight: T, width: W, height: H });
      const tileset = this.map.addTilesetImage('zc-tiles', 'zc-tiles', T, T, 0, 0);
      // Parois sombres derrière le sous-sol, pour que les grottes ne montrent pas le ciel
      const walls = this.map.createBlankLayer('fond', tileset).setDepth(-5);
      for (let x = 0; x < W; x++) {
        for (let y = this.surface[x] + 1; y < H; y++) walls.putTileAt(y <= this.surface[x] + 5 ? ZC.WALL_DIRT : ZC.WALL_STONE, x, y, false);
      }
      this.layer = this.map.createBlankLayer('monde', tileset).setDepth(0);
      // Indices solides déclarés avant de poser les blocs, pour que les blocs posés plus tard le soient aussi
      this.layer.setCollision(ZC.SOLID_IDS);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const id = this.grid[y * W + x];
          if (id) this.layer.putTileAt(id, x, y, false).tint = this.tileTint(x, y, id);
        }
      }
      this.layer.calculateFacesWithin(0, 0, W, H);
    }

    // --- Joueur ---
    createPlayer(save) {
      this.physics.world.setBounds(0, 0, W * T, H * T);
      this.physics.world.gravity.y = 950;
      let x = save ? Phaser.Math.Clamp(save.player.x, T, (W - 1) * T) : (this.spawnPos.x + 0.5) * T;
      let y = save ? Phaser.Math.Clamp(save.player.y, T * 2, (H - 3) * T) : this.spawnPos.y * T - 23;
      // Ne jamais apparaître coincé dans un bloc
      for (let k = 0; k < 40; k++) {
        const tx = Math.floor(x / T);
        if (!BLOCKS[this.getB(tx, Math.floor((y - 18) / T))].solid && !BLOCKS[this.getB(tx, Math.floor((y + 18) / T))].solid) break;
        y -= T;
      }
      this.player = this.physics.add.sprite(x, y, 'zc-player', 'f0').setDepth(10);
      this.player.body.setSize(14, 42);
      this.player.setCollideWorldBounds(true).setMaxVelocity(400, 650);
      this.physics.add.collider(this.player, this.layer);
      this.toolSprite = this.add.image(x, y, 'zc-items', 'i-pick_wood').setOrigin(0.2, 0.8).setDepth(11).setVisible(false);

      const cam = this.cameras.main;
      cam.setBounds(0, 0, W * T, H * T);
      cam.setRoundPixels(true);
      cam.startFollow(this.player, true, 0.15, 0.15);
    }

    held(action) {
      return !!this.touch[action] || KEYS[action].some((code) => this.keys.has(code));
    }

    updatePlayer(time, dt) {
      const p = this.player;
      const body = p.body;
      if (time >= this.knockUntil) {
        const left = this.held('left');
        const right = this.held('right');
        if (left && !right) p.setVelocityX(-165).setFlipX(true);
        else if (right && !left) p.setVelocityX(165).setFlipX(false);
        else p.setVelocityX(0);
      }
      const onFloor = body.blocked.down;
      if (onFloor && this.held('jump')) p.setVelocityY(-300);

      // Dégâts de chute (à partir d'environ 7 blocs)
      if (onFloor && this.lastVy > 560) this.hurt(Math.floor((this.lastVy - 520) / 20), null);
      this.lastVy = body.velocity.y;

      // La corruption ronge le joueur qui marche dessus
      const feet = this.getB(Math.floor(p.x / T), Math.floor((p.y + 23) / T));
      if (onFloor && feet === B.CORRUPT) {
        this.corruptHurtT += dt;
        if (this.corruptHurtT >= 1.5) {
          this.corruptHurtT = 0;
          this.hurt(1, null);
          if (!this.corruptWarned) {
            this.corruptWarned = true;
            this.toast('La corruption vous ronge ! Purifiez-la ou évitez-la.');
          }
        }
      } else {
        this.corruptHurtT = 0;
      }

      // Animation : saut, marche, immobile
      this.animT += dt;
      if (!onFloor) p.setFrame('f2');
      else if (Math.abs(body.velocity.x) > 10) {
        if (this.animT > 0.13) {
          this.animT = 0;
          this.frame2 = !this.frame2;
          p.setFrame(this.frame2 ? 'f1' : 'f0');
        }
      } else p.setFrame('f0');

      // Outil qui se balance pendant le minage ou l'attaque
      this.swingT -= dt;
      const tool = this.swingT > 0 && this.bestTool(this.swingKind);
      if (tool) {
        const dir = p.flipX ? -1 : 1;
        const ic = ZC.itemIcon(tool.id);
        const phase = (time % 250) / 250;
        this.toolSprite.setTexture(ic.key, ic.frame).setVisible(true).setFlipX(dir < 0)
          .setPosition(p.x + dir * 8, p.y + 2).setOrigin(dir > 0 ? 0.2 : 0.8, 0.8)
          .setAngle(dir * (-50 + phase * 100));
      } else {
        this.toolSprite.setVisible(false);
      }

      // Régénération lente quand on n'a pas été blessé récemment
      if (time - this.lastHurt > 6000 && this.hp < this.maxHp) {
        this.regenT += dt;
        if (this.regenT >= 4) {
          this.regenT = 0;
          this.hp++;
          this.drawHearts();
        }
      }
    }

    swing(kind) {
      this.swingT = 0.25;
      this.swingKind = kind;
    }

    hurt(n, source) {
      const now = this.time.now;
      if (this.dead || this.cinematic || n <= 0 || now < this.invulnUntil) return;
      const armor = this.bestArmor();
      const dmg = armor ? Math.max(1, Math.round(n * (1 - armor.armor))) : n;
      this.hp = Math.max(0, this.hp - dmg);
      this.invulnUntil = now + 700;
      this.lastHurt = now;
      this.regenT = 0;
      this.drawHearts();
      this.player.setTint(0xff6666);
      this.time.delayedCall(200, () => { if (this.player.active) this.player.clearTint(); });
      this.cameras.main.shake(120, 0.006);
      if (source) {
        this.player.setVelocity(Math.sign(this.player.x - source.x || 1) * 260, -220);
        this.knockUntil = now + 250;
      }
      if (this.hp <= 0) this.die();
    }

    die() {
      this.dead = true;
      this.mining = null;
      this.closeInventory();
      this.removeBoss();
      this.cursorG.clear();
      this.hoverText.setText('');
      this.toolSprite.setVisible(false);
      this.player.setVelocity(0, 0).setTint(0xff4444).setAngle(90);
      this.mobs.getChildren().forEach((m) => m.setVelocityX(0));
      const record = this.score > 0 && ZG.submit(this.score);
      // On réapparaît au point de départ avec la moitié de ses ressources
      this.deathPenalty();
      this.writeSave({ respawn: true });
      this.skipSave = true;
      const nights = `${this.nights} nuit${this.nights > 1 ? 's' : ''} survécue${this.nights > 1 ? 's' : ''}`;
      ZG.overlay(this, 'Vous êtes mort',
        `Score : ${this.score} points · ${nights}${record ? '\n🏆 Nouveau record !' : ''}\nRetour au point de départ : la moitié des ressources est perdue.`,
        { color: '#ff5d73', delay: 600 });
    }

    // --- Commandes ---
    bindInput() {
      this.input.keyboard.on('keydown', (e) => {
        this.keys.add(e.code);
        this.onKey(e.code);
      });
      this.input.keyboard.on('keyup', (e) => this.keys.delete(e.code));
      const clearKeys = () => {
        this.keys.clear();
        this.touch = {};
      };
      this.game.events.on('blur', clearKeys);
      this.events.once('shutdown', () => this.game.events.off('blur', clearKeys));

      this.input.mouse.disableContextMenu();
      this.input.addPointer(2);
      this.input.on('pointerdown', (p) => this.onPointerDown(p));
      this.input.on('pointerup', (p) => { if (p === this.worldPointer) this.worldPointer = null; });
      this.input.on('wheel', (p, over, dx, dy) => {
        if (this.uiOpen) this.scrollRecipes(Math.sign(dy));
        else this.select(this.sel + Math.sign(dy));
      });
    }

    onKey(code) {
      if (this.dead) return;
      if (code === 'KeyE') {
        this.toggleInventory();
        return;
      }
      if (code === 'Escape') {
        this.closeInventory();
        return;
      }
      const digit = /^(?:Digit|Numpad)([1-9])$/.exec(code);
      if (digit) this.select(Number(digit[1]) - 1);
      if (code === 'KeyC') this.quickPlanks();
    }

    overUi(p) {
      return Phaser.Geom.Rectangle.Contains(this.hotbarRect, p.x, p.y) ||
        this.touchRects.some((r) => Phaser.Geom.Rectangle.Contains(r, p.x, p.y));
    }

    pointerTile(p) {
      const wp = this.cameras.main.getWorldPoint(p.x, p.y);
      const tx = Math.floor(wp.x / T);
      const ty = Math.floor(wp.y / T);
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, (tx + 0.5) * T, (ty + 0.5) * T);
      return { wp, tx, ty, inReach: dist <= REACH * T };
    }

    inReachOf(e) {
      return Phaser.Math.Distance.Between(this.player.x, this.player.y, e.x, e.y) <= (REACH + 1) * T;
    }

    onPointerDown(p) {
      if (this.dead || this.cinematic || this.uiOpen || this.overUi(p)) return;
      this.worldPointer = p;
      const { wp, tx, ty, inReach } = this.pointerTile(p);
      if (p.rightButtonDown() || (p.wasTouch && this.touchMode === 'place')) {
        this.useAt(tx, ty, inReach);
        return;
      }
      const enemy = this.enemyAt(wp.x, wp.y);
      if (enemy && this.inReachOf(enemy)) this.tryAttack(enemy);
    }

    tryAttack(enemy) {
      if (this.time.now < this.nextAttack) return;
      this.nextAttack = this.time.now + 350;
      this.attack(enemy);
    }

    // Minage continu, survol et attaque maintenue
    updateInteraction(time, dt) {
      const g = this.cursorG.clear();
      const ptr = this.worldPointer || this.input.activePointer;
      if (this.uiOpen || this.cinematic || (!this.worldPointer && this.overUi(ptr))) {
        this.mining = null;
        this.hoverText.setText('');
        return;
      }
      const { wp, tx, ty, inReach } = this.pointerTile(ptr);
      this.updateHoverInfo(ptr, tx, ty, inReach);
      if (inReach) g.lineStyle(2, 0xffffff, 0.8).strokeRect(tx * T, ty * T, T, T);

      const wpPtr = this.worldPointer;
      const pressing = wpPtr && wpPtr.isDown && (wpPtr.wasTouch ? this.touchMode === 'mine' : wpPtr.leftButtonDown());
      if (!pressing) {
        this.mining = null;
        return;
      }
      const enemy = this.enemyAt(wp.x, wp.y);
      if (enemy) {
        if (this.inReachOf(enemy)) this.tryAttack(enemy);
        this.mining = null;
        return;
      }
      const id = this.getB(tx, ty);
      if (!inReach || !id) {
        this.mining = null;
        return;
      }
      const blk = BLOCKS[id];
      const same = this.mining && this.mining.x === tx && this.mining.y === ty;
      const pick = this.bestTool('pick');
      if (blk.tier > (pick ? pick.tier : 0)) {
        if (!same) {
          this.mining = { x: tx, y: ty, t: 0, dust: 0 };
          this.toast(blk.hard === Infinity ? `${blk.name} : indestructible` : `${blk.name} : il faut une ${ZC.PICK_TIER_NAMES[blk.tier]}`);
        }
        g.lineStyle(3, 0xff4d5e, 0.9).lineBetween(tx * T + 4, ty * T + 4, tx * T + T - 4, ty * T + T - 4)
          .lineBetween(tx * T + T - 4, ty * T + 4, tx * T + 4, ty * T + T - 4);
        return;
      }
      if (!same) this.mining = { x: tx, y: ty, t: 0, dust: 0 };
      const need = Math.max(0.05, blk.hard / (pick ? pick.speed : 1));
      this.mining.t += dt;
      this.mining.dust += dt;
      this.swing('pick');
      if (this.mining.dust > 0.15) {
        this.mining.dust = 0;
        this.burst((tx + 0.5) * T, (ty + 0.5) * T, DUST[id] || 0x8a8a90, 2);
      }
      if (this.mining.t >= need) {
        this.breakBlock(tx, ty);
        return;
      }
      // Fissures de plus en plus marquées
      const progress = this.mining.t / need;
      g.fillStyle(0x000000, 0.1 + progress * 0.4).fillRect(tx * T, ty * T, T, T);
      g.lineStyle(2, 0x000000, 0.75);
      const x0 = tx * T;
      const y0 = ty * T;
      const cracks = [[12, 12, 4, 3], [12, 12, 21, 7], [12, 12, 7, 21], [12, 12, 20, 20]];
      cracks.slice(0, Math.ceil(progress * cracks.length)).forEach(([ax, ay, bx, by]) => {
        g.lineBetween(x0 + ax, y0 + ay, x0 + bx, y0 + by);
      });
    }

    breakBlock(x, y) {
      const id = this.getB(x, y);
      const blk = BLOCKS[id];
      const i = y * W + x;
      const cx = (x + 0.5) * T;
      const cy = (y + 0.5) * T;
      if (id === B.CHEST) this.openChest(i);
      const m = this.machines.get(i);
      if (m) this.collectDrill(m);
      this.setB(x, y, B.AIR);
      this.mining = null;
      const drops = Array.isArray(blk.drop) ? blk.drop : blk.drop ? [[blk.drop, 1]] : [];
      drops.forEach(([item, n]) => {
        if (this.addItem(item, n) > 0) this.toast('Inventaire plein');
      });
      if (blk.points) this.addScore(blk.points, cx, cy - 10);
      if (blk.natural || id === B.CORRUPT) this.addInstability(x, y, 1);
      this.burst(cx, cy, DUST[id] || 0x8a8a90, 8);
    }

    // Clic droit : interagir avec un bloc, sinon utiliser l'objet sélectionné
    useAt(tx, ty, inReach) {
      const id = this.getB(tx, ty);
      if (id && BLOCKS[id].interact) {
        if (inReach) this.interact(tx, ty, id);
        else this.toast('Trop loin');
        return;
      }
      const s = this.selectedStack();
      if (!s) return;
      const it = ITEMS[s.id];
      if (it.heal) {
        if (this.hp >= this.maxHp) {
          this.toast('Votre santé est déjà au maximum');
          return;
        }
        this.hp = Math.min(this.maxHp, this.hp + it.heal);
        this.consumeSelected();
        this.drawHearts();
        this.burst(this.player.x, this.player.y - 10, 0xff6680, 10);
        this.toast('Potion bue : santé restaurée');
      } else if (it.block !== undefined) {
        this.placeBlock(tx, ty, inReach, it.block);
      } else if (it.tool || it.armor) {
        this.toast(`${it.name} : s'utilise automatiquement quand vous l'avez sur vous`);
      } else {
        this.toast(`${it.name} : ingrédient de fabrication (touche E)`);
      }
    }

    consumeSelected() {
      const s = this.inv[this.sel];
      s.n--;
      if (!s.n) this.inv[this.sel] = null;
      this.refreshItems();
    }

    placeBlock(tx, ty, inReach, blockId) {
      if (!inReach || tx < 0 || ty < 0 || tx >= W || ty >= H || this.getB(tx, ty)) return;
      if (BLOCKS[blockId].solid) {
        // Pas de bloc solide dans un personnage (rectangle réduit d'1 px pour autoriser le contact)
        const rect = new Phaser.Geom.Rectangle(tx * T + 1, ty * T + 1, T - 2, T - 2);
        const bodies = [this.player, ...this.mobs.getChildren(), this.boss].filter(Boolean).map((s) => s.body);
        if (bodies.some((b) => Phaser.Geom.Intersects.RectangleToRectangle(rect, new Phaser.Geom.Rectangle(b.x, b.y, b.width, b.height)))) return;
      }
      // Un bloc doit s'appuyer sur un bloc voisin
      if (![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => this.getB(tx + dx, ty + dy))) return;
      this.setB(tx, ty, blockId, { placed: true });
      this.consumeSelected();
      this.burst((tx + 0.5) * T, (ty + 0.5) * T, 0xffffff, 3);
      if (blockId === B.BENCH) {
        if (!this.basePos) this.toast('Établi posé : votre base est ici (attention aux invasions)');
        this.basePos = { x: tx, y: ty };
      }
      if (blockId === B.PURIFIER) this.toast('Cristal purificateur : il nettoie et protège la corruption alentour');
      if (BLOCKS[blockId].machine && !this.machineHintShown) {
        this.machineHintShown = true;
        this.toast('Les machines ont besoin d\'un générateur alimenté au charbon à moins de 12 blocs');
      }
    }

    interact(tx, ty, id) {
      const i = ty * W + tx;
      const m = this.machines.get(i);
      if (id === B.CHEST) this.openChest(i);
      else if (id === B.BENCH || id === B.FURNACE) this.openInventory();
      else if (id === B.CORE || id === B.CORE_ON) this.tryActivateCore();
      else if (m && m.type === 'gen') {
        if (!this.countItem('coal')) this.toast('Le générateur fonctionne au charbon : gardez-en sur vous');
        else if (m.fuel > ZC.GEN_MAX_FUEL - ZC.GEN_FUEL_PER_COAL) this.toast('Réservoir plein');
        else {
          this.removeItem('coal', 1);
          m.fuel += ZC.GEN_FUEL_PER_COAL;
          this.toast(`Générateur : ${fmtTime(m.fuel)} de carburant`);
        }
      } else if (m && m.type === 'drill') {
        if (!this.collectDrill(m)) {
          this.toast(m.depth > 24 ? 'Foreuse : forage terminé ou bloqué par une roche trop dure'
            : m.powered ? `Foreuse en marche (profondeur ${m.depth})` : 'Foreuse sans énergie : il faut un générateur alimenté');
        }
      } else if (m && m.type === 'door') {
        if (m.powered) this.toast('Porte alimentée : elle s\'ouvre automatiquement à votre approche');
        else if (id === B.DOOR) this.setB(tx, ty, B.DOOR_OPEN);
        else if (!Phaser.Geom.Rectangle.Overlaps(new Phaser.Geom.Rectangle(tx * T, ty * T, T, T), this.player.getBounds())) this.setB(tx, ty, B.DOOR);
      }
    }

    collectDrill(m) {
      const ids = Object.keys(m.buffer);
      if (!ids.length) return false;
      ids.forEach((id) => this.giveItem(id, m.buffer[id]));
      this.toast('Foreuse : ' + ids.map((id) => `${m.buffer[id]} ${ITEMS[id].name}`).join(', '));
      m.buffer = {};
      return true;
    }

    openChest(i) {
      const loot = this.chests.get(i);
      if (!loot) {
        this.toast('Coffre vide');
        return;
      }
      this.chests.delete(i);
      this.looted.add(i);
      loot.forEach(([id, n]) => this.giveItem(id, n));
      const x = (i % W + 0.5) * T;
      const y = Math.floor(i / W) * T;
      this.burst(x, y, 0xffd166, 14);
      this.addScore(50, x, y - 10);
      const list = loot.map(([id, n]) => `${ITEMS[id].name} ×${n}`).join(', ');
      if (loot.some(([id]) => id === 'fragment')) {
        this.banner('Fragment ancien trouvé !', `${this.countItem('fragment')}/${ZC.FRAGMENTS_NEEDED} — ${list}`, '#ffd166');
      } else {
        this.toast('Coffre : ' + list);
      }
      this.writeSave();
    }

    // --- Noyau du monde : objectif final ---
    tryActivateCore() {
      if (this.coreActive) {
        this.toast('Le noyau est éveillé. Le monde continue de vivre…');
        return;
      }
      const frags = this.countItem('fragment');
      const missing = [];
      if (frags < ZC.FRAGMENTS_NEEDED) missing.push(`fragments ${frags}/${ZC.FRAGMENTS_NEEDED}`);
      if (!this.bosses.golem) missing.push('Golem de pierre à vaincre');
      if (!this.bosses.king) missing.push('Roi zombie à vaincre');
      if (missing.length) {
        this.banner('Le noyau reste endormi', 'Il manque : ' + missing.join(' · '), '#9ef0ff');
        return;
      }
      this.activateCore();
    }

    activateCore() {
      const { x, y } = this.corePos;
      const cx = (x + 0.5) * T;
      const cy = (y + 0.5) * T;
      this.removeItem('fragment', ZC.FRAGMENTS_NEEDED);
      this.coreActive = true;
      this.cinematic = true;
      this.setB(x, y, B.CORE_ON);
      this.cameras.main.flash(900, 180, 255, 255);
      this.cameras.main.shake(2500, 0.008);
      this.banner('Le noyau s\'éveille !', 'Une onde de lumière traverse le monde et dissout la corruption…', '#9ef0ff');
      for (let k = 0; k < 3; k++) {
        const ring = this.add.circle(cx, cy, 20).setStrokeStyle(6, 0x9ef0ff).setDepth(40);
        this.tweens.add({ targets: ring, scale: 70, alpha: 0, duration: 3000, delay: k * 600, onComplete: () => ring.destroy() });
      }
      this.time.addEvent({
        delay: 100, repeat: 40, callback: () => {
          for (let n = 0; n < 150 && this.corruptList.length;) {
            const i = this.corruptList.pop();
            if (this.grid[i] === B.CORRUPT) {
              this.setB(i % W, Math.floor(i / W), B.STONE);
              n++;
            }
          }
        },
      });
      this.mobs.getChildren().slice().forEach((m) => this.killMob(m, false));
      this.removeBoss();
      this.addScore(2000, cx, cy - 40);
      this.time.delayedCall(4200, () => {
        this.cinematic = false;
        ZG.submit(this.score);
        this.writeSave();
        this.showVictory();
      });
    }

    showVictory() {
      const { width: w, height: h } = this.scale;
      const objs = [];
      const add = (o) => {
        objs.push(o);
        return o.setScrollFactor(0).setDepth(300);
      };
      add(this.add.rectangle(w / 2, h / 2, 560, 260, 0x0b0d22, 0.95).setStrokeStyle(4, 0x9ef0ff));
      add(this.add.text(w / 2, h / 2 - 80, 'Victoire !', { fontFamily: ZG.FONT, fontSize: '46px', fontStyle: 'bold', color: '#9ef0ff' }).setOrigin(0.5));
      add(this.add.text(w / 2, h / 2 - 10,
        `Le noyau ancien est éveillé et la corruption reflue.\nScore : ${this.score} points · Jour ${this.day}\nLe monde continue de vivre : explorez, construisez, survivez !`,
        { fontFamily: ZG.FONT, fontSize: '18px', color: '#d6d8f5', align: 'center', lineSpacing: 6 }).setOrigin(0.5));
      const btn = add(ZG.textButton(this, w / 2, h / 2 + 85, 'Continuer l\'aventure', () => objs.forEach((o) => o.destroy())));
      btn.setDepth(301);
    }

    // --- Interface ---
    buildHud() {
      const { width: w } = this.scale;
      const txt = (x, y, size, color = '#ffffff') => this.add.text(x, y, '', {
        fontFamily: ZG.FONT, fontSize: size + 'px', color, stroke: '#000000', strokeThickness: size >= 16 ? 4 : 3,
      }).setScrollFactor(0).setDepth(100);
      this.cursorG = this.add.graphics().setDepth(33);
      this.hearts = [];
      for (let i = 0; i < 20; i++) {
        this.hearts.push(this.add.image(12 + i * 21, 10, 'zc-heart', 'full').setOrigin(0).setScrollFactor(0).setDepth(100));
      }
      this.equipText = txt(14, 40, 13, '#d6d8f5');
      this.objText = txt(14, 60, 14, '#ffe066');
      this.arrowG = this.add.graphics().setScrollFactor(0).setDepth(100);
      this.dayText = txt(w - 14, 10, 18).setOrigin(1, 0);
      this.statusText = txt(w - 14, 36, 12, '#d6d8f5').setOrigin(1, 0).setAlign('right');
      this.barsG = this.add.graphics().setScrollFactor(0).setDepth(100);
      this.hoverText = this.add.text(0, 0, '', {
        fontFamily: ZG.FONT, fontSize: '12px', color: '#ffffff', backgroundColor: '#0b0d22cc', padding: { x: 6, y: 3 },
      }).setScrollFactor(0).setDepth(120);
      this.toastText = txt(w / 2, this.scale.height - 72, 16).setOrigin(0.5).setAlpha(0);
      this.bannerBg = this.add.rectangle(w / 2, 92, 600, 58, 0x0b0d22, 0.85).setScrollFactor(0).setDepth(105).setAlpha(0);
      this.bannerTitle = txt(w / 2, 76, 20).setOrigin(0.5).setDepth(106).setAlpha(0).setFontStyle('bold');
      this.bannerSub = txt(w / 2, 102, 13, '#d6d8f5').setOrigin(0.5).setDepth(106).setAlpha(0);
      this.drawHearts();
    }

    drawHearts() {
      this.hearts.forEach((img, i) => {
        if (i >= this.maxHp / 2) {
          img.setVisible(false);
          return;
        }
        const frame = this.hp >= (i + 1) * 2 ? 'full' : this.hp === i * 2 + 1 ? 'half' : 'empty';
        img.setFrame(frame).setVisible(true);
      });
    }

    toast(msg) {
      this.tweens.killTweensOf(this.toastText);
      this.toastText.setText(msg).setAlpha(1);
      this.tweens.add({ targets: this.toastText, alpha: 0, delay: 1800, duration: 400 });
    }

    banner(title, sub, color = '#ffffff') {
      const parts = [this.bannerBg, this.bannerTitle, this.bannerSub];
      this.tweens.killTweensOf(parts);
      this.bannerTitle.setText(title).setColor(color);
      this.bannerSub.setText(sub || '');
      this.bannerBg.setStrokeStyle(2, Phaser.Display.Color.HexStringToColor(color).color);
      parts.forEach((o) => o.setAlpha(0));
      this.tweens.add({ targets: parts, alpha: 1, duration: 250 });
      this.tweens.add({ targets: parts, alpha: 0, delay: 3800, duration: 500 });
    }

    floatText(x, y, msg, color = '#ffe066', size = 18) {
      const t = this.add.text(x, y, msg, {
        fontFamily: ZG.FONT, fontSize: size + 'px', fontStyle: 'bold', color, stroke: '#000000', strokeThickness: 4,
      }).setOrigin(0.5).setDepth(60);
      this.tweens.add({ targets: t, y: y - 36, alpha: 0, duration: 900, onComplete: () => t.destroy() });
    }

    addScore(n, x, y) {
      this.score += n;
      ZG.setScore(this.score);
      if (x !== undefined) this.floatText(x, y, `+${n}`);
    }

    showIntro() {
      const { width: w } = this.scale;
      const t = this.add.text(w / 2, 130,
        'Q/D ou ← → : bouger · Espace : sauter · Clic gauche : creuser/frapper · Clic droit : poser/utiliser\nE : inventaire et fabrication · 1-9 / molette : choisir · C : bois → planches',
        { fontFamily: ZG.FONT, fontSize: '14px', color: '#ffffff', align: 'center', stroke: '#000000', strokeThickness: 4, lineSpacing: 4 })
        .setOrigin(0.5, 0).setScrollFactor(0).setDepth(100);
      this.tweens.add({ targets: t, alpha: 0, delay: 12000, duration: 1000, onComplete: () => t.destroy() });
    }

    // Étape actuelle de la quête principale et lieu à rejoindre
    objective() {
      const frags = this.countItem('fragment');
      const tier = this.pickTier();
      const nearest = (types) => {
        let best = null;
        let bestD = Infinity;
        this.structures.forEach((s) => {
          if (!types.includes(s.type) || !this.chests.has(s.chest)) return;
          const d = Math.hypot(s.x - this.player.x / T, s.y - this.player.y / T);
          if (d < bestD) {
            best = s;
            bestD = d;
          }
        });
        return best;
      };
      if (this.coreActive) return { text: 'Le noyau est éveillé — le monde continue de vivre' };
      if (tier < 1) return { text: 'Récoltez du bois, fabriquez un établi puis une pioche (E)' };
      if (tier < 3) return { text: 'Creusez pour trouver du fer, fondez-le au four : pioche en fer' };
      if (!this.bosses.golem) return { text: 'Vainquez le Golem de pierre dans sa grande caverne', target: this.golemPos };
      if (!this.bosses.king) return { text: 'Vainquez le Roi zombie au cœur de la corruption', target: this.kingPos };
      if (frags < ZC.FRAGMENTS_NEEDED) {
        const s = nearest(['temple', 'secret']);
        return { text: `Fragments ${frags}/${ZC.FRAGMENTS_NEEDED} : fouillez temples et salles secrètes`, target: s };
      }
      if (tier < 5) return { text: 'Fabriquez une pioche en cristal pour percer la coque du noyau', target: null };
      return { text: 'Rejoignez le noyau au fond du monde et activez-le (clic droit)', target: this.corePos };
    }

    updateHud(dt) {
      this.hudT -= dt;
      if (this.hudT > 0) return;
      this.hudT = 0.25;
      const { width: w } = this.scale;
      if (this.equipDirty) {
        this.equipDirty = false;
        const pick = this.bestTool('pick');
        const sword = this.bestTool('sword');
        const armor = this.bestArmor();
        const short = (it, prefix) => (it ? it.name.replace(prefix, '') : '—');
        this.equipText.setText(`Pioche ${short(pick, 'Pioche ')} · Épée ${short(sword, 'Épée ')} · Armure ${short(armor, 'Armure ')} · Fragments ${this.countItem('fragment')}/${ZC.FRAGMENTS_NEEDED}`);
      }
      // Objectif, avec une flèche vers le lieu à rejoindre
      const obj = this.objective();
      const g = this.arrowG.clear();
      if (obj.target) {
        const dx = obj.target.x - this.player.x / T;
        const dy = obj.target.y - this.player.y / T;
        const a = Math.atan2(dy, dx);
        this.objText.setText(`Objectif : ${obj.text} — ${Math.round(Math.hypot(dx, dy))} blocs`);
        const ax = this.objText.x + this.objText.width + 14;
        const ay = this.objText.y + 10;
        g.fillStyle(0x000000, 0.6).fillCircle(ax, ay, 10);
        g.fillStyle(0xffe066, 1).fillTriangle(
          ax + Math.cos(a) * 8, ay + Math.sin(a) * 8,
          ax + Math.cos(a + 2.5) * 7, ay + Math.sin(a + 2.5) * 7,
          ax + Math.cos(a - 2.5) * 7, ay + Math.sin(a - 2.5) * 7);
      } else {
        this.objText.setText('Objectif : ' + obj.text);
      }

      const event = this.event ? { meteors: '☄ Météorites', quake: '⚠ Séisme', invasion: '⚔ Invasion' }[this.event.type] : '';
      this.dayText.setText(`Jour ${this.day} ${this.isNight ? (this.bloodMoon ? '🔴' : '🌙') : '☀️'}`);
      // Indicateurs : corruption du monde et instabilité locale
      const corr = Math.min(1, this.corruptCount / 3000);
      const inst = Math.min(1, this.localInstability() / 45);
      this.statusText.setText(`${event ? event + '\n' : ''}Corruption ${Math.round(corr * 100)} %\nInstabilité locale`);
      const bx = w - 130;
      const by = this.statusText.y + this.statusText.height + 4;
      const bg = this.barsG.clear();
      const bar = (y, v, color) => {
        bg.fillStyle(0x000000, 0.6).fillRect(bx - 2, y - 2, 120, 10);
        bg.fillStyle(color, 1).fillRect(bx, y, 116 * v, 6);
      };
      bar(by, corr, 0xa050e0);
      bar(by + 12, inst, inst > 0.8 ? 0xff4d5e : inst > 0.5 ? 0xff9a4d : 0x6fd38a);
    }

    // Infobulle sur les blocs utiles (coffres, machines, noyau)
    updateHoverInfo(ptr, tx, ty, inReach) {
      const id = this.getB(tx, ty);
      const blk = BLOCKS[id];
      let info = '';
      const m = this.machines.get(ty * W + tx);
      if (m && m.type === 'gen') info = `Générateur — ${m.fuel > 0 ? 'carburant ' + fmtTime(m.fuel) : 'sans charbon (clic droit)'} · charge ${m.load}/${ZC.MACHINE_POWER.gen}`;
      else if (m && m.type === 'lamp') info = m.powered ? 'Lampe électrique (alimentée)' : 'Lampe électrique — pas d\'énergie';
      else if (m && m.type === 'drill') info = `Foreuse — ${m.powered ? 'en marche' : 'pas d\'énergie'} · ${Object.values(m.buffer).reduce((a, b) => a + b, 0)} objets stockés`;
      else if (m && m.type === 'door') info = m.powered ? 'Porte électrique (automatique)' : 'Porte électrique — clic droit : ouvrir/fermer';
      else if (id === B.CHEST) info = this.chests.has(ty * W + tx) ? 'Coffre — clic droit pour l\'ouvrir' : 'Coffre vide';
      else if (id === B.CORE) info = 'Noyau ancien — clic droit pour tenter de l\'éveiller';
      else if (id === B.BENCH || id === B.FURNACE) info = `${blk.name} — clic droit : fabrication`;
      else if (id === B.PURIFIER) info = 'Cristal purificateur — protège un rayon de 7 blocs';
      if (!info || !inReach) {
        this.hoverText.setText('');
        return;
      }
      this.hoverText.setText(info).setPosition(Math.min(ptr.x + 14, this.scale.width - this.hoverText.width - 4), ptr.y + 16);
    }

    // --- Commandes tactiles ---
    buildTouch() {
      this.touchRects = [];
      if (!this.sys.game.device.input.touch) return;
      const { width: w, height: h } = this.scale;
      const button = (x, y, label, onDown, onUp) => {
        const c = this.add.circle(x, y, 32, 0x111327, 0.55).setStrokeStyle(2, 0x9ea2cc).setScrollFactor(0).setDepth(150).setInteractive();
        const t = this.add.text(x, y, label, { fontFamily: ZG.FONT, fontSize: '22px', color: '#ffffff' }).setOrigin(0.5).setScrollFactor(0).setDepth(151);
        c.on('pointerdown', (p, lx, ly, e) => {
          e.stopPropagation();
          onDown(t);
        });
        if (onUp) {
          c.on('pointerup', () => onUp());
          c.on('pointerout', () => onUp());
        }
        this.touchRects.push(new Phaser.Geom.Rectangle(x - 34, y - 34, 68, 68));
      };
      button(54, h - 96, '◀', () => { this.touch.left = true; }, () => { this.touch.left = false; });
      button(130, h - 96, '▶', () => { this.touch.right = true; }, () => { this.touch.right = false; });
      button(w - 54, h - 96, '⤒', () => { this.touch.jump = true; }, () => { this.touch.jump = false; });
      button(w - 54, h - 172, '⛏', (t) => {
        this.touchMode = this.touchMode === 'mine' ? 'place' : 'mine';
        t.setText(this.touchMode === 'mine' ? '⛏' : '🧱');
        this.toast(this.touchMode === 'mine' ? 'Mode : creuser / frapper' : 'Mode : poser / utiliser');
      });
      button(w - 130, h - 96, '🎒', () => this.toggleInventory());
    }

    // --- Boucle de jeu ---
    update(time, delta) {
      if (this.dead) return;
      const dt = Math.min(delta, 50) / 1000;
      this.updateLiving(time, dt);
      this.updatePlayer(time, dt);
      this.updateInteraction(time, dt);
      this.updateMobs(time, dt);
      this.updateBoss(time, dt);
      this.updateProjectiles(dt);
      this.updateHeldIcon();
      this.updateHud(dt);
    }
  }

  Object.assign(CraftScene.prototype, ZC.InventoryMixin, ZC.LivingMixin, ZC.MobsMixin, ZC.SaveMixin);

  ZG.register({ id: 'z-craft', width: 960, height: 600, scene: CraftScene });
})();
