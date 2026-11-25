/* ZGames — page de jeu : charge le script du jeu demandé et lance Phaser */

(function () {
  const id = new URLSearchParams(location.search).get('id');
  const meta = GAMES.find((g) => g.id === id);
  const container = document.getElementById('game-container');
  const errorBox = document.getElementById('game-error');
  let game = null;

  document.getElementById('year').textContent = new Date().getFullYear();

  function showError(html) {
    container.hidden = true;
    errorBox.innerHTML = html;
    errorBox.hidden = false;
  }

  function renderOtherGames() {
    document.getElementById('other-games').innerHTML = GAMES
      .filter((g) => g !== meta)
      .map((g) => `<li><a href="jeu.html?id=${encodeURIComponent(g.id)}"><span class="mini-thumb" style="--c1:${g.colors[0]};--c2:${g.colors[1]}">${g.icon}</span>${g.title}</a></li>`)
      .join('');
  }

  renderOtherGames();

  if (!meta) {
    document.getElementById('game-title').textContent = 'Jeu introuvable';
    showError('Ce jeu n\'existe pas. <a href="index.html#catalogue">Retour au catalogue</a>');
    return;
  }

  document.title = `${meta.title} — ZGames`;
  document.getElementById('game-title').textContent = meta.title;
  const tag = document.getElementById('game-tag');
  tag.textContent = CATEGORIES[meta.category];
  tag.classList.add(`tag-${meta.category}`);
  document.getElementById('game-desc').textContent = meta.description;
  document.getElementById('game-controls').innerHTML = meta.controls.map((c) => `<li>${c}</li>`).join('');
  document.getElementById('hud-score-label').textContent = meta.scoreLabel;
  document.getElementById('hud-best-label').textContent = meta.bestLabel;

  if (typeof Phaser === 'undefined') {
    showError('Impossible de charger le moteur de jeu Phaser (fichier <code>lib/phaser.min.js</code> manquant).');
    return;
  }

  ZG.setCurrent(meta);

  // Scripts annexes éventuels (meta.scripts), chargés dans l'ordre, puis le fichier principal du jeu
  const sources = [...(meta.scripts || []), `js/games/${meta.id}.js`];
  (function loadNext(i) {
    if (i >= sources.length) {
      start();
      return;
    }
    const script = document.createElement('script');
    script.src = sources[i];
    script.onload = () => loadNext(i + 1);
    script.onerror = () => showError('Le fichier du jeu n\'a pas pu être chargé.');
    document.body.appendChild(script);
  })(0);

  function start() {
    const def = ZG.getDefinition(meta.id);
    // Le conteneur garde les proportions du jeu et tient dans l'écran ; Phaser s'y adapte (Scale.FIT)
    container.style.aspectRatio = `${def.width} / ${def.height}`;
    container.style.width = `min(100%, ${def.width}px, calc(72vh * ${(def.width / def.height).toFixed(4)}))`;

    game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: container,
      width: def.width,
      height: def.height,
      backgroundColor: '#14152b',
      physics: { default: 'arcade', arcade: { debug: false } },
      // Phaser empêche lui-même les flèches et Espace de faire défiler la page.
      // (Un preventDefault() fait ailleurs avant lui ferait ignorer ces touches par Phaser.)
      input: { keyboard: { capture: [32, 37, 38, 39, 40] } },
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      // Réglages propres au jeu (couleur de fond, pixelArt…) tirés de l'exemple Phaser d'origine
      ...(def.config || {}),
      scene: def.scene,
    });
  }

  const restartBtn = document.getElementById('restart-btn');
  restartBtn.addEventListener('click', () => {
    restartBtn.blur(); // sinon la touche Espace « recliquerait » sur le bouton
    if (!game) return;
    const def = ZG.getDefinition(meta.id);
    // Pendant le chargement des images et des sons, on ne relance rien
    if (game.scene.getScenes(true).some((scene) => scene.load && scene.load.isLoading())) return;
    if (def.restartScene) {
      // Jeu à plusieurs scènes (menu, partie, fin) : on arrête tout et on relance la partie
      game.scene.getScenes(true).forEach((scene) => scene.scene.stop());
      game.scene.start(def.restartScene);
    } else {
      game.scene.getScenes(true).forEach((scene) => scene.scene.restart());
    }
  });
})();
