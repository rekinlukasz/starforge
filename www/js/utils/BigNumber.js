// Immutable big number stored as mantissa * 10^exponent.
// Mantissa is normalized to 1 <= |m| < 10 (or m = 0). Supports fractional
// values (rates per second) and magnitudes far beyond Number.MAX_VALUE.

const EXP_LIMIT = 9e15; // exponent bound, keeps exponent a safe integer
const PRECISION_GAP = 17; // beyond this exponent gap the smaller operand is negligible

export class BigNumber {
  constructor(mantissa = 0, exponent = 0) {
    this.m = mantissa;
    this.e = exponent;
    Object.freeze(this);
  }

  static normalize(m, e) {
    if (!Number.isFinite(m) || m === 0) {
      return m === 0 || Number.isNaN(m) ? ZERO : new BigNumber(Math.sign(m), EXP_LIMIT);
    }
    const shift = Math.floor(Math.log10(Math.abs(m)));
    // Divide/multiply by an exact power of ten to avoid 0.6/0.1 = 5.999… drift.
    let nm = shift >= 0 ? m / Math.pow(10, shift) : m * Math.pow(10, -shift);
    let ne = e + shift;
    // Correct floating-point drift at the boundaries.
    if (Math.abs(nm) >= 10) { nm /= 10; ne += 1; }
    if (Math.abs(nm) < 1) { nm *= 10; ne -= 1; }
    if (ne > EXP_LIMIT) ne = EXP_LIMIT;
    if (ne < -EXP_LIMIT) return ZERO;
    return new BigNumber(nm, ne);
  }

  static from(value) {
    if (value instanceof BigNumber) return value;
    if (typeof value === 'number') return BigNumber.normalize(value, 0);
    if (typeof value === 'string') return BigNumber.parse(value);
    if (value && typeof value === 'object' && 'm' in value && 'e' in value) {
      const m = Number(value.m);
      const e = Number(value.e);
      if (!Number.isFinite(m) || !Number.isFinite(e)) return ZERO;
      return BigNumber.normalize(m, Math.trunc(e));
    }
    return ZERO;
  }

  static parse(str) {
    const s = String(str).trim();
    const match = /^(-?\d+(?:\.\d+)?)(?:e([+-]?\d+))?$/i.exec(s);
    if (!match) return ZERO;
    return BigNumber.normalize(parseFloat(match[1]), match[2] ? parseInt(match[2], 10) : 0);
  }

  static max(a, b) { return BigNumber.from(a).gte(b) ? BigNumber.from(a) : BigNumber.from(b); }
  static min(a, b) { return BigNumber.from(a).lte(b) ? BigNumber.from(a) : BigNumber.from(b); }

  isZero() { return this.m === 0; }
  isNegative() { return this.m < 0; }
  sign() { return Math.sign(this.m); }

  add(other) {
    const b = BigNumber.from(other);
    if (b.m === 0) return this;
    if (this.m === 0) return b;
    const diff = this.e - b.e;
    if (diff > PRECISION_GAP) return this;
    if (diff < -PRECISION_GAP) return b;
    if (diff >= 0) return BigNumber.normalize(this.m + b.m / Math.pow(10, diff), this.e);
    return BigNumber.normalize(this.m / Math.pow(10, -diff) + b.m, b.e);
  }

  sub(other) {
    const b = BigNumber.from(other);
    return this.add(new BigNumber(-b.m, b.e));
  }

  mul(other) {
    const b = BigNumber.from(other);
    if (this.m === 0 || b.m === 0) return ZERO;
    return BigNumber.normalize(this.m * b.m, this.e + b.e);
  }

  div(other) {
    const b = BigNumber.from(other);
    if (b.m === 0) throw new RangeError('Division by zero');
    if (this.m === 0) return ZERO;
    return BigNumber.normalize(this.m / b.m, this.e - b.e);
  }

  // Raise to a real power; base must be non-negative.
  pow(power) {
    if (this.m === 0) return power === 0 ? ONE : ZERO;
    if (this.m < 0) throw new RangeError('pow of negative base');
    const log = Math.log10(this.m) + this.e;
    const total = log * power;
    const e = Math.floor(total);
    return BigNumber.normalize(Math.pow(10, total - e), e);
  }

  log10() {
    if (this.m <= 0) return -Infinity;
    return Math.log10(this.m) + this.e;
  }

  floor() {
    if (this.e >= PRECISION_GAP) return this;
    if (this.e < 0) return this.m < 0 ? BigNumber.from(-1) : ZERO;
    return BigNumber.from(Math.floor(this.toNumber()));
  }

  cmp(other) {
    const b = BigNumber.from(other);
    if (this.m === 0 && b.m === 0) return 0;
    const sa = Math.sign(this.m);
    const sb = Math.sign(b.m);
    if (sa !== sb) return sa > sb ? 1 : -1;
    // Same sign, both non-zero (zero handled via sign difference).
    if (this.e !== b.e) return (this.e > b.e ? 1 : -1) * sa;
    if (this.m === b.m) return 0;
    return this.m > b.m ? 1 : -1;
  }

  eq(o) { return this.cmp(o) === 0; }
  gt(o) { return this.cmp(o) > 0; }
  gte(o) { return this.cmp(o) >= 0; }
  lt(o) { return this.cmp(o) < 0; }
  lte(o) { return this.cmp(o) <= 0; }

  // Lossy conversion; returns Infinity beyond the double range. Use only for
  // values known to be small (ratios, UI percentages).
  toNumber() {
    if (this.e > 308) return this.m > 0 ? Infinity : -Infinity;
    if (this.e < -324) return 0;
    return this.e >= 0 ? this.m * Math.pow(10, this.e) : this.m / Math.pow(10, -this.e);
  }

  toJSON() {
    // Number#toString is round-trip exact, so save/load never drifts.
    return `${this.m}e${this.e}`;
  }

  toString() { return this.toJSON(); }
}

const ZERO = new BigNumber(0, 0);
const ONE = new BigNumber(1, 0);
BigNumber.ZERO = ZERO;
BigNumber.ONE = ONE;

export const big = (v) => BigNumber.from(v);
