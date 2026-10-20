// @vitest-environment happy-dom
// End-to-end user paths through the real DOM UI (no CSS, no timers).
import { describe, it, expect, beforeEach } from 'vitest';
import { Game } from '../www/js/core/Game.js';
import { UIManager } from '../www/js/ui/UIManager.js';
import { MemoryStorageAdapter } from '../www/js/persistence/StorageAdapter.js';
import { BigNumber } from '../www/js/utils/BigNumber.js';
import { TECHNOLOGIES } from '../www/data/technologies.js';
import { T0, rich, research, setBuilding, addShips } from './helpers.js';

let storage;
let game;
let ui;

function mount(g = new Game({ storage, now: T0 })) {
  document.body.innerHTML = '<div id="root"></div>';
  game = g;
  ui = new UIManager(game, document.getElementById('root'));
  ui.mount();
  ui.render();
  return ui;
}

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];
const tab = (id) => { $(`[data-tab="${id}"]`).click(); ui.render(); };
const modalButton = (text) => $$('.modal-actions .btn').find((b) => b.textContent.includes(text));

beforeEach(() => {
  storage = new MemoryStorageAdapter();
});

describe('UI user paths', () => {
  it('starts the game on the home screen with resources and the reactor', () => {
    mount();
    expect($('.screen-home').hidden).toBe(false);
    expect($$('.res-chip').length).toBeGreaterThanOrEqual(3);
    expect($('.reactor')).toBeTruthy();
    // Only implemented, unlocked tabs are visible.
    expect($('[data-tab="planets"]').hidden).toBe(true);
  });

  it('tapping the reactor generates energy', () => {
    mount();
    const before = game.resources.amount('energy').toNumber();
    $('.reactor').dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(game.resources.amount('energy').toNumber()).toBe(before + 1);
  });

  it('buys a building from the production screen', () => {
    mount();
    tab('production');
    const btn = $('[data-action="buy"][data-id="asteroidMine"]');
    expect(btn.disabled).toBe(false);
    btn.click();
    expect(game.buildings.level('asteroidMine')).toBe(1);
    ui.render();
    expect($('[data-building="asteroidMine"] .badge').textContent).toContain('Poziom 1');
  });

  it('disables unaffordable purchases and explains what is missing', () => {
    mount();
    tab('production');
    game.state.resources.metal.amount = BigNumber.ZERO;
    ui.render();
    const btn = $('[data-action="buy"][data-id="asteroidMine"]');
    expect(btn.disabled).toBe(true);
    expect($('[data-building="asteroidMine"] .card-note').textContent).toContain('Brakuje');
  });

  it('starts research from the tree', () => {
    const g = new Game({ storage, now: T0 });
    setBuilding(g, 'researchLab', 1);
    g.state.resources.researchData.amount = BigNumber.from(100);
    mount(g);
    tab('research');
    $('[data-tech="oreAnalysis"]').click();
    modalButton('Badaj').click();
    expect(game.state.research.active?.id).toBe('oreAnalysis');
  });

  it('claims a completed mission from the home screen', () => {
    const g = new Game({ storage, now: T0 });
    g.buyBuilding('asteroidMine', '1');
    g.simulate(0.1);
    mount(g);
    const claim = $$('.screen-home .btn').find((b) => b.textContent === 'Odbierz nagrodę');
    expect(claim.hidden).toBe(false);
    claim.click();
    expect(game.missions.status('firstMine')).toBe('claimed');
  });

  it('builds a ship, sends a scout, discovers a planet and claims the reward', () => {
    const g = new Game({ storage, now: T0 });
    rich(g, 1e6);
    research(g, 'spaceflight');
    setBuilding(g, 'shipyard', 1);
    mount(g);
    tab('fleet');
    $('[data-action="build"][data-id="scout"][data-count="1"]').click();
    expect(game.state.fleet.queue).toHaveLength(1);
    game.simulate(game.fleet.buildTime('scout') + 1);
    expect(game.fleet.owned('scout')).toBe(1);

    tab('exploration');
    ui.render();
    $('[data-action="launch"][data-id="innerBelt_scout"]').click();
    modalButton('Wyślij').click();
    expect(game.state.expeditions.active).toHaveLength(1);
    game.simulate(400);
    ui.render();
    const claim = $('[data-action="claim"]');
    expect(claim.hidden).toBe(false);
    claim.click();
    expect(game.planets.status('kepler')).toBe('discovered');
    expect(game.state.expeditions.active).toHaveLength(0);
  });

  it('colonizes an analyzed planet and builds in the colony', () => {
    const g = new Game({ storage, now: T0 });
    rich(g, 1e6);
    research(g, 'spaceflight', 'colonyShips');
    g.planets.discoverPlanet('kepler');
    g.planets.setStatus('kepler', 'analyzed');
    addShips(g, 'colonyShip', 1);
    mount(g);
    tab('planets');
    $('[data-action="colonize"][data-id="kepler"]').click();
    modalButton('Wyślij').click();
    game.simulate(2000);
    for (const e of [...game.state.expeditions.active]) game.claimExpedition(e.uid);
    expect(game.colonies.has('kepler')).toBe(true);
    ui.render();
    $('[data-action="manage"][data-id="kepler"]').click();
    $$('.colony-building .btn').find((b) => b.textContent === 'Rozbuduj').click();
    expect(game.colonies.totalLevels('kepler')).toBe(1);
  });

  it('saves and loads progress', () => {
    mount();
    tab('production');
    $('[data-action="buy"][data-id="asteroidMine"]').click();
    ui.saveNow();
    const g2 = new Game({ storage, now: T0 });
    g2.load(T0 + 1000);
    expect(g2.buildings.level('asteroidMine')).toBe(1);
  });

  it('prestige needs two explicit confirmations', () => {
    const g = new Game({ storage, now: T0 });
    research(g, ...TECHNOLOGIES.filter((t) => !t.condition).slice(0, 60).map((t) => t.id));
    for (const p of ['kepler', 'thalassa', 'glacius']) g.colonies.found(p);
    g.state.megastructures.dysonSwarm = { stage: 1, progress: 0, active: false };
    g.state.resources.energy.totalEarned = BigNumber.from(1e10);
    mount(g);
    tab('galaxy');
    $$('.screen-galaxy .btn').find((b) => b.textContent === 'Galactic Rebirth').click();
    const go = modalButton('Odrodź');
    expect(go.disabled).toBe(true); // not checked yet
    const check = $$('.modal input[type="checkbox"]').at(-1);
    check.checked = true;
    check.dispatchEvent(new Event('change'));
    expect(go.disabled).toBe(false);
    go.click();
    expect(game.state.prestige.rebirths).toBe(0); // first click only asks again
    modalButton('Tak').click();
    expect(game.state.prestige.rebirths).toBe(1);
    expect($('.screen-home').hidden).toBe(false);
  });

  it('back button closes a modal, then returns to the previous tab', () => {
    mount();
    tab('production');
    ui.menu.open();
    expect(ui.handleBack()).toBe(true);
    expect(ui.modals.isOpen()).toBe(false);
    expect(ui.handleBack()).toBe(true);
    expect(ui.navigation.current).toBe('home');
    expect(ui.handleBack()).toBe(false); // root: app may exit
  });
});
