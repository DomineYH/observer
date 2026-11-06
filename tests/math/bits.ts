// 결정적 수학 비트 출력 표: fixed inputs and their exact outputs, shared by the Node test and the engines page.
const view = new DataView(new ArrayBuffer(8));

/** 16 lowercase hex digits of the f64 bits; every NaN is 'nan' (engines may differ in NaN payloads). */
export function toHex(x: number): string {
  if (x !== x) return 'nan';
  view.setFloat64(0, x);
  return view.getBigUint64(0).toString(16).padStart(16, '0');
}

export function fromHex(h: string): number {
  if (h === 'nan') return NaN;
  view.setBigUint64(0, BigInt('0x' + h));
  return view.getFloat64(0);
}
