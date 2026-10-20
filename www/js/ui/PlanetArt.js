// Procedural planet illustrations (local SVG, no external assets).
// Each type gets its own palette and surface features; output is static
// and cheap to render, so it can be reused in lists.

const SVG_NS = 'http://www.w3.org/2000/svg';
let uid = 0;

const PALETTES = {
  rocky: ['#b9a58a', '#7d6a55', '#3b3027'],
  oceanic: ['#7fd3ff', '#2d79c7', '#0d2b5a'],
  desert: ['#f6d08b', '#d1914a', '#6b3d1a'],
  ice: ['#f1fbff', '#a9d8ee', '#4f7f9c'],
  volcanic: ['#ffb36b', '#c2411f', '#2a0c08'],
  gas: ['#f7e1b5', '#d39b5e', '#6e4423'],
  toxic: ['#d8f58a', '#79a83a', '#22340f'],
  terraformable: ['#c9b9a6', '#8d7865', '#3a2e27'],
  ruins: ['#c7c2d6', '#6f6787', '#25213a'],
  anomaly: ['#f0c8ff', '#8a4fd1', '#1b0838'],
  station: ['#9fe9e4', '#2c8f8a', '#0d2e33'],
};

const el = (tag, attrs = {}) => {
  const n = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
};

// Deterministic pseudo-random from a string seed.
function rng(seed) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

export function planetArt(type, seed = type, { size = 96, terraformStage = 0 } = {}) {
  const id = `pl${++uid}`;
  const [light, mid, dark] = PALETTES[type] ?? PALETTES.rocky;
  const rand = rng(seed);
  const svg = el('svg', { viewBox: '0 0 100 100', width: size, height: size, class: 'planet-art', 'aria-hidden': 'true' });
  const defs = el('defs');
  const grad = el('radialGradient', { id: `${id}g`, cx: '35%', cy: '32%', r: '75%' });
  grad.append(el('stop', { offset: '0%', 'stop-color': light }), el('stop', { offset: '55%', 'stop-color': mid }), el('stop', { offset: '100%', 'stop-color': dark }));
  const shade = el('radialGradient', { id: `${id}s`, cx: '30%', cy: '28%', r: '85%' });
  shade.append(el('stop', { offset: '55%', 'stop-color': '#000', 'stop-opacity': '0' }), el('stop', { offset: '100%', 'stop-color': '#000', 'stop-opacity': '0.6' }));
  const clip = el('clipPath', { id: `${id}c` });
  clip.append(el('circle', { cx: 50, cy: 50, r: 40 }));
  defs.append(grad, shade, clip);
  svg.append(defs);

  // Atmosphere halo
  const haloColor = type === 'toxic' ? '#b8ff6a' : type === 'anomaly' ? '#d48bff' : terraformStage > 0 ? '#8fe3ff' : light;
  svg.append(el('circle', { cx: 50, cy: 50, r: 45, fill: 'none', stroke: haloColor, 'stroke-opacity': type === 'rocky' && !terraformStage ? '0.08' : '0.25', 'stroke-width': 5 }));
  svg.append(el('circle', { cx: 50, cy: 50, r: 40, fill: `url(#${id}g)` }));

  const surface = el('g', { 'clip-path': `url(#${id}c)` });
  if (type === 'gas') {
    for (let i = 0; i < 7; i++) {
      const y = 14 + i * 11 + rand() * 4;
      surface.append(el('rect', { x: 0, y, width: 100, height: 3 + rand() * 5, fill: i % 2 ? dark : light, opacity: 0.35 }));
    }
    surface.append(el('ellipse', { cx: 62, cy: 60, rx: 8, ry: 4, fill: dark, opacity: 0.5 }));
  } else if (type === 'oceanic') {
    for (let i = 0; i < 4; i++) surface.append(el('ellipse', { cx: 20 + rand() * 60, cy: 20 + rand() * 60, rx: 4 + rand() * 8, ry: 3 + rand() * 5, fill: '#5fa36a', opacity: 0.7 }));
    surface.append(el('path', { d: 'M10 40 Q50 30 90 42', stroke: '#fff', 'stroke-opacity': 0.35, 'stroke-width': 3, fill: 'none' }));
  } else if (type === 'ice') {
    surface.append(el('ellipse', { cx: 50, cy: 12, rx: 30, ry: 10, fill: '#fff', opacity: 0.9 }));
    surface.append(el('ellipse', { cx: 50, cy: 90, rx: 28, ry: 9, fill: '#fff', opacity: 0.8 }));
    for (let i = 0; i < 5; i++) surface.append(el('path', { d: `M${10 + rand() * 80} ${30 + rand() * 40} l${rand() * 20 - 10} ${rand() * 12}`, stroke: dark, 'stroke-opacity': 0.4, 'stroke-width': 1 }));
  } else if (type === 'volcanic') {
    for (let i = 0; i < 6; i++) {
      const x = 15 + rand() * 70; const y = 15 + rand() * 70;
      surface.append(el('path', { d: `M${x} ${y} q${rand() * 10} ${rand() * 10} ${rand() * 18 - 9} ${rand() * 18}`, stroke: '#ffcf5c', 'stroke-width': 1.5, fill: 'none', opacity: 0.9 }));
    }
  } else if (type === 'toxic') {
    for (let i = 0; i < 5; i++) surface.append(el('ellipse', { cx: rand() * 100, cy: 20 + i * 14, rx: 30, ry: 4, fill: light, opacity: 0.25 }));
  } else if (type === 'ruins') {
    for (let i = 0; i < 9; i++) {
      const x = 20 + rand() * 60; const y = 20 + rand() * 60;
      surface.append(el('rect', { x, y, width: 2 + rand() * 5, height: 2 + rand() * 5, fill: '#e9e3ff', opacity: 0.5 }));
    }
    surface.append(el('circle', { cx: 50, cy: 50, r: 14, fill: 'none', stroke: '#e9e3ff', 'stroke-opacity': 0.35 }));
  } else if (type === 'anomaly') {
    surface.append(el('circle', { cx: 50, cy: 50, r: 12, fill: '#fff', opacity: 0.25 }));
    for (let i = 0; i < 3; i++) surface.append(el('ellipse', { cx: 50, cy: 50, rx: 38 - i * 9, ry: 9 + i * 3, fill: 'none', stroke: light, 'stroke-opacity': 0.4, transform: `rotate(${-20 + i * 25} 50 50)` }));
  } else if (type === 'desert') {
    for (let i = 0; i < 5; i++) surface.append(el('path', { d: `M0 ${25 + i * 13} Q50 ${20 + i * 13 + rand() * 10} 100 ${25 + i * 13}`, stroke: dark, 'stroke-opacity': 0.25, 'stroke-width': 2, fill: 'none' }));
  } else {
    // rocky / terraformable: craters
    for (let i = 0; i < 7; i++) {
      const r = 2 + rand() * 6;
      surface.append(el('circle', { cx: 15 + rand() * 70, cy: 15 + rand() * 70, r, fill: dark, opacity: 0.35 }));
    }
  }
  if (type === 'terraformable' && terraformStage > 0) {
    surface.append(el('rect', { x: 0, y: 0, width: 100, height: 100, fill: '#2d79c7', opacity: 0.18 * terraformStage }));
    for (let i = 0; i < terraformStage * 3; i++) surface.append(el('ellipse', { cx: 15 + rand() * 70, cy: 15 + rand() * 70, rx: 5 + rand() * 6, ry: 3 + rand() * 4, fill: '#5fa36a', opacity: 0.7 }));
  }
  svg.append(surface);
  svg.append(el('circle', { cx: 50, cy: 50, r: 40, fill: `url(#${id}s)` }));
  if (type === 'gas') svg.append(el('ellipse', { cx: 50, cy: 52, rx: 49, ry: 8, fill: 'none', stroke: light, 'stroke-opacity': 0.55, 'stroke-width': 2, transform: 'rotate(-12 50 50)' }));
  return svg;
}
