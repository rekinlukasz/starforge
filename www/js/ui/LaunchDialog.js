import { SHIPS, SHIP_MAP } from '../../data/ships.js';
import { PLANET_MAP } from '../../data/planets.js';
import { SECTOR_MAP } from '../../data/sectors.js';
import { RESOURCE_MAP } from '../../data/resources.js';
import { h, setText, clear } from './dom.js';
import { icon } from './Icons.js';
import { costView } from './components.js';
import { rewardText } from './effectText.js';
import { formatDuration, formatNumber } from '../utils/Formatter.js';

const OUTCOME = { victory: 'Zwycięstwo', retreat: 'Odwrót (brak nagród)' };

// Fleet picker + forecast for any expedition kind. Opens as a modal.
export function openLaunchDialog(ui, kind, id) {
  const game = ui.game;
  const def = game.expeditions.definition(kind, id);
  if (!def) return;
  const fleet = game.expeditions.defaultFleet(def);

  // Ship types the player may add: required ones, alternatives, and for
  // mining/combat any extra ship that improves the result.
  const allowed = new Set([...Object.keys(def.ships), ...Object.keys(def.altShips ?? {})]);
  if (def.type === 'mining') allowed.add('miner');
  if (def.type === 'combat') SHIPS.filter((s) => s.role === 'military').forEach((s) => allowed.add(s.id));

  const pickers = h('div', { class: 'fleet-picker' });
  const counts = new Map();
  for (const sid of allowed) {
    const value = h('span', { class: 'stepper-value' });
    const avail = h('span', { class: 'muted' });
    const minus = h('button', { class: 'icon-btn', 'aria-label': 'Mniej', onclick: () => { fleet[sid] = Math.max(0, (fleet[sid] ?? 0) - 1); refresh(); } }, [icon('minus', 'icon icon-sm')]);
    const plus = h('button', { class: 'icon-btn', 'aria-label': 'Więcej', onclick: () => { fleet[sid] = Math.min(game.fleet.available(sid), (fleet[sid] ?? 0) + 1); refresh(); } }, [icon('plus', 'icon icon-sm')]);
    pickers.append(h('div', { class: 'stepper-row' }, [icon(SHIP_MAP[sid].icon, 'icon'), h('span', { class: 'stepper-name', text: SHIP_MAP[sid].name }), avail, minus, value, plus]));
    counts.set(sid, { value, avail });
  }

  const cost = costView(game);
  const duration = h('dd');
  const minText = h('p', { class: 'muted' });
  const rewards = h('p');
  const forecastBox = h('div', { class: 'forecast', hidden: def.type !== 'combat' });
  const reasons = h('ul', { class: 'card-req' });
  const repeat = h('input', { type: 'checkbox', class: 'checkbox' });
  const repeatRow = h('label', { class: 'settings-row', hidden: !(def.repeatable && game.modifiers.hasFeature('autoclaim')) }, [h('span', { text: 'Powtarzaj automatycznie' }), repeat]);
  const confirm = h('input', { type: 'checkbox', class: 'checkbox' });
  const confirmRow = h('label', { class: 'settings-row warn-row', hidden: true }, [h('span', { text: 'Rozumiem ryzyko strat i chcę wysłać flotę' }), confirm]);
  confirm.addEventListener('change', () => refresh());

  const minFleet = (m) => Object.entries(m).map(([s, n]) => `${SHIP_MAP[s].name} x${n}`).join(', ');
  setText(minText, `Wymagana flota: ${minFleet(def.ships)}${def.altShips ? ` lub ${minFleet(def.altShips)}` : ''}`);
  const discoveries = [
    ...(def.discovers?.planets ?? []).map((p) => `planeta ${PLANET_MAP[p].name}`),
    ...(def.discovers?.sectors ?? []).map((s) => `sektor ${SECTOR_MAP[s].name}`),
  ];
  const rewardParts = [];
  if (Object.keys(def.rewards).length) rewardParts.push(rewardText(def.rewards) + (def.type === 'mining' ? ' (x ładowność / 60)' : ''));
  if (def.everyN) rewardParts.push(`co ${def.everyN.count}. wyprawa: ${rewardText(def.everyN.rewards)}`);
  if (discoveries.length) rewardParts.push(`odkrycie: ${discoveries.join(', ')}`);
  if (kind === 'survey') rewardParts.push('pełna analiza złóż i warunków planety');
  if (kind === 'colonize') rewardParts.push('założenie placówki (statek kolonizacyjny zostaje zużyty)');
  setText(rewards, `Nagrody: ${rewardParts.join('; ') || '—'}`);

  let dialog;
  const refresh = () => {
    for (const [sid, c] of counts) {
      setText(c.value, String(fleet[sid] ?? 0));
      setText(c.avail, `wolne: ${game.fleet.available(sid)}`);
    }
    cost.update(game.expeditions.fuelCost(def));
    const chosen = Object.fromEntries(Object.entries(fleet).filter(([, n]) => n > 0));
    setText(duration, Object.keys(chosen).length ? formatDuration(game.expeditions.duration(def, chosen)) : '—');
    const check = game.expeditions.check(kind, id, chosen);
    clear(reasons);
    check.reasons.forEach((r) => reasons.append(h('li', {}, [icon('lock', 'icon icon-sm'), r])));
    let needsConfirm = false;
    if (def.type === 'combat') {
      clear(forecastBox);
      const f = game.combat.forecast(def, chosen);
      const lost = Object.entries(f.destroyed).filter(([, n]) => n > 0).map(([s, n]) => `${SHIP_MAP[s].name} x${n}`);
      const dmg = Object.entries(f.damaged).filter(([, n]) => n > 0).map(([s, n]) => `${SHIP_MAP[s].name} x${n}`);
      forecastBox.append(
        h('h3', { text: 'Prognoza starcia' }),
        h('dl', { class: 'detail-list' }, [
          h('dt', { text: 'Siła floty' }), h('dd', { text: formatNumber(f.ownPower) }),
          h('dt', { text: 'Szacowane zagrożenie' }), h('dd', { text: formatNumber(f.enemyPower) }),
          h('dt', { text: 'Przewidywany wynik' }), h('dd', { class: f.outcome === 'victory' ? 'positive' : 'negative', text: OUTCOME[f.outcome] }),
          h('dt', { text: 'Utrata kadłuba' }), h('dd', { text: `${Math.round(f.hullLost * 100)}%` }),
          h('dt', { text: 'Zniszczone' }), h('dd', { text: lost.join(', ') || 'brak' }),
          h('dt', { text: 'Uszkodzone' }), h('dd', { text: dmg.join(', ') || 'brak' }),
        ]),
        h('p', { class: 'muted', text: `Flota wycofuje się przy ${Math.round((game.state.settings.retreatAt ?? 0.5) * 100)}% kadłuba. Walka jest deterministyczna — prognoza odpowiada wynikowi.` }),
      );
      needsConfirm = f.outcome !== 'victory' || lost.length > 0;
    }
    confirmRow.hidden = !needsConfirm;
    const btn = dialog?.querySelector('.modal-actions .btn');
    if (btn) btn.disabled = !check.ok || (needsConfirm && !confirm.checked);
  };

  dialog = ui.modals.open({
    title: def.name,
    icon: kind === 'colonize' ? 'colony' : def.type === 'combat' ? 'swords' : 'explore',
    body: [
      minText,
      h('h3', { text: 'Flota' }),
      pickers,
      h('dl', { class: 'detail-list' }, [h('dt', { text: 'Czas wyprawy' }), duration]),
      h('h3', { text: 'Koszt wyprawy' }),
      cost.el,
      rewards,
      forecastBox,
      repeatRow,
      confirmRow,
      reasons,
    ],
    buttons: [
      {
        label: 'Wyślij', kind: 'primary', closes: false,
        onClick: () => {
          const chosen = Object.fromEntries(Object.entries(fleet).filter(([, n]) => n > 0));
          const rec = game.launchExpedition(kind, id, chosen, { repeat: repeat.checked });
          if (rec) {
            ui.notify(`Wysłano: ${def.name}`, 'success');
            ui.modals.close();
          } else refresh();
        },
      },
      { label: 'Anuluj', kind: 'ghost' },
    ],
    onUpdate: refresh,
  });
  refresh();
}

export function resourceList(map) {
  return Object.entries(map).map(([r, v]) => `${RESOURCE_MAP[r]?.name ?? r} ${formatNumber(v)}`).join(', ');
}
