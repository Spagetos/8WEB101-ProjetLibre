/* Z-Craft — données du jeu : blocs, objets, outils, recettes, ennemis */

window.ZC = window.ZC || {};

(function () {
  ZC.T = 24; // taille d'un bloc en pixels
  ZC.W = 240; // largeur du monde en blocs
  ZC.H = 90; // hauteur du monde en blocs
  ZC.REACH = 5; // portée du joueur en blocs
  ZC.DAY_LENGTH = 160; // durée d'un jour complet en secondes
  ZC.CHUNK = 16; // taille des régions d'instabilité
  ZC.SAVE_KEY = 'zcraft:save';
  ZC.SAVE_VERSION = 2;
  ZC.FRAGMENTS_NEEDED = 5;

  const B = {
    AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, LOG: 4, LEAVES: 5, SAND: 6, PLANKS: 7,
    COAL: 8, IRON: 9, GOLD: 10, CRYSTAL: 11, BEDROCK: 12, ABYSS: 13,
    BRICK: 14, TEMPLE: 15, CORRUPT: 16, METEOR: 17, SHELL: 18, CORE: 19, CORE_ON: 20,
    TORCH: 21, BENCH: 22, FURNACE: 23, CHEST: 24, PURIFIER: 25,
    GEN: 26, GEN_ON: 27, LAMP: 28, LAMP_ON: 29, DRILL: 30, DOOR: 31, DOOR_OPEN: 32,
  };
  ZC.B = B;

  // hard : temps de minage à la main (s) ; tier : puissance de pioche requise ;
  // drop : objet récupéré ; solid : bloque les déplacements ; light : rayon de lumière
  const BLOCKS = [];
  const def = (id, props) => { BLOCKS[id] = Object.assign({ tier: 0, solid: true, light: 0, drop: null }, props); };
  def(B.AIR, { name: 'Air', hard: 0, solid: false });
  def(B.GRASS, { name: 'Herbe', hard: 0.55, drop: 'dirt', natural: true });
  def(B.DIRT, { name: 'Terre', hard: 0.5, drop: 'dirt', natural: true });
  def(B.STONE, { name: 'Pierre', hard: 2, tier: 1, drop: 'stone', natural: true });
  def(B.LOG, { name: 'Bois', hard: 1.2, drop: 'log' });
  def(B.LEAVES, { name: 'Feuilles', hard: 0.25, drop: 'leaves' });
  def(B.SAND, { name: 'Sable', hard: 0.45, drop: 'sand', natural: true });
  def(B.PLANKS, { name: 'Planches', hard: 1, drop: 'planks' });
  def(B.COAL, { name: 'Minerai de charbon', hard: 2.4, tier: 1, drop: 'coal', points: 5, natural: true });
  def(B.IRON, { name: 'Minerai de fer', hard: 3, tier: 2, drop: 'iron_ore', points: 10, natural: true });
  def(B.GOLD, { name: "Minerai d'or", hard: 3.6, tier: 3, drop: 'gold_ore', points: 25, natural: true });
  def(B.CRYSTAL, { name: 'Cristal lumineux', hard: 3, tier: 3, drop: 'crystal', points: 40, light: 4 });
  def(B.BEDROCK, { name: 'Bedrock', hard: Infinity, tier: 99 });
  def(B.ABYSS, { name: 'Roche abyssale', hard: 5, tier: 4, drop: 'abyss', natural: true });
  def(B.BRICK, { name: 'Brique ancienne', hard: 3, tier: 1, drop: 'brick' });
  def(B.TEMPLE, { name: 'Brique de temple', hard: 4.5, tier: 3, drop: 'temple' });
  def(B.CORRUPT, { name: 'Roche corrompue', hard: 2.5, tier: 2, drop: 'stone', points: 2, light: 1 });
  def(B.METEOR, { name: 'Météorite', hard: 4, tier: 3, drop: [['crystal', 1], ['iron_ore', 1]], points: 30, light: 2 });
  def(B.SHELL, { name: 'Coque du noyau', hard: 8, tier: 5 });
  def(B.CORE, { name: 'Noyau ancien', hard: Infinity, tier: 99, solid: false, light: 5, interact: true });
  def(B.CORE_ON, { name: 'Noyau éveillé', hard: Infinity, tier: 99, solid: false, light: 11, interact: true });
  def(B.TORCH, { name: 'Torche', hard: 0.05, solid: false, drop: 'torch', light: 6 });
  def(B.BENCH, { name: 'Établi', hard: 0.6, solid: false, drop: 'bench', interact: true });
  def(B.FURNACE, { name: 'Four', hard: 1, solid: false, drop: 'furnace', light: 2, interact: true });
  def(B.CHEST, { name: 'Coffre', hard: 0.8, solid: false, interact: true });
  def(B.PURIFIER, { name: 'Cristal purificateur', hard: 1, solid: false, drop: 'purifier', light: 5 });
  def(B.GEN, { name: 'Générateur', hard: 1, solid: false, drop: 'gen', interact: true, machine: 'gen' });
  def(B.GEN_ON, { name: 'Générateur', hard: 1, solid: false, drop: 'gen', light: 3, interact: true, machine: 'gen' });
  def(B.LAMP, { name: 'Lampe électrique', hard: 0.6, solid: false, drop: 'lamp', machine: 'lamp' });
  def(B.LAMP_ON, { name: 'Lampe électrique', hard: 0.6, solid: false, drop: 'lamp', light: 9, machine: 'lamp' });
  def(B.DRILL, { name: 'Foreuse automatique', hard: 1, solid: false, drop: 'drill', interact: true, machine: 'drill' });
  def(B.DOOR, { name: 'Porte électrique', hard: 1, drop: 'door', interact: true, machine: 'door' });
  def(B.DOOR_OPEN, { name: 'Porte électrique', hard: 1, solid: false, drop: 'door', interact: true, machine: 'door' });
  ZC.BLOCKS = BLOCKS;
  ZC.SOLID_IDS = BLOCKS.map((b, id) => (b.solid ? id : -1)).filter((id) => id > 0);

  // Objets : block = bloc posé ; tool = outil ; stack = quantité max par case
  const ITEMS = {
    dirt: { name: 'Terre', block: B.DIRT },
    stone: { name: 'Pierre', block: B.STONE },
    log: { name: 'Bois', block: B.LOG },
    leaves: { name: 'Feuilles', block: B.LEAVES },
    sand: { name: 'Sable', block: B.SAND },
    planks: { name: 'Planches', block: B.PLANKS },
    brick: { name: 'Brique ancienne', block: B.BRICK },
    temple: { name: 'Brique de temple', block: B.TEMPLE },
    abyss: { name: 'Roche abyssale', block: B.ABYSS },
    torch: { name: 'Torche', block: B.TORCH },
    bench: { name: 'Établi', block: B.BENCH },
    furnace: { name: 'Four', block: B.FURNACE },
    purifier: { name: 'Cristal purificateur', block: B.PURIFIER },
    gen: { name: 'Générateur', block: B.GEN },
    lamp: { name: 'Lampe électrique', block: B.LAMP },
    drill: { name: 'Foreuse automatique', block: B.DRILL },
    door: { name: 'Porte électrique', block: B.DOOR },
    coal: { name: 'Charbon' },
    iron_ore: { name: 'Minerai de fer' },
    gold_ore: { name: "Minerai d'or" },
    iron: { name: 'Lingot de fer' },
    gold: { name: "Lingot d'or" },
    crystal: { name: 'Cristal' },
    stick: { name: 'Bâton' },
    fragment: { name: 'Fragment ancien', stack: 99 },
    pick_wood: { name: 'Pioche en bois', tool: 'pick', tier: 1, speed: 1.6 },
    pick_stone: { name: 'Pioche en pierre', tool: 'pick', tier: 2, speed: 2.2 },
    pick_iron: { name: 'Pioche en fer', tool: 'pick', tier: 3, speed: 3 },
    pick_gold: { name: 'Pioche en or', tool: 'pick', tier: 4, speed: 4.2 },
    pick_crystal: { name: 'Pioche en cristal', tool: 'pick', tier: 5, speed: 6 },
    sword_wood: { name: 'Épée en bois', tool: 'sword', dmg: 3 },
    sword_stone: { name: 'Épée en pierre', tool: 'sword', dmg: 4 },
    sword_iron: { name: 'Épée en fer', tool: 'sword', dmg: 6 },
    sword_gold: { name: 'Épée en or', tool: 'sword', dmg: 8 },
    sword_crystal: { name: 'Épée en cristal', tool: 'sword', dmg: 11, purify: true },
    armor_iron: { name: 'Armure de fer', armor: 0.25 },
    armor_crystal: { name: 'Armure de cristal', armor: 0.5 },
    potion: { name: 'Potion de soin', heal: 8 },
    golem_heart: { name: 'Cœur de pierre', bonusHp: 4 },
    crown: { name: 'Couronne maudite', bonusHp: 4 },
  };
  Object.keys(ITEMS).forEach((id) => {
    const it = ITEMS[id];
    it.id = id;
    if (!it.stack) it.stack = it.tool || it.armor || it.bonusHp ? 1 : 99;
  });
  ZC.ITEMS = ITEMS;

  // Couleurs des matériaux pour les icônes d'outils
  ZC.MATERIAL_COLORS = {
    wood: [166, 124, 70], stone: [140, 140, 140], iron: [215, 215, 225], gold: [250, 214, 60], crystal: [110, 235, 245],
  };

  // station : 'bench' (établi) ou 'furnace' (four) à moins de 4 blocs
  ZC.RECIPES = [
    { out: 'planks', n: 4, cost: [['log', 1]] },
    { out: 'stick', n: 4, cost: [['planks', 2]] },
    { out: 'torch', n: 4, cost: [['stick', 1], ['coal', 1]] },
    { out: 'bench', n: 1, cost: [['planks', 4]] },
    { out: 'pick_wood', n: 1, cost: [['planks', 3], ['stick', 2]], station: 'bench' },
    { out: 'sword_wood', n: 1, cost: [['planks', 2], ['stick', 1]], station: 'bench' },
    { out: 'furnace', n: 1, cost: [['stone', 8]], station: 'bench' },
    { out: 'pick_stone', n: 1, cost: [['stone', 3], ['stick', 2]], station: 'bench' },
    { out: 'sword_stone', n: 1, cost: [['stone', 2], ['stick', 1]], station: 'bench' },
    { out: 'iron', n: 1, cost: [['iron_ore', 1], ['coal', 1]], station: 'furnace' },
    { out: 'gold', n: 1, cost: [['gold_ore', 1], ['coal', 1]], station: 'furnace' },
    { out: 'pick_iron', n: 1, cost: [['iron', 3], ['stick', 2]], station: 'bench' },
    { out: 'sword_iron', n: 1, cost: [['iron', 2], ['stick', 1]], station: 'bench' },
    { out: 'armor_iron', n: 1, cost: [['iron', 8]], station: 'bench' },
    { out: 'pick_gold', n: 1, cost: [['gold', 3], ['stick', 2]], station: 'bench' },
    { out: 'sword_gold', n: 1, cost: [['gold', 2], ['stick', 1]], station: 'bench' },
    { out: 'pick_crystal', n: 1, cost: [['crystal', 3], ['gold', 2], ['stick', 2]], station: 'bench' },
    { out: 'sword_crystal', n: 1, cost: [['crystal', 3], ['gold', 1], ['stick', 1]], station: 'bench' },
    { out: 'armor_crystal', n: 1, cost: [['crystal', 6], ['gold', 4]], station: 'bench' },
    { out: 'potion', n: 1, cost: [['crystal', 1], ['leaves', 2]], station: 'furnace' },
    { out: 'purifier', n: 1, cost: [['crystal', 2], ['stone', 4]], station: 'bench' },
    { out: 'gen', n: 1, cost: [['iron', 6], ['stone', 8]], station: 'furnace' },
    { out: 'lamp', n: 1, cost: [['iron', 1], ['crystal', 1]], station: 'bench' },
    { out: 'door', n: 1, cost: [['iron', 2], ['planks', 4]], station: 'bench' },
    { out: 'drill', n: 1, cost: [['iron', 5], ['gold', 2], ['crystal', 1]], station: 'bench' },
  ];

  ZC.STATION_NAMES = { bench: 'Établi', furnace: 'Four' };

  // Machines : production (+) ou consommation (-) d'énergie
  ZC.MACHINE_POWER = { gen: 6, lamp: -1, door: -1, drill: -4 };
  ZC.GEN_FUEL_PER_COAL = 45;
  ZC.GEN_MAX_FUEL = 600;
  ZC.POWER_RANGE = 12;

  // Types de zombies
  ZC.MOBS = {
    classic: { name: 'Zombie', hp: 8, speed: 70, dmg: 2, points: 30 },
    fast: { name: 'Zombie rapide', hp: 5, speed: 125, dmg: 2, points: 35 },
    armored: { name: 'Zombie blindé', hp: 20, speed: 55, dmg: 3, armor: 1, points: 60 },
    climber: { name: 'Zombie grimpeur', hp: 8, speed: 75, dmg: 2, climb: true, points: 40 },
    burrower: { name: 'Zombie fouisseur', hp: 10, speed: 60, dmg: 2, dig: true, points: 45 },
    corrupt: { name: 'Zombie corrompu', hp: 14, speed: 85, dmg: 3, noBurn: true, points: 60 },
  };
})();
