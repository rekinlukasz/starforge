import { BUILDING_MAP, BUILDING_CATEGORIES } from '../../data/buildings.js';
import { RESOURCE_MAP } from '../../data/resources.js';
import { SHIP_MAP } from '../../data/ships.js';
import { PLANET_MAP } from '../../data/planets.js';
import { formatNumber } from '../utils/Formatter.js';

const pct = (v) => `${v > 1 ? '+' : ''}${Math.round((v - 1) * 100)}%`;
const name = (map, id) => map[id]?.name ?? id;

const FEATURES = {
  autobuy: 'Odblokowuje automatyczny zakup budynków',
  autoclick: 'Odblokowuje automatyczny zapłon reaktora (2 impulsy/s)',
  logistics: 'Odblokowuje trasy logistyczne',
  autoclaim: 'Automatyczny odbiór i wznawianie ekspedycji',
};

// Polish description of a single effect, shared by research, upgrades and later systems.
export function effectText(e) {
  switch (e.type) {
    case 'buildingMult': return `${name(BUILDING_MAP, e.target)}: produkcja ${pct(e.value)}`;
    case 'categoryMult': return `${BUILDING_CATEGORIES[e.target] ?? e.target}: produkcja ${pct(e.value)}`;
    case 'resourceMult': return `${name(RESOURCE_MAP, e.target)}: cała produkcja ${pct(e.value)}`;
    case 'inputMult': return `${name(BUILDING_MAP, e.target)}: zużycie ${pct(e.value)}`;
    case 'capMult': return `Pojemność magazynów ${pct(e.value)}`;
    case 'resourceCapMult': return `${name(RESOURCE_MAP, e.target)}: pojemność ${pct(e.value)}`;
    case 'costMult': return `Koszt budynków ${pct(e.value)}`;
    case 'researchSpeed': return `Szybkość badań +${Math.round(e.value * 100)}%`;
    case 'clickAdd': return `Kliknięcie +${e.value} energii`;
    case 'clickMult': return `Energia z kliknięcia x${e.value}`;
    case 'clickRateShare': return `Kliknięcie dodaje ${e.value} s produkcji energii`;
    case 'overcharge': return 'Odblokowuje przeciążenie reaktora';
    case 'overchargeBoost': return `Przeciążenie: mnożnik +${e.value}`;
    case 'overchargeDuration': return `Przeciążenie trwa +${e.value} s`;
    case 'offlineCapHours': return `Limit produkcji offline +${e.value} h`;
    case 'unlockBuilding': return `Odblokowuje budynek: ${name(BUILDING_MAP, e.target)}`;
    case 'feature': return FEATURES[e.target] ?? `Odblokowuje: ${e.target}`;
    case 'globalMult': return `Cała produkcja ${pct(e.value)}`;
    case 'unlockShip': return `Odblokowuje statek: ${name(SHIP_MAP, e.target)}`;
    case 'unlockColonization': return `Pozwala kolonizować: ${name(PLANET_MAP, e.target)}`;
    case 'shipSpeed': return `Prędkość statków ${pct(e.value)}`;
    case 'shipCargo': return `Ładowność statków ${pct(e.value)}`;
    case 'shipAttack': return `Siła ognia floty ${pct(e.value)}`;
    case 'shipShields': return `Osłony floty ${pct(e.value)}`;
    case 'shipArmor': return `Pancerz floty ${pct(e.value)}`;
    case 'fuelMult': return `Zużycie paliwa ${pct(e.value)}`;
    case 'expeditionDuration': return `Czas ekspedycji ${pct(e.value)}`;
    case 'terraformDuration': return `Czas terraformowania ${pct(e.value)}`;
    case 'colonyProduction': return `Produkcja kolonii ${pct(e.value)}`;
    case 'colonyStorage': return `Magazyny kolonii ${pct(e.value)}`;
    case 'colonySlots': return `Sloty w koloniach +${e.value}`;
    case 'repairCost': return `Koszt napraw ${pct(e.value)}`;
    case 'globalAdd': return `Cała produkcja +${Math.round(e.value * 100)}%`;
    default: return e.text ?? e.type;
  }
}

export function rewardText(reward) {
  return Object.entries(reward).map(([r, v]) => `${name(RESOURCE_MAP, r)} +${formatNumber(v)}`).join(', ');
}
