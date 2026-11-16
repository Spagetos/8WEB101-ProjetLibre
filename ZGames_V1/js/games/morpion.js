/* Morpion — stratégie, IA basée sur minimax */

const MORPION_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

// random = probabilité que l'IA joue un coup au hasard au lieu du meilleur coup
const MORPION_LEVELS = [
  { key: 'facile', label: 'Facile', random: 0.7 },
  { key: 'moyen', label: 'Moyen', random: 0.3 },
  { key: 'imbattable', label: 'Imbattable', random: 0 },
];

function morpionWinner(board) {
  for (const line of MORPION_LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return { player: board[a], line };
  }
  return null;
}

// Score du point de vue de l'IA (O) : on préfère gagner vite et perdre tard
function morpionMinimax(board, player, depth) {
  const win = morpionWinner(board);
  if (win) return win.player === 'O' ? 10 - depth : depth - 10;
  if (board.every(Boolean)) return 0;

  let best = player === 'O' ? -Infinity : Infinity;
  for (let i = 0; i < 9; i++) {
    if (board[i]) continue;
    board[i] = player;
    const score = morpionMinimax(board, player === 'O' ? 'X' : 'O', depth + 1);
    board[i] = null;
    best = player === 'O' ? Math.max(best, score) : Math.min(best, score);
  }
  return best;
}

class MorpionScene extends Phaser.Scene {
  constructor() {
    super('morpion');
  }

  create() {
    this.board = Array(9).fill(null);
    this.over = false;
    this.size = 140;
    this.x0 = 30;
    this.y0 = 90;
    this.levelIndex = Math.max(0, MORPION_LEVELS.findIndex((l) => l.key === ZG.load('morpion:level', 'moyen')));

    // La session survit au redémarrage de la scène grâce au registre global du jeu
    this.session = this.registry.get('morpion-session') || { w: 0, d: 0, l: 0, round: 0 };
    this.registry.set('morpion-session', this.session);
    this.updateSession();

    this.drawGrid();
    for (let i = 0; i < 9; i++) {
      const { x, y } = this.center(i);
      const zone = this.add.rectangle(x, y, this.size - 8, this.size - 8, 0xffffff, 0)
        .setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => { if (!this.board[i] && !this.over) zone.setFillStyle(0xffffff, 0.05); });
      zone.on('pointerout', () => zone.setFillStyle(0xffffff, 0));
      zone.on('pointerdown', () => { zone.setFillStyle(0xffffff, 0); this.playerMove(i); });
    }

    this.status = this.add.text(this.scale.width / 2, 42, '', {
      fontFamily: ZG.FONT, fontSize: '24px', fontStyle: 'bold', color: '#eceeff',
    }).setOrigin(0.5);
    this.levelBtn = ZG.textButton(this, this.scale.width / 2, this.scale.height - 35, '', () => this.cycleLevel());
    this.updateLevelLabel();

    // Le premier joueur alterne à chaque manche
    const aiStarts = this.session.round % 2 === 1;
    this.session.round++;
    if (aiStarts) {
      this.turn = 'O';
      this.status.setText("L'IA commence…");
      this.time.delayedCall(500, () => this.aiMove());
    } else {
      this.turn = 'X';
      this.status.setText('À vous de jouer (X)');
    }
  }

  center(i) {
    return {
      x: this.x0 + (i % 3) * this.size + this.size / 2,
      y: this.y0 + Math.floor(i / 3) * this.size + this.size / 2,
    };
  }

  drawGrid() {
    const g = this.add.graphics();
    g.lineStyle(6, 0x3a3f78);
    const len = this.size * 3;
    for (let k = 1; k < 3; k++) {
      g.lineBetween(this.x0 + k * this.size, this.y0 + 10, this.x0 + k * this.size, this.y0 + len - 10);
      g.lineBetween(this.x0 + 10, this.y0 + k * this.size, this.x0 + len - 10, this.y0 + k * this.size);
    }
  }

  cycleLevel() {
    this.levelIndex = (this.levelIndex + 1) % MORPION_LEVELS.length;
    ZG.save('morpion:level', MORPION_LEVELS[this.levelIndex].key);
    this.updateLevelLabel();
  }

  updateLevelLabel() {
    this.levelBtn.setText(`Niveau : ${MORPION_LEVELS[this.levelIndex].label}  ▸`);
  }

  updateSession() {
    const s = this.session;
    ZG.setScore(`${s.w} - ${s.d} - ${s.l}`);
  }

  playerMove(i) {
    if (this.over || this.turn !== 'X' || this.board[i]) return;
    this.place(i, 'X');
    if (this.checkEnd()) return;
    this.turn = 'O';
    this.status.setText("L'IA réfléchit…");
    this.time.delayedCall(450, () => this.aiMove());
  }

  aiMove() {
    if (this.over) return;
    const empty = this.board.map((v, i) => (v ? null : i)).filter((i) => i !== null);
    let choice;
    if (Math.random() < MORPION_LEVELS[this.levelIndex].random) {
      choice = Phaser.Utils.Array.GetRandom(empty);
    } else {
      let best = -Infinity;
      let candidates = [];
      for (const i of empty) {
        this.board[i] = 'O';
        const score = morpionMinimax(this.board, 'X', 1);
        this.board[i] = null;
        if (score > best) { best = score; candidates = [i]; } else if (score === best) candidates.push(i);
      }
      choice = Phaser.Utils.Array.GetRandom(candidates);
    }
    this.place(choice, 'O');
    if (this.checkEnd()) return;
    this.turn = 'X';
    this.status.setText('À vous de jouer (X)');
  }

  place(i, player) {
    this.board[i] = player;
    const { x, y } = this.center(i);
    const g = this.add.graphics({ x, y });
    if (player === 'X') {
      g.lineStyle(14, 0x4cc9f0);
      g.lineBetween(-36, -36, 36, 36);
      g.lineBetween(36, -36, -36, 36);
    } else {
      g.lineStyle(14, 0xff5d73);
      g.strokeCircle(0, 0, 40);
    }
    g.setScale(0.3);
    this.tweens.add({ targets: g, scale: 1, duration: 180, ease: 'Back.Out' });
  }

  checkEnd() {
    const win = morpionWinner(this.board);
    const full = this.board.every(Boolean);
    if (!win && !full) return false;

    this.over = true;
    if (win) {
      const a = this.center(win.line[0]);
      const b = this.center(win.line[2]);
      const g = this.add.graphics();
      g.lineStyle(10, 0xffffff, 0.85);
      g.lineBetween(a.x, a.y, b.x, b.y);
    }

    if (win && win.player === 'X') {
      this.session.w++;
      ZG.addWin();
      this.status.setText('Victoire !');
      ZG.overlay(this, 'Victoire !', 'Vous avez battu l\'IA 🎉', { color: '#7cf29c', delay: 700 });
    } else if (win) {
      this.session.l++;
      this.status.setText("L'IA gagne");
      ZG.overlay(this, 'Défaite', "L'IA remporte cette manche.", { color: '#ff5d73', delay: 700 });
    } else {
      this.session.d++;
      this.status.setText('Match nul');
      ZG.overlay(this, 'Match nul', 'Personne ne gagne cette fois.', { color: '#ffd166', delay: 700 });
    }
    this.updateSession();
    return true;
  }
}

ZG.register({ id: 'morpion', width: 480, height: 580, scene: MorpionScene });
