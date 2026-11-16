/* Casse-briques — arcade (moteur physique Arcade de Phaser) */

class BreakoutScene extends Phaser.Scene {
  constructor() {
    super('casse-briques');
  }

  create() {
    this.W = this.scale.width;
    this.H = this.scale.height;
    this.score = 0;
    this.lives = 3;
    this.level = 1;
    this.speed = 380;
    this.launched = false;
    this.over = false;
    this.startBest = ZG.getBest();

    // Pas de collision avec le bas : la balle peut tomber
    this.physics.world.setBoundsCollision(true, true, true, false);

    this.bricks = this.physics.add.staticGroup();
    this.buildBricks();

    this.paddle = this.add.rectangle(this.W / 2, this.H - 40, 120, 16, 0xe8e9ff);
    this.physics.add.existing(this.paddle);
    this.paddle.body.setImmovable(true);
    this.paddle.body.setAllowGravity(false);

    this.ball = this.add.circle(this.W / 2, this.H - 60, 9, 0xffd166);
    this.physics.add.existing(this.ball);
    this.ball.body.setCircle(9);
    this.ball.body.setCollideWorldBounds(true);
    this.ball.body.setBounce(1, 1);

    this.physics.add.collider(this.ball, this.paddle, this.hitPaddle, null, this);
    this.physics.add.collider(this.ball, this.bricks, this.hitBrick, null, this);

    const style = { fontFamily: ZG.FONT, fontSize: '20px', color: '#eceeff' };
    this.livesText = this.add.text(16, 14, '', style);
    this.levelText = this.add.text(this.W - 16, 14, '', style).setOrigin(1, 0);
    this.hint = this.add.text(this.W / 2, this.H / 2 + 60, 'Espace ou clic pour lancer la balle', {
      ...style, fontSize: '22px',
    }).setOrigin(0.5);

    this.cursors = this.input.keyboard.createCursorKeys();
    this.input.on('pointermove', (p) => { this.paddle.x = p.x; });
    this.input.on('pointerdown', (p) => { this.paddle.x = p.x; this.launch(); });
    this.input.keyboard.on('keydown-SPACE', () => this.launch());

    ZG.setScore(0);
    this.updateHud();
  }

  buildBricks() {
    const colors = [0xff5d73, 0xff9f43, 0xffd166, 0x7cf29c, 0x4cc9f0, 0x9d7cff];
    const cols = 10;
    const bw = 68;
    const bh = 24;
    const gap = 8;
    const x0 = (this.W - (cols * bw + (cols - 1) * gap)) / 2 + bw / 2;
    colors.forEach((color, r) => {
      for (let c = 0; c < cols; c++) {
        const brick = this.add.rectangle(x0 + c * (bw + gap), 80 + r * (bh + gap), bw, bh, color);
        this.bricks.add(brick);
      }
    });
  }

  updateHud() {
    this.livesText.setText('❤ '.repeat(this.lives).trim() || '—');
    this.levelText.setText(`Niveau ${this.level}`);
  }

  launch() {
    if (this.launched || this.over) return;
    this.launched = true;
    this.hint.setVisible(false);
    const angle = Phaser.Math.DegToRad(Phaser.Math.Between(-35, 35));
    this.ball.body.setVelocity(this.speed * Math.sin(angle), -this.speed * Math.cos(angle));
  }

  hitPaddle(ball, paddle) {
    // L'angle de rebond dépend de l'endroit où la balle touche la raquette
    const diff = Phaser.Math.Clamp((ball.x - paddle.x) / (paddle.width / 2), -1, 1);
    const angle = Phaser.Math.DegToRad(diff * 60);
    ball.body.setVelocity(this.speed * Math.sin(angle), -this.speed * Math.cos(angle));
  }

  hitBrick(ball, brick) {
    const fx = this.add.rectangle(brick.x, brick.y, brick.width, brick.height, brick.fillColor);
    this.tweens.add({ targets: fx, alpha: 0, scale: 1.4, duration: 200, onComplete: () => fx.destroy() });
    brick.destroy();

    this.score += 10 * this.level;
    ZG.setScore(this.score);
    ZG.submit(this.score);

    if (this.bricks.countActive() === 0) this.nextLevel();
  }

  nextLevel() {
    this.level++;
    this.speed += 40;
    this.launched = false;
    this.hint.setText(`Niveau ${this.level} ! Espace ou clic pour lancer`).setVisible(true);
    this.updateHud();
    this.time.delayedCall(300, () => this.buildBricks());
  }

  loseLife() {
    this.lives--;
    this.updateHud();
    this.cameras.main.flash(250, 120, 20, 40);
    if (this.lives <= 0) {
      this.gameOver();
      return;
    }
    this.launched = false;
    this.hint.setText('Espace ou clic pour relancer').setVisible(true);
  }

  gameOver() {
    this.over = true;
    this.ball.body.stop();
    this.ball.setVisible(false);
    const record = this.score > 0 && (this.startBest === null || this.score > this.startBest);
    ZG.overlay(this, 'Game over',
      `Score : ${this.score} points (niveau ${this.level})${record ? '\n🏆 Nouveau record !' : ''}`,
      { color: '#ff5d73' });
  }

  update() {
    if (this.over) return;

    if (this.cursors.left.isDown) this.paddle.x -= 10;
    else if (this.cursors.right.isDown) this.paddle.x += 10;
    this.paddle.x = Phaser.Math.Clamp(this.paddle.x, 60, this.W - 60);

    if (!this.launched) {
      this.ball.body.reset(this.paddle.x, this.paddle.y - 20);
      return;
    }

    // Évite que la balle reste coincée dans une trajectoire presque horizontale
    const v = this.ball.body.velocity;
    if (Math.abs(v.y) < 120) {
      v.y = v.y < 0 ? -120 : 120;
      v.setLength(this.speed);
    }

    if (this.ball.y > this.H + 30) this.loseLife();
  }
}

ZG.register({ id: 'casse-briques', width: 800, height: 600, scene: BreakoutScene });
