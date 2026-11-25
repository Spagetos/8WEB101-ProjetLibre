/* ZGames — utilitaires partagés : sauvegarde des scores, HUD, contrôles, écran de fin */

const ZG = (() => {
  const PREFIX = 'zgames:';
  const FONT = '"Segoe UI", "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", system-ui, Roboto, Arial, sans-serif';
  const definitions = {};
  let current = null;

  const DIRS = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };

  // Codes physiques : WASD correspond aussi à ZQSD sur un clavier AZERTY
  const KEY_DIRS = {
    ArrowUp: 'up', KeyW: 'up',
    ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
  };

  // --- Stockage (localStorage peut être indisponible : navigation privée, etc.) ---
  function load(key, fallback = null) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  // Retourne false si l'écriture a échoué (stockage plein ou indisponible)
  function save(key, value) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }

  function has(key) {
    try {
      return localStorage.getItem(PREFIX + key) !== null;
    } catch (e) {
      return false;
    }
  }

  function remove(key) {
    try {
      localStorage.removeItem(PREFIX + key);
    } catch (e) { /* rien à supprimer */ }
  }

  // --- Scores ---
  function getBest(id = current && current.id) {
    return load('best:' + id);
  }

  function formatBest(game) {
    const best = getBest(game.id);
    return best === null ? '—' : `${best} ${game.unit}`;
  }

  function setCurrent(game) {
    current = game;
    refreshHud();
  }

  function refreshHud() {
    const el = document.getElementById('hud-best');
    if (el && current) el.textContent = formatBest(current);
  }

  function setScore(value) {
    const el = document.getElementById('hud-score');
    if (el) el.textContent = value;
  }

  // Enregistre le score s'il bat le record. Retourne true si c'est un nouveau record.
  function submit(value) {
    if (!current) return false;
    const best = getBest();
    const better = best === null || (current.scoreType === 'low' ? value < best : value > best);
    if (better) {
      save('best:' + current.id, value);
      refreshHud();
    }
    return better;
  }

  function addWin() {
    if (!current) return 0;
    const total = (getBest() || 0) + 1;
    save('best:' + current.id, total);
    refreshHud();
    return total;
  }

  // --- Enregistrement des jeux ---
  function register(def) {
    definitions[def.id] = def;
  }

  function getDefinition(id) {
    return definitions[id];
  }

  // --- Contrôles ---
  function keyToDir(code) {
    return KEY_DIRS[code] || null;
  }

  function onSwipe(scene, callback) {
    let start = null;
    scene.input.on('pointerdown', (p) => { start = { x: p.x, y: p.y }; });
    scene.input.on('pointerup', (p) => {
      if (!start) return;
      const dx = p.x - start.x;
      const dy = p.y - start.y;
      start = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 30) return;
      if (Math.abs(dx) > Math.abs(dy)) callback(dx > 0 ? 'right' : 'left');
      else callback(dy > 0 ? 'down' : 'up');
    });
  }

  // --- Écran de fin de partie (Espace, Entrée ou clic pour rejouer) ---
  function overlay(scene, title, message, { color = '#ffffff', delay = 0 } = {}) {
    const show = () => {
      const { width: w, height: h } = scene.scale;
      const layer = scene.add.container(0, 0).setDepth(1000).setAlpha(0);
      const bg = scene.add.rectangle(w / 2, h / 2, w, h, 0x07081a, 0.8);
      const t = scene.add.text(w / 2, h / 2 - 60, title, {
        fontFamily: FONT, fontSize: '52px', fontStyle: 'bold', color,
      }).setOrigin(0.5);
      const m = scene.add.text(w / 2, h / 2 + 6, message, {
        fontFamily: FONT, fontSize: '22px', color: '#d6d8f5', align: 'center', lineSpacing: 6,
      }).setOrigin(0.5);
      const hint = scene.add.text(w / 2, h / 2 + 90, 'Espace ou clic pour rejouer', {
        fontFamily: FONT, fontSize: '18px', color: '#9ea2cc',
      }).setOrigin(0.5);
      layer.add([bg, t, m, hint]);
      // Reste fixe à l'écran même si la caméra défile, et n'apparaît pas sur les caméras secondaires (mini-carte)
      layer.setScrollFactor(0, 0, true);
      scene.cameras.cameras.forEach((cam) => { if (cam !== scene.cameras.main) cam.ignore(layer); });

      scene.tweens.add({ targets: layer, alpha: 1, duration: 250 });
      scene.tweens.add({ targets: hint, alpha: 0.35, duration: 700, yoyo: true, repeat: -1 });

      scene.time.delayedCall(400, () => {
        const restart = () => scene.scene.restart();
        scene.input.keyboard.once('keydown-SPACE', restart);
        scene.input.keyboard.once('keydown-ENTER', restart);
        scene.input.once('pointerdown', restart);
      });
    };
    if (delay) scene.time.delayedCall(delay, show);
    else show();
  }

  // Petit bouton texte cliquable dessiné dans le canevas
  function textButton(scene, x, y, label, onClick, origin = 0.5) {
    const btn = scene.add.text(x, y, label, {
      fontFamily: FONT, fontSize: '17px', color: '#eceeff',
      backgroundColor: '#272b52', padding: { x: 12, y: 6 },
    }).setOrigin(origin, 0.5).setInteractive({ useHandCursor: true });
    btn.on('pointerover', () => btn.setBackgroundColor('#3a3f78'));
    btn.on('pointerout', () => btn.setBackgroundColor('#272b52'));
    btn.on('pointerdown', (pointer, lx, ly, event) => {
      event.stopPropagation();
      onClick();
    });
    return btn;
  }

  return {
    FONT, DIRS, load, save, has, remove, getBest, formatBest, setCurrent, setScore, submit, addWin,
    register, getDefinition, keyToDir, onSwipe, overlay, textButton,
  };
})();
