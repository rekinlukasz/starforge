import { PRESTIGE_UPGRADES } from '../../data/prestige.js';
import { h, setText, clear } from './dom.js';
import { icon } from './Icons.js';
import { formatNumber } from '../utils/Formatter.js';

// List of prestige upgrades. Without `plan`, buttons buy right away with the
// current points. With a `plan` object ({ id: extra levels }), buttons queue
// levels against `budget` points; the plan is bought when the rebirth happens.
export function prestigeUpgradeList(game, { plan = null, budget = 0 } = {}) {
  const el = h('div', { class: 'prestige-upgrades' });
  const summary = h('p');
  const render = () => {
    clear(el);
    const left = plan ? budget - game.prestige.planCost(plan) : game.resources.amount('prestigePoints').toNumber();
    setText(summary, plan
      ? `Do wydania: ${formatNumber(budget)} PP · zaplanowano: ${formatNumber(budget - left)} PP · zostanie: ${formatNumber(left)} PP`
      : `Dostępne punkty prestiżu: ${formatNumber(left)}`);
    for (const u of PRESTIGE_UPGRADES) {
      const lvl = game.prestige.upgradeLevel(u.id);
      const queued = plan?.[u.id] ?? 0;
      const maxed = lvl + queued >= u.maxLevel;
      const cost = game.prestige.upgradeCost(u.id, lvl + queued);
      const buy = h('button', { class: 'btn btn-sm btn-primary', text: maxed ? 'Maks.' : `${plan ? '+1' : 'Kup'} (${cost} PP)` });
      buy.disabled = maxed || left < cost;
      buy.addEventListener('click', () => {
        if (plan) plan[u.id] = queued + 1;
        else game.buyPrestigeUpgrade(u.id);
        render();
      });
      const buttons = [buy];
      if (plan) {
        const undo = h('button', { class: 'btn btn-sm btn-ghost', text: '−1', 'aria-label': `Usuń poziom ${u.name} z planu` });
        undo.disabled = queued === 0;
        undo.addEventListener('click', () => {
          if (queued > 1) plan[u.id] = queued - 1;
          else delete plan[u.id];
          render();
        });
        buttons.unshift(undo);
      }
      el.append(h('div', { class: 'colony-building' }, [
        icon(u.icon, 'icon card-icon'),
        h('div', { class: 'card-titles' }, [
          h('strong', { text: `${u.name} · ${lvl + queued}/${u.maxLevel}${queued ? ` (+${queued})` : ''}` }),
          h('span', { class: 'muted', text: u.description }),
        ]),
        h('div', { class: 'quick-row' }, buttons),
      ]));
    }
  };
  render();
  return { el, summary, render };
}
