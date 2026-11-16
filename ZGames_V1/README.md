# ZGames — 8WEB101 · Projet libre

## Équipe

| Prénom Nom | Rôle principal |
|---|---|
| _Prénom Nom (membre A)_ | Architecture, intégration de Phaser, jeux d'arcade et d'action, déploiement |
| _Prénom Nom (membre B)_ | Interface et catalogue, jeux de réflexion et de stratégie, responsive et tests |

## L'idée du projet

**ZGames** est une plateforme Web interactive qui regroupe plusieurs mini-jeux accessibles directement depuis un navigateur. Le site permet aux utilisateurs de découvrir différents types de jeux (**arcade**, **réflexion** et **stratégie**) à travers une interface intuitive et organisée. Chaque jeu est présenté dans un catalogue, avec recherche et filtres par catégorie, qui permet de choisir facilement celui auquel on veut jouer. L'objectif est de proposer une plateforme conviviale, offrant une expérience de jeu simple et accessible (sans installation ni compte), avec une variété de divertissements au sein d'un même environnement numérique.

### Jeux disponibles

| Jeu | Catégorie | Particularité |
|---|---|---|
| Snake | Arcade | Vitesse croissante, contrôles clavier et tactiles |
| Casse-briques | Arcade | Moteur physique Arcade de Phaser, niveaux successifs |
| Memory | Réflexion | 8 paires, animation de retournement, record en nombre de coups |
| 2048 | Réflexion | Fusion de tuiles, glisser au doigt |
| Morpion | Stratégie | IA minimax (3 niveaux, dont « imbattable ») |
| Puissance 4 | Stratégie | IA minimax avec élagage alpha-bêta (3 niveaux) |
| Z-City | Action | Ville vue du dessus façon GTA : voitures, livraisons, police, mini-carte |
| Z-Craft | Action | « Le Monde Vivant » : survie et construction en 2D, corruption qui se propage, boss, machines, objectif final (voir ci-dessous) |

Les meilleurs scores sont enregistrés dans le navigateur (`localStorage`).

### Z-Craft — Le Monde Vivant

Principe : chaque action du joueur influence un monde qui continue d'évoluer.

- **Inventaire et fabrication** : 36 cases (dont une barre rapide de 9), objets empilables, 25 recettes. Certaines recettes demandent un établi ou un four à proximité.
- **Progression** : pioches en bois, pierre, fer, or et cristal (vitesse et puissance croissantes ; chaque bloc exige un niveau de pioche minimal), épées, armures et potions de soin.
- **Exploration** : cavernes de cristaux lumineux, ruines gardées, temples souterrains, salles secrètes fermées, coffres, minerais plus rares en profondeur.
- **Corruption** : des zones souterraines démarrent corrompues et la corruption s'étend, surtout la nuit. Creuser intensément dans une région augmente son **instabilité**, ce qui accélère la corruption et provoque des éboulements. Les **cristaux purificateurs** la repoussent et protègent un rayon de 7 blocs.
- **Événements aléatoires** : Nuit rouge, pluie de météorites (avec marques d'avertissement au sol), tremblement de terre (qui révèle des cavités), invasion de la base.
- **Zombies évolutifs** : classique, rapide, blindé, grimpeur, fouisseur (creuse la terre) et corrompu. Leur apparition dépend des nuits passées, de l'équipement du joueur et de la corruption.
- **Machines** : le générateur (alimenté au charbon) fournit de l'énergie dans un rayon de 12 blocs à des lampes, portes automatiques et foreuses.
- **Boss** : le Golem de pierre (ondes de choc, lancer de rochers) et le Roi zombie (orbes, invocations, charge). Chacun a une barre de vie, une seconde phase et une récompense. Si on s'enfuit, le boss se rendort et on peut réessayer.
- **Objectif final** : réunir 5 fragments anciens, vaincre les deux boss, percer la coque du noyau avec une pioche en cristal, puis l'activer. La partie continue après la victoire.
- **Sauvegarde** : la progression est enregistrée automatiquement (toutes les 30 s, à la fermeture de la page et aux moments clés). Une sauvegarde illisible est détectée et remplacée par un nouveau monde. Le bouton « Nouveau monde » se trouve dans l'inventaire (E).

Commandes : Q/D ou ← → pour se déplacer, Espace / Z / ↑ pour sauter. Clic gauche maintenu pour creuser ou frapper, clic droit pour poser, utiliser, ouvrir un coffre ou alimenter une machine. E pour l'inventaire (Échap pour fermer), 1-9 ou la molette pour choisir un objet, C pour transformer du bois en planches. Des boutons à l'écran sont proposés sur les appareils tactiles. Les touches utilisent les codes physiques (`e.code`) : la même position fonctionne en AZERTY et en QWERTY.

## Technologies choisies

- **HTML, CSS, JavaScript** (sans framework, sans étape de compilation)
- **Phaser 3** (moteur de jeux 2D en JavaScript) : <https://phaser.io/>
- **Git / GitHub** pour le versionnement et l'hébergement (GitHub Pages)

## Dépôt Git

Lien : 

## Lancer le projet

Aucune installation n'est nécessaire : ouvrir `index.html` dans un navigateur. Phaser est inclus localement (`lib/phaser.min.js`), le site fonctionne donc hors-ligne.

Pour un serveur local (optionnel) : `npx serve .` ou l'extension *Live Server* de VS Code.

## Structure

```
index.html            Accueil + catalogue
jeu.html              Page de jeu générique (jeu.html?id=snake)
css/style.css         Styles
js/catalogue.js       Liste des jeux (titre, catégorie, description, commandes)
js/zg.js              Utilitaires communs : scores, HUD, contrôles, écran de fin
js/main.js            Rendu du catalogue, recherche, filtres
js/game-page.js       Chargement du jeu et lancement de Phaser
js/games/*.js         Un fichier (une scène Phaser) par jeu
js/games/z-craft/     Modules de Z-Craft (données, textures, monde, inventaire, monde vivant, ennemis, sauvegarde)
lib/phaser.min.js     Phaser 3.80.1
```

Ajouter un jeu : créer `js/games/<id>.js` qui appelle `ZG.register({ id, width, height, scene })`, puis ajouter une entrée dans `js/catalogue.js`. Un jeu découpé en plusieurs fichiers liste ses scripts annexes dans le champ `scripts` de son entrée : ils sont chargés dans l'ordre, avant le fichier principal (scripts classiques, sans modules).

## Plan de travail

### Tâches, responsables et échéances

| # | Tâche | Responsable | Échéance |
|---|---|---|---|
| 1 | Rédaction de l'énoncé et du plan de travail | Membres A et B | 12 oct. 2026 |
| 2 | Création du dépôt GitHub, structure des dossiers, conventions | Membre A | 14 oct. 2026 |
| 3 | Maquette de l'interface et charte graphique | Membre B | 19 oct. 2026 |
| 4 | Page d'accueil et catalogue (recherche, filtres) | Membre B | 26 oct. 2026 |
| 5 | Page de jeu générique, intégration de Phaser, sauvegarde des scores | Membre A | 26 oct. 2026 |
| 6 | Jeux d'arcade : Snake et Casse-briques | Membre A | 6 nov. 2026 |
| 7 | Jeux de réflexion : Memory et 2048 | Membre B | 6 nov. 2026 |
| 8 | Jeux de stratégie : Morpion et Puissance 4 (IA) | Membre B | 16 nov. 2026 |
| 9 | Jeu d'action : Z-City | Membre A | 20 nov. 2026 |
| 10 | Adaptation mobile (responsive, contrôles tactiles) et accessibilité | Membre B | 23 nov. 2026 |
| 11 | Tests sur plusieurs navigateurs et corrections | Membres A et B | 30 nov. 2026 |
| 12 | Déploiement sur GitHub Pages et documentation (README) | Membre A | 4 déc. 2026 |
| 13 | Préparation de la présentation finale | Membres A et B | 7 déc. 2026 |

### Risques identifiés et solutions de repli

| Risque | Impact | Solution de repli |
|---|---|---|
| Courbe d'apprentissage de Phaser plus longue que prévu | Retard sur les jeux | Commencer par les jeux les plus simples (Snake, Morpion) en suivant les exemples officiels ; en dernier recours, coder un jeu en Canvas 2D natif. |
| Retard sur le développement d'un ou plusieurs jeux | Catalogue incomplet | Définir un minimum viable : catalogue + 1 jeu par catégorie (3 jeux). Les autres jeux sont des bonus livrés s'il reste du temps. |
| IA trop lente ou trop complexe (Puissance 4) | Jeu peu jouable | Limiter la profondeur de recherche du minimax ; sinon, utiliser une IA simple à règles (gagner, sinon bloquer, sinon jouer au centre). |
| CDN ou connexion Internet indisponible | Les jeux ne se chargent pas | Phaser est copié en local dans `lib/` : le site fonctionne sans Internet. |
| Conflits Git entre membres | Perte de temps, code écrasé | Une branche par fonctionnalité, pull requests relues, un fichier par jeu pour limiter les conflits, commits fréquents. |
| Mauvais rendu sur mobile | Expérience dégradée | Mise à l'échelle automatique de Phaser (`Scale.FIT`), contrôles tactiles ; à défaut, indiquer que le jeu se joue de préférence sur ordinateur. |
| Absence ou indisponibilité d'un membre | Tâches bloquées | Tâches documentées dans le dépôt, relecture en binôme pour que chacun connaisse le code des autres, redistribution en réunion hebdomadaire. |
| Stockage local indisponible (navigation privée) | Scores non sauvegardés | Accès au `localStorage` protégé par `try/catch` : les jeux restent jouables, seuls les records ne sont pas conservés. |
