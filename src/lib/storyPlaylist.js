import { FIGURES, ERA_KEYS, getEra } from '@/lib/figuresData';

// Thin act labels per era (figId -> label). Purely metadata — no new content.
export const ACTS = {
  founding: {
    1:  'Нэгтгэгч',
    5:  'Нэгтгэгч',
    10: 'Нэгтгэгч',
    14: 'Нэгтгэгч',
    17: 'Домгийн эх',
    21: 'Домгийн эх',
    9:  'Дайчлал',
  },
  expansion: {
    2:  'Хархорум',
    6:  'Хархорум',
    4:  'Хархорум',
    8:  'Алтан орд',
    19: 'Хатдын засаг',
    15: 'Хатдын засаг',
  },
  yuan: {
    3:  'Дадугийн хаан',
    20: 'Дадугийн хаан',
    7:  'Багдадын уналт',
    11: 'Төв Ази',
    18: 'Төв Ази',
  },
  northern: { 12: 'Сэргэн мандалт', 16: 'Сэргэн мандалт' },
  qing:     { 22: 'Манж холбоо', 24: 'Манж холбоо' },
  modern:   { 13: 'Тусгаар тогтнол' },
};

/**
 * Build a deterministic chapter playlist from static figure data.
 * @returns Array of Slide:
 *   { kind: 'intro', era }
 *   | { kind: 'figure', figure, act? }
 *   | { kind: 'outro', era }
 */
export function buildChapterPlaylist(chapterKey) {
  const figures = FIGURES
    .filter((f) => getEra(f) === chapterKey)
    .sort((a, b) => a.fig_id - b.fig_id);
  const acts = ACTS[chapterKey] ?? {};
  const figureSlides = figures.map((f) => ({
    kind: 'figure',
    figure: f,
    act: acts[f.fig_id],
  }));
  return [
    { kind: 'intro', era: chapterKey },
    ...figureSlides,
    { kind: 'outro', era: chapterKey },
  ];
}

/** Return the next era key, or null if this is the last era. */
export function nextEra(chapterKey) {
  const idx = ERA_KEYS.indexOf(chapterKey);
  if (idx < 0 || idx >= ERA_KEYS.length - 1) return null;
  return ERA_KEYS[idx + 1];
}
