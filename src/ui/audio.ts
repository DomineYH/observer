// 효과음 through WebAudio: a decaying noise burst, low-passed for the 폭음 and band-passed for the squelch (demo values).
import type { Effects } from './sound';

/** Silent until unlock(): browsers start audio only after a user gesture. */
export function webAudio(): Effects & { unlock(): void } {
  let ctx: AudioContext | null = null;
  let noise: AudioBuffer | null = null;
  const play = (type: BiquadFilterType, frequency: number, gain: number, offset = 0, duration?: number) => {
    if (!ctx || !noise) return;
    const source = ctx.createBufferSource();
    source.buffer = noise;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    const g = ctx.createGain();
    g.gain.value = gain;
    source.connect(filter).connect(g).connect(ctx.destination);
    source.start(0, offset, duration);
  };
  return {
    unlock() {
      if (ctx) return;
      ctx = new AudioContext();
      const len = ctx.sampleRate * 2;
      noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.2);
    },
    boom: (distance) => play('lowpass', Math.max(110, 700 - distance / 10), Math.min(0.9, 1200 / Math.max(1, distance))),
    squelch: () => play('bandpass', 2400, 0.05, 0.4, 0.07),
  };
}
