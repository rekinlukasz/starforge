import { h } from './dom.js';
import { ResourceBar } from './ResourceBar.js';
import { ModalManager } from './ModalManager.js';
import { NotificationManager } from './NotificationManager.js';
import { Navigation } from './Navigation.js';
import { MenuPanel } from './MenuPanel.js';
import { HomeScreen } from './screens/HomeScreen.js';
import { ProductionScreen } from './screens/ProductionScreen.js';
import { ResearchScreen } from './screens/ResearchScreen.js';
import { PlanetsScreen } from './screens/PlanetsScreen.js';
import { FleetScreen } from './screens/FleetScreen.js';
import { ExplorationScreen } from './screens/ExplorationScreen.js';
import { GalaxyScreen } from './screens/GalaxyScreen.js';
import { SHIP_MAP } from '../../data/ships.js';
import { PLANET_MAP } from '../../data/planets.js';
import { SECTOR_MAP } from '../../data/sectors.js';
import { MEGASTRUCTURE_MAP } from '../../data/megastructures.js';
import { MissionsPanel } from './MissionsPanel.js';
import { TECH_MAP } from '../../data/technologies.js';
import { MISSION_MAP } from '../../data/missions.js';
import { ACHIEVEMENT_MAP } from '../../data/achievements.js';
import { BUILDING_MAP } from '../../data/buildings.js';
import { RESOURCE_MAP } from '../../data/resources.js';
import { formatDuration, formatNumber } from '../utils/Formatter.js';

// Builds the DOM once; afterwards only updates the active screen in place.
export class UIManager {
  constructor(game, root) {
    this.game = game;
    this.root = root;
    this.modals = null;
  }

  mount() {
    const app = h('div', { class: 'app' });
    this.root.append(app);
    this.modals = new ModalManager(this.root);
    this.toasts = new NotificationManager(this.root);
    this.resourceBar = new ResourceBar(this.game, this.modals);
    this.menu = new MenuPanel(this);
    this.missionsPanel = new MissionsPanel(this);

    this.screens = new Map();
    this.content = h('main', { class: 'content' });
    this.navigation = new Navigation({ onChange: (id) => this.show(id), onMenu: () => this.menu.open() });
    const home = new HomeScreen(this);
    const production = new ProductionScreen(this);
    const research = new ResearchScreen(this);
    const g = this.game;
    const spaceAge = () => g.research.isCompleted('spaceflight') || g.fleet.all().some((s) => g.fleet.owned(s.id) > 0);
    const tabs = [
      [home, 'home', () => true],
      [production, 'production', () => true],
      [research, 'research', () => g.buildings.level('researchLab') > 0 || g.research.countCompleted() > 0],
      [new PlanetsScreen(this), 'planet', () => g.planets.knownPlanets().length > 0 || g.colonies.ids().length > 0],
      [new FleetScreen(this), 'fleet', spaceAge],
      [new ExplorationScreen(this), 'explore', spaceAge],
      [new GalaxyScreen(this), 'galaxy', spaceAge],
    ];
    for (const [screen, iconName, visible] of tabs) {
      this.screens.set(screen.id, screen);
      screen.el.hidden = true;
      this.content.append(screen.el);
      this.navigation.register(screen, iconName, visible);
    }
    app.append(h('header', { class: 'topbar' }, [this.resourceBar.el]), this.content, this.navigation.el);
    this.navigation.go('home', { remember: false });
    this.bindEvents();
    this.render();
  }

  bindEvents() {
    const ev = this.game.events;
    const g = this.game;
    ev.on('buildingUnlocked', (id) => this.notify(`Nowy budynek: ${BUILDING_MAP[id].name}`, 'success'));
    ev.on('resourceUnlocked', (id) => this.notify(`Nowy zasób: ${RESOURCE_MAP[id].name}`));
    ev.on('overcharge', () => this.notify('Przeciążenie reaktora! Produkcja zwiększona.', 'success'));
    ev.on('researchCompleted', (id) => this.notify(`Ukończono badanie: ${TECH_MAP[id].name}`, 'success'));
    ev.on('missionCompleted', (id) => this.notify(`Zadanie wykonane: ${MISSION_MAP[id].name}`, 'success'));
    ev.on('shipBuilt', (id) => this.notify(`Zwodowano: ${SHIP_MAP[id].name}`, 'success'));
    ev.on('expeditionCompleted', (e) => this.notify(`Ekspedycja zakończona: ${g.expeditions.definition(e.kind, e.id).name}`, 'success'));
    ev.on('sectorDiscovered', (id) => this.notify(`Odkryto sektor: ${SECTOR_MAP[id].name}`, 'success'));
    ev.on('planetStatus', ({ id, status }) => {
      const text = { discovered: 'Odkryto planetę', analyzed: 'Przeanalizowano planetę', colonized: 'Założono kolonię' }[status];
      this.notify(`${text}: ${PLANET_MAP[id].name}`, 'success');
    });
    ev.on('megaStageCompleted', ({ id, stage }) => this.notify(`${MEGASTRUCTURE_MAP[id].name}: ukończono etap ${stage}`, 'success'));
    ev.on('terraformStage', ({ id, stage }) => this.notify(`${PLANET_MAP[id].name}: terraformowanie, etap ${stage}`, 'success'));
    ev.on('achievementUnlocked', (id) => this.notify(`Osiągnięcie: ${ACHIEVEMENT_MAP[id].name}`, 'success'));
    // Re-render right after player actions so feedback is immediate.
    for (const name of ['buildingBought', 'upgradeBought', 'click', 'researchStarted', 'researchQueued', 'researchCancelled', 'missionClaimed',
      'shipQueued', 'expeditionLaunched', 'expeditionClaimed', 'routeCreated', 'routeDeleted', 'colonyBuilt', 'colonySpecialized', 'rebirth']) {
      ev.on(name, () => this.scheduleRender());
    }
    ev.on('saveFailed', () => this.notify('Nie udało się zapisać gry (brak miejsca?)', 'error'));
    ev.on('settingsChanged', () => {
      document.documentElement.classList.toggle('reduce-motion', this.game.state.settings.reduceMotion);
      this.render();
    });
    ev.on('stateReplaced', () => {
      // A rebirth or import can hide tabs; fall back to the home screen.
      if (!this.navigation.visibility.get(this.navigation.current)?.()) this.navigation.go('home', { remember: false });
      document.documentElement.classList.toggle('reduce-motion', this.game.state.settings.reduceMotion);
      this.render();
    });
    document.documentElement.classList.toggle('reduce-motion', this.game.state.settings.reduceMotion);
  }

  show(id) {
    for (const [sid, screen] of this.screens) screen.el.hidden = sid !== id;
    this.content.scrollTop = 0;
    this.screens.get(id)?.update();
    this.syncScene();
  }

  // ---- 3D layer (optional; the UI works identically without it) ---------

  attach3D(renderer) {
    this.renderer3d = renderer;
    for (const screen of this.screens.values()) screen.attach3D?.(renderer);
    if (!this.pulseHooked) {
      this.pulseHooked = true;
      this.game.events.on('click', () => this.renderer3d?.pulseReactor());
    }
    this.syncScene();
  }

  detach3D() {
    for (const screen of this.screens.values()) screen.detach3D?.();
    this.renderer3d = null;
  }

  syncScene() {
    if (!this.renderer3d || !this.navigation.current) return;
    const screen = this.screens.get(this.navigation.current);
    this.renderer3d.setScreen(this.navigation.current, screen?.sceneOptions?.() ?? {});
  }

  focusPlanet(id) {
    this.renderer3d?.focusPlanet(id);
  }

  render() {
    this.navigation.update(this.game.missions.claimableCount());
    this.resourceBar.update();
    this.screens.get(this.navigation.current)?.update();
    this.modals.update();
  }

  scheduleRender() {
    if (this.renderQueued) return;
    this.renderQueued = true;
    requestAnimationFrame(() => {
      this.renderQueued = false;
      this.render();
    });
  }

  notify(text, kind) {
    this.toasts.show(text, kind);
  }

  flash(el) {
    if (!el || this.game.state.settings.reduceMotion) return;
    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');
  }

  saveNow() {
    const r = this.game.save();
    if (r.ok) this.notify('Gra zapisana', 'success');
  }

  importSave(text) {
    this.game.importSave(text); // throws with a readable message
    this.notify('Zapis zaimportowany', 'success');
  }

  resetGame() {
    this.game.resetGame();
    this.navigation.go('home', { remember: false });
    this.notify('Rozpoczęto nową grę');
  }

  showLoadProblem(source, error, onClose) {
    const text = source === 'backup'
      ? 'Główny zapis był uszkodzony. Przywrócono postęp z kopii zapasowej.'
      : 'Nie udało się odczytać zapisu ani kopii zapasowej. Rozpoczęto nową grę. Uszkodzone dane zachowano pod kluczem "starforge.save.corrupt".';
    this.modals.open({
      title: 'Odzyskiwanie zapisu',
      icon: 'save',
      body: [h('p', { text }), h('p', { class: 'muted', text: `Szczegóły: ${error?.message ?? 'nieznany błąd'}` })],
      onClose,
    });
  }

  // Offline report; rewards are applied only after "Odbierz".
  showOfflineReport(pending, onAccept) {
    const { report } = pending;
    const list = h('ul', { class: 'report-list' });
    const gains = report.changes.filter((c) => !c.delta.isNegative());
    const losses = report.changes.filter((c) => c.delta.isNegative());
    for (const c of gains) list.append(h('li', { class: 'positive', text: `${RESOURCE_MAP[c.id].name}: +${formatNumber(c.delta)}` }));
    for (const c of losses) list.append(h('li', { class: 'negative', text: `${RESOURCE_MAP[c.id].name}: ${formatNumber(c.delta)}` }));
    if (!report.changes.length) list.append(h('li', { class: 'muted', text: 'Brak zmian w zasobach.' }));
    const events = h('ul', { class: 'report-list' });
    for (const e of report.events) events.append(h('li', { text: e }));
    const capped = report.awaySeconds > report.creditedSeconds + 1;
    this.modals.open({
      title: 'Raport z nieobecności',
      icon: 'journal',
      dismissible: false,
      body: [
        h('dl', { class: 'detail-list' }, [
          h('dt', { text: 'Czas nieobecności' }), h('dd', { text: formatDuration(report.awaySeconds) }),
          h('dt', { text: 'Uwzględniony czas' }), h('dd', { text: formatDuration(report.creditedSeconds) }),
        ]),
        capped ? h('p', { class: 'muted', text: `Limit produkcji offline: ${this.game.state.settings.offlineCapHours} h (zmienisz go w ustawieniach).` }) : null,
        h('h3', { text: 'Zasoby' }), list,
        report.events.length ? h('h3', { text: 'Zdarzenia' }) : null,
        report.events.length ? events : null,
      ],
      buttons: [{ label: 'Odbierz', kind: 'primary', onClick: onAccept }],
    });
  }

  // Android back button: modal -> previous tab -> let caller decide.
  handleBack() {
    if (this.modals.back()) return true;
    return this.navigation.back();
  }
}
