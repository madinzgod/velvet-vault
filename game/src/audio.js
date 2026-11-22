// audio.js — tiny synthesized sound effects from one WebAudio
// context: no audio files, nothing to load, silent until the player
// first interacts (browser autoplay rules) and silent in shot mode.

let ctx = null;

export function initAudio() {
  if (ctx) return;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  } catch {
    ctx = null;
  }
}

function tone(freq, dur, type = 'sine', gain = 0.06, when = 0, slideTo = null) {
  if (!ctx) return;
  const t0 = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  amp.gain.setValueAtTime(gain, t0);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(amp).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export const sfx = {
  coin() { tone(1560, 0.07, 'square', 0.035); tone(2090, 0.1, 'square', 0.03, 0.06); },
  spotted() { tone(880, 0.08, 'square', 0.045); },
  grab() { tone(660, 0.09, 'triangle', 0.07); tone(880, 0.09, 'triangle', 0.07, 0.08); tone(1320, 0.16, 'triangle', 0.07, 0.16); },
  caught() { tone(320, 0.5, 'sawtooth', 0.08, 0, 70); tone(160, 0.6, 'sawtooth', 0.06, 0.1, 50); },
  win() { tone(523, 0.12, 'triangle', 0.07); tone(659, 0.12, 'triangle', 0.07, 0.1); tone(784, 0.12, 'triangle', 0.07, 0.2); tone(1046, 0.3, 'triangle', 0.08, 0.3); },
  click() { tone(1200, 0.04, 'sine', 0.03); },
};
