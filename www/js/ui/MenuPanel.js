import { h, clear } from './dom.js';
import { icon } from './Icons.js';
import { formatDuration, formatNumber } from '../utils/Formatter.js';
import { RESOURCES } from '../../data/resources.js';
import { prestigeUpgradeList } from './prestigeUpgrades.js';
import { AUTOBUY_THRESHOLDS } from '../systems/AutomationSystem.js';

// "More" panel: journal, storage overview and settings (save tools).
export class MenuPanel {
  constructor(ui) {
    this.ui = ui;
    this.game = ui.game;
  }

  open() {
    this.ui.modals.open({
      title: 'Więcej',
      icon: 'menu',
      body: [
        h('div', { class: 'menu-grid' }, [
          this.entry('mission', 'Zadania', this.missionSummary(), () => this.ui.missionsPanel.openMissions()),
          this.entry('trophy', 'Osiągnięcia', `${this.game.achievements.count()} odblokowanych`, () => this.ui.missionsPanel.openAchievements()),
          this.entry('journal', 'Dziennik', 'Raporty i odkrycia stacji', () => this.openJournal()),
          this.hasPrestige() ? this.entry('prestige', 'Prestiż', `${formatNumber(this.game.resources.amount('prestigePoints'))} PP do wydania`, () => this.openPrestige()) : null,
          this.entry('storage', 'Magazyn', 'Wszystkie zasoby i pojemności', () => this.openStorage()),
          this.entry('settings', 'Ustawienia', 'Zapis, eksport, import, offline', () => this.openSettings()),
        ]),
      ],
    });
  }

  // Prestige upgrades stay reachable after a rebirth, before the galaxy
  // screen unlocks again.
  hasPrestige() {
    return this.game.state.prestige.rebirths > 0 || this.game.resources.amount('prestigePoints').gt(0);
  }

  openPrestige() {
    const upgrades = prestigeUpgradeList(this.game);
    this.ui.modals.open({ title: 'Ulepszenia prestiżu', icon: 'prestige', body: [upgrades.summary, upgrades.el] });
  }

  missionSummary() {
    const n = this.game.missions.claimableCount();
    return n ? `${n} do odebrania` : 'Cele i nagrody';
  }

  entry(iconName, title, desc, onClick) {
    return h('button', { class: 'menu-entry', onclick: onClick }, [
      icon(iconName, 'icon menu-icon'),
      h('span', { class: 'menu-text' }, [h('strong', { text: title }), h('span', { class: 'muted', text: desc })]),
    ]);
  }

  openJournal() {
    const list = h('ul', { class: 'log-list log-full' });
    for (const e of this.game.state.log) {
      list.append(h('li', {}, [h('time', { class: 'muted', text: new Date(e.t).toLocaleString('pl-PL') }), h('p', { text: e.text })]));
    }
    this.ui.modals.open({ title: 'Dziennik stacji', icon: 'journal', body: [list] });
  }

  openStorage() {
    const table = h('table', { class: 'storage-table' });
    const refresh = () => {
      clear(table);
      table.append(h('tr', {}, [h('th', { text: 'Zasób' }), h('th', { text: 'Ilość' }), h('th', { text: 'Limit' }), h('th', { text: 'Saldo/s' })]));
      for (const r of RESOURCES) {
        if (!this.game.state.resources[r.id].unlocked) continue;
        const cap = this.game.resources.cap(r.id);
        const b = this.game.production.balance(r.id);
        table.append(h('tr', {}, [
          h('td', {}, [icon(r.icon, 'icon icon-sm'), r.name]),
          h('td', { text: formatNumber(this.game.resources.amount(r.id)) }),
          h('td', { text: cap ? formatNumber(cap) : '∞' }),
          h('td', { class: b.net.isNegative() ? 'negative' : '', text: formatNumber(b.net) }),
        ]));
      }
    };
    refresh();
    this.ui.modals.open({ title: 'Magazyn', icon: 'storage', body: [table], onUpdate: refresh });
  }

  openSettings() {
    const s = this.game.state.settings;
    const offlineSelect = h('select', { class: 'input', 'aria-label': 'Limit produkcji offline' });
    for (const hours of [2, 4, 8, 12, 24]) {
      const opt = h('option', { value: String(hours), text: `${hours} h` });
      if (hours === s.offlineCapHours) opt.selected = true;
      offlineSelect.append(opt);
    }
    offlineSelect.addEventListener('change', () => this.game.setOfflineCap(offlineSelect.value));

    const motion = h('input', { type: 'checkbox', class: 'checkbox' });
    motion.checked = s.reduceMotion;
    motion.addEventListener('change', () => this.game.setReduceMotion(motion.checked));

    const autoRows = [];
    if (this.game.automation.available()) {
      const thr = h('select', { class: 'input', 'aria-label': 'Próg automatycznego zakupu' });
      for (const v of AUTOBUY_THRESHOLDS) {
        const opt = h('option', { value: String(v), text: `${Math.round(v * 100)}% zapasów` });
        if (v === this.game.state.automation.threshold) opt.selected = true;
        thr.append(opt);
      }
      thr.addEventListener('change', () => this.game.setAutobuyThreshold(thr.value));
      autoRows.push(h('div', { class: 'settings-row' }, [h('label', { text: 'Automatyczny zakup: maks. koszt' }), thr]));
    }
    if (this.game.modifiers.hasFeature('autoclick')) {
      const ac = h('input', { type: 'checkbox', class: 'checkbox' });
      ac.checked = this.game.state.automation.autoclick;
      ac.addEventListener('change', () => this.game.setAutoclick(ac.checked));
      autoRows.push(h('label', { class: 'settings-row' }, [h('span', { text: 'Automatyczny zapłon reaktora' }), ac]));
    }
    const saved = this.game.state.meta.lastSavedAt;
    this.ui.modals.open({
      title: 'Ustawienia',
      icon: 'settings',
      body: [
        h('div', { class: 'settings-row' }, [h('label', { text: 'Limit produkcji offline' }), offlineSelect]),
        h('label', { class: 'settings-row' }, [h('span', { text: 'Ogranicz animacje' }), motion]),
        ...autoRows,
        h('p', { class: 'muted', text: `Efektywny limit offline: ${this.game.offline.capHours()} h (z technologiami)` }),
        h('p', { class: 'muted', text: saved ? `Ostatni zapis: ${new Date(saved).toLocaleTimeString('pl-PL')}` : 'Brak zapisu' }),
        h('p', { class: 'muted', text: `Czas gry: ${formatDuration(this.game.state.meta.simTime)}` }),
        h('div', { class: 'quick-row' }, [
          h('button', { class: 'btn btn-primary', onclick: () => this.ui.saveNow() }, [icon('save'), 'Zapisz teraz']),
          h('button', { class: 'btn btn-ghost', onclick: () => this.openExport() }, ['Eksportuj zapis']),
          h('button', { class: 'btn btn-ghost', onclick: () => this.openImport() }, ['Importuj zapis']),
        ]),
        h('div', { class: 'danger-zone' }, [
          h('button', { class: 'btn btn-danger', onclick: () => this.confirmReset() }, ['Rozpocznij od nowa']),
        ]),
      ],
    });
  }

  openExport() {
    const code = this.game.exportSave();
    const area = h('textarea', { class: 'input code-area', readonly: true, rows: '6' });
    area.value = code;
    this.ui.modals.open({
      title: 'Eksport zapisu',
      icon: 'save',
      body: [h('p', { text: 'Skopiuj ten kod i przechowaj go w bezpiecznym miejscu.' }), area],
      buttons: [
        { label: 'Kopiuj', kind: 'primary', closes: false, onClick: () => this.copy(area) },
        { label: 'Zamknij', kind: 'ghost' },
      ],
    });
    area.select();
  }

  async copy(area) {
    try {
      await navigator.clipboard.writeText(area.value);
      this.ui.notify('Skopiowano kod zapisu', 'success');
    } catch {
      area.select();
      this.ui.notify('Zaznaczono kod — skopiuj go ręcznie');
    }
  }

  openImport() {
    const area = h('textarea', { class: 'input code-area', rows: '6', placeholder: 'SF1:...' });
    const error = h('p', { class: 'error-text' });
    this.ui.modals.open({
      title: 'Import zapisu',
      icon: 'save',
      body: [h('p', { text: 'Wklej kod zapisu. Obecny postęp zostanie zastąpiony.' }), area, error],
      buttons: [
        {
          label: 'Importuj', kind: 'danger', closes: false,
          onClick: () => {
            try {
              this.ui.importSave(area.value);
              this.ui.modals.close();
            } catch (err) {
              error.textContent = err.message;
            }
          },
        },
        { label: 'Anuluj', kind: 'ghost' },
      ],
    });
  }

  confirmReset() {
    const check = h('input', { type: 'checkbox', class: 'checkbox' });
    const dialog = this.ui.modals.open({
      title: 'Nowa gra',
      icon: 'close',
      body: [
        h('p', { text: 'Cały postęp zostanie trwale usunięty, łącznie z kopią zapasową.' }),
        h('label', { class: 'settings-row' }, [h('span', { text: 'Rozumiem, chcę zacząć od nowa' }), check]),
      ],
      buttons: [
        { label: 'Usuń postęp', kind: 'danger', onClick: () => { if (!check.checked) return false; this.ui.resetGame(); return true; } },
        { label: 'Anuluj', kind: 'ghost' },
      ],
    });
    const btn = dialog.querySelector('.btn-danger');
    btn.disabled = true;
    check.addEventListener('change', () => { btn.disabled = !check.checked; });
  }
}
