/* Z-City — action en monde ouvert vu de dessus, façon GTA */

const ZC = {
  WORLD: 2400,    // taille de la ville (carrée)
  BLOCK: 400,     // distance entre deux routes
  ROAD: 110,      // largeur d'une route
  LANE: 28,       // décalage d'une voie par rapport au centre de la route
  SIDEWALK: 18,   // largeur du trottoir
  CAR_COLORS: [0xe63946, 0x457b9d, 0xf4a261, 0x2a9d8f, 0xe9c46a, 0xffffff, 0x8d99ae, 0x9d4edd, 0x222222],
  PED_COLORS: [0xff6b6b, 0x4dabf7, 0x69db7c, 0xffd43b, 0xda77f2, 0xff922b, 0xadb5bd, 0x20c997],
  BUILDING_COLORS: [0x8d6e63, 0x6d7b8d, 0xa1887f, 0x5c6bc0, 0x78909c, 0xb0855b, 0x7e57c2, 0x4d8076, 0xc0a062, 0x8e5a5a],
};

class ZCityScene extends Phaser.Scene {
  constructor() {
    super('z-city');
  }

  create() {
    this.W = this.scale.width;
    this.H = this.scale.height;
    this.money = 0;
    this.health = 100;
    this.wanted = 0;
    this.lastCrime = 0;
    this.lastHit = 0;
    this.nextPoliceSpawn = 0;
    this.vehicle = null;
    this.over = false;

    this.makeTextures();
    this.physics.world.setBounds(0, 0, ZC.WORLD, ZC.WORLD);

    this.buildings = this.physics.add.staticGroup();
    this.cars = this.physics.add.group();
    this.police = this.physics.add.group();
    this.peds = this.physics.add.group();
    this.lotSpots = [];
    this.buildCity();

    // Véhicules : une voiture garée près du départ, des voitures dans les parkings, de la circulation
    this.spawnCar(ZC.BLOCK * 3, ZC.BLOCK * 3 + 100, Math.PI / 2, 0xe63946);
    Phaser.Utils.Array.Shuffle(this.lotSpots).slice(0, 14)
      .forEach((s) => this.spawnCar(s.x, s.y, s.rot, Phaser.Utils.Array.GetRandom(ZC.CAR_COLORS)));
    for (let i = 0; i < 18; i++) this.spawnTraffic();
    for (let i = 0; i < 35; i++) this.spawnPed();

    this.player = this.physics.add.sprite(ZC.BLOCK * 3 - 40, ZC.BLOCK * 3 + 60, 'zc-player').setDepth(6);
    this.player.body.setCircle(8, 2, 2);
    this.player.setCollideWorldBounds(true);

    this.setupColliders();
    this.createPickups();

    this.cameras.main.setBounds(0, 0, ZC.WORLD, ZC.WORLD);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);

    this.keys = this.input.keyboard.addKeys('UP,DOWN,LEFT,RIGHT,W,A,S,D,Z,Q,E,SPACE');

    this.createHud();
    this.newMission();

    // Gyrophares : on alterne deux textures
    this.sirenOn = false;
    this.time.addEvent({
      delay: 220,
      loop: true,
      callback: () => {
        this.sirenOn = !this.sirenOn;
        this.police.getChildren().forEach((p) => p.setTexture(this.sirenOn ? 'zc-police2' : 'zc-police1'));
      },
    });

    ZG.setScore(0);
    this.showMessage('Bienvenue à Z-City !', '#ffd166');
  }

  // ------------------------------------------------------------------ Textures
  makeTextures() {
    if (this.textures.exists('zc-car')) return;
    const g = this.make.graphics({ x: 0, y: 0 }, false);

    // Voiture blanche (teintée ensuite), orientée vers la droite
    g.fillStyle(0x000000, 0.35).fillRoundedRect(3, 3, 48, 26, 7);
    g.fillStyle(0xffffff).fillRoundedRect(0, 0, 48, 26, 7);
    g.fillStyle(0x1b2333).fillRoundedRect(28, 4, 10, 18, 3).fillRoundedRect(7, 5, 7, 16, 3);
    g.fillStyle(0xfff2a8).fillRect(45, 3, 3, 5).fillRect(45, 18, 3, 5);
    g.generateTexture('zc-car', 52, 30);

    // Voiture de police (deux versions pour faire clignoter le gyrophare)
    const police = (key, swap) => {
      g.clear();
      g.fillStyle(0x000000, 0.35).fillRoundedRect(3, 3, 48, 26, 7);
      g.fillStyle(0x15172a).fillRoundedRect(0, 0, 48, 26, 7);
      g.fillStyle(0xffffff).fillRect(14, 0, 22, 26);
      g.fillStyle(0x1b2333).fillRoundedRect(30, 4, 8, 18, 3).fillRoundedRect(8, 5, 6, 16, 3);
      g.fillStyle(swap ? 0x2f6bff : 0xff2a2a).fillRect(21, 2, 7, 11);
      g.fillStyle(swap ? 0xff2a2a : 0x2f6bff).fillRect(21, 13, 7, 11);
      g.generateTexture(key, 52, 30);
    };
    police('zc-police1', false);
    police('zc-police2', true);

    // Joueur (couleurs fixes) et piéton (blanc, teinté ensuite)
    g.clear();
    g.fillStyle(0x000000, 0.3).fillCircle(11, 11, 9);
    g.fillStyle(0x2d6cdf).fillEllipse(10, 10, 12, 19);
    g.fillStyle(0xf1c27d).fillCircle(11, 10, 5);
    g.fillStyle(0x3b2a1a).fillCircle(9, 10, 4);
    g.generateTexture('zc-player', 22, 22);

    g.clear();
    g.fillStyle(0x000000, 0.3).fillCircle(11, 11, 8);
    g.fillStyle(0xcfcfcf).fillEllipse(10, 10, 11, 17);
    g.fillStyle(0xffffff).fillCircle(11, 10, 5);
    g.generateTexture('zc-person', 22, 22);

    // Arbre, billet, marqueur de mission
    g.clear();
    g.fillStyle(0x000000, 0.25).fillCircle(26, 26, 20);
    g.fillStyle(0x2f8f46).fillCircle(22, 22, 20);
    g.fillStyle(0x3fae5a).fillCircle(18, 18, 12).fillCircle(28, 24, 9);
    g.generateTexture('zc-tree', 48, 48);

    g.clear();
    g.fillStyle(0x1e7a3c).fillRoundedRect(0, 0, 24, 14, 3);
    g.fillStyle(0x7cf29c).fillRoundedRect(2, 2, 20, 10, 2);
    g.fillStyle(0x1e7a3c).fillCircle(12, 7, 3);
    g.generateTexture('zc-money', 24, 14);

    g.clear();
    g.fillStyle(0xffffff, 0.25).fillCircle(32, 32, 30);
    g.lineStyle(5, 0xffffff).strokeCircle(32, 32, 28);
    g.generateTexture('zc-marker', 64, 64);

    g.destroy();
  }

  // ------------------------------------------------------------------ Ville
  // Tout le décor fixe est dessiné une seule fois puis « cuit » dans une texture (bien plus rapide à afficher)
  buildCity() {
    const { WORLD, BLOCK, ROAD, SIDEWALK } = ZC;
    const half = ROAD / 2;
    const g = this.make.graphics({ x: 0, y: 0 }, false);

    g.fillStyle(0x2a2c35).fillRect(0, 0, WORLD, WORLD);

    // Marquages : lignes pointillées et passages piétons
    const nearCrossing = (v) => { const m = v % BLOCK; return m < 80 || m > BLOCK - 80; };
    g.fillStyle(0xe8e8e8, 0.5);
    for (let k = 1; k < WORLD / BLOCK; k++) {
      const c = k * BLOCK;
      for (let p = 0; p < WORLD; p += 50) {
        if (nearCrossing(p) || nearCrossing(p + 30)) continue;
        g.fillRect(p, c - 2, 30, 4);
        g.fillRect(c - 2, p, 4, 30);
      }
      for (let j = 1; j < WORLD / BLOCK; j++) {
        const cy = j * BLOCK;
        for (let s = -48; s <= 40; s += 14) {
          g.fillRect(c + s, cy - half - 20, 8, 16);
          g.fillRect(c + s, cy + half + 4, 8, 16);
          g.fillRect(c - half - 20, cy + s, 16, 8);
          g.fillRect(c + half + 4, cy + s, 16, 8);
        }
      }
    }

    // Pâtés de maisons : trottoir + bâtiments, parc ou parking
    const blocks = WORLD / BLOCK;
    for (let bi = 0; bi < blocks; bi++) {
      for (let bj = 0; bj < blocks; bj++) {
        const x0 = bi * BLOCK + half;
        const y0 = bj * BLOCK + half;
        const size = BLOCK - ROAD;
        g.fillStyle(0x5d6070).fillRect(x0, y0, size, size);
        g.lineStyle(2, 0x7a7d8c).strokeRect(x0 + 1, y0 + 1, size - 2, size - 2);

        const ix = x0 + SIDEWALK;
        const iy = y0 + SIDEWALK;
        const is = size - SIDEWALK * 2;
        const r = Math.random();
        if (bi === 2 && bj === 2) this.drawLot(g, ix, iy, is);
        else if (r < 0.12) this.drawPark(g, ix, iy, is);
        else if (r < 0.24) this.drawLot(g, ix, iy, is);
        else this.drawBuildings(g, ix, iy, is);
      }
    }

    if (this.textures.exists('zc-ground')) this.textures.remove('zc-ground');
    g.generateTexture('zc-ground', WORLD, WORLD);
    g.destroy();
    this.add.image(0, 0, 'zc-ground').setOrigin(0).setDepth(0);
  }

  drawPark(g, x, y, s) {
    g.fillStyle(0x2f6b3a).fillRect(x, y, s, s);
    g.fillStyle(0x8a7f62).fillRect(x + s / 2 - 8, y, 16, s).fillRect(x, y + s / 2 - 8, s, 16);
    g.fillStyle(0x4dabf7).fillCircle(x + s / 2, y + s / 2, 22);
    g.lineStyle(4, 0xb0b0b0).strokeCircle(x + s / 2, y + s / 2, 24);
    for (let i = 0; i < 8; i++) {
      const qx = i % 2 ? x + Phaser.Math.Between(20, s / 2 - 30) : x + Phaser.Math.Between(s / 2 + 30, s - 20);
      const qy = i % 4 < 2 ? y + Phaser.Math.Between(20, s / 2 - 30) : y + Phaser.Math.Between(s / 2 + 30, s - 20);
      this.add.image(qx, qy, 'zc-tree').setDepth(8).setAngle(Phaser.Math.Between(0, 360));
    }
  }

  drawLot(g, x, y, s) {
    g.fillStyle(0x3a3c46).fillRect(x, y, s, s);
    g.lineStyle(2, 0xd0d0d0, 0.7);
    for (let c = 0; c <= 5; c++) {
      const lx = x + 2 + c * 50;
      g.lineBetween(lx, y + 10, lx, y + 85);
      g.lineBetween(lx, y + s - 85, lx, y + s - 10);
    }
    for (let c = 0; c < 5; c++) {
      const cx = x + 27 + c * 50;
      this.lotSpots.push({ x: cx, y: y + 48, rot: Math.PI / 2 });
      this.lotSpots.push({ x: cx, y: y + s - 48, rot: -Math.PI / 2 });
    }
  }

  drawBuildings(g, x, y, s) {
    const gap = 14;
    const rects = [];
    const layout = Phaser.Math.Between(0, 2);
    if (layout === 0) {
      rects.push([x, y, s, s]);
    } else if (layout === 1) {
      const a = Phaser.Math.Between(100, 140);
      if (Math.random() < 0.5) rects.push([x, y, a, s], [x + a + gap, y, s - a - gap, s]);
      else rects.push([x, y, s, a], [x, y + a + gap, s, s - a - gap]);
    } else {
      const h = (s - gap) / 2;
      rects.push([x, y, h, h], [x + h + gap, y, h, h], [x, y + h + gap, h, h], [x + h + gap, y + h + gap, h, h]);
    }

    rects.forEach(([bx, by, bw, bh]) => {
      const color = Phaser.Utils.Array.GetRandom(ZC.BUILDING_COLORS);
      const dark = Phaser.Display.Color.ValueToColor(color).darken(18).color;
      g.fillStyle(0x000000, 0.35).fillRect(bx + 8, by + 8, bw, bh);
      g.fillStyle(color).fillRect(bx, by, bw, bh);
      g.lineStyle(4, dark).strokeRect(bx + 7, by + 7, bw - 14, bh - 14);
      g.fillStyle(0x9aa0b0);
      for (let i = 0; i < Phaser.Math.Between(1, 3); i++) {
        g.fillRect(bx + Phaser.Math.Between(16, Math.max(17, bw - 40)), by + Phaser.Math.Between(16, Math.max(17, bh - 36)), 22, 16);
      }
      // Corps physique invisible : le visuel est déjà dans la texture du sol
      const body = this.add.rectangle(bx + bw / 2, by + bh / 2, bw, bh).setVisible(false);
      this.buildings.add(body);
    });
  }

  // ------------------------------------------------------------------ Positions aléatoires
  // Un point sur une voie de circulation (on roule à droite)
  lanePoint() {
    const k = Phaser.Math.Between(1, ZC.WORLD / ZC.BLOCK - 1) * ZC.BLOCK;
    const along = Phaser.Math.Between(100, ZC.WORLD - 100);
    const dir = Math.random() < 0.5 ? 1 : -1;
    if (Math.random() < 0.5) {
      const y = k + ZC.LANE * dir;
      return { x: along, y, rot: dir > 0 ? 0 : Math.PI, dx: dir, dy: 0, laneX: null, laneY: y };
    }
    const x = k - ZC.LANE * dir;
    return { x, y: along, rot: dir > 0 ? Math.PI / 2 : -Math.PI / 2, dx: 0, dy: dir, laneX: x, laneY: null };
  }

  sidewalkPoint() {
    const n = ZC.WORLD / ZC.BLOCK;
    const x0 = Phaser.Math.Between(0, n - 1) * ZC.BLOCK + ZC.ROAD / 2;
    const y0 = Phaser.Math.Between(0, n - 1) * ZC.BLOCK + ZC.ROAD / 2;
    const size = ZC.BLOCK - ZC.ROAD;
    const along = Phaser.Math.Between(10, size - 10);
    const m = ZC.SIDEWALK / 2;
    switch (Phaser.Math.Between(0, 3)) {
      case 0: return { x: x0 + along, y: y0 + m };
      case 1: return { x: x0 + along, y: y0 + size - m };
      case 2: return { x: x0 + m, y: y0 + along };
      default: return { x: x0 + size - m, y: y0 + along };
    }
  }

  // ------------------------------------------------------------------ Entités
  spawnCar(x, y, rot, tint) {
    const car = this.cars.create(x, y, 'zc-car');
    car.setTint(tint).setRotation(rot).setDepth(5);
    // Les corps Arcade ne tournent pas : un carré centré est un bon compromis
    car.body.setSize(30, 30);
    car.body.setDrag(500, 500);
    car.body.setCollideWorldBounds(true);
    car.speed = 0;
    car.traffic = null;
    return car;
  }

  spawnTraffic() {
    const p = this.lanePoint();
    const car = this.spawnCar(p.x, p.y, p.rot, Phaser.Utils.Array.GetRandom(ZC.CAR_COLORS));
    car.body.setCollideWorldBounds(false);
    car.traffic = { ...p, speed: 140 };
  }

  spawnPed() {
    const p = this.sidewalkPoint();
    const ped = this.peds.create(p.x, p.y, 'zc-person');
    ped.setTint(Phaser.Utils.Array.GetRandom(ZC.PED_COLORS)).setDepth(4);
    ped.body.setCircle(6, 5, 5);
    ped.setCollideWorldBounds(true);
    ped.nextTurn = 0;
  }

  spawnPolice() {
    const t = this.activeTarget();
    for (let i = 0; i < 40; i++) {
      const p = this.lanePoint();
      const d = Phaser.Math.Distance.Between(p.x, p.y, t.x, t.y);
      if (d < 550 || d > 950) continue;
      const cop = this.police.create(p.x, p.y, 'zc-police1');
      cop.setRotation(p.rot).setDepth(5);
      cop.body.setSize(30, 30);
      cop.body.setCollideWorldBounds(true);
      cop.speed = 0;
      cop.stuck = 0;
      cop.reverse = 0;
      cop.last = { x: p.x, y: p.y };
      return;
    }
  }

  createPickups() {
    this.pickups = [];
    for (let i = 0; i < 14; i++) {
      const p = Math.random() < 0.5 ? this.lanePoint() : this.sidewalkPoint();
      const bill = this.add.image(p.x, p.y, 'zc-money').setDepth(3);
      this.tweens.add({ targets: bill, angle: 360, duration: 3000, repeat: -1 });
      this.pickups.push(bill);
    }
  }

  setupColliders() {
    const phys = this.physics.add;
    phys.collider(this.player, this.buildings);
    phys.collider(this.peds, this.buildings);
    phys.collider(this.police, this.buildings);
    phys.collider(this.police, this.police);
    phys.collider(this.cars, this.player);
    phys.collider(this.cars, this.buildings, (car) => {
      if (car !== this.vehicle) return;
      if (Math.abs(car.speed) > 230) this.damage(6);
      car.speed *= -0.3;
    });
    phys.collider(this.cars, this.cars, (a, b) => {
      if (a === this.vehicle || b === this.vehicle) this.vehicle.speed *= 0.7;
    });
    phys.collider(this.police, this.player, () => this.policeHit(false));
    phys.collider(this.police, this.cars, (cop, car) => { if (car === this.vehicle) this.policeHit(true); });
    phys.overlap(this.peds, this.cars, this.hitPed, null, this);
  }

  // ------------------------------------------------------------------ Interface
  createHud() {
    const hud = [];
    const fix = (o) => { o.setScrollFactor(0).setDepth(100); hud.push(o); return o; };
    const base = { fontFamily: ZG.FONT, stroke: '#000000', strokeThickness: 4 };
    const box = { fontFamily: ZG.FONT, fontSize: '16px', color: '#ffffff', backgroundColor: 'rgba(0,0,0,0.6)', padding: { x: 10, y: 6 } };

    this.moneyText = fix(this.add.text(16, 10, '$ 0', { ...base, fontSize: '30px', fontStyle: 'bold', color: '#7cf29c' }));
    this.starsText = fix(this.add.text(16, 48, '', { ...base, fontSize: '26px', color: '#ffd166' }));
    this.healthBar = fix(this.add.graphics());
    this.missionText = fix(this.add.text(16, this.H - 14, '', { ...box, fontSize: '18px' }).setOrigin(0, 1));
    this.hintText = fix(this.add.text(this.W - 14, this.H - 14, '', box).setOrigin(1, 1));
    this.messageText = fix(this.add.text(this.W / 2, 130, '', { ...base, fontSize: '28px', fontStyle: 'bold', strokeThickness: 6 })
      .setOrigin(0.5).setAlpha(0));
    fix(this.add.rectangle(this.W - 87, 87, 156, 156).setStrokeStyle(3, 0xffffff, 0.7));

    // Flèche qui indique l'objectif
    this.arrow = this.add.graphics().setDepth(20);

    // Mini-carte : une seconde caméra qui voit toute la ville
    this.minimap = this.cameras.add(this.W - 162, 12, 150, 150).setZoom(150 / ZC.WORLD).setBackgroundColor(0x111111);
    this.minimap.centerOn(ZC.WORLD / 2, ZC.WORLD / 2);
    this.minimap.ignore([...hud, this.arrow]);

    this.playerBlip = this.add.circle(0, 0, 60, 0x4cc9f0).setDepth(50);
    this.targetBlip = this.add.circle(0, 0, 75, 0xffd166).setDepth(49);
    this.cameras.main.ignore([this.playerBlip, this.targetBlip]);

    this.updateStars();
  }

  showMessage(text, color = '#ffffff') {
    this.tweens.killTweensOf(this.messageText);
    this.messageText.setText(text).setColor(color).setAlpha(1);
    this.tweens.add({ targets: this.messageText, alpha: 0, delay: 1800, duration: 500 });
  }

  updateStars() {
    this.starsText.setText('★'.repeat(this.wanted) + '☆'.repeat(5 - this.wanted));
  }

  addMoney(n) {
    this.money += n;
    this.moneyText.setText(`$ ${this.money}`);
    ZG.setScore(`${this.money} $`);
  }

  // ------------------------------------------------------------------ Missions
  newMission() {
    const p = this.lanePoint();
    this.mission = { stage: 'pickup', x: p.x, y: p.y, time: 0 };
    this.placeMarker(0xffd166);
  }

  placeMarker(color) {
    if (!this.marker) {
      this.marker = this.add.image(0, 0, 'zc-marker').setDepth(2);
      this.tweens.add({ targets: this.marker, scale: 1.25, duration: 500, yoyo: true, repeat: -1 });
    }
    this.marker.setPosition(this.mission.x, this.mission.y).setTint(color);
    this.targetBlip.setPosition(this.mission.x, this.mission.y).setFillStyle(color);
  }

  updateMission(dt) {
    const t = this.activeTarget();
    const m = this.mission;
    const dist = Phaser.Math.Distance.Between(t.x, t.y, m.x, m.y);

    if (dist < 45) {
      if (m.stage === 'pickup') {
        let p;
        let d;
        do {
          p = this.lanePoint();
          d = Phaser.Math.Distance.Between(m.x, m.y, p.x, p.y);
        } while (d < 900 || d > 1700);
        this.mission = { stage: 'deliver', x: p.x, y: p.y, time: Math.round(d / 170) + 20 };
        this.placeMarker(0x7cf29c);
        this.showMessage('Colis récupéré ! Livrez-le vite', '#7cf29c');
      } else {
        const reward = 150 + Math.round(m.time) * 5;
        this.addMoney(reward);
        this.showMessage(`Livraison réussie : +${reward} $`, '#7cf29c');
        this.newMission();
      }
      return;
    }

    if (m.stage === 'deliver') {
      m.time -= dt;
      if (m.time <= 0) {
        this.showMessage('Trop tard, livraison ratée…', '#ff5d73');
        this.newMission();
        return;
      }
      this.missionText.setText(`📦 Livrez le colis (point vert) — ${Math.ceil(m.time)} s`);
    } else {
      this.missionText.setText('📍 Allez chercher le colis (point jaune)');
    }

    // Flèche autour du joueur vers l'objectif
    const a = Phaser.Math.Angle.Between(t.x, t.y, m.x, m.y);
    const cx = t.x + Math.cos(a) * 50;
    const cy = t.y + Math.sin(a) * 50;
    const px = -Math.sin(a);
    const py = Math.cos(a);
    this.arrow.clear();
    this.arrow.fillStyle(m.stage === 'pickup' ? 0xffd166 : 0x7cf29c, 0.9);
    this.arrow.fillTriangle(
      cx + Math.cos(a) * 12, cy + Math.sin(a) * 12,
      cx - Math.cos(a) * 8 + px * 9, cy - Math.sin(a) * 8 + py * 9,
      cx - Math.cos(a) * 8 - px * 9, cy - Math.sin(a) * 8 - py * 9,
    );
  }

  updatePickups() {
    const t = this.activeTarget();
    this.pickups.forEach((bill) => {
      if (!bill.visible) return;
      if (Phaser.Math.Distance.Between(t.x, t.y, bill.x, bill.y) > 30) return;
      bill.setVisible(false);
      this.addMoney(25);
      this.time.delayedCall(10000, () => {
        const p = Math.random() < 0.5 ? this.lanePoint() : this.sidewalkPoint();
        bill.setPosition(p.x, p.y).setVisible(true);
      });
    });
  }

  // ------------------------------------------------------------------ Joueur
  activeTarget() {
    return this.vehicle || this.player;
  }

  input4() {
    const k = this.keys;
    return {
      up: k.UP.isDown || k.W.isDown || k.Z.isDown,
      down: k.DOWN.isDown || k.S.isDown,
      left: k.LEFT.isDown || k.A.isDown || k.Q.isDown,
      right: k.RIGHT.isDown || k.D.isDown,
    };
  }

  nearestCar() {
    let best = null;
    let bestDist = 60;
    this.cars.getChildren().forEach((car) => {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, car.x, car.y);
      if (d < bestDist) { best = car; bestDist = d; }
    });
    return best;
  }

  toggleVehicle() {
    if (this.vehicle) {
      this.exitVehicle();
      return;
    }
    const car = this.nearestCar();
    if (!car) return;
    if (car.traffic) {
      car.traffic = null;
      this.addCrime(1);
      this.showMessage('Voiture volée !', '#ff9f43');
    }
    this.vehicle = car;
    car.speed = 0;
    car.body.setCollideWorldBounds(true);
    this.player.body.stop();
    this.player.body.enable = false;
    this.player.setVisible(false);
    this.cameras.main.startFollow(car, true, 0.12, 0.12);
  }

  exitVehicle() {
    const car = this.vehicle;
    // On cherche un côté libre (pas dans un mur) pour faire descendre le joueur
    for (const offset of [Math.PI / 2, -Math.PI / 2, Math.PI]) {
      const a = car.rotation + offset;
      const x = car.x + Math.cos(a) * 34;
      const y = car.y + Math.sin(a) * 34;
      if (this.physics.overlapRect(x - 9, y - 9, 18, 18, false, true).length) continue;
      this.vehicle = null;
      car.speed = 0;
      this.player.body.enable = true;
      this.player.body.reset(x, y);
      this.player.setVisible(true);
      this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
      return;
    }
    this.showMessage('Impossible de sortir ici', '#ff5d73');
  }

  walk() {
    const d = this.input4();
    const v = new Phaser.Math.Vector2(d.right - d.left, d.down - d.up);
    if (v.lengthSq()) {
      v.normalize().scale(170);
      this.player.rotation = v.angle();
    }
    this.player.body.setVelocity(v.x, v.y);
  }

  drive(dt) {
    const car = this.vehicle;
    const d = this.input4();
    const MAX = 380;
    const REVERSE = -150;

    if (d.up) car.speed += 420 * dt;
    else if (d.down) car.speed -= (car.speed > 0 ? 650 : 280) * dt;
    else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 180 * dt);
    if (this.keys.SPACE.isDown) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 900 * dt);
    car.speed = Phaser.Math.Clamp(car.speed, REVERSE, MAX);

    // On ne peut tourner que si la voiture avance (et le volant s'inverse en marche arrière)
    const steer = d.right - d.left;
    const grip = Math.min(1, Math.abs(car.speed) / 120);
    const handbrake = this.keys.SPACE.isDown ? 1.6 : 1;
    car.rotation += steer * 2.7 * handbrake * grip * Math.sign(car.speed) * dt;
    car.body.setVelocity(Math.cos(car.rotation) * car.speed, Math.sin(car.rotation) * car.speed);
  }

  // ------------------------------------------------------------------ Crimes & police
  hitPed(ped, car) {
    if (car !== this.vehicle || Math.abs(car.speed) < 70) return;
    const splat = this.add.circle(ped.x, ped.y, 11, 0x8b0000, 0.8).setDepth(1);
    this.tweens.add({ targets: splat, alpha: 0, delay: 6000, duration: 2000, onComplete: () => splat.destroy() });
    ped.destroy();
    this.addCrime(1);
    this.time.delayedCall(5000, () => this.spawnPed());
  }

  addCrime(n) {
    this.wanted = Math.min(5, this.wanted + n);
    this.lastCrime = this.time.now;
    this.updateStars();
    this.tweens.add({ targets: this.starsText, scale: 1.3, duration: 120, yoyo: true });
  }

  policeHit(inCar) {
    const now = this.time.now;
    if (now - this.lastHit < 400) return;
    this.lastHit = now;
    this.damage(inCar ? 5 : 12);
  }

  damage(n) {
    this.health = Math.max(0, this.health - n);
    this.cameras.main.shake(120, 0.006);
    if (this.health <= 0) this.busted();
  }

  updateWanted(time) {
    // Les étoiles redescendent si l'on ne commet pas de nouveau crime pendant un moment
    if (this.wanted > 0 && time - this.lastCrime > 16000) {
      this.wanted--;
      this.lastCrime = time;
      this.updateStars();
      this.showMessage(this.wanted ? 'La police perd votre trace…' : 'Vous avez semé la police !', '#4cc9f0');
    }

    const cops = this.police.getChildren();
    if (cops.length < this.wanted && time > this.nextPoliceSpawn) {
      this.spawnPolice();
      this.nextPoliceSpawn = time + 1500;
    }
    if (cops.length > this.wanted) {
      const t = this.activeTarget();
      const farthest = cops.reduce((a, b) => (
        Phaser.Math.Distance.Between(a.x, a.y, t.x, t.y) > Phaser.Math.Distance.Between(b.x, b.y, t.x, t.y) ? a : b));
      farthest.destroy();
    }

    if (this.wanted === 0 && this.health < 100) this.health = Math.min(100, this.health + 0.05);
  }

  updatePolice(dt) {
    const t = this.activeTarget();
    const max = 230 + this.wanted * 25;
    this.police.getChildren().forEach((cop) => {
      const moved = Phaser.Math.Distance.Between(cop.x, cop.y, cop.last.x, cop.last.y) / dt;
      cop.last.x = cop.x;
      cop.last.y = cop.y;

      if (cop.reverse > 0) {
        // Coincé contre un mur : marche arrière en braquant
        cop.reverse -= dt;
        cop.speed = -130;
        cop.rotation += 1.6 * dt;
      } else {
        const desired = Phaser.Math.Angle.Between(cop.x, cop.y, t.x, t.y);
        cop.rotation = Phaser.Math.Angle.RotateTo(cop.rotation, desired, 2.8 * dt);
        const close = Phaser.Math.Distance.Between(cop.x, cop.y, t.x, t.y) < 70 && !this.vehicle;
        cop.speed = Math.min(cop.speed + 300 * dt, close ? 70 : max);
        if (cop.speed > 80 && moved < 25) cop.stuck += dt;
        else cop.stuck = 0;
        if (cop.stuck > 0.6) {
          cop.reverse = 0.7;
          cop.stuck = 0;
        }
      }
      cop.body.setVelocity(Math.cos(cop.rotation) * cop.speed, Math.sin(cop.rotation) * cop.speed);
    });
  }

  // ------------------------------------------------------------------ PNJ
  updateTraffic() {
    this.cars.getChildren().forEach((car) => {
      const t = car.traffic;
      if (!t) return;
      car.rotation = t.rot;
      car.body.setVelocity(t.dx * t.speed, t.dy * t.speed);
      // Revient doucement sur sa voie après un choc
      if (t.laneY !== null) car.body.velocity.y += (t.laneY - car.y) * 2;
      else car.body.velocity.x += (t.laneX - car.x) * 2;
      // La ville « boucle » : une voiture qui sort réapparaît de l'autre côté
      if (car.x > ZC.WORLD + 60) car.x = -60;
      else if (car.x < -60) car.x = ZC.WORLD + 60;
      if (car.y > ZC.WORLD + 60) car.y = -60;
      else if (car.y < -60) car.y = ZC.WORLD + 60;
    });
  }

  updatePeds(time) {
    const v = this.vehicle;
    this.peds.getChildren().forEach((ped) => {
      // Les piétons fuient une voiture qui fonce vers eux
      if (v && Math.abs(v.speed) > 120 && Phaser.Math.Distance.Between(ped.x, ped.y, v.x, v.y) < 110) {
        const a = Phaser.Math.Angle.Between(v.x, v.y, ped.x, ped.y);
        ped.body.setVelocity(Math.cos(a) * 130, Math.sin(a) * 130);
        ped.rotation = a;
        ped.nextTurn = time + 800;
        return;
      }
      if (time < ped.nextTurn) return;
      ped.nextTurn = time + Phaser.Math.Between(1500, 4000);
      if (Math.random() < 0.25) {
        ped.body.setVelocity(0, 0);
        return;
      }
      const a = Phaser.Math.Between(0, 3) * (Math.PI / 2);
      const speed = Phaser.Math.Between(35, 55);
      ped.body.setVelocity(Math.cos(a) * speed, Math.sin(a) * speed);
      ped.rotation = a;
    });
  }

  // ------------------------------------------------------------------ Boucle
  update(time, delta) {
    if (this.over) return;
    const dt = Math.min(delta / 1000, 0.05);

    if (Phaser.Input.Keyboard.JustDown(this.keys.E)) this.toggleVehicle();
    if (this.vehicle) this.drive(dt);
    else this.walk();

    this.updateTraffic();
    this.updatePeds(time);
    this.updatePolice(dt);
    this.updateWanted(time);
    this.updatePickups();
    this.updateMission(dt);
    if (this.over) return;

    const t = this.activeTarget();
    this.playerBlip.setPosition(t.x, t.y);

    this.healthBar.clear();
    this.healthBar.fillStyle(0x000000, 0.6).fillRect(16, 84, 164, 14);
    this.healthBar.fillStyle(this.health > 30 ? 0x7cf29c : 0xff5d73).fillRect(18, 86, 160 * this.health / 100, 10);

    if (this.vehicle) this.hintText.setText(`E : descendre · Espace : frein à main · ${Math.round(Math.abs(this.vehicle.speed) / 3)} km/h`);
    else if (this.nearestCar()) this.hintText.setText('E : monter dans la voiture');
    else this.hintText.setText('ZQSD / flèches : se déplacer');
  }

  busted() {
    if (this.over) return;
    this.over = true;
    this.physics.pause();
    const record = this.money > 0 && ZG.submit(this.money);
    ZG.overlay(this, 'ARRÊTÉ !',
      `Vous avez amassé ${this.money} $${record ? '\n🏆 Nouveau record !' : ''}`,
      { color: '#4cc9f0', delay: 500 });
  }
}

ZG.register({ id: 'z-city', width: 800, height: 600, scene: ZCityScene });
