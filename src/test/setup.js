import '@testing-library/jest-dom/vitest';

// jsdom doesn't implement matchMedia; some libs (react-hot-toast for
// prefers-reduced-motion) call it on mount.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

// jsdom doesn't implement IntersectionObserver; reveal-on-scroll patterns and
// TimelineSection use it. Stub with a no-op that never fires "intersecting".
if (typeof window !== 'undefined' && !window.IntersectionObserver) {
  class StubIntersectionObserver {
    constructor() {}
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() { return []; }
  }
  window.IntersectionObserver = StubIntersectionObserver;
  globalThis.IntersectionObserver = StubIntersectionObserver;
}
