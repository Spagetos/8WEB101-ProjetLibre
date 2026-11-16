/* Memory — réflexion */

const MEMORY_SYMBOLS = ['🍒', '🍋', '🍇', '⭐', '🚀', '🎲', '👾', '🌙'];
const CARD_BACK = 0x3a3f8f;
const CARD_FACE = 0xf4f4ff;

class MemoryScene extends Phaser.Scene {
  constructor() {
    super('memory');
  }

  create() {
    this.moves = 0;
    this.found = 0;
    this.first = null;
    this.lock = false;
    this.startTime = null;

    const size = 120;
    const gap = 20;
    const offset = (this.scale.width - (4 * size + 3 * gap)) / 2 + size / 2;
    const deck = Phaser.Utils.Array.Shuffle([...MEMORY_SYMBOLS, ...MEMORY_SYMBOLS]);

    deck.forEach((symbol, i) => {
      const x = offset + (i % 4) * (size + gap);
      const y = offset + Math.floor(i / 4) * (size + gap);
      const back = this.add.rectangle(x, y, size, size, CARD_BACK)
        .setStrokeStyle(3, 0x6c72ff)
        .setInteractive({ useHandCursor: true });
      const mark = this.add.text(x, y, '?', {
        fontFamily: ZG.FONT, fontSize: '48px', fontStyle: 'bold', color: '#8f95ff',
      }).setOrigin(0.5);
      const face = this.add.text(x, y, symbol, { fontFamily: ZG.FONT, fontSize: '60px' })
        .setOrigin(0.5).setVisible(false);
      const card = { symbol, back, mark, face, open: false, done: false };
      back.on('pointerdown', () => this.flip(card));
      back.on('pointerover', () => { if (!card.open) back.setFillStyle(0x4a50a8); });
      back.on('pointerout', () => { if (!card.open) back.setFillStyle(CARD_BACK); });
    });

    ZG.setScore(0);
  }

  flip(card) {
    if (this.lock || card.open || card.done) return;
    if (this.startTime === null) this.startTime = this.time.now;
    this.reveal(card, true);

    if (!this.first) {
      this.first = card;
      return;
    }

    this.moves++;
    ZG.setScore(this.moves);
    const other = this.first;
    this.first = null;

    if (other.symbol === card.symbol) {
      other.done = card.done = true;
      this.found++;
      [other, card].forEach((c) => c.back.setStrokeStyle(4, 0x22c47a));
      if (this.found === MEMORY_SYMBOLS.length) this.win();
    } else {
      this.lock = true;
      this.time.delayedCall(750, () => {
        this.reveal(other, false);
        this.reveal(card, false);
        this.lock = false;
      });
    }
  }

  // Animation de retournement : on écrase la carte horizontalement puis on change de face
  reveal(card, open) {
    card.open = open;
    this.tweens.add({
      targets: [card.back, card.mark, card.face],
      scaleX: 0,
      duration: 110,
      yoyo: true,
      onYoyo: () => {
        card.mark.setVisible(!open);
        card.face.setVisible(open);
        card.back.setFillStyle(open ? CARD_FACE : CARD_BACK);
      },
    });
  }

  win() {
    const seconds = Math.round((this.time.now - this.startTime) / 1000);
    const record = ZG.submit(this.moves);
    ZG.overlay(this, 'Bravo !',
      `Toutes les paires en ${this.moves} coups et ${seconds} s${record ? '\n🏆 Nouveau record !' : ''}`,
      { color: '#7cf29c', delay: 500 });
  }
}

ZG.register({ id: 'memory', width: 600, height: 600, scene: MemoryScene });
