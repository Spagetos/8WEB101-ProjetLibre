/* Z-Craft — sauvegarde de la progression dans localStorage (via ZG.save / ZG.load) */

window.ZC = window.ZC || {};

(function () {
  const { W, H } = ZC;
  const SIZE = W * H;
  const isInt = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
  const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

  // Blocs modifiés : « index.id » en base 36, séparés par des virgules
  const encodeDiff = (map) => Array.from(map, ([i, id]) => i.toString(36) + '.' + id.toString(36)).join(',');
  const decodeDiff = (str) => {
    const out = [];
    if (!str) return out;
    str.split(',').forEach((part) => {
      const [a, b] = part.split('.');
      const i = parseInt(a, 36);
      const id = parseInt(b, 36);
      if (!isInt(i, 0, SIZE - 1) || !isInt(id, 0, ZC.BLOCKS.length - 1)) throw new Error('bloc invalide');
      out.push([i, id]);
    });
    return out;
  };

  ZC.SaveMixin = {
    // Lit et valide la sauvegarde ; retourne null si absente ou illisible
    loadSave() {
      const data = ZG.load(ZC.SAVE_KEY, null);
      if (!data) {
        // Présente mais illisible (JSON abîmé) : on la signale et on repart d'un nouveau monde
        if (ZG.has(ZC.SAVE_KEY)) {
          this.saveError = true;
          ZG.remove(ZC.SAVE_KEY);
        }
        return null;
      }
      try {
        if (data.v !== ZC.SAVE_VERSION) throw new Error('version');
        if (!isInt(data.seed, 0, 2 ** 31)) throw new Error('graine');
        if (!Array.isArray(data.inv) || data.inv.length !== 36) throw new Error('inventaire');
        if (!data.player || !isNum(data.player.x) || !isNum(data.player.y)) throw new Error('joueur');
        data.diffList = decodeDiff(data.diff);
        return data;
      } catch (e) {
        this.saveError = true;
        ZG.remove(ZC.SAVE_KEY);
        return null;
      }
    },

    // Applique les modifications du monde avant la construction du Tilemap
    applySaveWorld(save) {
      save.diffList.forEach(([i, id]) => {
        this.grid[i] = id;
        this.diff.set(i, id);
      });
      (save.looted || []).forEach((i) => {
        this.chests.delete(i);
        this.looted.add(i);
      });
      (save.placed || []).forEach((i) => { if (isInt(i, 0, SIZE - 1)) this.placed.add(i); });
    },

    applySaveState(save) {
      save.inv.forEach((s, i) => {
        if (Array.isArray(s) && ZC.ITEMS[s[0]] && isInt(s[1], 1, 999)) this.inv[i] = { id: s[0], n: Math.min(s[1], ZC.ITEMS[s[0]].stack) };
      });
      this.sel = isInt(save.sel, 0, 8) ? save.sel : 0;
      this.score = isInt(save.score, 0, 1e9) ? save.score : 0;
      this.clock = isNum(save.clock) ? save.clock : this.clock;
      this.nights = isInt(save.nights, 0, 1e6) ? save.nights : 0;
      this.maxHp = isInt(save.maxHp, 20, 40) ? save.maxHp : 20;
      this.hp = isInt(save.player.hp, 1, this.maxHp) ? save.player.hp : this.maxHp;
      this.bosses = { golem: !!(save.bosses && save.bosses.golem), king: !!(save.bosses && save.bosses.king) };
      this.coreActive = !!save.core;
      const spawned = new Set(save.spawned || []);
      const found = new Set(save.found || []);
      this.structures.forEach((s) => {
        s.spawned = spawned.has(s.id);
        s.found = found.has(s.id);
      });
      (save.machines || []).forEach((m) => {
        if (!Array.isArray(m)) return;
        const st = this.machines.get(m[0]);
        if (!st) return;
        st.fuel = isNum(m[1]) ? Math.max(0, Math.min(ZC.GEN_MAX_FUEL, m[1])) : 0;
        st.depth = isInt(m[2], 1, 99) ? m[2] : 1;
        if (m[3] && typeof m[3] === 'object') {
          Object.keys(m[3]).forEach((id) => { if (ZC.ITEMS[id] && isInt(m[3][id], 1, 999)) st.buffer[id] = m[3][id]; });
        }
      });
      if (Array.isArray(save.instab) && save.instab.length === this.instab.length) {
        save.instab.forEach((v, i) => { this.instab[i] = isNum(v) ? Math.max(0, Math.min(60, v)) : 0; });
      }
      if (save.base && isInt(save.base.x, 0, W - 1) && isInt(save.base.y, 0, H - 1)) this.basePos = save.base;
    },

    writeSave(opts = {}) {
      if (this.skipSave || !this.player) return true;
      const pos = opts.respawn
        ? { x: (this.spawnPos.x + 0.5) * ZC.T, y: this.spawnPos.y * ZC.T - 23 }
        : { x: Math.round(this.player.x), y: Math.round(this.player.y) };
      const data = {
        v: ZC.SAVE_VERSION,
        seed: this.seed,
        diff: encodeDiff(this.diff),
        placed: Array.from(this.placed).slice(-4000),
        looted: Array.from(this.looted),
        inv: this.inv.map((s) => (s ? [s.id, s.n] : 0)),
        sel: this.sel,
        player: { x: pos.x, y: pos.y, hp: opts.respawn ? this.maxHp : Math.max(1, this.hp) },
        maxHp: this.maxHp,
        score: this.score,
        clock: Math.round(this.clock * 10) / 10,
        nights: this.nights,
        bosses: this.bosses,
        core: this.coreActive,
        spawned: this.structures.filter((s) => s.spawned).map((s) => s.id),
        found: this.structures.filter((s) => s.found).map((s) => s.id),
        machines: Array.from(this.machines, ([i, m]) => [i, Math.round(m.fuel), m.depth, m.buffer]),
        instab: Array.from(this.instab, (v) => Math.round(v)),
        base: this.basePos || null,
      };
      let ok = ZG.save(ZC.SAVE_KEY, data);
      if (!ok) {
        // Stockage presque plein : on retente sans les données secondaires
        data.placed = [];
        data.instab = [];
        ok = ZG.save(ZC.SAVE_KEY, data);
      }
      if (!ok && !this.saveWarned) {
        this.saveWarned = true;
        this.toast('Sauvegarde impossible : stockage du navigateur plein ou indisponible');
      }
      if (this.score > 0) ZG.submit(this.score);
      return ok;
    },

    newWorld() {
      ZG.remove(ZC.SAVE_KEY);
      this.skipSave = true;
      this.scene.restart();
    },
  };
})();
