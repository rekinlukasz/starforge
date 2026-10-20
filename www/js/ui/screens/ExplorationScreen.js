import { SECTORS } from '../../../data/sectors.js';
import { SHIP_MAP } from '../../../data/ships.js';
import { PLANET_MAP } from '../../../data/planets.js';
import { h, setText, setClass, clear } from '../dom.js';
import { icon } from '../Icons.js';
import { rewardText } from '../effectText.js';
import { openLaunchDialog } from '../LaunchDialog.js';
import { formatDuration } from '../../utils/Formatter.js';

const TYPE_LABEL = { scout: 'Zwiad', mining: 'Wydobycie', science: 'Nauka', story: 'Fabularna', combat: 'Walka (opcjonalna)', survey: 'Analiza', colonize: 'Kolonizacja' };
const DANGER = ['Bezpieczny', 'Niskie', 'Umiarkowane', 'Wysokie', 'Ekstremalne', 'Śmiertelne'];

export class ExplorationScreen {
  constructor(ui) {
    this.ui = ui;
    this.game = ui.game;
    this.id = 'exploration';
    this.title = 'Eksploracja';
    this.el = this.build();
    this.activeSig = '';
    this.sectorSig = '';
  }

  build() {
    this.activeList = h('div', { class: 'expedition-list' });
    this.sectorList = h('div', { class: 'card-grid' });
    const root = h('div', { class: 'screen screen-exploration' }, [
      h('div', { class: 'screen-toolbar' }, [h('h1', { text: 'Eksploracja' })]),
      h('section', { class: 'card-section' }, [h('h2', { class: 'section-title', text: 'Aktywne ekspedycje' }), this.activeList]),
      h('section', { class: 'card-section' }, [h('h2', { class: 'section-title', text: 'Odkryte sektory' }), this.sectorList]),
    ]);
    root.addEventListener('click', (e) => {
      const t = e.target.closest('[data-action]');
      if (!t || t.disabled) return;
      const { action, uid, kind, id } = t.dataset;
      if (action === 'claim') this.claim(uid);
      if (action === 'launch') openLaunchDialog(this.ui, kind, id);
      this.update();
    });
    root.addEventListener('change', (e) => {
      const t = e.target.closest('[data-action="repeat"]');
      if (t) this.game.setExpeditionRepeat(t.dataset.uid, t.checked);
    });
    return root;
  }

  claim(uid) {
    const r = this.game.claimExpedition(uid);
    if (!r) return;
    if (!r.victory) { this.ui.notify(`${r.def.name}: odwrót — brak nagród`, 'error'); return; }
    const parts = Object.entries(r.granted).filter(([, v]) => v.gt(0)).map(([k]) => k);
    this.ui.notify(`${r.def.name}: ukończono${parts.length ? ' — nagrody odebrane' : ''}`, 'success');
  }

  renderActive() {
    const g = this.game;
    clear(this.activeList);
    this.activeRows = [];
    if (!g.state.expeditions.active.length) {
      this.activeList.append(h('p', { class: 'muted', text: 'Brak aktywnych ekspedycji. Wybierz wyprawę w jednym z sektorów poniżej.' }));
      return;
    }
    for (const e of g.state.expeditions.active) {
      const def = g.expeditions.definition(e.kind, e.id);
      const fill = h('span', { class: 'meter-fill' });
      const time = h('span', { class: 'muted' });
      const ships = Object.entries(e.ships).map(([s, n]) => `${SHIP_MAP[s].name} x${n}`).join(', ') || '—';
      const repeat = def.repeatable && g.modifiers.hasFeature('autoclaim')
        ? h('label', { class: 'chip' }, [h('input', { type: 'checkbox', dataset: { action: 'repeat', uid: String(e.uid) }, ...(e.repeat ? { checked: true } : {}) }), 'Powtarzaj'])
        : null;
      const claim = h('button', { class: 'btn btn-primary btn-sm', dataset: { action: 'claim', uid: String(e.uid) }, text: 'Odbierz' });
      const result = e.battle ? h('span', { class: e.battle.outcome === 'victory' ? 'positive' : 'negative', text: e.battle.outcome === 'victory' ? 'Zwycięstwo' : 'Odwrót' }) : null;
      const row = h('article', { class: 'expedition' }, [
        icon(e.kind === 'colonize' ? 'colony' : def.type === 'combat' ? 'swords' : 'explore', 'icon expedition-icon'),
        h('div', { class: 'expedition-main' }, [
          h('strong', { text: def.name }),
          h('span', { class: 'muted', text: `${TYPE_LABEL[def.type] ?? ''} · ${ships}` }),
          h('span', { class: 'meter-track' }, [fill]),
        ]),
        h('div', { class: 'expedition-side' }, [time, result, repeat, claim]),
      ]);
      this.activeList.append(row);
      this.activeRows.push({ e, fill, time, claim });
    }
  }

  renderSectors() {
    const g = this.game;
    clear(this.sectorList);
    this.expButtons = [];
    for (const s of SECTORS) {
      if (!g.planets.isSectorDiscovered(s.id)) continue;
      const list = h('ul', { class: 'sector-expeditions' });
      for (const x of s.expeditions) {
        const def = g.expeditions.definition('sector', x.id);
        const done = !def.repeatable && g.expeditions.completions(def.key) > 0;
        const ships = Object.entries(def.ships).map(([sid, n]) => `${SHIP_MAP[sid].name} x${n}`).join(', ');
        const btn = h('button', { class: 'btn btn-sm', dataset: { action: 'launch', kind: 'sector', id: x.id } });
        const discovers = (def.discovers?.planets ?? []).map((p) => PLANET_MAP[p].name);
        list.append(h('li', { class: `sector-exp${done ? ' done' : ''}` }, [
          h('div', {}, [
            h('strong', { text: def.name }),
            h('span', { class: 'eyebrow', text: ` ${TYPE_LABEL[def.type]}${def.repeatable ? ' · powtarzalna' : ''}` }),
            h('p', { class: 'muted', text: `Flota: ${ships} · bazowo ${formatDuration(def.duration)}` }),
            h('p', { class: 'muted', text: `Nagrody: ${rewardText(def.rewards)}${discovers.length ? ` · odkrywa: ${discovers.join(', ')}` : ''}` }),
          ]),
          btn,
        ]));
        this.expButtons.push({ btn, def, done });
      }
      this.sectorList.append(h('article', { class: 'card sector-card' }, [
        h('header', { class: 'card-head' }, [
          icon('galaxy', 'icon card-icon'),
          h('div', { class: 'card-titles' }, [h('span', { class: 'eyebrow', text: `Zagrożenie: ${DANGER[s.danger]}` }), h('h3', { text: s.name })]),
        ]),
        h('p', { class: 'card-desc', text: s.description }),
        list,
      ]));
    }
  }

  update() {
    const g = this.game;
    const aSig = g.state.expeditions.active.map((e) => `${e.uid}${e.status}${e.repeat}`).join(',') + g.modifiers.hasFeature('autoclaim');
    if (aSig !== this.activeSig) { this.activeSig = aSig; this.renderActive(); }
    for (const r of this.activeRows ?? []) {
      const done = r.e.status === 'completed';
      r.fill.style.transform = `scaleX(${g.expeditions.progress(r.e)})`;
      setText(r.time, done ? 'Ukończona' : `Pozostało ${formatDuration(g.expeditions.remaining(r.e))}`);
      r.claim.hidden = !done;
    }
    const sSig = SECTORS.filter((s) => g.planets.isSectorDiscovered(s.id)).map((s) => s.id).join(',') + JSON.stringify(g.state.expeditions.completions);
    if (sSig !== this.sectorSig) { this.sectorSig = sSig; this.renderSectors(); }
    for (const b of this.expButtons ?? []) {
      if (b.done) { setText(b.btn, 'Wykonana'); b.btn.className = 'btn btn-sm btn-done'; b.btn.disabled = true; continue; }
      const running = g.expeditions.isRunning(b.def.key);
      const req = b.def.requires ? g.expeditions.check('sector', b.def.key, g.expeditions.defaultFleet(b.def)) : null;
      const locked = req && req.reasons.some((r) => r.startsWith('Technologia'));
      setText(b.btn, running ? 'W toku' : locked ? 'Zablokowana' : 'Przygotuj');
      b.btn.className = `btn btn-sm ${running || locked ? 'btn-unavailable' : 'btn-primary'}`;
      b.btn.disabled = running || locked;
      setClass(b.btn, 'btn-locked', Boolean(locked));
    }
  }
}
