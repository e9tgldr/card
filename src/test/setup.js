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

// jsdom doesn't implement ResizeObserver; Radix UI's overlays
// (AlertDialog/Dialog/Popover) read it during mount and crash without a stub.
if (typeof window !== 'undefined' && !window.ResizeObserver) {
  class StubResizeObserver {
    constructor() {}
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.ResizeObserver = StubResizeObserver;
  globalThis.ResizeObserver = StubResizeObserver;
}

// Radix relies on Element.hasPointerCapture which jsdom doesn't implement.
if (typeof window !== 'undefined') {
  if (!window.Element.prototype.hasPointerCapture) {
    window.Element.prototype.hasPointerCapture = () => false;
  }
  if (!window.Element.prototype.releasePointerCapture) {
    window.Element.prototype.releasePointerCapture = () => {};
  }
  if (!window.Element.prototype.setPointerCapture) {
    window.Element.prototype.setPointerCapture = () => {};
  }
}
