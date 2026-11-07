// 상태 해시: two 32-bit FNV-1a lanes over the same bytes, read as one 64-bit value (hi = lane B, lo = lane A).
const PRIME = 0x01000193;
const view = new DataView(new ArrayBuffer(8));

export class Hasher {
  private a = 0x811c9dc5;
  private b = 0xcbf29ce4;

  byte(x: number): void {
    this.a = Math.imul(this.a ^ (x & 0xff), PRIME) >>> 0;
    this.b = Math.imul(this.b ^ (x & 0xff), PRIME) >>> 0;
  }

  u32(x: number): void {
    this.byte(x);
    this.byte(x >>> 8);
    this.byte(x >>> 16);
    this.byte(x >>> 24);
  }

  i32(x: number): void {
    this.u32(x >>> 0);
  }

  f64(x: number): void {
    // Engines may differ in NaN payloads; every NaN hashes as the canonical quiet NaN.
    if (x !== x) {
      this.u32(0);
      this.u32(0x7ff80000);
      return;
    }
    view.setFloat64(0, x, true);
    this.u32(view.getUint32(0, true));
    this.u32(view.getUint32(4, true));
  }

  hex(): string {
    return this.b.toString(16).padStart(8, '0') + this.a.toString(16).padStart(8, '0');
  }
}
