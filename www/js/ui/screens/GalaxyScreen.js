import { SECTORS } from '../../../data/sectors.js';
import { MEGASTRUCTURES } from '../../../data/megastructures.js';
import {
  PRESTIGE_RESET, PRESTIGE_KEPT, PRESTIGE_UPGRADES, PRESTIGE_SPECIALIZATIONS, PRESTIGE_FORMULA,
} from '../../../data/prestige.js';
import { h, setText, setClass, clear } from '../dom.js';
import { icon } from '../Icons.js';
import { costView } from '../components.js';
import { effectText } from '../effectText.js';
import { formatDuration, formatNumber } from '../../utils/Formatter.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
// Map layout (percent coordinates) — purely presentational.
const POS = {
  innerBelt: [14, 52], cometCloud: [30, 22], outerReach: [34, 70], jovianDeep: [50, 18],
  toxicVeil: [56, 58], verdantArm: [54, 86], pirateHaven: [74, 80], precursorRuins: [74, 42], anomalyRift: [90, 22],
};

export class GalaxyScreen {
  constructor(ui) {
    this.ui = ui;
    this.game = ui.game;
    this.id = 'galaxy';
    this.title = 'Galaktyka';
    this.megaCards = new Map();
    this.el = this.build();
  }

  build() {
    this.map = this.buildMap();
    this.megaGrid = h('div', { class: 'card-grid' });
    this.prestigeInfo = h('div', { class: 'prestige-summary' });
    this.prestigeBtn = h('button', { class: 'btn btn-primary', text: 'Galactic Rebirth', onclick: () => this.openPrestige() });
    for (const m of MEGASTRUCTURES) this.megaGrid.append(this.megaCard(m));
    return h('div', { class: 'screen screen-galaxy' }, [
      h('div', { class: 'screen-toolbar' }, [h('h1', { text: 'Galaktyka' })]),
      h('section', { class: 'panel galaxy-panel' }, [h('h2', { class: 'panel-title', text: 'Mapa sektorów' }), this.map]),
      h('section', { class: 'card-section' }, [h('h2', { class: 'section-title', text: 'Megastruktury' }), this.megaGrid]),
      h('section', { class: 'panel' }, [h('h2', { class: 'panel-title', text: 'Galactic Rebirth' }), this.prestigeInfo, h('div', { class: 'quick-row' }, [this.prestigeBtn])]),
    ]);
  }

  buildMap() {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('class', 'galaxy-map');
    const links = document.createElementNS(SVG_NS, 'g');
    const nodes = document.createElementNS(SVG_NS, 'g');
    svg.append(links, nodes);
    this.mapLinks = [];
    this.mapNodes = new Map();
    for (const s of SECTORS) {
      for (const e of s.expeditions) {
        for (const d of e.discovers?.sectors ?? []) {
          const line = document.createElementNS(SVG_NS, 'line');
          const [x1, y1] = POS[s.id]; const [x2, y2] = POS[d];
          Object.entries({ x1, y1, x2, y2 }).forEach(([k, v]) => line.setAttribute(k, v));
          line.setAttribute('class', 'map-link');
          links.append(line);
          this.mapLinks.push({ line, to: d });
        }
      }
    }
    const wrap = h('div', { class: 'galaxy-wrap' }, [svg]);
    for (const s of SECTORS) {
      const [x, y] = POS[s.id];
      const label = h('button', { class: 'map-node', dataset: { sector: s.id }, onclick: () => this.ui.navigation.go('exploration') }, [h('span', { class: 'map-dot' }), h('span', { class: 'map-label', text: s.name })]);
      label.style.left = `${x}%`;
      label.style.top = `${y}%`;
      wrap.append(label);
      this.mapNodes.set(s.id, label);
    }
    return wrap;
  }

  megaCard(m) {
    const stage = h('span', { class: 'badge' });
    const fill = h('span', { class: 'meter-fill' });
    const time = h('span', { class: 'muted' });
    const cost = costView(this.game);
    const reasons = h('ul', { class: 'card-req' });
    const btn = h('button', { class: 'btn btn-sm btn-primary', text: 'Rozpocznij etap', onclick: () => {
      if (this.game.startMegastructureStage(m.id)) this.ui.notify(`${m.name}: rozpoczęto etap`, 'success');
      this.update();
    } });
    const card = h('article', { class: 'card' }, [
      h('header', { class: 'card-head' }, [icon(m.icon, 'icon card-icon'), h('div', { class: 'card-titles' }, [h('h3', { text: m.name }), stage])]),
      h('p', { class: 'card-desc', text: m.description }),
      h('ul', { class: 'effect-list' }, m.effectsPerStage.map((e) => h('li', { text: `Na etap: ${effectText(e)}` }))),
      h('span', { class: 'meter-track' }, [fill]), time,
      reasons,
      h('footer', { class: 'card-foot' }, [cost.el, btn]),
    ]);
    this.megaCards.set(m.id, { stage, fill, time, cost, reasons, btn, card });
    return card;
  }

  update() {
    const g = this.game;
    for (const s of SECTORS) {
      const node = this.mapNodes.get(s.id);
      const known = g.planets.isSectorDiscovered(s.id);
      setClass(node, 'known', known);
      setClass(node, 'colonized', s.expeditions.some((e) => (e.discovers?.planets ?? []).some((p) => g.colonies.has(p))));
      const label = node.querySelector('.map-label');
      setText(label, known ? s.name : '???');
    }
    for (const l of this.mapLinks) setClass(l.line, 'known', g.planets.isSectorDiscovered(l.to));

    for (const m of MEGASTRUCTURES) {
      const c = this.megaCards.get(m.id);
      const st = g.megastructures.stage(m.id);
      const active = g.state.megastructures[m.id]?.active;
      setText(c.stage, `Etap ${st}/${m.stages}`);
      c.fill.style.transform = `scaleX(${active ? g.megastructures.progressRatio(m.id) : st / m.stages})`;
      setText(c.time, active ? `Budowa etapu: pozostało ${formatDuration(g.megastructures.remaining(m.id))}` : `Czas etapu: ${formatDuration(g.megastructures.duration(m.id))}`);
      c.cost.update(m.stageCost);
      const chk = g.megastructures.check(m.id);
      const sig = chk.reasons.join('|');
      if (c.reasons.dataset.sig !== sig) {
        c.reasons.dataset.sig = sig;
        clear(c.reasons);
        chk.reasons.forEach((r) => c.reasons.append(h('li', {}, [icon('lock', 'icon icon-sm'), r])));
      }
      c.btn.disabled = !chk.ok;
      c.btn.className = `btn btn-sm ${chk.ok ? 'btn-primary' : 'btn-unavailable'}`;
    }

    const req = g.prestige.requirement();
    const pts = g.prestige.pointsBreakdown();
    const sig = `${req.met}${pts.total}${g.state.prestige.rebirths}${req.parts.map((p) => p.text).join()}`;
    if (this.prestigeInfo.dataset.sig !== sig) {
      this.prestigeInfo.dataset.sig = sig;
      clear(this.prestigeInfo);
      this.prestigeInfo.append(
        h('p', { text: `Odrodzenia: ${g.state.prestige.rebirths} · punkty prestiżu: ${formatNumber(g.resources.amount('prestigePoints'))}` }),
        h('p', { text: `Punkty do zdobycia teraz: ${pts.total}` }),
        h('ul', { class: 'card-req' }, req.parts.map((p) => h('li', { class: p.met ? 'positive' : '' }, [icon(p.met ? 'check' : 'lock', 'icon icon-sm'), p.text]))),
      );
    }
  }

  openPrestige() {
    const g = this.game;
    const pts = g.prestige.pointsBreakdown();
    const specSelect = h('select', { class: 'input', 'aria-label': 'Specjalizacja nowego cyklu' });
    for (const [id, s] of Object.entries(PRESTIGE_SPECIALIZATIONS)) specSelect.append(h('option', { value: id, text: `${s.name} — ${s.description}` }));
    if (g.state.prestige.specialization) specSelect.value = g.state.prestige.specialization;
    const understand = h('input', { type: 'checkbox', class: 'checkbox' });

    const upgradesEl = h('div', { class: 'prestige-upgrades' });
    const ppText = h('p');
    const renderUpgrades = () => {
      clear(upgradesEl);
      setText(ppText, `Dostępne punkty prestiżu: ${formatNumber(g.resources.amount('prestigePoints'))}`);
      for (const u of PRESTIGE_UPGRADES) {
        const lvl = g.prestige.upgradeLevel(u.id);
        const maxed = lvl >= u.maxLevel;
        const cost = g.prestige.upgradeCost(u.id);
        const btn = h('button', { class: 'btn btn-sm btn-primary', text: maxed ? 'Maks.' : `Kup (${cost} PP)` });
        btn.disabled = maxed || g.resources.amount('prestigePoints').lt(cost);
        btn.addEventListener('click', () => { g.buyPrestigeUpgrade(u.id); renderUpgrades(); });
        upgradesEl.append(h('div', { class: 'colony-building' }, [
          icon(u.icon, 'icon card-icon'),
          h('div', { class: 'card-titles' }, [h('strong', { text: `${u.name} · ${lvl}/${u.maxLevel}` }), h('span', { class: 'muted', text: u.description })]),
          btn,
        ]));
      }
    };
    renderUpgrades();

    const can = g.prestige.canRebirth();
    const dialog = this.ui.modals.open({
      title: 'Galactic Rebirth',
      icon: 'prestige',
      body: [
        h('p', { text: 'Rozpocznij nowy cykl rozwoju z trwałymi bonusami.' }),
        h('h3', { text: `Otrzymasz ${pts.total} punktów prestiżu` }),
        h('p', { class: 'muted', text: `Energia w tym cyklu: ${pts.fromEnergy} (pierwiastek z energii / ${formatNumber(PRESTIGE_FORMULA.energyDivisor)}) · kolonie: ${pts.fromColonies} · megastruktury: ${pts.fromMega}` }),
        h('h3', { text: 'Zostanie zresetowane' }),
        h('ul', { class: 'report-list negative' }, PRESTIGE_RESET.map((t) => h('li', { text: t }))),
        h('h3', { text: 'Zostanie zachowane' }),
        h('ul', { class: 'report-list positive' }, PRESTIGE_KEPT.map((t) => h('li', { text: t }))),
        h('h3', { text: 'Specjalizacja nowego cyklu' }),
        specSelect,
        h('h3', { text: 'Ulepszenia prestiżu' }),
        ppText,
        upgradesEl,
        can ? h('label', { class: 'settings-row warn-row' }, [h('span', { text: 'Rozumiem, co zostanie zresetowane' }), understand]) : h('p', { class: 'negative', text: 'Warunki odrodzenia nie są jeszcze spełnione.' }),
      ],
      buttons: [
        { label: 'Odrodź się', kind: 'danger', closes: false, onClick: () => this.confirmRebirth(specSelect.value) },
        { label: 'Zamknij', kind: 'ghost' },
      ],
    });
    const btn = dialog.querySelector('.modal-actions .btn');
    btn.disabled = true;
    understand.addEventListener('change', () => { btn.disabled = !understand.checked || !can; });
  }

  // Second, separate confirmation so prestige can't happen by an accidental tap.
  confirmRebirth(spec) {
    const g = this.game;
    const pts = g.prestige.pointsBreakdown().total;
    this.ui.modals.open({
      title: 'Potwierdź odrodzenie',
      icon: 'prestige',
      dismissible: true,
      body: [h('p', { text: `Ostatnie potwierdzenie: nowy cykl jako ${PRESTIGE_SPECIALIZATIONS[spec].name}, +${pts} punktów prestiżu. Tej operacji nie można cofnąć.` })],
      buttons: [
        { label: 'Tak, rozpocznij nowy cykl', kind: 'danger', onClick: () => {
          const got = g.rebirth(spec);
          if (got) {
            this.ui.notify(`Galactic Rebirth! +${got} PP`, 'success');
            this.ui.navigation.go('home', { remember: false });
          }
        } },
        { label: 'Anuluj', kind: 'ghost' },
      ],
    });
  }
}

