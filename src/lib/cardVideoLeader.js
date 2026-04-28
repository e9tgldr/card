// Module-scoped singleton: at most one card video plays at a time.
let currentId = null;
let currentPause = null;

export function takeLeadership(id, pauseFn) {
  if (currentId !== null && currentId !== id && typeof currentPause === 'function') {
    try { currentPause(); } catch { /* ignore */ }
  }
  currentId = id;
  currentPause = pauseFn;
}

export function releaseLeadership(id) {
  if (currentId === id) {
    currentId = null;
    currentPause = null;
  }
}

export function getCurrentId() {
  return currentId;
}
