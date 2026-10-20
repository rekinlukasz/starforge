// Local SVG icon set, drawn as simple line glyphs on a 24x24 grid.
// Built with createElementNS from static path data (no innerHTML).

const SVG_NS = 'http://www.w3.org/2000/svg';

const PATHS = {
  energy: ['M13 2 4 14h7l-1 8 9-12h-7z'],
  metal: ['M4 8l8-5 8 5v8l-8 5-8-5z', 'M4 8l8 5 8-5', 'M12 13v8'],
  silicon: ['M7 7h10v10H7z', 'M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4'],
  water: ['M12 3c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z'],
  biomass: ['M5 19c0-8 6-14 14-14 0 8-6 14-14 14z', 'M5 19l8-8'],
  alloy: ['M3 15l4-6h10l4 6z', 'M3 15v3h18v-3'],
  electronics: ['M5 5h14v14H5z', 'M9 9h6v6H9z', 'M5 12H2M22 12h-3M12 5V2M12 22v-3'],
  polymers: ['M6 6a3 3 0 1 0 0 .1M18 6a3 3 0 1 0 0 .1M12 18a3 3 0 1 0 0 .1', 'M8.5 7.5 11 16M15.5 7.5 13 16M9 6h6'],
  machinery: ['M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z', 'M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2'],
  chemicals: ['M9 3h6M10 3v6l-5 10h14l-5-10V3'],
  construction: ['M3 20h18', 'M5 20V9l7-5 7 5v11', 'M9 20v-6h6v6'],
  fusion: ['M12 12m-3 0a3 3 0 1 0 6 0 3 3 0 1 0-6 0', 'M12 3a9 4 0 0 1 0 18 9 4 0 0 1 0-18z'],
  nano: ['M12 3l8 4.5v9L12 21l-8-4.5v-9z', 'M12 12l8-4.5M12 12v9M12 12 4 7.5'],
  antimatter: ['M12 12m-2 0a2 2 0 1 0 4 0 2 2 0 1 0-4 0', 'M3 12a9 3 0 1 0 18 0 9 3 0 1 0-18 0', 'M7.5 4.2a9 3 60 1 0 9 15.6 9 3 60 1 0-9-15.6z'],
  crystal: ['M12 2 6 9l6 13 6-13z', 'M6 9h12'],
  exotic: ['M12 3a9 9 0 1 0 9 9', 'M12 7a5 5 0 1 0 5 5', 'M12 11a1 1 0 1 0 1 1'],
  research: ['M10 3v6L4 19a1.5 1.5 0 0 0 1.3 2h13.4A1.5 1.5 0 0 0 20 19l-6-10V3', 'M8 3h8', 'M7 15h10'],
  artifact: ['M12 2l3 7h7l-5.5 4.5 2 7.5L12 17l-6.5 4 2-7.5L2 9h7z'],
  credits: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M15 9c-.5-1-1.6-1.5-3-1.5-1.8 0-3 .9-3 2.2 0 3 6 1.6 6 4.6 0 1.3-1.2 2.2-3 2.2-1.4 0-2.5-.5-3-1.5M12 6v1.5M12 16.5V18'],
  prestige: ['M3 18h18l-2-10-4 4-3-7-3 7-4-4z'],
  solar: ['M3 14h18l-2-8H5z', 'M3 14l1 4h16l1-4', 'M9 6l-1 8M15 6l1 8M4 10h16'],
  mine: ['M14 4l6 6', 'M17 7 7 17', 'M4 20l3-3', 'M11 4a9 9 0 0 1 9 9'],
  drill: ['M12 2v4', 'M8 6h8l-1 6h-6z', 'M9 12l3 10 3-10'],
  lab: ['M10 3v6L4 19a1.5 1.5 0 0 0 1.3 2h13.4A1.5 1.5 0 0 0 20 19l-6-10V3', 'M8 3h8'],
  depot: ['M3 8l9-5 9 5v10l-9 5-9-5z', 'M3 8l9 5 9-5', 'M12 13v10', 'M7.5 5.5l9 5'],
  ice: ['M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7', 'M9 4l3 2 3-2M9 20l3-2 3 2'],
  foundry: ['M4 21V10l5 3V10l5 3V10l6 3v8z', 'M17 6V3h3v8'],
  factory: ['M3 21V9l6 4V9l6 4V5h6v16z', 'M7 17h2M12 17h2M17 17h2'],
  click: ['M9 11V5a2 2 0 0 1 4 0v5', 'M13 10a2 2 0 0 1 4 0v2', 'M17 12a2 2 0 0 1 4 0v3a7 7 0 0 1-7 7h-1a7 7 0 0 1-6-3.5L4 14a2 2 0 0 1 3.5-2L9 14'],
  overcharge: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M13 6l-4 7h4l-1 5 4-7h-4z'],
  home: ['M3 11l9-7 9 7', 'M5 10v10h14V10', 'M10 20v-5h4v5'],
  production: ['M3 21V9l6 4V9l6 4V5h6v16z'],
  menu: ['M4 6h16M4 12h16M4 18h16'],
  save: ['M5 3h11l3 3v15H5z', 'M8 3v5h8V3', 'M8 21v-7h8v7'],
  close: ['M6 6l12 12M18 6 6 18'],
  journal: ['M6 3h11a2 2 0 0 1 2 2v16H8a2 2 0 0 1-2-2z', 'M6 19a2 2 0 0 1 2-2h11', 'M10 7h6M10 11h6'],
  settings: ['M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z', 'M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1'],
  lock: ['M6 11h12v10H6z', 'M8 11V7a4 4 0 0 1 8 0v4'],
  check: ['M5 12l5 5L20 7'],
  antenna: ['M12 12v10', 'M8 22h8', 'M12 12a2 2 0 1 0 0-.1', 'M7.8 7.8a6 6 0 0 1 8.4 0M5 5a10 10 0 0 1 14 0'],
  ai: ['M9 3h6v3H9z', 'M5 6h14v12H5z', 'M9 11h.01M15 11h.01', 'M9 15h6', 'M2 10v4M22 10v4'],
  tree: ['M6 4h4v4H6zM14 10h4v4h-4zM6 16h4v4H6z', 'M10 6h2v12h-2M12 12h2'],
  list: ['M8 6h13M8 12h13M8 18h13', 'M3 6h.01M3 12h.01M3 18h.01'],
  mission: ['M5 21V4', 'M5 4h11l-2 4 2 4H5'],
  trophy: ['M8 21h8M12 17v4', 'M7 4h10v5a5 5 0 0 1-10 0z', 'M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4'],
  plus: ['M12 5v14M5 12h14'],
  minus: ['M5 12h14'],
  auto: ['M4 12a8 8 0 0 1 14-5.3L20 9', 'M20 4v5h-5', 'M20 12a8 8 0 0 1-14 5.3L4 15', 'M4 20v-5h5'],
  scout: ['M12 2l4 9-4 3-4-3z', 'M8 11l-4 6h4M16 11l4 6h-4', 'M10 17l2 5 2-5'],
  cargo: ['M3 8h14l4 4v6H3z', 'M3 13h18', 'M7 18v2M17 18v2'],
  colony: ['M4 20V10l8-6 8 6v10', 'M9 20v-5h6v5', 'M12 4V2'],
  escort: ['M12 3l7 8-7 10-7-10z', 'M12 3v18'],
  frigate: ['M2 13l6-3h8l6 3-6 3H8z', 'M8 10V7h6v3', 'M12 16v3'],
  cruiser: ['M1 12l5-3h12l5 3-5 3H6z', 'M6 9V6h4v3M14 9V6h4v3', 'M8 15v3M16 15v3'],
  terraform: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M3 12h18', 'M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18'],
  shield: ['M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z'],
  planet: ['M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14z', 'M2 15c4-1 16-5 20-9'],
  fleet: ['M2 13l6-3h8l6 3-6 3H8z', 'M5 7l3-1.5h4l3 1.5-3 1.5H8z'],
  explore: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M15.5 8.5l-2 5-5 2 2-5z'],
  galaxy: ['M12 12m-1.5 0a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0-3 0', 'M12 3c5 0 9 4 7 8M12 21c-5 0-9-4-7-8M3 9c2-4 9-6 12-3M21 15c-2 4-9 6-12 3'],
  route: ['M5 19a2 2 0 1 0 0-.1M19 7a2 2 0 1 0 0-.1', 'M7 19h6a4 4 0 0 0 0-8h-2a4 4 0 0 1 0-8h6'],
  swords: ['M14 4l6 0 0 6-9 9-3-3z', 'M4 14l6 6', 'M3 21l3-3'],
  storage: ['M3 7h18v13H3z', 'M3 7l2-4h14l2 4', 'M9 12h6'],
};

export function icon(name, className = 'icon') {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', className);
  svg.setAttribute('aria-hidden', 'true');
  for (const d of PATHS[name] ?? PATHS.metal) {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', d);
    svg.append(path);
  }
  return svg;
}
