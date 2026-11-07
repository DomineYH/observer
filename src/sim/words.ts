// IEEE words of a double for the fdlibm port (C's __HI/__LO), little-endian explicitly.
const view = new DataView(new ArrayBuffer(8));
export function hi(x: number): number {
  view.setFloat64(0, x, true);
  return view.getInt32(4, true);
}
export function lo(x: number): number {
  view.setFloat64(0, x, true);
  return view.getUint32(0, true);
}
export function fromWords(h: number, l: number): number {
  view.setInt32(4, h, true);
  view.setUint32(0, l >>> 0, true);
  return view.getFloat64(0, true);
}
/** x with its high word replaced (C's `__HI(x) = h`). */
export function withHi(x: number, h: number): number {
  view.setFloat64(0, x, true);
  view.setInt32(4, h, true);
  return view.getFloat64(0, true);
}
/** x with its low word replaced (C's `__LO(x) = l`). */
export function withLo(x: number, l: number): number {
  view.setFloat64(0, x, true);
  view.setUint32(0, l >>> 0, true);
  return view.getFloat64(0, true);
}
