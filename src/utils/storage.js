const KEY_BEST = 'odkryj-gliwice:bestTime';

export function getBestTime() {
  const v = localStorage.getItem(KEY_BEST);
  return v ? Number(v) : null;
}

export function setBestTime(seconds) {
  const current = getBestTime();
  if (current === null || seconds < current) {
    localStorage.setItem(KEY_BEST, String(seconds));
    return true;
  }
  return false;
}

export function getMuted() {
  return localStorage.getItem('odkryj-gliwice:muted') === '1';
}

export function setMuted(muted) {
  localStorage.setItem('odkryj-gliwice:muted', muted ? '1' : '0');
}