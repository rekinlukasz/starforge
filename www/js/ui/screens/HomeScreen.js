import { BUILDINGS } from '../../../data/buildings.js';
import { OVERCHARGE } from '../../../data/upgrades.js';
import { TECH_MAP } from '../../../data/technologies.js';
import { rewardText } from '../effectText.js';
import { RESOURCE_MAP } from '../../../data/resources.js';
import { h, setText, setClass, clear } from '../dom.js';
import { icon } from '../Icons.js';
import { formatNumber, formatRate, formatDuration } from '../../utils/Formatter.js';

const FLOATER_POOL = 8;

export class HomeScreen {
  constructor(ui) {
    this.ui = ui;
    this.game = ui.game;
    this.id = 'home';
    this.title = 'Centrum';
    this.el = this.build();
    this.logSignature = '';
  }

  build() {
    // Reactor ----------------------------------------------------------
    this.clickValue = h('span', { class: 'reactor-value' });
    this.reactor = h('button', { class: 'reactor', 'aria-label': 'Reaktor orbitalny — dotknij, aby wygenerować energię' }, [
      h('span', { class: 'reactor-ring ring-outer' }),
      h('span', { class: 'reactor-ring ring-inner' }),
      h('span', { class: 'reactor-core' }, [icon('energy', 'icon reactor-glyph')]),
    ]);
    this.floaters = [];
    const floaterLayer = h('div', { class: 'floaters', 'aria-hidden': 'true' });
    for (let i = 0; i < FLOATER_POOL; i++) {
      const f = h('span', { class: 'floater' });
      floaterLayer.append(f);
      this.floaters.push(f);
    }
    this.floaterIndex = 0;
    // pointerdown reacts immediately and fires once per finger.
    this.reactor.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.onReactor(e);
    });
    this.reactor.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.onReactor(null); }
    });

    this.chargeFill = h('span', { class: 'meter-fill' });
    this.chargeLabel = h('span', { class: 'meter-label' });
    this.chargeMeter = h('div', { class: 'meter', hidden: true }, [h('span', { class: 'meter-track' }, [this.chargeFill]), this.chargeLabel]);

    const reactorPanel = h('section', { class: 'reactor-panel' }, [
      h('div', { class: 'station-name' }, [h('span', { class: 'eyebrow', text: 'Stacja orbitalna' }), h('h1', { text: 'Odrodzenie-7' })]),
      h('div', { class: 'reactor-wrap' }, [this.reactor, floaterLayer]),
      this.clickValue,
      this.chargeMeter,
    ]);

    // Info panels ------------------------------------------------------
    this.objectiveHeading = h('h2', { class: 'panel-title', text: 'Najważniejsze zadanie' });
    this.objectiveTitle = h('h3');
    this.objectiveBody = h('ul', { class: 'objective-list' });
    this.objectiveReward = h('p', { class: 'muted' });
    this.claimBtn = h('button', { class: 'btn btn-primary btn-sm', text: 'Odbierz nagrodę', hidden: true, onclick: () => {
      const m = this.game.missions.featured();
      if (m && this.game.claimMission(m.id)) this.ui.notify(`Nagroda: ${rewardText(m.reward)}`, 'success');
    } });
    const objective = h('section', { class: 'panel' }, [this.objectiveHeading, this.objectiveTitle, this.objectiveBody, this.objectiveReward,
      h('div', { class: 'quick-row' }, [this.claimBtn, h('button', { class: 'btn btn-ghost btn-sm', text: 'Wszystkie zadania', onclick: () => this.ui.missionsPanel.openMissions() })])]);

    this.researchName = h('strong');
    this.researchTime = h('span', { class: 'muted' });
    this.researchFill = h('span', { class: 'meter-fill' });
    this.researchPanel = h('section', { class: 'panel', hidden: true }, [
      h('h2', { class: 'panel-title', text: 'Aktualne badanie' }), this.researchName,
      h('span', { class: 'meter-track' }, [this.researchFill]), this.researchTime,
      h('button', { class: 'btn btn-ghost btn-sm', text: 'Otwórz badania', onclick: () => this.ui.navigation.go('research') }),
    ]);

    this.balanceList = h('dl', { class: 'balance-list' });
    const balance = h('section', { class: 'panel' }, [h('h2', { class: 'panel-title', text: 'Bilans produkcji' }), this.balanceList]);

    this.logList = h('ul', { class: 'log-list' });
    const journal = h('section', { class: 'panel panel-log' }, [h('h2', { class: 'panel-title', text: 'Dziennik stacji' }), this.logList]);

    this.quickBuy = h('button', { class: 'btn btn-primary', onclick: () => this.buyCheapest() });
    this.quickBuyLabel = h('span');
    this.quickBuy.append(icon('production'), this.quickBuyLabel);
    const quick = h('section', { class: 'panel quick-actions' }, [
      h('h2', { class: 'panel-title', text: 'Szybkie akcje' }),
      h('div', { class: 'quick-row' }, [
        this.quickBuy,
        h('button', { class: 'btn btn-ghost', onclick: () => this.ui.navigation.go('production') }, [icon('production'), 'Produkcja']),
        h('button', { class: 'btn btn-ghost', onclick: () => this.ui.saveNow() }, [icon('save'), 'Zapisz']),
      ]),
    ]);

    this.empireList = h('ul', { class: 'objective-list' });
    this.empirePanel = h('section', { class: 'panel', hidden: true }, [
      h('h2', { class: 'panel-title', text: 'Imperium' }), this.empireList,
      h('div', { class: 'quick-row' }, [
        h('button', { class: 'btn btn-ghost btn-sm', text: 'Ekspedycje', onclick: () => this.ui.navigation.go('exploration') }),
        h('button', { class: 'btn btn-ghost btn-sm', text: 'Planety', onclick: () => this.ui.navigation.go('planets') }),
      ]),
    ]);
    const side = h('div', { class: 'home-side' }, [objective, balance, this.researchPanel, this.empirePanel, quick, journal]);
    return h('div', { class: 'screen screen-home' }, [reactorPanel, side]);
  }

  // The 3D reactor is drawn exactly under the (then transparent) DOM button.
  sceneOptions() {
    return {
      anchor: () => {
        const r = this.reactor.getBoundingClientRect();
        return r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
      },
    };
  }

  onReactor(event) {
    const gained = this.game.click();
    if (!gained) return;
    if (!this.game.state.settings.reduceMotion) {
      this.reactor.classList.remove('pulse');
      void this.reactor.offsetWidth; // restart CSS animation
      this.reactor.classList.add('pulse');
      const f = this.floaters[this.floaterIndex];
      this.floaterIndex = (this.floaterIndex + 1) % this.floaters.length;
      const rect = this.reactor.getBoundingClientRect();
      const x = event ? event.clientX - rect.left : rect.width / 2;
      const y = event ? event.clientY - rect.top : rect.height / 2;
      f.textContent = '+' + formatNumber(gained);
      f.style.left = `${x}px`;
      f.style.top = `${y}px`;
      f.classList.remove('fly');
      void f.offsetWidth;
      f.classList.add('fly');
    }
    this.updateReactor();
  }

  // Cheapest affordable unlocked building, by summed cost.
  cheapestAffordable() {
    let best = null;
    for (const b of BUILDINGS) {
      if (!this.game.buildings.isUnlocked(b.id)) continue;
      const cost = this.game.buildings.cost(b.id, 1);
      if (!this.game.resources.canAfford(cost)) continue;
      const total = Object.values(cost).reduce((a, v) => a.add(v), Object.values(cost)[0].mul(0));
      if (!best || total.lt(best.total)) best = { id: b.id, name: b.name, total };
    }
    return best;
  }

  buyCheapest() {
    const best = this.cheapestAffordable();
    if (best && this.game.buildings.buy(best.id, 1)) this.ui.notify(`Zbudowano: ${best.name}`);
  }

  updateReactor() {
    const game = this.game;
    setText(this.clickValue, `+${formatNumber(game.clicks.clickValue())} energii / dotknięcie`);
    const mods = game.modifiers.get();
    this.chargeMeter.hidden = !mods.overchargeUnlocked;
    if (mods.overchargeUnlocked) {
      const remaining = game.clicks.overchargeRemaining();
      const active = remaining > 0;
      setClass(this.reactor, 'overcharged', active);
      setClass(this.chargeMeter, 'active', active);
      const ratio = active ? remaining / mods.overchargeDuration : game.state.click.charge / OVERCHARGE.chargeRequired;
      this.chargeFill.style.transform = `scaleX(${ratio})`;
      setText(this.chargeLabel, active
        ? `Przeciążenie x${mods.overchargeMultiplier.toFixed(1)} — ${formatDuration(remaining)}`
        : `Ładunek reaktora ${game.state.click.charge}/${OVERCHARGE.chargeRequired}`);
    }
  }

  updateObjective() {
    const game = this.game;
    const mission = game.missions.featured();
    let title;
    let items;
    if (mission) {
      const st = game.missions.status(mission.id);
      setText(this.objectiveHeading, st === 'completed' ? 'Zadanie wykonane' : 'Najważniejsze zadanie');
      title = mission.name;
      items = st === 'completed' ? [mission.description] : game.missions.progress(mission.id).parts.map((p) => (p.met ? '✓ ' : '') + p.text);
      setText(this.objectiveReward, `Nagroda: ${rewardText(mission.reward)}`);
      this.claimBtn.hidden = st !== 'completed';
    } else {
      this.claimBtn.hidden = true;
      setText(this.objectiveReward, '');
      setText(this.objectiveHeading, 'Następny cel');
    }
    const locked = BUILDINGS.find((b) => !game.buildings.isUnlocked(b.id) && !b.unlock.tech);
    if (mission) {
      // title and items set above
    } else if (locked) {
      title = `Odblokuj: ${locked.name}`;
      items = game.buildings.unlockStatus(locked.id).missing;
    } else {
      const next = game.upgrades.visible().find((u) => !game.upgrades.isOwned(u.id));
      title = next ? `Kup ulepszenie: ${next.name}` : 'Rozbudowuj produkcję i gromadź dane badawcze';
      items = next ? [next.description] : ['Dane badawcze będą potrzebne w drzewku technologii.'];
    }
    setText(this.objectiveTitle, title);
    const sig = items.join('|');
    if (this.objectiveBody.dataset.sig !== sig) {
      this.objectiveBody.dataset.sig = sig;
      clear(this.objectiveBody);
      items.forEach((t) => this.objectiveBody.append(h('li', { text: t })));
    }
  }

  updateBalance() {
    const game = this.game;
    const ids = Object.keys(game.state.resources).filter((id) => game.state.resources[id].unlocked);
    const sig = ids.join(',');
    if (this.balanceList.dataset.sig !== sig) {
      this.balanceList.dataset.sig = sig;
      clear(this.balanceList);
      this.balanceRows = {};
      for (const id of ids) {
        const dd = h('dd');
        this.balanceList.append(h('dt', {}, [icon(RESOURCE_MAP[id].icon, 'icon icon-sm'), RESOURCE_MAP[id].name]), dd);
        this.balanceRows[id] = dd;
      }
    }
    for (const id of ids) {
      const { net } = game.production.balance(id);
      setText(this.balanceRows[id], formatRate(net));
      setClass(this.balanceRows[id], 'negative', net.isNegative());
    }
  }

  updateLog() {
    const log = this.game.state.log.slice(0, 4);
    const sig = log.map((e) => e.t + e.text.length).join(',');
    if (sig === this.logSignature) return;
    this.logSignature = sig;
    clear(this.logList);
    for (const e of log) this.logList.append(h('li', { text: e.text }));
  }

  updateResearch() {
    const g = this.game;
    const visible = g.buildings.level('researchLab') > 0 || g.research.countCompleted() > 0;
    this.researchPanel.hidden = !visible;
    if (!visible) return;
    const a = g.state.research.active;
    setText(this.researchName, a ? TECH_MAP[a.id].name : 'Brak aktywnego badania');
    setText(this.researchTime, a ? `Pozostało ${formatDuration(g.research.remainingSeconds())}` : 'Dane badawcze czekają na wykorzystanie.');
    this.researchFill.style.transform = `scaleX(${g.research.progressRatio()})`;
  }

  updateEmpire() {
    const g = this.game;
    const active = g.state.expeditions.active;
    const colonies = g.colonies.summary();
    const visible = active.length > 0 || colonies.length > 0 || g.research.isCompleted('spaceflight');
    this.empirePanel.hidden = !visible;
    if (!visible) return;
    const done = active.filter((e) => e.status === 'completed').length;
    const lines = [
      `Ekspedycje: ${active.length} aktywnych${done ? `, ${done} do odebrania` : ''}`,
      `Kolonie: ${colonies.length ? colonies.map((c) => `${c.name} (${c.stage})`).join(', ') : 'brak'}`,
      `Trasy: ${g.state.logistics.routes.filter((r) => r.active).length} aktywnych · w kolejce stoczni: ${g.state.fleet.queue.length}`,
    ];
    const sig = lines.join('|');
    if (this.empireList.dataset.sig === sig) return;
    this.empireList.dataset.sig = sig;
    clear(this.empireList);
    lines.forEach((t) => this.empireList.append(h('li', { text: t })));
  }

  update() {
    this.updateEmpire();
    this.updateResearch();
    this.updateReactor();
    this.updateObjective();
    this.updateBalance();
    this.updateLog();
    const best = this.cheapestAffordable();
    this.quickBuy.disabled = !best;
    setText(this.quickBuyLabel, best ? `Zbuduj: ${best.name}` : 'Brak taniej budowy');
  }
}
