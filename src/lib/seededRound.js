// mulberry32 — tiny deterministic 32-bit PRNG.
// Same seed -> same sequence, in Node and in browsers.
export function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// FNV-1a 32-bit hash of a string -> unsigned 32-bit integer.
export function hashSeed(str) {
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function shuffleWith(rand, arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Build a deterministic round from a shared seed.
 * Operates on the real single-language figure shape: `{ fig_id, cat, quote, ... }`.
 * Returns question fig_ids and option fig_ids — name localisation is the caller's job
 * so client and server can share the exact same algorithm.
 *
 * Same (figures, size, seedString) -> byte-identical output.
 * Figures missing a `quote` are dropped from the pool.
 */
export function buildRoundFromSeed(allFigures, size, seedString) {
  const rand = mulberry32(hashSeed(seedString));
  const pool = allFigures.filter((f) => f.quote != null && f.quote !== '');
  const sampled = shuffleWith(rand, pool).slice(0, Math.min(size, pool.length));

  return sampled.map((figure) => {
    const sameCat = allFigures.filter(
      (f) => f.cat === figure.cat && f.fig_id !== figure.fig_id,
    );
    const wrongPool =
      sameCat.length >= 3
        ? sameCat
        : allFigures.filter((f) => f.fig_id !== figure.fig_id);
    const wrongs = shuffleWith(rand, wrongPool).slice(0, 3);
    const optionFigIds = shuffleWith(rand, [figure, ...wrongs]).map((f) => f.fig_id);

    return {
      figId: figure.fig_id,
      quote: figure.quote,
      qattr: figure.qattr ?? null,
      optionFigIds,
    };
  });
}
