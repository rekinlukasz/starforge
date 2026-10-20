import { SHIPS, SHIP_MAP, SHIP_ROLES, SHIP_UPGRADE } from '../../../data/ships.js';
import { PLANET_MAP } from '../../../data/planets.js';
import { RESOURCES, RESOURCE_MAP } from '../../../data/resources.js';
import { h, setText, setClass, clear } from '../dom.js';
import { icon } from '../Icons.js';
import { costView, shortfallText } from '../components.js';
import { formatDuration, formatNumber } from '../../utils/Formatter.js';
import { STATION, MIN_INTERVAL } from '../../systems/LogisticsSystem.js';

export class FleetScreen {
  constructor(ui) {
    this.ui = ui;
    this.game = ui.game;
    this.id = 'fleet';
    this.title = 'Flota';
    this.shipCards = new Map();
    this.sigs = {};
    this.el = this.build();
  }

  build() {
    this.yardNote = h('p', { class: 'muted' });
    this.queueEl = h('div', { class: 'queue' });
    this.shipGrid = h('div', { class: 'card-grid' });
    this.routesEl = h('div', { class: 'route-list' });
    this.routeForm = h('div', { class: 'route-form' });
    this.logisticsSection = h('section', { class: 'card-section' }, [
      h('h2', { class: 'section-title', text: 'Trasy logistyczne' }), this.routeForm, this.routesEl,
    ]);
    const retreat = h('select', { class: 'input', 'aria-label': 'Próg odwrotu' });
    for (const v of [0.25, 0.5, 0.75]) {
      const o = h('option', { value: String(v), text: `Odwrót przy ${Math.round(v * 100)}% kadłuba` });
      if (v === (this.game.state.settings.retreatAt ?? 0.5)) o.selected = true;
      retreat.append(o);
    }
    retreat.addEventListener('change', () => this.game.setRetreatThreshold(retreat.value));
    this.militaryNote = h('div', { class: 'toolbar-group' }, [retreat]);

    const root = h('div', { class: 'screen screen-fleet' }, [
      h('div', { class: 'screen-toolbar' }, [h('h1', { text: 'Flota' }), this.militaryNote]),
      h('section', { class: 'panel' }, [h('h2', { class: 'panel-title', text: 'Stocznia' }), this.yardNote, this.queueEl]),
      h('section', { class: 'card-section' }, [h('h2', { class: 'section-title', text: 'Statki' }), this.shipGrid]),
      this.logisticsSection,
    ]);
    root.addEventListener('click', (e) => {
      const t = e.target.closest('[data-action]');
      if (!t || t.disabled) return;
      const { action, id, count } = t.dataset;
      if (action === 'build' && this.game.buildShip(id, Number(count))) this.ui.notify(`Zamówiono: ${SHIP_MAP[id].name} x${count}`, 'success');
      if (action === 'cancel') this.game.cancelShip(t.dataset.index);
      if (action === 'upgrade' && this.game.upgradeShip(id)) this.ui.notify(`Ulepszono: ${SHIP_MAP[id].name}`, 'success');
      if (action === 'repair') this.game.repairShip(id);
      if (action === 'route-toggle') this.game.setRouteActive(id, t.dataset.on === '1');
      if (action === 'route-delete') this.game.deleteRoute(id);
      this.update();
    });
    return root;
  }

  rebuildShips() {
    const g = this.game;
    clear(this.shipGrid);
    this.shipCards.clear();
    for (const s of SHIPS) {
      const unlocked = g.fleet.isUnlocked(s.id);
      if (!unlocked && g.fleet.owned(s.id) === 0) continue;
      const counts = h('span', { class: 'badge' });
      const stats = h('p', { class: 'muted' });
      const cost = costView(g);
      const note = h('div', { class: 'card-note' });
      const b1 = h('button', { class: 'btn btn-sm btn-primary', dataset: { action: 'build', id: s.id, count: '1' }, text: 'Zbuduj' });
      const b5 = h('button', { class: 'btn btn-sm btn-ghost', dataset: { action: 'build', id: s.id, count: '5' }, text: 'x5' });
      const up = h('button', { class: 'chip', dataset: { action: 'upgrade', id: s.id } });
      const repair = h('button', { class: 'chip', dataset: { action: 'repair', id: s.id } });
      const card = h('article', { class: 'card' }, [
        h('header', { class: 'card-head' }, [icon(s.icon, 'icon card-icon'), h('div', { class: 'card-titles' }, [h('span', { class: 'eyebrow', text: SHIP_ROLES[s.role] }), h('h3', { text: s.name }), counts])]),
        h('p', { class: 'card-desc', text: s.description }),
        stats,
        h('div', { class: 'quick-row' }, [up, repair]),
        h('footer', { class: 'card-foot' }, [cost.el, h('div', { class: 'card-actions' }, [b5, b1])]),
        note,
      ]);
      this.shipGrid.append(card);
      this.shipCards.set(s.id, { counts, stats, cost, note, b1, b5, up, repair });
    }
    if (!this.shipCards.size) this.shipGrid.append(h('p', { class: 'muted', text: 'Zbadaj „Loty międzyplanetarne”, aby odblokować pierwsze statki.' }));
  }

  updateShips() {
    const g = this.game;
    const canBuild = g.fleet.canBuild();
    for (const [id, c] of this.shipCards) {
      const owned = g.fleet.owned(id);
      setText(c.counts, `Posiadane ${owned} · wolne ${g.fleet.available(id)} · w akcji ${g.fleet.busy(id)} · uszkodzone ${g.fleet.damaged(id)}`);
      const st = g.fleet.stats(id);
      setText(c.stats, `Prędkość ${st.speed.toFixed(1)} · ładowność ${formatNumber(st.cargo)} · atak ${formatNumber(st.attack)} · pancerz ${formatNumber(st.armor)} · osłony ${formatNumber(st.shields)} · kadłub ${formatNumber(st.hull)} · budowa ${formatDuration(g.fleet.buildTime(id))}`);
      const cost = SHIP_MAP[id].cost;
      c.cost.update(cost);
      const afford = g.resources.canAfford(cost);
      const ok = canBuild && g.fleet.isUnlocked(id) && afford;
      c.b1.disabled = !ok;
      c.b1.className = `btn btn-sm ${ok ? 'btn-primary' : 'btn-unavailable'}`;
      c.b5.disabled = !canBuild || !g.resources.canAfford(Object.fromEntries(Object.entries(cost).map(([r, v]) => [r, v * 5])));
      setText(c.note, !canBuild ? 'Wymagana stocznia (zakładka Produkcja → Kosmos)' : afford ? '' : shortfallText(g, cost));
      const lvl = g.fleet.upgradeLevel(id);
      const upCost = g.fleet.upgradeCost(id);
      const maxed = lvl >= SHIP_UPGRADE.maxLevel;
      setText(c.up, maxed ? `Ulepszenie ${lvl} (maks.)` : `Ulepsz do ${lvl + 1}: ${Object.entries(upCost).map(([r, v]) => `${RESOURCE_MAP[r].name} ${formatNumber(v)}`).join(', ')}`);
      c.up.disabled = maxed || !g.resources.canAfford(upCost);
      const dmg = g.fleet.unscheduledDamaged(id);
      c.repair.hidden = g.fleet.damaged(id) === 0;
      const rc = g.fleet.repairCost(id);
      setText(c.repair, dmg > 0 ? `Napraw (${dmg}): ${Object.entries(rc).map(([r, v]) => `${RESOURCE_MAP[r].name} ${formatNumber(v)}`).join(', ')}` : 'Naprawa w toku');
      c.repair.disabled = dmg <= 0 || !g.resources.canAfford(rc);
    }
  }

  updateYard() {
    const g = this.game;
    const slots = g.fleet.shipyardSlots();
    setText(this.yardNote, slots ? `Równoległe budowy: ${slots} · w kolejce ${g.state.fleet.queue.length}/20 · naprawy w kolejce: ${g.state.fleet.repairs.length}` : 'Brak stoczni. Zbadaj „Loty międzyplanetarne” i zbuduj Stocznię w zakładce Produkcja.');
    const sig = g.state.fleet.queue.map((q) => q.shipId).join(',');
    if (this.sigs.queue !== sig) {
      this.sigs.queue = sig;
      clear(this.queueEl);
      this.queueFills = [];
      g.state.fleet.queue.forEach((q, i) => {
        const fill = h('span', { class: 'meter-fill' });
        this.queueEl.append(h('div', { class: 'queue-item' }, [
          icon(SHIP_MAP[q.shipId].icon, 'icon icon-sm'), SHIP_MAP[q.shipId].name,
          h('span', { class: 'meter-track mini' }, [fill]),
          h('button', { class: 'icon-btn', dataset: { action: 'cancel', index: String(i) }, 'aria-label': 'Anuluj (zwrot kosztów)' }, [icon('close', 'icon icon-sm')]),
        ]));
        this.queueFills.push({ fill, q });
      });
    }
    for (const f of this.queueFills ?? []) f.fill.style.transform = `scaleX(${Math.min(1, f.q.progress / SHIP_MAP[f.q.shipId].buildTime)})`;
  }

  locations() {
    return [STATION, ...this.game.colonies.ids()];
  }

  locationName(id) {
    return id === STATION ? 'Stacja Odrodzenie-7' : PLANET_MAP[id]?.name ?? id;
  }

  buildRouteForm() {
    const g = this.game;
    clear(this.routeForm);
    const sel = (name, options) => {
      const s = h('select', { class: 'input', 'aria-label': name });
      options.forEach(([v, t]) => s.append(h('option', { value: v, text: t })));
      return s;
    };
    const locs = this.locations().map((l) => [l, this.locationName(l)]);
    const from = sel('Źródło', locs);
    const to = sel('Cel', locs);
    if (locs.length > 1) { from.value = locs[1][0]; to.value = STATION; }
    const resource = sel('Zasób', RESOURCES.filter((r) => g.logistics.transportable(r.id)).map((r) => [r.id, r.name]));
    const amount = h('input', { class: 'input', type: 'number', min: '1', value: '100', 'aria-label': 'Wielkość transportu' });
    const interval = h('input', { class: 'input', type: 'number', min: String(MIN_INTERVAL), value: '120', 'aria-label': 'Co ile sekund' });
    const transporters = h('input', { class: 'input', type: 'number', min: '1', value: '1', 'aria-label': 'Liczba transportowców' });
    const error = h('p', { class: 'error-text' });
    const capacity = h('span', { class: 'muted' });
    const updateCap = () => setText(capacity, `Ładowność: ${formatNumber(g.logistics.capacity(Math.max(0, Number(transporters.value) || 0)))} · wolne transportowce: ${g.fleet.available('transporter')}`);
    transporters.addEventListener('input', updateCap);
    updateCap();
    const create = h('button', { class: 'btn btn-primary btn-sm', text: 'Utwórz trasę', onclick: () => {
      const r = g.createRoute({ from: from.value, to: to.value, resource: resource.value, amount: amount.value, interval: interval.value, transporters: transporters.value });
      if (r.ok) { error.textContent = ''; this.ui.notify('Utworzono trasę', 'success'); this.sigs.routes = ''; this.update(); updateCap(); }
      else error.textContent = r.reason;
    } });
    const field = (label, input) => h('label', { class: 'field' }, [h('span', { class: 'muted', text: label }), input]);
    this.routeForm.append(
      h('div', { class: 'route-fields' }, [field('Z', from), field('Do', to), field('Zasób', resource), field('Ilość / kurs', amount), field('Co (s)', interval), field('Transportowce', transporters)]),
      h('div', { class: 'quick-row' }, [create, capacity]),
      error,
    );
  }

  updateRoutes() {
    const g = this.game;
    this.logisticsSection.hidden = !g.logistics.available();
    if (this.logisticsSection.hidden) return;
    const formSig = this.locations().join(',');
    if (this.sigs.form !== formSig) { this.sigs.form = formSig; this.buildRouteForm(); }
    const sig = g.state.logistics.routes.map((r) => `${r.id}${r.active}`).join(',');
    if (this.sigs.routes !== sig) {
      this.sigs.routes = sig;
      clear(this.routesEl);
      this.routeRows = [];
      if (!g.state.logistics.routes.length) this.routesEl.append(h('p', { class: 'muted', text: 'Brak tras. Trasy przewożą zasoby z magazynów kolonii na stację lub między koloniami.' }));
      for (const r of g.state.logistics.routes) {
        const status = h('span', { class: 'muted' });
        const stats = h('span', { class: 'muted' });
        this.routesEl.append(h('article', { class: 'route' }, [
          icon('route', 'icon card-icon'),
          h('div', { class: 'card-titles' }, [
            h('strong', { text: `${this.locationName(r.from)} → ${this.locationName(r.to)}` }),
            h('span', { text: `${RESOURCE_MAP[r.resource].name}: ${formatNumber(r.amount)} co ${r.interval} s · transportowce: ${r.transporters} · podróż ${formatDuration(g.logistics.travelTime(r.from, r.to))}` }),
            stats, status,
          ]),
          h('div', { class: 'card-actions' }, [
            h('button', { class: 'btn btn-sm btn-ghost', dataset: { action: 'route-toggle', id: String(r.id), on: r.active ? '0' : '1' }, text: r.active ? 'Wstrzymaj' : 'Wznów' }),
            h('button', { class: 'btn btn-sm btn-danger', dataset: { action: 'route-delete', id: String(r.id) }, text: 'Usuń' }),
          ]),
        ]));
        this.routeRows.push({ r, status, stats });
      }
    }
    for (const row of this.routeRows ?? []) {
      setText(row.status, g.logistics.routeStatus(row.r));
      setText(row.stats, `Kursy: ${row.r.trips} · dostarczono ${formatNumber(row.r.delivered)} · paliwo/kurs: ${formatNumber(g.logistics.fuelFor(row.r.amount))} energii`);
    }
  }

  update() {
    const g = this.game;
    const sig = SHIPS.map((s) => (g.fleet.isUnlocked(s.id) || g.fleet.owned(s.id) ? '1' : '0')).join('');
    if (this.sigs.ships !== sig) { this.sigs.ships = sig; this.rebuildShips(); }
    this.militaryNote.hidden = !SHIPS.some((s) => s.role === 'military' && g.fleet.isUnlocked(s.id));
    this.updateYard();
    this.updateShips();
    this.updateRoutes();
  }
}
