/* ZGames — page d'accueil : affichage du catalogue, recherche et filtres */

(function () {
  const grid = document.getElementById('games-grid');
  const empty = document.getElementById('empty');
  const search = document.getElementById('search');
  const filters = document.getElementById('filters');
  let category = 'all';

  const normalize = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  function cardHtml(game) {
    const url = `jeu.html?id=${encodeURIComponent(game.id)}`;
    return `
      <article class="game-card">
        <a href="${url}" class="thumb" style="--c1:${game.colors[0]};--c2:${game.colors[1]}" aria-label="Jouer à ${game.title}">
          <span>${game.icon}</span>
        </a>
        <div class="card-body">
          <span class="tag tag-${game.category}">${CATEGORIES[game.category]}</span>
          <h3>${game.title}</h3>
          <p>${game.description}</p>
          <div class="card-foot">
            <span class="best">${game.bestLabel} : <strong>${ZG.formatBest(game)}</strong></span>
            <a href="${url}" class="btn btn-small">Jouer</a>
          </div>
        </div>
      </article>`;
  }

  function render() {
    const q = normalize(search.value.trim());
    const list = GAMES.filter((g) =>
      (category === 'all' || g.category === category) &&
      (!q || normalize(`${g.title} ${g.description} ${CATEGORIES[g.category]}`).includes(q)));
    grid.innerHTML = list.map(cardHtml).join('');
    empty.hidden = list.length > 0;
  }

  function renderFilters() {
    const entries = [['all', 'Tous'], ...Object.entries(CATEGORIES)];
    filters.innerHTML = entries.map(([key, label]) =>
      `<button type="button" class="chip" data-cat="${key}" aria-pressed="${key === category}">${label}</button>`).join('');
  }

  filters.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    category = chip.dataset.cat;
    renderFilters();
    render();
  });
  search.addEventListener('input', render);

  document.getElementById('random-game').addEventListener('click', (e) => {
    e.preventDefault();
    const game = GAMES[Math.floor(Math.random() * GAMES.length)];
    location.href = `jeu.html?id=${encodeURIComponent(game.id)}`;
  });

  document.getElementById('stat-games').textContent = GAMES.length;
  document.getElementById('stat-categories').textContent = Object.keys(CATEGORIES).length;
  document.getElementById('year').textContent = new Date().getFullYear();

  renderFilters();
  render();
})();
