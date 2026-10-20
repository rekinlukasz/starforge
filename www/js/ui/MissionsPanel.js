import { MISSIONS, MISSION_TYPES } from '../../data/missions.js';
import { ACHIEVEMENTS, ACHIEVEMENT_BONUS } from '../../data/achievements.js';
import { RESOURCE_MAP } from '../../data/resources.js';
import { h, setText, setClass, clear } from './dom.js';
import { icon } from './Icons.js';
import { rewardText } from './effectText.js';
import { evaluateConditions } from '../systems/Conditions.js';

const ORDER = { completed: 0, active: 1, locked: 2, claimed: 3 };

// Mission list with progress and claim buttons, plus the achievements list.
export class MissionsPanel {
  constructor(ui) {
    this.ui = ui;
    this.game = ui.game;
  }

  missionRow(m) {
    const fill = h('span', { class: 'meter-fill' });
    const parts = h('ul', { class: 'card-req' });
    const status = h('span', { class: 'badge' });
    const btn = h('button', { class: 'btn btn-primary btn-sm' });
    const warn = h('div', { class: 'card-note' });
    btn.addEventListener('click', () => {
      if (this.game.claimMission(m.id)) this.ui.notify(`Nagroda odebrana: ${rewardText(m.reward)}`, 'success');
    });
    const row = h('article', { class: 'mission' }, [
      h('div', { class: 'mission-head' }, [
        icon('mission', 'icon mission-icon'),
        h('div', { class: 'card-titles' }, [h('span', { class: 'eyebrow', text: MISSION_TYPES[m.type] }), h('h3', { text: m.name }), status]),
        btn,
      ]),
      h('p', { class: 'card-desc', text: m.description }),
      parts,
      h('span', { class: 'meter-track' }, [fill]),
      h('div', { class: 'muted', text: `Nagroda: ${rewardText(m.reward)}` }),
      warn,
    ]);
    const update = () => {
      const st = this.game.missions.status(m.id);
      const prog = this.game.missions.progress(m.id);
      setClass(row, 'claimable', st === 'completed');
      setClass(row, 'done', st === 'claimed');
      setText(status, { completed: 'Gotowe do odebrania', active: 'W toku', locked: 'Zablokowane', claimed: 'Odebrane' }[st]);
      const ratio = st === 'claimed' || st === 'completed' ? 1 : prog.ratio;
      fill.style.transform = `scaleX(${ratio})`;
      const sig = st + prog.parts.map((p) => p.text).join('|');
      if (parts.dataset.sig !== sig) {
        parts.dataset.sig = sig;
        clear(parts);
        if (st === 'locked') {
          const after = evaluateConditions(this.game.state, { missions: m.after });
          after.parts.filter((p) => !p.met).forEach((p) => parts.append(h('li', {}, [icon('lock', 'icon icon-sm'), p.text])));
        } else if (st === 'active') {
          prog.parts.forEach((p) => parts.append(h('li', { class: p.met ? 'positive' : '' }, [icon(p.met ? 'check' : 'mission', 'icon icon-sm'), p.text])));
        }
      }
      btn.hidden = st !== 'completed';
      btn.textContent = 'Odbierz';
      const overflow = st === 'completed' ? this.game.missions.overflow(m.id) : [];
      setText(warn, overflow.length ? `Uwaga: magazyn pełny — część nagrody przepadnie (${overflow.map((r) => RESOURCE_MAP[r].name).join(', ')})` : '');
    };
    update();
    return { row, update };
  }

  openMissions() {
    const list = h('div', { class: 'mission-list' });
    let rows = [];
    let sig = '';
    const refresh = () => {
      const sorted = [...MISSIONS].sort((a, b) => ORDER[this.game.missions.status(a.id)] - ORDER[this.game.missions.status(b.id)]);
      const nextSig = sorted.map((m) => m.id + this.game.missions.status(m.id)).join(',');
      if (nextSig !== sig) {
        sig = nextSig;
        clear(list);
        rows = sorted.map((m) => this.missionRow(m));
        rows.forEach((r) => list.append(r.row));
      } else rows.forEach((r) => r.update());
    };
    refresh();
    this.ui.modals.open({ title: 'Zadania', icon: 'mission', body: [list], onUpdate: refresh });
  }

  openAchievements() {
    const list = h('div', { class: 'achievement-grid' });
    const summary = h('p', { class: 'muted' });
    const refresh = () => {
      clear(list);
      const n = this.game.achievements.count();
      setText(summary, `Odblokowano ${n}/${ACHIEVEMENTS.length} · premia do produkcji +${Math.round(n * ACHIEVEMENT_BONUS * 100)}%`);
      for (const a of ACHIEVEMENTS) {
        const unlocked = this.game.achievements.isUnlocked(a.id);
        const prog = evaluateConditions(this.game.state, a.goal);
        list.append(h('div', { class: `achievement${unlocked ? ' unlocked' : ''}` }, [
          icon(unlocked ? a.icon : 'lock', 'icon achievement-icon'),
          h('div', {}, [h('strong', { text: a.name }), h('p', { class: 'muted', text: a.description }),
            unlocked ? null : h('span', { class: 'muted', text: `${Math.floor(prog.ratio * 100)}%` })]),
        ]));
      }
    };
    refresh();
    this.ui.modals.open({ title: 'Osiągnięcia', icon: 'trophy', body: [summary, list] });
  }
}

