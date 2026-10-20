import {
  PLANETS, PLANET_MAP, PLANET_TYPES, COLONY_BUILDINGS, SPECIALIZATIONS, TERRAFORMING,
} from '../../../data/planets.js';
import { RESOURCE_MAP } from '../../../data/resources.js';
import { SECTOR_MAP } from '../../../data/sectors.js';
import { h, setText, setClass, clear } from '../dom.js';
import { icon } from '../Icons.js';
import { costView, shortfallText } from '../components.js';
import { planetArt } from '../PlanetArt.js';
import { openLaunchDialog } from '../LaunchDialog.js';
import { formatNumber, formatRate, formatDuration } from '../../utils/Formatter.js';
import { TRANSMITTED } from '../../systems/ColonySystem.js';

const STATUS = { discovered: 'Odkryta', analyzed: 'Przeanalizowana', colonized: 'Kolonia' };
const perSec = (map) => Object.entries(map).map(([r, v]) => `${RESOURCE_MAP[r].name} ${formatNumber(v)}/s`).join(', ');

export class PlanetsScreen {
  constructor(ui) {
    this.ui = ui;
    this.game = ui.game;
    this.id = 'planets';
    this.title = 'Planety';
    this.sig = '';
    this.el = this.build();
  }

  build() {
    this.summary = h('p', { class: 'muted' });
    this.grid = h('div', { class: 'card-grid planet-grid' });
    const root = h('div', { class: 'screen screen-planets' }, [
      h('div', { class: 'screen-toolbar' }, [h('div', { class: 'toolbar-group' }, [h('h1', { text: 'Planety' }), this.summary])]),
      this.grid,
    ]);
    root.addEventListener('click', (e) => {
      const t = e.target.closest('[data-action]');
      if (!t || t.disabled) return;
      const { action, id } = t.dataset;
      if (action === 'survey') openLaunchDialog(this.ui, 'survey', id);
      if (action === 'colonize') openLaunchDialog(this.ui, 'colonize', id);
      if (action === 'manage') this.openColony(id);
    });
    return root;
  }

  rebuild() {
    const g = this.game;
    clear(this.grid);
    this.cards = [];
    const known = g.planets.knownPlanets();
    if (!known.length) {
      this.grid.append(h('p', { class: 'muted', text: 'Nie odkryto jeszcze żadnej planety. Zbuduj stocznię i wyślij zwiadowcę w zakładce Eksploracja.' }));
    }
    for (const p of known) {
      const status = h('span', { class: 'badge' });
      const btn = h('button', { class: 'btn btn-sm' });
      const note = h('div', { class: 'card-note' });
      const info = h('div', { class: 'planet-info' });
      const colony = g.colonies.colony(p.id);
      const card = h('article', { class: 'card planet-card' }, [
        h('div', { class: 'planet-head' }, [
          planetArt(p.type, p.id, { size: 84, terraformStage: colony?.terraform.stage ?? 0 }),
          h('div', { class: 'card-titles' }, [
            h('span', { class: 'eyebrow', text: `${PLANET_TYPES[p.type]} · ${SECTOR_MAP[p.sector].name}` }),
            h('h3', { text: p.name }),
            status,
          ]),
        ]),
        h('p', { class: 'card-desc', text: p.description }),
        info,
        h('footer', { class: 'card-foot' }, [note, btn]),
      ]);
      this.grid.append(card);
      this.cards.push({ p, status, btn, note, info });
    }
  }

  update() {
    const g = this.game;
    const sig = g.planets.knownPlanets().map((p) => p.id + g.planets.status(p.id)).join(',');
    if (sig !== this.sig) { this.sig = sig; this.rebuild(); }
    setText(this.summary, `Znane: ${g.planets.knownPlanets().length}/${PLANETS.length} · kolonie: ${g.colonies.ids().length}`);
    for (const c of this.cards ?? []) this.updateCard(c);
  }

  updateCard(c) {
    const g = this.game;
    const st = g.planets.status(c.p.id);
    setText(c.status, STATUS[st]);
    const analyzed = st === 'analyzed' || st === 'colonized';
    const infoSig = st + (g.colonies.has(c.p.id) ? g.colonies.stage(c.p.id) + g.colonies.totalLevels(c.p.id) : '');
    if (c.info.dataset.sig !== infoSig) {
      c.info.dataset.sig = infoSig;
      clear(c.info);
      if (analyzed) {
        c.info.append(
          h('p', { class: 'positive', text: `+ ${c.p.advantage}` }),
          h('p', { class: 'negative', text: `− ${c.p.drawback}` }),
          h('p', { class: 'muted', text: `Złoża (na poziom): ${perSec(c.p.deposits)} · sloty: ${c.p.slots}` }),
        );
        if (g.colonies.has(c.p.id)) {
          c.info.append(h('p', { text: `${g.colonies.stage(c.p.id)} · zabudowa ${g.colonies.totalLevels(c.p.id)}/${g.colonies.slots(c.p.id)} · specjalizacja: ${SPECIALIZATIONS[g.colonies.colony(c.p.id).specialization].name}` }));
        }
      } else {
        c.info.append(h('p', { class: 'muted', text: 'Skład i warunki nieznane. Wyślij statek badawczy (lub 2 zwiadowców), aby przeanalizować planetę.' }));
      }
    }
    const b = c.btn;
    if (st === 'discovered') {
      const running = g.expeditions.isRunning(`survey:${c.p.id}`);
      Object.assign(b.dataset, { action: 'survey', id: c.p.id });
      setText(b, running ? 'Analiza w toku' : 'Analizuj');
      b.disabled = running;
      b.className = `btn btn-sm ${running ? 'btn-unavailable' : 'btn-primary'}`;
      setText(c.note, '');
    } else if (st === 'analyzed') {
      const running = g.expeditions.isRunning(`colonize:${c.p.id}`);
      const req = g.planets.colonizationRequirements(c.p.id);
      Object.assign(b.dataset, { action: 'colonize', id: c.p.id });
      setText(b, running ? 'Statek w drodze' : req.met ? 'Kolonizuj' : 'Zablokowana');
      b.disabled = running || !req.met;
      b.className = `btn btn-sm ${running ? 'btn-unavailable' : req.met ? 'btn-primary' : 'btn-locked'}`;
      setText(c.note, req.met ? '' : `Wymaga: ${req.missing.join(', ')}`);
    } else {
      Object.assign(b.dataset, { action: 'manage', id: c.p.id });
      setText(b, 'Zarządzaj');
      b.disabled = false;
      b.className = 'btn btn-sm btn-primary';
      setText(c.note, '');
    }
  }

  // ---- colony management modal -----------------------------------------

  openColony(id) {
    const g = this.game;
    const p = PLANET_MAP[id];
    const header = h('div', { class: 'planet-head' }, [planetArt(p.type, p.id, { size: 72, terraformStage: g.colonies.colony(id).terraform.stage })]);
    const stage = h('p');
    const specSelect = h('select', { class: 'input', 'aria-label': 'Specjalizacja kolonii' });
    for (const [key, s] of Object.entries(SPECIALIZATIONS)) {
      if (key === 'none') continue;
      const mult = p.multipliers[key];
      specSelect.append(h('option', { value: key, text: `${s.name} (przydatność x${mult})` }));
    }
    const specDesc = h('p', { class: 'muted' });
    const specBtn = h('button', { class: 'btn btn-sm btn-primary', text: 'Ustaw' });
    const specCost = h('span', { class: 'muted' });
    specBtn.addEventListener('click', () => {
      if (g.specializeColony(id, specSelect.value)) this.ui.notify(`Specjalizacja: ${SPECIALIZATIONS[specSelect.value].name}`, 'success');
      refresh();
    });
    specSelect.addEventListener('change', () => refresh());

    const rows = new Map();
    const buildList = h('div', { class: 'colony-buildings' });
    for (const b of COLONY_BUILDINGS) {
      const level = h('span', { class: 'badge' });
      const cost = costView(g);
      const btn = h('button', { class: 'btn btn-sm btn-primary', text: 'Rozbuduj' });
      const note = h('div', { class: 'card-note' });
      btn.addEventListener('click', () => { g.buildColonyBuilding(id, b.id); refresh(); });
      buildList.append(h('div', { class: 'colony-building' }, [
        icon(b.icon, 'icon card-icon'),
        h('div', { class: 'card-titles' }, [h('strong', { text: b.name }), level, h('span', { class: 'muted', text: b.description })]),
        h('div', { class: 'colony-building-actions' }, [cost.el, btn, note]),
      ]));
      rows.set(b.id, { level, cost, btn, note });
    }

    const stockTable = h('table', { class: 'storage-table' });
    const factoryText = h('p', { class: 'muted' });
    const upkeepText = h('p', { class: 'muted', text: `Utrzymanie habitatu (na poziom): ${perSec(p.upkeep) || 'brak'}` });

    const terraform = h('div', { class: 'terraform', hidden: !p.terraformable });
    const tfStatus = h('p');
    const tfFill = h('span', { class: 'meter-fill' });
    const tfReasons = h('ul', { class: 'card-req' });
    const tfBtn = h('button', { class: 'btn btn-sm btn-primary', text: 'Rozpocznij etap' });
    const tfCost = costView(g);
    tfBtn.addEventListener('click', () => { if (g.startTerraform(id)) this.ui.notify('Rozpoczęto etap terraformowania', 'success'); refresh(); });
    terraform.append(h('h3', { text: 'Terraformowanie' }), tfStatus, h('span', { class: 'meter-track' }, [tfFill]), tfCost.el, tfReasons, tfBtn);

    const refresh = () => {
      const c = g.colonies.colony(id);
      if (!c) { this.ui.modals.close(); return; }
      setText(stage, `${g.colonies.stage(id)} · zabudowa ${g.colonies.totalLevels(id)}/${g.colonies.slots(id)} slotów · magazyn ${formatNumber(g.colonies.storageCap(id))} na zasób · produkcja x${g.colonies.colonyMultiplier(id).toFixed(2)}`);
      if (document.activeElement !== specSelect && c.specialization !== 'none' && specSelect.dataset.init !== '1') {
        specSelect.value = c.specialization;
        specSelect.dataset.init = '1';
      }
      setText(specDesc, `Obecna: ${SPECIALIZATIONS[c.specialization].name}. ${SPECIALIZATIONS[specSelect.value].description}`);
      const cost = g.colonies.specializationCost(id);
      setText(specCost, Object.keys(cost).length ? `Zmiana kosztuje: ${Object.entries(cost).map(([r, v]) => `${RESOURCE_MAP[r].name} ${v}`).join(', ')}` : 'Pierwszy wybór jest darmowy');
      specBtn.disabled = specSelect.value === c.specialization || !g.resources.canAfford(cost);
      const full = g.colonies.totalLevels(id) >= g.colonies.slots(id);
      for (const [bid, r] of rows) {
        setText(r.level, `Poziom ${c.buildings[bid]}`);
        const bc = g.colonies.buildingCost(id, bid);
        r.cost.update(bc);
        const afford = g.resources.canAfford(bc);
        r.btn.disabled = full || !afford;
        r.btn.className = `btn btn-sm ${full || !afford ? 'btn-unavailable' : 'btn-primary'}`;
        setText(r.note, full ? 'Brak wolnych slotów' : afford ? '' : shortfallText(g, bc));
      }
      const recipe = g.colonies.factoryRecipe(id);
      setText(factoryText, recipe ? `Fabryka przetwarza: ${perSec(recipe.inputs)} → ${perSec(recipe.outputs)} (na poziom)` : 'Fabryka: brak lokalnych surowców do przetworzenia.');
      clear(stockTable);
      stockTable.append(h('tr', {}, [h('th', { text: 'Zasób w kolonii' }), h('th', { text: 'Ilość' }), h('th', { text: 'Saldo/s' })]));
      const ids = new Set([...Object.keys(c.stock), ...Object.keys(g.colonies.reports[id]?.perResource ?? {})]);
      for (const r of ids) {
        if (TRANSMITTED.includes(r)) continue;
        const net = g.colonies.balance(id, r);
        stockTable.append(h('tr', {}, [
          h('td', {}, [icon(RESOURCE_MAP[r].icon, 'icon icon-sm'), RESOURCE_MAP[r].name]),
          h('td', { text: formatNumber(g.colonies.stock(id, r)) }),
          h('td', { class: net.isNegative() ? 'negative' : '', text: formatRate(net) }),
        ]));
      }
      if (ids.size === 0) stockTable.append(h('tr', {}, [h('td', { text: 'Brak — zbuduj kompleks wydobywczy.' })]));
      if (p.terraformable) {
        const t = c.terraform;
        setText(tfStatus, `Etap ${t.stage}/${TERRAFORMING.maxStage}${t.stage < TERRAFORMING.maxStage ? ` · następny: ${TERRAFORMING.stageNames[t.stage]}` : ' · ukończono'}${t.active ? ` · pozostało ${formatDuration(g.colonies.terraformDuration() - t.progress)}` : ''}`);
        tfFill.style.transform = `scaleX(${t.active ? t.progress / g.colonies.terraformDuration() : t.stage / TERRAFORMING.maxStage})`;
        tfCost.update(TERRAFORMING.cost);
        const chk = g.colonies.canTerraform(id);
        clear(tfReasons);
        chk.reasons.forEach((r) => tfReasons.append(h('li', {}, [icon('lock', 'icon icon-sm'), r])));
        tfBtn.disabled = !chk.ok;
        setClass(tfBtn, 'btn-unavailable', !chk.ok);
      }
    };

    this.ui.modals.open({
      title: `Kolonia: ${p.name}`,
      icon: 'colony',
      body: [
        header, stage,
        h('h3', { text: 'Specjalizacja' }),
        h('div', { class: 'quick-row' }, [specSelect, specBtn]), specCost, specDesc,
        h('h3', { text: 'Zabudowa (koszt pokrywa stacja)' }), buildList, factoryText, upkeepText,
        h('h3', { text: 'Magazyn kolonii' }),
        h('p', { class: 'muted', text: 'Dane badawcze, kredyty i artefakty trafiają od razu na stację. Pozostałe zasoby przewieź trasą logistyczną (zakładka Flota).' }),
        stockTable,
        terraform,
      ],
      onUpdate: refresh,
    });
    refresh();
  }
}
