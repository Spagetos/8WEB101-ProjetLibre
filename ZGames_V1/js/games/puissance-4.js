/* Puissance 4 — stratégie, IA minimax avec élagage alpha-bêta */

const P4 = {
  ROWS: 6,
  COLS: 7,
  EMPTY: 0,
  HUMAN: 1,
  AI: 2,
  ORDER: [3, 2, 4, 1, 5, 0, 6], // on explore le centre d'abord : meilleur élagage
};

const P4_LEVELS = [
  { key: 'facile', label: 'Facile', depth: 1, random: 0.35 },
  { key: 'moyen', label: 'Moyen', depth: 3, random: 0.1 },
  { key: 'difficile', label: 'Difficile', depth: 5, random: 0 },
];

function p4FindWin(b, p) {
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (let r = 0; r < P4.ROWS; r++) {
    for (let c = 0; c < P4.COLS; c++) {
      if (b[r][c] !== p) continue;
      for (const [dr, dc] of dirs) {
        const cells = [[r, c]];
        for (let k = 1; k < 4; k++) {
          const rr = r + dr * k;
          const cc = c + dc * k;
          if (rr < 0 || rr >= P4.ROWS || cc < 0 || cc >= P4.COLS || b[rr][cc] !== p) break;
          cells.push([rr, cc]);
        }
        if (cells.length === 4) return cells;
      }
    }
  }
  return null;
}

function p4NextRow(b, c) {
  for (let r = P4.ROWS - 1; r >= 0; r--) if (b[r][c] === P4.EMPTY) return r;
  return -1;
}

function p4ValidCols(b) {
  return P4.ORDER.filter((c) => b[0][c] === P4.EMPTY);
}

function p4ScoreWindow(cells) {
  let ai = 0;
  let human = 0;
  let empty = 0;
  for (const v of cells) {
    if (v === P4.AI) ai++;
    else if (v === P4.HUMAN) human++;
    else empty++;
  }
  if (ai === 3 && empty === 1) return 5;
  if (ai === 2 && empty === 2) return 2;
  if (human === 3 && empty === 1) return -4;
  return 0;
}

// Heuristique : contrôle du centre + nombre d'alignements prometteurs
function p4Evaluate(b) {
  let score = 0;
  for (let r = 0; r < P4.ROWS; r++) {
    if (b[r][3] === P4.AI) score += 3;
    else if (b[r][3] === P4.HUMAN) score -= 3;
  }
  for (let r = 0; r < P4.ROWS; r++) {
    for (let c = 0; c < P4.COLS; c++) {
      if (c <= P4.COLS - 4) score += p4ScoreWindow([b[r][c], b[r][c + 1], b[r][c + 2], b[r][c + 3]]);
      if (r <= P4.ROWS - 4) score += p4ScoreWindow([b[r][c], b[r + 1][c], b[r + 2][c], b[r + 3][c]]);
      if (r <= P4.ROWS - 4 && c <= P4.COLS - 4) score += p4ScoreWindow([b[r][c], b[r + 1][c + 1], b[r + 2][c + 2], b[r + 3][c + 3]]);
      if (r <= P4.ROWS - 4 && c >= 3) score += p4ScoreWindow([b[r][c], b[r + 1][c - 1], b[r + 2][c - 2], b[r + 3][c - 3]]);
    }
  }
  return score;
}

function p4Minimax(b, depth, alpha, beta, maximizing) {
  if (p4FindWin(b, P4.AI)) return 100000 + depth;
  if (p4FindWin(b, P4.HUMAN)) return -100000 - depth;
  const cols = p4ValidCols(b);
  if (!cols.length) return 0;
  if (depth === 0) return p4Evaluate(b);

  let value = maximizing ? -Infinity : Infinity;
  for (const c of cols) {
    const r = p4NextRow(b, c);
    b[r][c] = maximizing ? P4.AI : P4.HUMAN;
    const score = p4Minimax(b, depth - 1, alpha, beta, !maximizing);
    b[r][c] = P4.EMPTY;
    if (maximizing) {
      value = Math.max(value, score);
      alpha = Math.max(alpha, value);
    } else {
      value = Math.min(value, score);
      beta = Math.min(beta, value);
    }
    if (alpha >= beta) break;
  }
  return value;
}

function p4ChooseColumn(b, level) {
  const cols = p4ValidCols(b);
  if (Math.random() < level.random) return Phaser.Utils.Array.GetRandom(cols);
  let best = -Infinity;
  let choice = cols[0];
  for (const c of cols) {
    const r = p4NextRow(b, c);
    b[r][c] = P4.AI;
    const score = p4Minimax(b, level.depth - 1, -Infinity, Infinity, false);
    b[r][c] = P4.EMPTY;
    if (score > best) {
      best = score;
      choice = c;
    }
  }
  return choice;
}

class Puissance4Scene extends Phaser.Scene {
  constructor() {
    super('puissance-4');
  }

  create() {
    this.CELL = 90;
    this.X0 = 35;
    this.Y0 = 120;
    this.board = Array.from({ length: P4.ROWS }, () => Array(P4.COLS).fill(P4.EMPTY));
    this.over = false;
    this.busy = false;
    this.col = 3;
    this.levelIndex = Math.max(0, P4_LEVELS.findIndex((l) => l.key === ZG.load('p4:level', 'moyen')));

    this.session = this.registry.get('p4-session') || { w: 0, d: 0, l: 0, round: 0 };
    this.registry.set('p4-session', this.session);
    this.updateSession();

    this.drawBoard();

    this.preview = this.add.circle(this.colX(this.col), 72, 36, 0xff5d73).setDepth(3);
    this.status = this.add.text(16, 24, '', {
      fontFamily: ZG.FONT, fontSize: '22px', fontStyle: 'bold', color: '#eceeff',
    }).setOrigin(0, 0.5);
    this.levelBtn = ZG.textButton(this, this.scale.width - 16, 24, '', () => this.cycleLevel(), 1);
    this.updateLevelLabel();

    this.input.on('pointermove', (p) => this.setColumn(this.columnAt(p.x)));
    this.input.on('pointerdown', (p) => {
      this.setColumn(this.columnAt(p.x));
      this.playerMove(this.col);
    });
    this.input.keyboard.on('keydown', (e) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.setColumn(this.col - 1);
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') this.setColumn(this.col + 1);
      else if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowDown') this.playerMove(this.col);
    });

    const aiStarts = this.session.round % 2 === 1;
    this.session.round++;
    if (aiStarts) {
      this.turn = P4.AI;
      this.status.setText("L'IA commence…");
      this.preview.setVisible(false);
      this.time.delayedCall(500, () => this.aiMove());
    } else {
      this.turn = P4.HUMAN;
      this.status.setText('À vous (rouge)');
    }
  }

  colX(c) {
    return this.X0 + c * this.CELL + this.CELL / 2;
  }

  rowY(r) {
    return this.Y0 + r * this.CELL + this.CELL / 2;
  }

  columnAt(x) {
    return Phaser.Math.Clamp(Math.floor((x - this.X0) / this.CELL), 0, P4.COLS - 1);
  }

  setColumn(c) {
    this.col = Phaser.Math.Clamp(c, 0, P4.COLS - 1);
    this.preview.x = this.colX(this.col);
  }

  // Plateau troué : une texture pleine dont on efface les cercles, posée au-dessus des jetons
  drawBoard() {
    const w = P4.COLS * this.CELL;
    const h = P4.ROWS * this.CELL;
    this.add.rectangle(this.X0, this.Y0, w, h, 0x0e1030).setOrigin(0);

    const holes = this.make.graphics({}, false);
    holes.fillStyle(0xffffff);
    for (let r = 0; r < P4.ROWS; r++) {
      for (let c = 0; c < P4.COLS; c++) {
        holes.fillCircle(c * this.CELL + this.CELL / 2, r * this.CELL + this.CELL / 2, 36);
      }
    }
    const frame = this.add.renderTexture(this.X0, this.Y0, w, h).setOrigin(0).setDepth(2);
    frame.fill(0x2b3bb5);
    frame.erase(holes);
    holes.destroy();
  }

  cycleLevel() {
    this.levelIndex = (this.levelIndex + 1) % P4_LEVELS.length;
    ZG.save('p4:level', P4_LEVELS[this.levelIndex].key);
    this.updateLevelLabel();
  }

  updateLevelLabel() {
    this.levelBtn.setText(`Niveau : ${P4_LEVELS[this.levelIndex].label}  ▸`);
  }

  updateSession() {
    const s = this.session;
    ZG.setScore(`${s.w} - ${s.d} - ${s.l}`);
  }

  playerMove(c) {
    if (this.over || this.busy || this.turn !== P4.HUMAN) return;
    if (p4NextRow(this.board, c) === -1) return;
    this.drop(c, P4.HUMAN, () => {
      this.turn = P4.AI;
      this.status.setText("L'IA réfléchit…");
      this.preview.setVisible(false);
      // Petit délai pour que le texte s'affiche avant le calcul de l'IA
      this.time.delayedCall(250, () => this.aiMove());
    });
  }

  aiMove() {
    if (this.over) return;
    const c = p4ChooseColumn(this.board, P4_LEVELS[this.levelIndex]);
    this.drop(c, P4.AI, () => {
      this.turn = P4.HUMAN;
      this.status.setText('À vous (rouge)');
      this.preview.setVisible(true);
    });
  }

  drop(c, player, next) {
    const r = p4NextRow(this.board, c);
    this.board[r][c] = player;
    this.busy = true;
    const color = player === P4.HUMAN ? 0xff5d73 : 0xffd166;
    const disc = this.add.circle(this.colX(c), 72, 36, color).setDepth(1);
    this.tweens.add({
      targets: disc,
      y: this.rowY(r),
      duration: 120 + r * 60,
      ease: 'Bounce.Out',
      onComplete: () => {
        this.busy = false;
        if (!this.checkEnd(player)) next();
      },
    });
  }

  checkEnd(player) {
    const cells = p4FindWin(this.board, player);
    const full = p4ValidCols(this.board).length === 0;
    if (!cells && !full) return false;

    this.over = true;
    this.preview.setVisible(false);
    if (cells) {
      cells.forEach(([r, c]) => {
        const ring = this.add.circle(this.colX(c), this.rowY(r), 30).setStrokeStyle(6, 0xffffff).setDepth(3);
        this.tweens.add({ targets: ring, alpha: 0.3, duration: 400, yoyo: true, repeat: -1 });
      });
    }

    if (cells && player === P4.HUMAN) {
      this.session.w++;
      ZG.addWin();
      this.status.setText('Victoire !');
      ZG.overlay(this, 'Victoire !', "Quatre d'affilée, bien joué 🎉", { color: '#7cf29c', delay: 1000 });
    } else if (cells) {
      this.session.l++;
      this.status.setText("L'IA gagne");
      ZG.overlay(this, 'Défaite', "L'IA a aligné quatre jetons.", { color: '#ff5d73', delay: 1000 });
    } else {
      this.session.d++;
      this.status.setText('Match nul');
      ZG.overlay(this, 'Match nul', 'La grille est pleine.', { color: '#ffd166', delay: 700 });
    }
    this.updateSession();
    return true;
  }
}

ZG.register({ id: 'puissance-4', width: 700, height: 680, scene: Puissance4Scene });
