/* 2048 — réflexion */

const TILE_STYLES = {
  2: [0xeee4da, '#5b5148'],
  4: [0xede0c8, '#5b5148'],
  8: [0xf2b179, '#ffffff'],
  16: [0xf59563, '#ffffff'],
  32: [0xf67c5f, '#ffffff'],
  64: [0xf65e3b, '#ffffff'],
  128: [0xedcf72, '#ffffff'],
  256: [0xedcc61, '#ffffff'],
  512: [0xedc850, '#ffffff'],
  1024: [0xedc53f, '#ffffff'],
  2048: [0xedc22e, '#ffffff'],
};

class Game2048Scene extends Phaser.Scene {
  constructor() {
    super('2048');
  }

  create() {
    this.N = 4;
    this.pad = 14;
    this.cell = (this.scale.width - this.pad * (this.N + 1)) / this.N;
    this.grid = Array.from({ length: this.N }, () => Array(this.N).fill(0));
    this.score = 0;
    this.over = false;
    this.won = false;
    this.startBest = ZG.getBest();
    this.tiles = [];

    const bg = this.add.graphics();
    bg.fillStyle(0x2a2d55);
    bg.fillRect(0, 0, this.scale.width, this.scale.height);
    bg.fillStyle(0x3a3e70);
    for (let r = 0; r < this.N; r++) {
      for (let c = 0; c < this.N; c++) {
        const { x, y } = this.cellCenter(r, c);
        bg.fillRoundedRect(x - this.cell / 2, y - this.cell / 2, this.cell, this.cell, 10);
      }
    }

    const a = this.addRandom();
    const b = this.addRandom();
    this.render(new Set([a, b]));

    this.input.keyboard.on('keydown', (e) => {
      const dir = ZG.keyToDir(e.code);
      if (dir) this.move(dir);
    });
    ZG.onSwipe(this, (dir) => this.move(dir));
    ZG.setScore(0);
  }

  cellCenter(r, c) {
    return {
      x: this.pad + c * (this.cell + this.pad) + this.cell / 2,
      y: this.pad + r * (this.cell + this.pad) + this.cell / 2,
    };
  }

  addRandom() {
    const empty = [];
    this.grid.forEach((row, r) => row.forEach((v, c) => { if (!v) empty.push([r, c]); }));
    if (!empty.length) return null;
    const [r, c] = Phaser.Utils.Array.GetRandom(empty);
    this.grid[r][c] = Math.random() < 0.9 ? 2 : 4;
    return `${r},${c}`;
  }

  // Coordonnées de la i-ème ligne, dans l'ordre vers lequel les tuiles glissent
  lineCoords(dir, i) {
    const coords = [];
    for (let j = 0; j < this.N; j++) {
      const k = this.N - 1 - j;
      if (dir === 'left') coords.push([i, j]);
      else if (dir === 'right') coords.push([i, k]);
      else if (dir === 'up') coords.push([j, i]);
      else coords.push([k, i]);
    }
    return coords;
  }

  move(dir) {
    if (this.over) return;
    let moved = false;
    let gained = 0;
    const merged = new Set();

    for (let i = 0; i < this.N; i++) {
      const coords = this.lineCoords(dir, i);
      const values = coords.map(([r, c]) => this.grid[r][c]).filter(Boolean);
      const out = [];
      for (let k = 0; k < values.length; k++) {
        if (values[k] === values[k + 1]) {
          out.push(values[k] * 2);
          gained += values[k] * 2;
          const [r, c] = coords[out.length - 1];
          merged.add(`${r},${c}`);
          k++;
        } else {
          out.push(values[k]);
        }
      }
      while (out.length < this.N) out.push(0);
      coords.forEach(([r, c], k) => {
        if (this.grid[r][c] !== out[k]) moved = true;
        this.grid[r][c] = out[k];
      });
    }

    if (!moved) return;

    this.score += gained;
    ZG.setScore(this.score);
    ZG.submit(this.score);
    const added = this.addRandom();
    this.render(new Set([added]), merged);

    if (!this.won && this.grid.some((row) => row.includes(2048))) {
      this.won = true;
      this.showBanner('2048 atteint ! Continuez…');
    }
    if (!this.canMove()) this.gameOver();
  }

  canMove() {
    for (let r = 0; r < this.N; r++) {
      for (let c = 0; c < this.N; c++) {
        const v = this.grid[r][c];
        if (!v) return true;
        if (c < this.N - 1 && v === this.grid[r][c + 1]) return true;
        if (r < this.N - 1 && v === this.grid[r + 1][c]) return true;
      }
    }
    return false;
  }

  render(added = new Set(), merged = new Set()) {
    this.tiles.forEach((t) => t.destroy());
    this.tiles = [];
    for (let r = 0; r < this.N; r++) {
      for (let c = 0; c < this.N; c++) {
        const v = this.grid[r][c];
        if (!v) continue;
        const { x, y } = this.cellCenter(r, c);
        const [fill, color] = TILE_STYLES[v] || [0x3c3a32, '#ffffff'];
        const tile = this.add.container(x, y);
        const g = this.add.graphics();
        g.fillStyle(fill);
        g.fillRoundedRect(-this.cell / 2, -this.cell / 2, this.cell, this.cell, 10);
        const size = v < 100 ? 48 : v < 1000 ? 40 : v < 10000 ? 32 : 26;
        const label = this.add.text(0, 0, String(v), {
          fontFamily: ZG.FONT, fontSize: `${size}px`, fontStyle: 'bold', color,
        }).setOrigin(0.5);
        tile.add([g, label]);
        this.tiles.push(tile);

        const key = `${r},${c}`;
        if (added.has(key)) {
          tile.setScale(0);
          this.tweens.add({ targets: tile, scale: 1, duration: 140, ease: 'Back.Out' });
        } else if (merged.has(key)) {
          this.tweens.add({ targets: tile, scale: 1.12, duration: 80, yoyo: true });
        }
      }
    }
  }

  showBanner(text) {
    const banner = this.add.text(this.scale.width / 2, this.scale.height / 2, text, {
      fontFamily: ZG.FONT, fontSize: '28px', fontStyle: 'bold', color: '#ffffff',
      backgroundColor: '#edc22e', padding: { x: 18, y: 10 },
    }).setOrigin(0.5).setDepth(500);
    this.tweens.add({ targets: banner, alpha: 0, delay: 1500, duration: 500, onComplete: () => banner.destroy() });
  }

  gameOver() {
    this.over = true;
    const record = this.score > 0 && (this.startBest === null || this.score > this.startBest);
    ZG.overlay(this, 'Plus de coups !',
      `Score : ${this.score} points${record ? '\n🏆 Nouveau record !' : ''}`,
      { color: '#f2b179', delay: 400 });
  }
}

ZG.register({ id: '2048', width: 480, height: 480, scene: Game2048Scene });
