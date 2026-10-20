import { BUILDINGS, BUILDING_CATEGORIES, BUILDING_MAP } from '../../../data/buildings.js';
import { RECIPES, recipeRates } from '../../../data/recipes.js';
import { RESOURCE_MAP } from '../../../data/resources.js';
import { UPGRADES } from '../../../data/upgrades.js';
import { h, setText, setClass, clear } from '../dom.js';
import { icon } from '../Icons.js';
import { costView, shortfallText } from '../components.js';
import { formatNumber } from '../../utils/Formatter.js';

const BUY_MODES = [
  { id: '1', label: 'x1' },
  { id: '10', label: 'x10' },
  { id: 'next', label: 'Do progu' },
  { id: 'max', label: 'Maks.' },
];

export class ProductionScreen {
  constructor(ui) {
    this.ui = ui;
    this.game = ui.game;
    this.id = 'production';
    this.title = 'Produkcja';
    this.cards = new Map();
    this.upgradeCards = new Map();
    this.signature = '';
    this.el = this.build();
  }

  build() {
    this.modeButtons = new Map();
    const modes = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': 'Tryb zakupu' });
    for (const m of BUY_MODES) {
      const b = h('button', { class: 'seg', role: 'radio', dataset: { action: 'mode', mode: m.id }, text: m.label });
      modes.append(b);
      this.modeButtons.set(m.id, b);
    }
    this.list = h('div', { class: 'card-sections' });
    const root = h('div', { class: 'screen screen-production' }, [
      h('div', { class: 'screen-toolbar' }, [h('h1', { text: 'Produkcja' }), modes]),
      this.list,
    ]);
    // One delegated listener for every button on this screen.
    root.addEventListener('click', (e) => {
      const target = e.target.closest('[data-action]');
      if (!target || target.disabled) return;
      const { action, id, mode } = target.dataset;
      if (action === 'mode') this.game.setBuyMode(mode);
      if (action === 'buy') this.buyBuilding(id);
      if (action === 'upgrade') this.buyUpgrade(id);
      if (action === 'autobuy') this.game.setAutobuy(id, !this.game.automation.isEnabled(id));
      this.update();
    });
    return root;
  }

  buyBuilding(id) {
    const n = this.game.buyBuilding(id);
    if (n > 0) this.ui.flash(this.cards.get(id)?.card);
  }

  buyUpgrade(id) {
    if (this.game.buyUpgrade(id)) {
      this.ui.notify(`Ulepszenie aktywne: ${UPGRADES.find((u) => u.id === id).name}`, 'success');
    }
  }

  // Which cards are shown: unlocked buildings + the first locked one per
  // category (as a preview with requirements); visible upgrades.
  currentSignature() {
    const g = this.game;
    const b = BUILDINGS.map((x) => (g.buildings.isUnlocked(x.id) ? '1' : '0')).join('');
    const u = g.upgrades.visible().map((x) => x.id + (g.upgrades.isOwned(x.id) ? '+' : '')).join(',');
    return b + '|' + u;
  }

  rebuild() {
    clear(this.list);
    this.cards.clear();
    this.upgradeCards.clear();
    const g = this.game;
    // One flowing grid (ordered by category) uses landscape width better
    // than a row per category.
    const grid = h('div', { class: 'card-grid' });
    for (const cat of Object.keys(BUILDING_CATEGORIES)) {
      const inCat = BUILDINGS.filter((b) => b.category === cat);
      const shown = inCat.filter((b) => g.buildings.isUnlocked(b.id));
      const firstLocked = inCat.find((b) => !g.buildings.isUnlocked(b.id));
      if (firstLocked) shown.push(firstLocked);
      for (const b of shown) grid.append(this.buildingCard(b));
    }
    this.list.append(h('section', { class: 'card-section' }, [h('h2', { class: 'section-title', text: 'Budynki' }), grid]));
    const ups = g.upgrades.visible();
    if (ups.length) {
      const grid = h('div', { class: 'card-grid' });
      // Unowned first, owned at the end.
      for (const u of [...ups].sort((a, b) => g.upgrades.isOwned(a.id) - g.upgrades.isOwned(b.id))) grid.append(this.upgradeCard(u));
      this.list.append(h('section', { class: 'card-section' }, [h('h2', { class: 'section-title', text: 'Ulepszenia' }), grid]));
    }
  }

  buildingCard(def) {
    const level = h('span', { class: 'badge' });
    const effect = h('div', { class: 'card-effect' });
    const efficiency = h('div', { class: 'card-warning', hidden: true });
    const requirements = h('ul', { class: 'card-req' });
    const cost = costView(this.game);
    const note = h('div', { class: 'card-note' });
    const btnLabel = h('span');
    const button = h('button', { class: 'btn btn-primary card-btn', dataset: { action: 'buy', id: def.id } }, [btnLabel]);
    const auto = h('button', { class: 'chip auto-chip', dataset: { action: 'autobuy', id: def.id }, hidden: true, title: 'Automatyczny zakup' }, [icon('auto', 'icon icon-sm'), 'Auto']);
    const card = h('article', { class: 'card', dataset: { building: def.id } }, [
      h('header', { class: 'card-head' }, [icon(def.icon, 'icon card-icon'), h('div', { class: 'card-titles' }, [h('span', { class: 'eyebrow', text: BUILDING_CATEGORIES[def.category] }), h('h3', { text: def.name }), level])]),
      h('p', { class: 'card-desc', text: def.description }),
      effect, efficiency, requirements,
      h('footer', { class: 'card-foot' }, [cost.el, h('div', { class: 'card-actions' }, [auto, button])]),
      note,
    ]);
    this.cards.set(def.id, { card, level, effect, efficiency, requirements, cost, note, button, btnLabel, auto });
    return card;
  }

  upgradeCard(def) {
    const cost = costView(this.game);
    const note = h('div', { class: 'card-note' });
    const button = h('button', { class: 'btn btn-primary card-btn', dataset: { action: 'upgrade', id: def.id } });
    const card = h('article', { class: 'card card-upgrade' }, [
      h('header', { class: 'card-head' }, [icon(def.icon, 'icon card-icon'), h('div', { class: 'card-titles' }, [h('h3', { text: def.name })])]),
      h('p', { class: 'card-desc', text: def.description }),
      h('footer', { class: 'card-foot' }, [cost.el, button]),
      note,
    ]);
    this.upgradeCards.set(def.id, { card, cost, note, button });
    return card;
  }

  effectText(def) {
    const g = this.game;
    if (!def.recipe) {
      const capAdd = def.effects?.find((e) => e.type === 'capAdd');
      return capAdd ? `Magazyny: +${Math.round(capAdd.value * 100)}% bazowej pojemności na poziom` : '';
    }
    const rates = recipeRates(RECIPES[def.recipe]);
    const lvl = Math.max(1, g.buildings.level(def.id));
    const mult = g.modifiers.buildingMultiplier(def.id) * g.buildings.milestoneMultiplier(def.id) * g.modifiers.globalProductionMultiplier();
    const out = Object.entries(rates.outputs).map(([r, v]) => `+${formatNumber(v * lvl * mult)} ${RESOURCE_MAP[r].name}`);
    const inp = Object.entries(rates.inputs).map(([r, v]) => `-${formatNumber(v * lvl)} ${RESOURCE_MAP[r].name}`);
    const prefix = g.buildings.level(def.id) > 0 ? 'Łącznie' : 'Na poziom';
    return `${prefix}/s: ${[...out, ...inp].join(', ')}`;
  }

  update() {
    const sig = this.currentSignature();
    if (sig !== this.signature) {
      this.signature = sig;
      this.rebuild();
    }
    const g = this.game;
    const mode = g.state.settings.buyMode;
    for (const [id, b] of this.modeButtons) {
      setClass(b, 'active', id === mode);
      b.setAttribute('aria-checked', String(id === mode));
    }
    for (const [id, c] of this.cards) this.updateBuildingCard(BUILDING_MAP[id], c, mode);
    for (const [id, c] of this.upgradeCards) this.updateUpgradeCard(id, c);
  }

  updateBuildingCard(def, c, mode) {
    const g = this.game;
    const unlocked = g.buildings.isUnlocked(def.id);
    setClass(c.card, 'locked', !unlocked);
    if (!unlocked) {
      c.auto.hidden = true;
      setText(c.level, 'Zablokowany');
      const missing = g.buildings.unlockStatus(def.id).missing;
      const sig = missing.join('|');
      if (c.requirements.dataset.sig !== sig) {
        c.requirements.dataset.sig = sig;
        clear(c.requirements);
        missing.forEach((m) => c.requirements.append(h('li', {}, [icon('lock', 'icon icon-sm'), m])));
      }
      c.cost.update(def.baseCost);
      c.button.disabled = true;
      c.button.className = 'btn card-btn btn-locked';
      setText(c.btnLabel, 'Zablokowany');
      setText(c.note, '');
      setText(c.effect, this.effectText(def));
      return;
    }
    if (c.requirements.childElementCount) { clear(c.requirements); c.requirements.dataset.sig = ''; }
    c.auto.hidden = !g.automation.available();
    if (!c.auto.hidden) {
      const on = g.automation.isEnabled(def.id);
      setClass(c.auto, 'active', on);
      c.auto.setAttribute('aria-pressed', String(on));
    }
    const level = g.buildings.level(def.id);
    const next = g.buildings.nextMilestone(def.id);
    setText(c.level, `Poziom ${level}${next ? ` · próg ${next}` : ''}`);
    setText(c.effect, this.effectText(def));
    const eff = g.production.lastReport.efficiency[def.id];
    const throttled = eff !== undefined && eff < 0.999;
    c.efficiency.hidden = !throttled;
    if (throttled) setText(c.efficiency, `Wydajność ${Math.round(eff * 100)}% — brak surowców wejściowych`);

    const count = g.buildings.countForMode(def.id, mode);
    const cost = g.buildings.cost(def.id, count);
    c.cost.update(cost);
    const affordable = g.resources.canAfford(cost);
    c.button.disabled = !affordable;
    c.button.className = `btn card-btn ${affordable ? 'btn-primary' : 'btn-unavailable'}`;
    setText(c.btnLabel, level === 0 ? `Zbuduj${count > 1 ? ` x${count}` : ''}` : `Rozbuduj x${count}`);
    setText(c.note, affordable ? '' : shortfallText(g, cost));
  }

  updateUpgradeCard(id, c) {
    const g = this.game;
    const def = UPGRADES.find((u) => u.id === id);
    const owned = g.upgrades.isOwned(id);
    setClass(c.card, 'owned', owned);
    if (owned) {
      c.cost.el.hidden = true;
      c.button.disabled = true;
      c.button.className = 'btn card-btn btn-done';
      setText(c.button, 'Aktywne');
      setText(c.note, '');
      return;
    }
    c.cost.update(def.cost);
    const affordable = g.resources.canAfford(def.cost);
    c.button.disabled = !affordable;
    c.button.className = `btn card-btn ${affordable ? 'btn-primary' : 'btn-unavailable'}`;
    setText(c.button, 'Kup');
    setText(c.note, affordable ? '' : shortfallText(g, def.cost));
  }
}
