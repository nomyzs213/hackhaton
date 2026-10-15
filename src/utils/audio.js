import { getMuted } from './storage.js';

let ctx = null;

function ensureCtx() {
  if (!ctx && typeof window !== 'undefined') {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx && ctx.state === 'suspended') {
    ctx.resume();
  }
  return ctx;
}

export function playBeep(freq = 440, duration = 0.12, type = 'square', volume = 0.08) {
  if (getMuted()) return;
  const c = ensureCtx();
  if (!c) return;
  try {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, c.currentTime);
    gain.gain.setValueAtTime(volume, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duration);
    osc.connect(gain).connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + duration);
  } catch (e) {
    // Audio context might be restricted before user gesture
  }
}

export function sfxClick() {
  playBeep(520, 0.06, 'square', 0.06);
}

export function sfxSuccess() {
  playBeep(523.25, 0.1, 'triangle', 0.1);
  setTimeout(() => playBeep(659.25, 0.1, 'triangle', 0.1), 90);
  setTimeout(() => playBeep(783.99, 0.18, 'triangle', 0.1), 180);
}

export function sfxWrong() {
  playBeep(220, 0.15, 'sawtooth', 0.1);
  setTimeout(() => playBeep(164.81, 0.25, 'sawtooth', 0.1), 140);
}

export function sfxHit() {
  playBeep(150, 0.18, 'sawtooth', 0.15);
  setTimeout(() => playBeep(90, 0.2, 'sawtooth', 0.15), 60);
}

export function sfxHonk() {
  if (getMuted()) return;
  const c = ensureCtx();
  if (!c) return;
  try {
    // Podwójny ton klaksonu samochodowego (F4 + A4)
    [349.23, 440.00].forEach((freq) => {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, c.currentTime);
      gain.gain.setValueAtTime(0.05, c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.18);
      osc.connect(gain).connect(c.destination);
      osc.start();
      osc.stop(c.currentTime + 0.18);
    });
  } catch (e) {}
}

export function sfxCoin() {
  playBeep(987.77, 0.08, 'sine', 0.08);
  setTimeout(() => playBeep(1318.51, 0.2, 'sine', 0.08), 80);
}

export function sfxDuck() {
  playBeep(320, 0.08, 'sawtooth', 0.03);
  setTimeout(() => playBeep(280, 0.08, 'sawtooth', 0.03), 70);
}

export function sfxWin() {
  const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51];
  notes.forEach((freq, idx) => {
    setTimeout(() => playBeep(freq, 0.18, 'triangle', 0.12), idx * 110);
  });
}

export function sfxGameOver() {
  const notes = [392.00, 349.23, 311.13, 261.63];
  notes.forEach((freq, idx) => {
    setTimeout(() => playBeep(freq, 0.22, 'sawtooth', 0.1), idx * 180);
  });
}

// Retro 8-bit ścieżka dźwiękowa
let bgmTimer = null;
let bgmStep = 0;
// Radosna, śląska melodia wędrowna w retro stylu 8-bit
const melody = [
  261.63, 0, 329.63, 0, 392.00, 0, 523.25, 0,
  392.00, 0, 329.63, 0, 349.23, 0, 392.00, 0,
  440.00, 0, 392.00, 0, 349.23, 0, 329.63, 0,
  293.66, 0, 329.63, 0, 261.63, 0, 0, 0,
  329.63, 0, 349.23, 0, 392.00, 0, 440.00, 0,
  392.00, 0, 349.23, 0, 329.63, 0, 293.66, 0,
  261.63, 0, 329.63, 0, 392.00, 0, 523.25, 0,
  587.33, 0, 523.25, 0, 392.00, 0, 0, 0
];

export function startBGM() {
  if (bgmTimer) return;
  bgmStep = 0;
  bgmTimer = setInterval(() => {
    if (getMuted()) return;
    const freq = melody[bgmStep % melody.length];
    if (freq > 0) {
      playBeep(freq, 0.11, 'sine', 0.02);
    }
    bgmStep++;
  }, 160);
}

export function stopBGM() {
  if (bgmTimer) {
    clearInterval(bgmTimer);
    bgmTimer = null;
  }
}