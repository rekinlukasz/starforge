import { RESOURCES, RESOURCE_MAP } from '../../data/resources.js';
import { h, setText, setClass, clear } from './dom.js';
import { icon } from './Icons.js';
import { formatNumber, formatRate, formatDuration } from '../utils/Formatter.js';

// Top bar with every unlocked resource: amount, net rate, fill level.
export class ResourceBar {
  constructor(game, modals) {
    this.game = game;
    this.modals = modals;
    this.el = h('div', { class: 'resource-bar', role: 'list' });
    this.items = new Map();
    this.signature = '';
    this.el.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-resource]');
      if (chip) this.showDetails(chip.dataset.resource);
    });
  }

  rebuild() {
    clear(this.el);
    this.items.clear();
    for (const r of RESOURCES) {
      if (!this.game.state.resources[r.id].unlocked) continue;
      const amount = h('span', { class: 'res-amount' });
      const rate = h('span', { class: 'res-rate' });
      const fill = h('span', { class: 'res-fill' });
      const chip = h('button', { class: 'res-chip', dataset: { resource: r.id }, role: 'listitem', 'aria-label': r.name, title: r.name }, [
        icon(r.icon, 'icon res-icon'),
        h('span', { class: 'res-values' }, [amount, rate]),
        h('span', { class: 'res-track' }, [fill]),
      ]);
      this.el.append(chip);
      this.items.set(r.id, { chip, amount, rate, fill });
    }
  }

  update() {
    const sig = RESOURCES.filter((r) => this.game.state.resources[r.id].unlocked).map((r) => r.id).join(',');
    if (sig !== this.signature) {
      this.signature = sig;
      this.rebuild();
    }
    for (const [id, item] of this.items) {
      const amount = this.game.resources.amount(id);
      const cap = this.game.resources.cap(id);
      const { net } = this.game.production.balance(id);
      setText(item.amount, formatNumber(amount));
      setText(item.rate, formatRate(net));
      setClass(item.rate, 'negative', net.isNegative());
      const ratio = cap ? Math.min(1, amount.div(cap).toNumber()) : 0;
      item.fill.style.transform = `scaleX(${ratio})`;
      setClass(item.chip, 'full', Boolean(cap) && ratio >= 0.999);
    }
  }

  showDetails(id) {
    const def = RESOURCE_MAP[id];
    if (!def) return;
    const game = this.game;
    const rows = h('dl', { class: 'detail-list' });
    const values = {};
    const row = (key, label) => {
      values[key] = h('dd');
      rows.append(h('dt', { text: label }), values[key]);
    };
    row('amount', 'Ilość');
    row('cap', 'Pojemność');
    row('income', 'Przyrost');
    row('expense', 'Zużycie');
    row('net', 'Saldo');
    row('ttc', 'Do zapełnienia');
    const refresh = () => {
      const b = game.production.balance(id);
      const cap = game.resources.cap(id);
      setText(values.amount, formatNumber(game.resources.amount(id)));
      setText(values.cap, cap ? formatNumber(cap) : 'bez limitu');
      setText(values.income, formatRate(b.income));
      setText(values.expense, b.expense.isZero() ? '0/s' : '-' + formatNumber(b.expense) + '/s');
      setText(values.net, formatRate(b.net));
      setText(values.ttc, b.timeToCap === null ? '—' : b.timeToCap === 0 ? 'pełny' : formatDuration(b.timeToCap));
    };
    refresh();
    this.modals.open({
      title: def.name,
      icon: def.icon,
      body: [
        h('p', { text: def.description }),
        rows,
        h('p', { class: 'muted', text: `Pozyskiwanie: ${def.sources}` }),
        h('p', { class: 'muted', text: `Zastosowanie: ${def.uses}` }),
      ],
      onUpdate: refresh,
    });
  }
}
