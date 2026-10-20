import { RESOURCE_MAP } from '../../data/resources.js';
import { h, setText, setClass, clear } from './dom.js';
import { icon } from './Icons.js';
import { formatNumber } from '../utils/Formatter.js';

// Renders a cost as chips; unaffordable parts get the "short" class.
// Returns { el, update(cost) } so the chips can refresh in place.
export function costView(game) {
  const el = h('div', { class: 'cost' });
  let keys = '';
  const chips = new Map();
  const update = (cost) => {
    const sig = Object.keys(cost).join(',');
    if (sig !== keys) {
      keys = sig;
      clear(el);
      chips.clear();
      for (const id of Object.keys(cost)) {
        const value = h('span');
        const chip = h('span', { class: 'cost-chip', title: RESOURCE_MAP[id].name }, [icon(RESOURCE_MAP[id].icon, 'icon icon-sm'), value]);
        chips.set(id, { chip, value });
        el.append(chip);
      }
    }
    for (const [id, v] of Object.entries(cost)) {
      const c = chips.get(id);
      setText(c.value, formatNumber(v));
      setClass(c.chip, 'short', game.resources.amount(id).lt(v));
    }
  };
  return { el, update };
}

// Human readable list of missing resources, e.g. "Brakuje: Metal 12".
export function shortfallText(game, cost) {
  const parts = game.resources.shortfall(cost).map((s) => `${RESOURCE_MAP[s.id].name} ${formatNumber(s.need.sub(s.have))}`);
  return parts.length ? `Brakuje: ${parts.join(', ')}` : '';
}
