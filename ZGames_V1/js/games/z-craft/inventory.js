/* Z-Craft — inventaire, barre rapide, fabrication et équipements */

window.ZC = window.ZC || {};

(function () {
  const B = ZC.B;
  const ITEMS = ZC.ITEMS;
  const SLOTS = 36; // 9 cases de barre rapide + 27 cases d'inventaire
  const HOTBAR = 9;
  const SLOT = 44;
  const STEP = 48;
  const ROW_H = 36;
  const VISIBLE_ROWS = 10;
  const PICK_TIER_NAMES = ['à la main', 'pioche en bois', 'pioche en pierre', 'pioche en fer', 'pioche en or', 'pioche en cristal'];
  ZC.PICK_TIER_NAMES = PICK_TIER_NAMES;

  const text = (scene, x, y, str, size, color = '#eceeff', extra = {}) => scene.add.text(x, y, str, Object.assign({
    fontFamily: ZG.FONT, fontSize: size + 'px', color, stroke: '#000000', strokeThickness: size >= 16 ? 4 : 3,
  }, extra)).setScrollFactor(0);

  ZC.InventoryMixin = {
    // --- Données ---
    initInventory() {
      this.inv = new Array(SLOTS).fill(null);
      this.sel = 0;
      this.cursorStack = null;
      this.recipeScroll = 0;
    },

    itemDef(id) {
      return ITEMS[id];
    },

    countItem(id) {
      return this.inv.reduce((n, s) => n + (s && s.id === id ? s.n : 0), 0);
    },

    canFit(id, n) {
      const max = ITEMS[id].stack;
      let room = 0;
      this.inv.forEach((s) => {
        if (!s) room += max;
        else if (s.id === id) room += max - s.n;
      });
      return room >= n;
    },

    // Ajoute des objets ; retourne la quantité qui n'a pas pu être rangée
    addItem(id, n = 1) {
      const def = ITEMS[id];
      if (!def || n <= 0) return n;
      for (let i = 0; i < SLOTS && n > 0; i++) {
        const s = this.inv[i];
        if (s && s.id === id && s.n < def.stack) {
          const k = Math.min(def.stack - s.n, n);
          s.n += k;
          n -= k;
        }
      }
      for (let i = 0; i < SLOTS && n > 0; i++) {
        if (!this.inv[i]) {
          const k = Math.min(def.stack, n);
          this.inv[i] = { id, n: k };
          n -= k;
        }
      }
      this.refreshItems();
      return n;
    },

    removeItem(id, n = 1) {
      for (let i = SLOTS - 1; i >= 0 && n > 0; i--) {
        const s = this.inv[i];
        if (s && s.id === id) {
          const k = Math.min(s.n, n);
          s.n -= k;
          n -= k;
          if (!s.n) this.inv[i] = null;
        }
      }
      this.refreshItems();
    },

    // Donne un objet au joueur avec un petit retour visuel
    giveItem(id, n, x, y) {
      const left = this.addItem(id, n);
      if (left > 0) this.toast('Inventaire plein : des objets sont perdus');
      if (x !== undefined) this.floatText(x, y, `+${n - left} ${ITEMS[id].name}`, '#9ef0ff');
      return left;
    },

    selectedStack() {
      return this.inv[this.sel];
    },

    // Meilleur équipement possédé (utilisé automatiquement)
    bestTool(kind) {
      let best = null;
      this.inv.forEach((s) => {
        if (!s) return;
        const it = ITEMS[s.id];
        if (it.tool !== kind) return;
        if (!best || (kind === 'pick' ? it.tier > best.tier : it.dmg > best.dmg)) best = it;
      });
      return best;
    },

    bestArmor() {
      let best = null;
      this.inv.forEach((s) => {
        const it = s && ITEMS[s.id];
        if (it && it.armor && (!best || it.armor > best.armor)) best = it;
      });
      return best;
    },

    pickTier() {
      const p = this.bestTool('pick');
      return p ? p.tier : 0;
    },

    nearStation(station) {
      const block = station === 'bench' ? B.BENCH : B.FURNACE;
      const px = Math.floor(this.player.x / ZC.T);
      const py = Math.floor(this.player.y / ZC.T);
      for (let y = py - 4; y <= py + 4; y++) {
        for (let x = px - 4; x <= px + 4; x++) if (this.getB(x, y) === block) return true;
      }
      return false;
    },

    canCraft(r) {
      return (!r.station || this.nearStation(r.station)) && r.cost.every(([id, n]) => this.countItem(id) >= n);
    },

    craft(r, times = 1) {
      let made = 0;
      for (let k = 0; k < times; k++) {
        if (!this.canCraft(r) || !this.canFit(r.out, r.n)) break;
        r.cost.forEach(([id, n]) => this.removeItem(id, n));
        this.addItem(r.out, r.n);
        made++;
      }
      if (made) {
        this.toast(`Fabriqué : ${ITEMS[r.out].name} ×${r.n * made}`);
        this.burst(this.player.x, this.player.y - 10, 0xffe066, 8);
      } else if (!r.station || this.nearStation(r.station)) {
        this.toast(this.canFit(r.out, r.n) ? 'Ressources insuffisantes' : 'Inventaire plein');
      } else {
        this.toast(`Il faut être près d'un ${ZC.STATION_NAMES[r.station].toLowerCase()}`);
      }
      return made;
    },

    // Raccourci historique : C transforme 1 bois en 4 planches
    quickPlanks() {
      if (!this.countItem('log')) {
        this.toast('Il faut du bois pour fabriquer des planches');
        return;
      }
      this.craft(ZC.RECIPES[0]);
    },

    // --- Barre rapide ---
    buildHotbar() {
      const { width: w, height: h } = this.scale;
      const total = HOTBAR * STEP - (STEP - SLOT);
      const y = h - 30;
      this.hotbarRect = new Phaser.Geom.Rectangle((w - total) / 2 - 4, y - SLOT / 2 - 4, total + 8, SLOT + 8);
      this.hotbarSlots = [];
      for (let i = 0; i < HOTBAR; i++) {
        const x = (w - total) / 2 + SLOT / 2 + i * STEP;
        const bg = this.add.rectangle(x, y, SLOT, SLOT, 0x111327, 0.78).setScrollFactor(0).setDepth(100);
        bg.setInteractive().on('pointerdown', (p, lx, ly, e) => {
          e.stopPropagation();
          if (this.uiOpen) this.clickSlot(i, p.rightButtonDown());
          else this.select(i);
        });
        const icon = this.add.image(x, y, 'zc-tiles', 'b1').setScale(1.25).setScrollFactor(0).setDepth(101).setVisible(false);
        const count = text(this, x + SLOT / 2 - 3, y + SLOT / 2 - 1, '', 13).setOrigin(1, 1).setDepth(102);
        const key = text(this, x - SLOT / 2 + 3, y - SLOT / 2 + 1, String(i + 1), 10, '#9ea2cc').setDepth(102);
        this.hotbarSlots.push({ bg, icon, count, key });
      }
      this.refreshHotbar();
    },

    setSlotVisual(slot, stack) {
      if (stack) {
        const ic = ZC.itemIcon(stack.id);
        slot.icon.setTexture(ic.key, ic.frame).setVisible(true);
        slot.count.setText(stack.n > 1 ? String(stack.n) : '');
      } else {
        slot.icon.setVisible(false);
        slot.count.setText('');
      }
    },

    refreshHotbar() {
      if (!this.hotbarSlots) return;
      this.hotbarSlots.forEach((slot, i) => {
        this.setSlotVisual(slot, this.inv[i]);
        const on = i === this.sel;
        slot.bg.setStrokeStyle(on ? 3 : 2, on ? 0xffffff : 0x4a4f80);
        slot.bg.setFillStyle(on ? 0x2a2f5c : 0x111327, 0.8);
      });
    },

    refreshItems() {
      this.refreshHotbar();
      if (this.uiOpen) this.refreshInventory();
      this.equipDirty = true;
    },

    select(i) {
      this.sel = Phaser.Math.Wrap(i, 0, HOTBAR);
      this.refreshHotbar();
      const s = this.inv[this.sel];
      this.toast(s ? `${ITEMS[s.id].name}${s.n > 1 ? ' (' + s.n + ')' : ''}` : 'Case vide');
    },

    // --- Inventaire complet (touche E) ---
    buildInventoryUI() {
      const { width: w, height: h } = this.scale;
      const ui = [];
      const add = (o) => {
        ui.push(o);
        return o.setScrollFactor(0).setVisible(false);
      };
      const px = 120;
      const py = 64;
      const pw = 720;
      const ph = 448;
      this.invPanelRect = new Phaser.Geom.Rectangle(px, py, pw, ph);
      const shade = add(this.add.rectangle(0, 0, w, h, 0x05060f, 0.55).setOrigin(0).setDepth(200).setInteractive());
      shade.on('pointerdown', (p, lx, ly, e) => {
        e.stopPropagation();
        if (!Phaser.Geom.Rectangle.Contains(this.invPanelRect, p.x, p.y)) this.closeInventory();
      });
      const g = add(this.add.graphics().setDepth(201));
      g.fillStyle(0x161935, 0.97).fillRect(px, py, pw, ph);
      g.lineStyle(3, 0x6c63ff, 1).strokeRect(px, py, pw, ph);
      g.lineStyle(1, 0x2c3060, 1).strokeRect(px + 6, py + 6, pw - 12, ph - 12);
      g.fillStyle(0x0f1128, 1).fillRect(586, py + 40, 238, ph - 56);
      add(text(this, px + 20, py + 12, 'Inventaire', 20, '#ffffff', { fontStyle: 'bold' }).setDepth(202));
      add(text(this, 596, py + 12, 'Fabrication', 20, '#ffffff', { fontStyle: 'bold' }).setDepth(202));

      // Cases : 3 rangées d'inventaire puis la barre rapide
      this.invSlots = [];
      for (let i = 0; i < SLOTS; i++) {
        const row = i < HOTBAR ? 3 : Math.floor((i - HOTBAR) / 9);
        const col = i < HOTBAR ? i : (i - HOTBAR) % 9;
        const x = px + 20 + SLOT / 2 + col * STEP;
        const y = py + 64 + SLOT / 2 + row * STEP + (i < HOTBAR ? 12 : 0);
        const bg = add(this.add.rectangle(x, y, SLOT, SLOT, 0x22264a, 1).setDepth(202).setStrokeStyle(2, 0x3a3f78));
        bg.setInteractive().on('pointerdown', (p, lx, ly, e) => {
          e.stopPropagation();
          this.clickSlot(i, p.rightButtonDown());
        });
        bg.on('pointerover', () => this.showItemInfo(this.inv[i]));
        const icon = add(this.add.image(x, y, 'zc-tiles', 'b1').setScale(1.25).setDepth(203));
        const count = add(text(this, x + SLOT / 2 - 3, y + SLOT / 2 - 1, '', 13).setOrigin(1, 1).setDepth(204));
        this.invSlots.push({ bg, icon, count });
      }
      add(text(this, px + 20, py + 64 + 3 * STEP - 5, 'Barre rapide', 11, '#9ea2cc').setDepth(202));

      this.invEquip = add(text(this, px + 20, py + 300, '', 14, '#d6d8f5', { lineSpacing: 6 }).setDepth(202));
      this.invInfo = add(text(this, px + 20, py + 372, '', 13, '#ffe066', { wordWrap: { width: 440 } }).setDepth(202));

      // Boutons
      const button = (x, y, label, color, onClick) => {
        const b = add(text(this, x, y, label, 15, '#ffffff', { backgroundColor: color, padding: { x: 10, y: 5 }, strokeThickness: 0 })
          .setOrigin(0, 0.5).setDepth(203).setInteractive({ useHandCursor: true }));
        b.on('pointerdown', (p, lx, ly, e) => {
          e.stopPropagation();
          onClick(b);
        });
        return b;
      };
      button(px + 20, py + ph - 26, 'Fermer (E)', '#3a3f78', () => this.closeInventory());
      this.newWorldBtn = button(px + 140, py + ph - 26, 'Nouveau monde', '#7a2a3a', (b) => {
        if (this.newWorldArmed) {
          this.newWorld();
          return;
        }
        this.newWorldArmed = true;
        b.setText('Confirmer : tout effacer ?');
        this.time.delayedCall(3000, () => {
          this.newWorldArmed = false;
          if (b.active) b.setText('Nouveau monde');
        });
      });

      // Liste des recettes (défilement à la molette)
      this.recipeRows = [];
      for (let k = 0; k < VISIBLE_ROWS; k++) {
        const y = py + 50 + k * ROW_H;
        const bg = add(this.add.rectangle(592, y, 226, ROW_H - 4, 0x22264a, 1).setOrigin(0).setDepth(202));
        bg.setInteractive({ useHandCursor: true }).on('pointerdown', (p, lx, ly, e) => {
          e.stopPropagation();
          const r = this.recipeOrder[this.recipeScroll + k];
          if (r) this.craft(r, p.event.shiftKey ? 10 : 1);
        });
        bg.on('pointerover', () => {
          const r = this.recipeOrder[this.recipeScroll + k];
          if (r) this.showItemInfo({ id: r.out, n: r.n }, r);
        });
        const icon = add(this.add.image(608, y + (ROW_H - 4) / 2, 'zc-tiles', 'b1').setDepth(203));
        const name = add(text(this, 624, y + 2, '', 13, '#ffffff').setDepth(203));
        const cost = add(text(this, 624, y + 18, '', 10, '#9ea2cc').setDepth(203));
        this.recipeRows.push({ bg, icon, name, cost });
      }
      this.recipeHint = add(text(this, 596, py + ph - 26, 'Clic : fabriquer · Maj+clic : ×10', 11, '#9ea2cc').setOrigin(0, 0.5).setDepth(202));

      // Objet tenu par le curseur
      this.heldIcon = add(this.add.image(0, 0, 'zc-tiles', 'b1').setScale(1.3).setDepth(260));
      this.heldCount = add(text(this, 0, 0, '', 13).setOrigin(1, 1).setDepth(261));
      this.invUi = ui;
      this.uiOpen = false;
    },

    toggleInventory() {
      if (this.uiOpen) this.closeInventory();
      else this.openInventory();
    },

    openInventory() {
      if (this.dead || this.uiOpen) return;
      this.uiOpen = true;
      this.mining = null;
      this.recipeScroll = 0;
      this.invUi.forEach((o) => o.setVisible(true));
      this.refreshInventory();
    },

    closeInventory() {
      if (!this.uiOpen) return;
      if (this.cursorStack) {
        this.addItem(this.cursorStack.id, this.cursorStack.n);
        this.cursorStack = null;
      }
      this.uiOpen = false;
      this.invUi.forEach((o) => o.setVisible(false));
      this.refreshHotbar();
    },

    clickSlot(i, right) {
      const s = this.inv[i];
      const h = this.cursorStack;
      if (right) {
        // Clic droit : prendre la moitié, ou déposer un seul objet
        if (!h && s) {
          const k = Math.ceil(s.n / 2);
          this.cursorStack = { id: s.id, n: k };
          s.n -= k;
          if (!s.n) this.inv[i] = null;
        } else if (h && (!s || (s.id === h.id && s.n < ITEMS[s.id].stack))) {
          if (s) s.n++;
          else this.inv[i] = { id: h.id, n: 1 };
          h.n--;
          if (!h.n) this.cursorStack = null;
        }
      } else if (!h) {
        this.cursorStack = s;
        this.inv[i] = null;
      } else if (!s) {
        this.inv[i] = h;
        this.cursorStack = null;
      } else if (s.id === h.id && ITEMS[s.id].stack > 1) {
        const k = Math.min(ITEMS[s.id].stack - s.n, h.n);
        s.n += k;
        h.n -= k;
        if (!h.n) this.cursorStack = null;
      } else {
        this.inv[i] = h;
        this.cursorStack = s;
      }
      this.refreshItems();
    },

    showItemInfo(stack, recipe) {
      if (!this.invInfo) return;
      if (!stack) {
        this.invInfo.setText('');
        return;
      }
      const it = ITEMS[stack.id];
      let info = it.name;
      if (it.tool === 'pick') info += ` — niveau ${it.tier}, vitesse ×${it.speed}`;
      if (it.tool === 'sword') info += ` — ${it.dmg} dégâts${it.purify ? ', ×2 contre la corruption' : ''}`;
      if (it.armor) info += ` — réduit les dégâts de ${Math.round(it.armor * 100)} %`;
      if (it.heal) info += ` — rend ${it.heal / 2} cœurs (clic droit pour boire)`;
      if (it.block !== undefined) info += ' — clic droit pour poser';
      if (stack.id === 'fragment') info += ` — ${ZC.FRAGMENTS_NEEDED} sont nécessaires pour éveiller le noyau`;
      if (recipe) {
        info += '\nCoût : ' + recipe.cost.map(([id, n]) => `${n} ${ITEMS[id].name}`).join(', ');
        if (recipe.station) info += ` · ${ZC.STATION_NAMES[recipe.station]} à proximité`;
      }
      this.invInfo.setText(info);
    },

    refreshInventory() {
      this.invSlots.forEach((slot, i) => {
        this.setSlotVisual(slot, this.inv[i]);
        slot.bg.setStrokeStyle(2, i === this.sel ? 0xffffff : 0x3a3f78);
      });
      const pick = this.bestTool('pick');
      const sword = this.bestTool('sword');
      const armor = this.bestArmor();
      this.invEquip.setText([
        `Pioche : ${pick ? pick.name.replace('Pioche ', '') + ' (niveau ' + pick.tier + ')' : 'aucune (mains nues)'}`,
        `Épée : ${sword ? sword.name.replace('Épée ', '') + ' (' + sword.dmg + ' dégâts)' : 'aucune (2 dégâts)'}` +
          `   ·   Armure : ${armor ? armor.name.replace('Armure ', '') : 'aucune'}`,
        `Fragments anciens : ${this.countItem('fragment')} / ${ZC.FRAGMENTS_NEEDED}   ·   Cœurs max : ${this.maxHp / 2}`,
      ].join('\n'));

      // Recettes réalisables d'abord, puis celles dont on possède déjà un ingrédient
      const score = (r) => (this.canCraft(r) ? 0 : r.cost.some(([id]) => this.countItem(id) > 0) ? 1 : 2);
      this.recipeOrder = ZC.RECIPES.slice().sort((a, b) => score(a) - score(b));
      const maxScroll = Math.max(0, this.recipeOrder.length - VISIBLE_ROWS);
      this.recipeScroll = Phaser.Math.Clamp(this.recipeScroll, 0, maxScroll);
      this.recipeRows.forEach((row, k) => {
        const r = this.recipeOrder[this.recipeScroll + k];
        const ok = r && this.canCraft(r);
        row.bg.setFillStyle(ok ? 0x23533a : 0x22264a, 1);
        if (!r) return;
        const ic = ZC.itemIcon(r.out);
        row.icon.setTexture(ic.key, ic.frame);
        row.name.setText(`${ITEMS[r.out].name}${r.n > 1 ? ' ×' + r.n : ''}`).setColor(ok ? '#ffffff' : '#9ea2cc');
        const cost = r.cost.map(([id, n]) => `${n} ${ITEMS[id].name}`).join(', ');
        row.cost.setText(cost.length > 34 ? cost.slice(0, 33) + '…' : cost);
      });
      this.recipeHint.setText(`Clic : fabriquer · Maj+clic : ×10   ${this.recipeScroll + 1}-${Math.min(this.recipeOrder.length, this.recipeScroll + VISIBLE_ROWS)}/${this.recipeOrder.length}`);
    },

    scrollRecipes(dir) {
      this.recipeScroll += dir;
      this.refreshInventory();
    },

    updateHeldIcon() {
      if (!this.uiOpen) return;
      const p = this.input.activePointer;
      if (this.cursorStack) {
        const ic = ZC.itemIcon(this.cursorStack.id);
        this.heldIcon.setTexture(ic.key, ic.frame).setPosition(p.x, p.y).setVisible(true);
        this.heldCount.setText(this.cursorStack.n > 1 ? String(this.cursorStack.n) : '').setPosition(p.x + 20, p.y + 20).setVisible(true);
      } else {
        this.heldIcon.setVisible(false);
        this.heldCount.setVisible(false);
      }
    },

    // Pénalité de mort : la moitié des ressources est perdue (outils et objets uniques conservés)
    deathPenalty() {
      this.inv.forEach((s, i) => {
        if (!s) return;
        const it = ITEMS[s.id];
        if (it.tool || it.armor || s.id === 'fragment') return;
        s.n = Math.ceil(s.n / 2);
        if (!s.n) this.inv[i] = null;
      });
    },
  };
})();
