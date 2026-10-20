import { TECHNOLOGIES, TECH_MAP, TECH_CATEGORIES } from '../../../data/technologies.js';
import { h, setText, setClass, clear } from '../dom.js';
import { icon } from '../Icons.js';
import { costView, shortfallText } from '../components.js';
import { effectText } from '../effectText.js';
import { formatDuration } from '../../utils/Formatter.js';

const CATEGORY_ICONS = {
  energy: 'energy', automation: 'auto', metallurgy: 'alloy', electronics: 'electronics', ai: 'ai',
  propulsion: 'fusion', colonization: 'biomass', logistics: 'storage', quantum: 'crystal',
  terraforming: 'water', stellar: 'solar', alien: 'artifact',
};

const NODE_W = 176;
const NODE_H = 58;
const COL_GAP = 64;
const ROW_GAP = 14;
const ZOOMS = [0.6, 0.8, 1, 1.25];

const STATUS_LABEL = {
  completed: 'Ukończone', active: 'W trakcie', queued: 'W kolejce', available: 'Dostępne', locked: 'Zablokowane',
};

export class ResearchScreen {
  constructor(ui) {
    this.ui = ui;
    this.game = ui.game;
    this.id = 'research';
    this.title = 'Badania';
    this.view = 'tree';
    this.filter = 'available';
    this.category = 'all';
    this.zoomIndex = 2;
    this.nodes = new Map();
    this.listCards = new Map();
    this.el = this.build();
  }

  build() {
    // Current research ---------------------------------------------------
    this.activeName = h('strong');
    this.activeTime = h('span', { class: 'muted' });
    this.activeFill = h('span', { class: 'meter-fill' });
    this.cancelBtn = h('button', { class: 'btn btn-ghost btn-sm', dataset: { action: 'cancel' }, text: 'Anuluj' });
    this.queueEl = h('div', { class: 'queue' });
    this.speedEl = h('span', { class: 'muted' });
    this.activePanel = h('section', { class: 'panel research-active' }, [
      h('div', { class: 'research-active-head' }, [
        h('div', { class: 'research-active-text' }, [h('span', { class: 'panel-title', text: 'Aktualne badanie' }), this.activeName, this.activeTime]),
        this.cancelBtn,
      ]),
      h('span', { class: 'meter-track' }, [this.activeFill]),
      h('div', { class: 'research-active-foot' }, [this.queueEl, this.speedEl]),
    ]);

    // Toolbar --------------------------------------------------------------
    this.viewButtons = {
      tree: h('button', { class: 'seg', dataset: { action: 'view', view: 'tree' } }, [icon('tree', 'icon icon-sm'), 'Drzewko']),
      list: h('button', { class: 'seg', dataset: { action: 'view', view: 'list' } }, [icon('list', 'icon icon-sm'), 'Lista']),
    };
    this.zoomControls = h('div', { class: 'segmented' }, [
      h('button', { class: 'seg', dataset: { action: 'zoom', dir: '-1' }, 'aria-label': 'Oddal' }, [icon('minus', 'icon icon-sm')]),
      h('button', { class: 'seg', dataset: { action: 'zoom', dir: '1' }, 'aria-label': 'Przybliż' }, [icon('plus', 'icon icon-sm')]),
    ]);
    this.filterButtons = {};
    const filters = h('div', { class: 'segmented' });
    for (const [id, label] of [['available', 'Dostępne'], ['all', 'Wszystkie'], ['completed', 'Ukończone']]) {
      this.filterButtons[id] = h('button', { class: 'seg', dataset: { action: 'filter', filter: id }, text: label });
      filters.append(this.filterButtons[id]);
    }
    this.categorySelect = h('select', { class: 'input', 'aria-label': 'Kategoria' }, [h('option', { value: 'all', text: 'Wszystkie kategorie' })]);
    for (const [id, label] of Object.entries(TECH_CATEGORIES)) {
      if (TECHNOLOGIES.some((t) => t.category === id)) this.categorySelect.append(h('option', { value: id, text: label }));
    }
    this.categorySelect.addEventListener('change', () => { this.category = this.categorySelect.value; this.rebuildList(); this.update(); });
    this.listControls = h('div', { class: 'toolbar-group' }, [filters, this.categorySelect]);
    this.countEl = h('span', { class: 'muted' });

    const toolbar = h('div', { class: 'screen-toolbar' }, [
      h('div', { class: 'toolbar-group' }, [h('h1', { text: 'Badania' }), this.countEl]),
      h('div', { class: 'toolbar-group' }, [h('div', { class: 'segmented' }, [this.viewButtons.tree, this.viewButtons.list]), this.zoomControls, this.listControls]),
    ]);

    // Tree -----------------------------------------------------------------
    this.treeInner = h('div', { class: 'tree-inner' });
    this.treeSizer = h('div', { class: 'tree-sizer' }, [this.treeInner]);
    this.treeEl = h('div', { class: 'tree-scroll' }, [this.treeSizer]);
    this.buildTree();

    // List -----------------------------------------------------------------
    this.listEl = h('div', { class: 'card-grid' });

    const root = h('div', { class: 'screen screen-research' }, [this.activePanel, toolbar, this.treeEl, this.listEl]);
    root.addEventListener('click', (e) => {
      const t = e.target.closest('[data-action],[data-tech]');
      if (!t || t.disabled) return;
      if (t.dataset.tech) { this.openDetails(t.dataset.tech); return; }
      const a = t.dataset.action;
      if (a === 'view') { this.view = t.dataset.view; this.applyView(); }
      if (a === 'filter') { this.filter = t.dataset.filter; this.rebuildList(); }
      if (a === 'zoom') this.setZoom(this.zoomIndex + Number(t.dataset.dir));
      if (a === 'cancel') this.game.cancelResearch();
      if (a === 'dequeue') this.game.dequeueResearch(t.dataset.id);
      if (a === 'start') this.start(t.dataset.id);
      this.update();
    });
    this.applyView();
    return root;
  }

  // Column = depth of the longest prerequisite chain, so every link points
  // left-to-right; rows ordered by category so related techs sit together.
  layout() {
    const catOrder = Object.keys(TECH_CATEGORIES);
    const depth = {};
    const depthOf = (id) => {
      if (depth[id] === undefined) {
        const req = TECH_MAP[id].requires;
        depth[id] = req.length ? 1 + Math.max(...req.map(depthOf)) : 0;
      }
      return depth[id];
    };
    TECHNOLOGIES.forEach((t) => depthOf(t.id));
    const columns = Math.max(...Object.values(depth)) + 1;
    const pos = {};
    let maxRows = 0;
    for (let col = 0; col < columns; col++) {
      const inCol = TECHNOLOGIES.filter((t) => depth[t.id] === col)
        .sort((a, b) => catOrder.indexOf(a.category) - catOrder.indexOf(b.category));
      inCol.forEach((t, row) => { pos[t.id] = { x: col * (NODE_W + COL_GAP), y: row * (NODE_H + ROW_GAP) }; });
      maxRows = Math.max(maxRows, inCol.length);
    }
    return { pos, width: columns * (NODE_W + COL_GAP) - COL_GAP, height: maxRows * (NODE_H + ROW_GAP) - ROW_GAP };
  }

  buildTree() {
    const { pos, width, height } = this.layout();
    this.treeSize = { width, height };
    const SVG_NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'tree-links');
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    this.links = [];
    for (const t of TECHNOLOGIES) {
      for (const r of t.requires) {
        const a = pos[r];
        const b = pos[t.id];
        const x1 = a.x + NODE_W; const y1 = a.y + NODE_H / 2;
        const x2 = b.x; const y2 = b.y + NODE_H / 2;
        const mx = (x1 + x2) / 2;
        const path = document.createElementNS(SVG_NS, 'path');
        path.setAttribute('d', `M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`);
        svg.append(path);
        this.links.push({ path, from: r, to: t.id });
      }
    }
    this.treeInner.append(svg);
    for (const t of TECHNOLOGIES) {
      const status = h('span', { class: 'node-status' });
      // Position via CSSOM: the CSP forbids inline style attributes.
      const node = h('button', { class: 'tree-node', dataset: { tech: t.id } }, [
        icon(CATEGORY_ICONS[t.category], 'icon node-icon'),
        h('span', { class: 'node-text' }, [h('span', { class: 'node-name', text: t.name }), status]),
      ]);
      node.style.left = `${pos[t.id].x}px`;
      node.style.top = `${pos[t.id].y}px`;
      this.treeInner.append(node);
      this.nodes.set(t.id, { node, status });
    }
    this.treeInner.style.width = `${width}px`;
    this.treeInner.style.height = `${height}px`;
    this.setZoom(this.zoomIndex);
  }

  setZoom(index) {
    this.zoomIndex = Math.max(0, Math.min(ZOOMS.length - 1, index));
    const z = ZOOMS[this.zoomIndex];
    this.treeInner.style.transform = `scale(${z})`;
    this.treeSizer.style.width = `${this.treeSize.width * z}px`;
    this.treeSizer.style.height = `${this.treeSize.height * z}px`;
  }

  applyView() {
    const tree = this.view === 'tree';
    this.treeEl.hidden = !tree;
    this.zoomControls.hidden = !tree;
    this.listEl.hidden = tree;
    this.listControls.hidden = tree;
    setClass(this.viewButtons.tree, 'active', tree);
    setClass(this.viewButtons.list, 'active', !tree);
    if (!tree) this.rebuildList();
  }

  listItems() {
    const r = this.game.research;
    return TECHNOLOGIES.filter((t) => {
      if (this.category !== 'all' && t.category !== this.category) return false;
      const st = r.status(t.id);
      if (this.filter === 'available') return st === 'available' || st === 'active' || st === 'queued';
      if (this.filter === 'completed') return st === 'completed';
      return true;
    });
  }

  rebuildList() {
    if (this.view !== 'list') return;
    clear(this.listEl);
    this.listCards.clear();
    this.listSignature = this.currentListSignature();
    const items = this.listItems();
    if (!items.length) this.listEl.append(h('p', { class: 'muted', text: 'Brak technologii w tym widoku.' }));
    for (const t of items) {
      const status = h('span', { class: 'badge' });
      const cost = costView(this.game);
      const button = h('button', { class: 'btn btn-primary card-btn', dataset: { action: 'start', id: t.id } });
      const note = h('div', { class: 'card-note' });
      const card = h('article', { class: 'card' }, [
        h('header', { class: 'card-head' }, [
          icon(CATEGORY_ICONS[t.category], 'icon card-icon'),
          h('div', { class: 'card-titles' }, [h('span', { class: 'eyebrow', text: `${TECH_CATEGORIES[t.category]} · poziom ${t.tier}` }), h('h3', { text: t.name }), status]),
        ]),
        h('ul', { class: 'effect-list' }, t.effects.map((e) => h('li', { text: effectText(e) }))),
        h('footer', { class: 'card-foot' }, [cost.el, button]),
        note,
        h('button', { class: 'link-btn', dataset: { tech: t.id }, text: 'Szczegóły' }),
      ]);
      this.listEl.append(card);
      this.listCards.set(t.id, { card, status, cost, button, note });
    }
  }

  currentListSignature() {
    return this.listItems().map((t) => t.id).join(',');
  }

  start(id) {
    const result = this.game.startResearch(id);
    const msg = {
      started: `Rozpoczęto badanie: ${TECH_MAP[id].name}`,
      queued: `Dodano do kolejki: ${TECH_MAP[id].name}`,
      queueFull: 'Kolejka badań jest pełna',
      unaffordable: 'Brak zasobów na to badanie',
      locked: 'Najpierw ukończ wymagane technologie',
    }[result];
    if (msg) this.ui.notify(msg, result === 'started' || result === 'queued' ? 'success' : 'error');
    return result;
  }

  // Shared button state for a tech (tree detail modal and list cards).
  buttonState(id) {
    const r = this.game.research;
    const st = r.status(id);
    const def = TECH_MAP[id];
    if (st === 'completed') return { label: 'Ukończone', cls: 'btn-done', disabled: true };
    if (st === 'active') return { label: 'W trakcie', cls: 'btn-unavailable', disabled: true };
    if (st === 'queued') return { label: 'W kolejce', cls: 'btn-unavailable', disabled: true };
    const pending = new Set([this.game.state.research.active?.id, ...this.game.state.research.queue].filter(Boolean));
    const queueable = this.game.state.research.active && def.requires.every((q) => r.isCompleted(q) || pending.has(q));
    if (st === 'locked' && !queueable) return { label: 'Zablokowane', cls: 'btn-locked', disabled: true };
    if (this.game.state.research.active) return { label: 'Do kolejki', cls: 'btn-primary', disabled: false };
    const affordable = this.game.resources.canAfford(def.cost);
    return { label: 'Badaj', cls: affordable ? 'btn-primary' : 'btn-unavailable', disabled: !affordable, short: !affordable };
  }

  openDetails(id) {
    const def = TECH_MAP[id];
    const r = this.game.research;
    const cost = costView(this.game);
    const reqList = h('ul', { class: 'card-req' });
    const status = h('span', { class: 'badge' });
    const duration = h('span', { class: 'muted' });
    const note = h('p', { class: 'card-note' });
    const refresh = () => {
      cost.update(def.cost);
      setText(status, STATUS_LABEL[r.status(id)]);
      setText(duration, `Czas badania: ${formatDuration(r.duration(id))}`);
      clear(reqList);
      for (const q of def.requires) {
        const done = r.isCompleted(q);
        reqList.append(h('li', { class: done ? 'positive' : '' }, [icon(done ? 'check' : 'lock', 'icon icon-sm'), TECH_MAP[q].name]));
      }
      const btn = dialog.querySelector('.modal-actions .btn');
      const s = this.buttonState(id);
      btn.textContent = s.label;
      btn.className = `btn ${s.cls}`;
      btn.disabled = s.disabled;
      setText(note, s.short ? shortfallText(this.game, def.cost) : '');
    };
    const dialog = this.ui.modals.open({
      title: def.name,
      icon: CATEGORY_ICONS[def.category],
      body: [
        h('p', { class: 'eyebrow', text: `${TECH_CATEGORIES[def.category]} · poziom ${def.tier}` }),
        status,
        h('p', { text: def.description }),
        h('h3', { text: 'Efekty' }),
        h('ul', { class: 'effect-list' }, def.effects.map((e) => h('li', { text: effectText(e) }))),
        def.requires.length ? h('h3', { text: 'Wymagania' }) : null,
        def.requires.length ? reqList : null,
        h('h3', { text: 'Koszt' }),
        cost.el,
        duration,
        note,
      ],
      buttons: [
        { label: 'Badaj', kind: 'primary', closes: false, onClick: () => { this.start(id); refresh(); } },
        { label: 'Zamknij', kind: 'ghost' },
      ],
      onUpdate: refresh,
    });
    refresh();
  }

  updateActive() {
    const g = this.game;
    const a = g.state.research.active;
    setText(this.activeName, a ? TECH_MAP[a.id].name : 'Brak — wybierz technologię');
    const waiting = !a && g.state.research.queue.length;
    setText(this.activeTime, a ? `Pozostało ${formatDuration(g.research.remainingSeconds())}` : waiting ? 'Kolejka czeka na zasoby' : '');
    this.activeFill.style.transform = `scaleX(${g.research.progressRatio()})`;
    this.cancelBtn.hidden = !a;
    setText(this.speedEl, `Szybkość badań: ${Math.round(g.research.speed() * 100)}%`);
    const sig = g.state.research.queue.join(',');
    if (this.queueEl.dataset.sig !== sig) {
      this.queueEl.dataset.sig = sig;
      clear(this.queueEl);
      if (g.state.research.queue.length) this.queueEl.append(h('span', { class: 'muted', text: 'Kolejka:' }));
      for (const q of g.state.research.queue) {
        this.queueEl.append(h('button', { class: 'chip', dataset: { action: 'dequeue', id: q }, title: 'Usuń z kolejki' }, [TECH_MAP[q].name, icon('close', 'icon icon-sm')]));
      }
    }
  }

  update() {
    const g = this.game;
    this.updateActive();
    setText(this.countEl, `${g.research.countCompleted()}/${TECHNOLOGIES.length}`);
    for (const [id, btn] of Object.entries(this.filterButtons)) setClass(btn, 'active', id === this.filter);
    if (this.view === 'tree') {
      for (const [id, n] of this.nodes) {
        const st = g.research.status(id);
        if (n.node.dataset.status !== st) {
          n.node.dataset.status = st;
          n.node.className = `tree-node status-${st}`;
          setText(n.status, STATUS_LABEL[st]);
        }
      }
      for (const l of this.links) {
        setClass(l.path, 'done', g.research.isCompleted(l.from));
      }
    } else {
      if (this.currentListSignature() !== this.listSignature) this.rebuildList();
      for (const [id, c] of this.listCards) {
        const s = this.buttonState(id);
        setText(c.status, STATUS_LABEL[g.research.status(id)]);
        setText(c.button, s.label);
        c.button.className = `btn card-btn ${s.cls}`;
        c.button.disabled = s.disabled;
        c.cost.update(TECH_MAP[id].cost);
        c.cost.el.hidden = g.research.isCompleted(id);
        setText(c.note, s.short ? shortfallText(g, TECH_MAP[id].cost) : '');
      }
    }
  }
}
