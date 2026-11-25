/* ZGames — catalogue des jeux (partagé par l'accueil et la page de jeu) */

const CATEGORIES = {
  arcade: 'Arcade',
  reflexion: 'Réflexion',
  strategie: 'Stratégie',
};

// scoreType : 'high' (plus haut = mieux), 'low' (plus bas = mieux), 'wins' (cumul des victoires)
const GAMES = [
  {
    id: 'snake',
    title: 'Snake',
    category: 'arcade',
    icon: '🐍',
    colors: ['#22c47a', '#0b3d2c'],
    description: 'Guidez le serpent, mangez les fruits et grandissez… sans vous mordre la queue. Les bords de l\'écran se rejoignent et la vitesse augmente tous les 5 fruits. D\'après l\'exemple officiel Phaser « Snake ».',
    controls: ['Flèches ou ZQSD : changer de direction', 'Glisser le doigt : changer de direction (mobile)', 'Espace ou clic : rejouer après une défaite'],
    scoreType: 'high', scoreLabel: 'Score', bestLabel: 'Record', unit: 'pts',
  },
  {
    id: 'casse-briques',
    title: 'Casse-briques',
    category: 'arcade',
    icon: '🧱',
    colors: ['#ff7a59', '#5a1530'],
    description: 'Renvoyez la balle avec la raquette pour détruire les 60 briques. Le mur se reconstruit quand il est détruit. D\'après l\'exemple officiel Phaser « Breakout ».',
    controls: ['Souris, doigt ou flèches : déplacer la raquette', 'Clic ou Espace : lancer la balle', '3 vies par partie'],
    scoreType: 'high', scoreLabel: 'Score', bestLabel: 'Record', unit: 'pts',
  },
  {
    id: 'stacker',
    title: 'Stacker',
    category: 'arcade',
    icon: '🏗️',
    colors: ['#99ffff', '#1d4e89'],
    description: 'Empilez les rangées de blocs jusqu\'en haut de l\'écran. Chaque bloc mal aligné tombe, la rangée accélère et rétrécit après les rangées 5 et 10. D\'après l\'exemple officiel Phaser « Stacker ».',
    controls: ['Espace ou clic : poser la rangée', '15 rangées pour gagner le gros lot'],
    scoreType: 'high', scoreLabel: 'Rangées', bestLabel: 'Record', unit: 'rangées',
  },
  {
    id: 'card-memory',
    title: 'Memory',
    category: 'reflexion',
    icon: '🃏',
    colors: ['#8c7ae6', '#192a56'],
    description: 'Retournez les cartes deux par deux et retrouvez les 6 paires avant d\'avoir perdu vos 10 vies. D\'après l\'exemple officiel Phaser « Card Memory » (Francisco Pereira).',
    controls: ['Clic ou toucher : retourner une carte', 'Chaque erreur coûte une vie', 'Icône en haut à gauche : couper le son'],
    scoreType: 'high', scoreLabel: 'Vies', bestLabel: 'Record', unit: 'vies',
  },
  {
    id: 'emoji-match',
    title: 'Emoji Match',
    category: 'reflexion',
    icon: '😀',
    colors: ['#ffd166', '#008eb0'],
    description: 'Une seule paire d\'emojis identiques se cache dans la grille : trouvez-en un maximum en 30 secondes. D\'après l\'exemple officiel Phaser « Emoji Match ».',
    controls: ['Clic ou toucher : choisir un emoji', 'Le chrono démarre au premier clic'],
    scoreType: 'high', scoreLabel: 'Paires', bestLabel: 'Record', unit: 'paires',
  },
  {
    id: 'flood-fill',
    title: 'Flood Fill',
    category: 'strategie',
    icon: '🎨',
    colors: ['#7cf29c', '#3b1d5e'],
    description: 'Changez la couleur de la zone partant du coin supérieur gauche pour absorber les cases voisines. Remplissez toute la grille de 14 × 14 en 25 coups maximum. D\'après l\'exemple officiel Phaser « Flood Fill ».',
    controls: ['Clic sur un monstre : choisir la couleur', 'Il faut tout remplir en 25 coups', 'Le record est le nombre de coups restants'],
    scoreType: 'high', scoreLabel: 'Coups restants', bestLabel: 'Record', unit: 'coups',
  },
];
