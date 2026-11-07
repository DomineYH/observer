import { describe, expect, test } from 'vitest';
import { Hasher } from './hash';

const bytesOf = (s: string) => {
  const h = new Hasher();
  for (const c of s) h.byte(c.charCodeAt(0));
  return h;
};

describe('상태 해시', () => {
  test('lane A is standard 32-bit FNV-1a', () => {
    expect(bytesOf('').hex().slice(8)).toBe('811c9dc5');
    expect(bytesOf('a').hex().slice(8)).toBe('e40c292c');
    expect(bytesOf('foobar').hex().slice(8)).toBe('bf9cf968');
  });

  test('hex is 16 lowercase digits and lane B differs from lane A', () => {
    const hex = bytesOf('a').hex();
    expect(hex).toMatch(/^[0-9a-f]{16}$/);
    expect(hex.slice(0, 8)).not.toBe(hex.slice(8));
  });

  test('u32 writes 4 little-endian bytes', () => {
    const a = new Hasher();
    a.u32(0x04030201);
    const b = new Hasher();
    [1, 2, 3, 4].forEach((x) => b.byte(x));
    expect(a.hex()).toBe(b.hex());
  });

  test('f64 hashes exact bits: NaN payloads are canonical, -0 differs from 0', () => {
    const quiet = new Hasher();
    quiet.f64(NaN);
    const other = new Hasher();
    const buf = new DataView(new ArrayBuffer(8));
    buf.setUint32(0, 1, true);
    buf.setUint32(4, 0x7ff00000, true); // signalling-style NaN payload
    other.f64(buf.getFloat64(0, true));
    expect(other.hex()).toBe(quiet.hex());

    const zero = new Hasher();
    zero.f64(0);
    const negZero = new Hasher();
    negZero.f64(-0);
    expect(negZero.hex()).not.toBe(zero.hex());

    const tiny = new Hasher();
    tiny.f64(1.5000000000000002); // 1.5 plus one ULP
    const onePointFive = new Hasher();
    onePointFive.f64(1.5);
    expect(tiny.hex()).not.toBe(onePointFive.hex());
  });
});
