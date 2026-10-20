import { BigNumber } from './BigNumber.js';

const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];

// Human readable number: 1.23K, 4.56M ... then scientific notation 1.23e45.
export function formatNumber(value, decimals = 2) {
  const n = BigNumber.from(value);
  if (n.isZero()) return '0';
  const sign = n.isNegative() ? '-' : '';
  const abs = n.isNegative() ? new BigNumber(-n.m, n.e) : n;
  if (abs.e < 3) {
    const num = abs.toNumber();
    if (num < 0.01) return sign + '<0.01';
    const d = num >= 100 ? 0 : num >= 10 ? 1 : decimals;
    return sign + trimZeros(num.toFixed(d));
  }
  const tier = Math.floor(abs.e / 3);
  if (tier < SUFFIXES.length) {
    const scaled = abs.m * Math.pow(10, abs.e - tier * 3);
    const d = scaled >= 100 ? 1 : decimals;
    return sign + trimZeros(scaled.toFixed(d)) + SUFFIXES[tier];
  }
  return sign + abs.m.toFixed(decimals) + 'e' + abs.e;
}

function trimZeros(str) {
  return str.includes('.') ? str.replace(/\.?0+$/, '') : str;
}

export function formatRate(value) {
  const n = BigNumber.from(value);
  if (n.isZero()) return '0/s';
  return (n.isNegative() ? '' : '+') + formatNumber(n) + '/s';
}

// Seconds -> "1h 05m", "3m 20s", "12s".
export function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return '∞';
  const s = Math.max(0, Math.floor(seconds));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${String(sec).padStart(2, '0')}s`;
  return `${sec}s`;
}
