/* Snake — arcade */

class SnakeScene extends Phaser.Scene {
  constructor() {
    super('snake');
  }

  create() {
    this.cell = 25;
    this.cols = this.scale.width / this.cell;
    this.rows = this.scale.height / this.cell;
    this.snake = [{ x: 8, y: 12 }, { x: 7, y: 12 }, { x: 6, y: 12 }];
    this.dir = ZG.DIRS.right;
    this.queue = [];
    this.score = 0;
    this.delay = 130;
    this.started = false;
    this.alive = true;

    this.drawBoard();
    this.food = this.add.circle(0, 0, this.cell * 0.36, 0xff5d73);
    this.tweens.add({ targets: this.food, scale: 1.2, duration: 400, yoyo: true, repeat: -1 });
    this.placeFood();
    this.g = this.add.graphics();

    this.hint = this.add.text(this.scale.width / 2, this.scale.height / 2 + 90,
      'Appuyez sur une flèche pour commencer', {
        fontFamily: ZG.FONT, fontSize: '22px', color: '#eceeff',
      }).setOrigin(0.5);

    this.input.keyboard.on('keydown', (e) => this.turn(ZG.keyToDir(e.code)));
    ZG.onSwipe(this, (dir) => this.turn(dir));

    this.timer = this.time.addEvent({ delay: this.delay, loop: true, callback: this.step, callbackScope: this });
    ZG.setScore(0);
    this.render();
  }

  drawBoard() {
    const bg = this.add.graphics();
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        bg.fillStyle((x + y) % 2 ? 0x181a33 : 0x1c1f3c);
        bg.fillRect(x * this.cell, y * this.cell, this.cell, this.cell);
      }
    }
  }

  turn(name) {
    const d = ZG.DIRS[name];
    if (!d || !this.alive) return;
    // N'importe quelle direction lance la partie, même celle déjà en cours ou son opposée
    if (!this.started) {
      this.started = true;
      this.hint.destroy();
    }
    const last = this.queue.length ? this.queue[this.queue.length - 1] : this.dir;
    if (d === last || (d.x === -last.x && d.y === -last.y)) return;
    if (this.queue.length < 3) this.queue.push(d);
  }

  placeFood() {
    let f;
    do {
      f = { x: Phaser.Math.Between(0, this.cols - 1), y: Phaser.Math.Between(0, this.rows - 1) };
    } while (this.snake.some((s) => s.x === f.x && s.y === f.y));
    this.foodPos = f;
    this.food.setPosition((f.x + 0.5) * this.cell, (f.y + 0.5) * this.cell);
  }

  step() {
    if (!this.started || !this.alive) return;
    if (this.queue.length) this.dir = this.queue.shift();

    const head = { x: this.snake[0].x + this.dir.x, y: this.snake[0].y + this.dir.y };
    const eats = head.x === this.foodPos.x && head.y === this.foodPos.y;
    // La queue se déplace en même temps que la tête, sauf si le serpent grandit
    const body = eats ? this.snake : this.snake.slice(0, -1);
    const outside = head.x < 0 || head.y < 0 || head.x >= this.cols || head.y >= this.rows;
    if (outside || body.some((s) => s.x === head.x && s.y === head.y)) {
      this.gameOver();
      return;
    }

    this.snake.unshift(head);
    if (eats) {
      this.score += 10;
      ZG.setScore(this.score);
      this.placeFood();
      this.delay = Math.max(55, this.delay - 3);
      this.timer.delay = this.delay;
    } else {
      this.snake.pop();
    }
    this.render();
  }

  render() {
    const c = this.cell;
    const g = this.g;
    const from = Phaser.Display.Color.ValueToColor(0x6ef0a0);
    const to = Phaser.Display.Color.ValueToColor(0x139a52);
    g.clear();
    this.snake.forEach((s, i) => {
      const col = Phaser.Display.Color.Interpolate.ColorWithColor(from, to, this.snake.length, i);
      g.fillStyle(Phaser.Display.Color.GetColor(col.r, col.g, col.b));
      g.fillRoundedRect(s.x * c + 2, s.y * c + 2, c - 4, c - 4, i === 0 ? 8 : 6);
    });

    // Yeux orientés dans la direction du mouvement
    const h = this.snake[0];
    const cx = (h.x + 0.5) * c;
    const cy = (h.y + 0.5) * c;
    const px = -this.dir.y;
    const py = this.dir.x;
    g.fillStyle(0x0b0c18);
    g.fillCircle(cx + this.dir.x * 5 + px * 5, cy + this.dir.y * 5 + py * 5, 3);
    g.fillCircle(cx + this.dir.x * 5 - px * 5, cy + this.dir.y * 5 - py * 5, 3);
  }

  gameOver() {
    this.alive = false;
    this.timer.remove();
    this.cameras.main.shake(250, 0.01);
    const record = this.score > 0 && ZG.submit(this.score);
    ZG.overlay(this, 'Game over',
      `Score : ${this.score} points${record ? '\n🏆 Nouveau record !' : ''}`,
      { color: '#ff5d73', delay: 300 });
  }
}

ZG.register({ id: 'snake', width: 800, height: 600, scene: SnakeScene });
