/**
 * English name and role translations for the current FIGURES set.
 * Used by `figureName()` and `figureRole()` helpers in i18n.jsx.
 *
 * Fallback behaviour: if a figure isn't mapped, the Mongolian original is returned.
 *
 * The collection currently holds 37 Алтан Ургийн Хаад (Golden Lineage Khans);
 * only the marquee 6 have curated EN content. Everything else falls back to MN.
 */

export const FIGURE_NAMES_EN = {
  1:  'Genghis Khan',
  2:  'Ögedei Khan',
  3:  'Güyük Khan',
  4:  'Möngke Khan',
  5:  'Kublai Khan',
  31: 'Dayan Khan',
};

/**
 * English biographies for a curated set of marquee figures.
 * Sparse: most figures have only Mongolian content; figures listed here
 * also show a full English bio when the UI is set to EN mode.
 */
export const FIGURE_BIOS_EN = {
  1: 'Born Temüjin, Genghis Khan is the greatest empire-builder in world history. He forged the scattered steppe tribes into a single nation in 1206, then swept across Eurasia in a generation — from the Pacific coast to the fringes of Europe. Behind the legend of conquest stands a ruler who codified law (the Yasa), standardised writing, protected the trade routes of the Silk Road, and insisted on meritocratic promotion in an age of hereditary privilege.',
  2: 'Third son of Genghis Khan and his chosen heir, Ögedei ruled as the second Great Khan from 1229. He built the imperial capital at Karakorum, extended the empire deep into Persia and the Jin lands, and authorised the campaign that brought Mongol horsemen to the Danube. Genial and dissolute in equal measure, he is remembered for securing his father’s conquests through administration as much as arms.',
  5: 'Grandson of Genghis Khan, Kublai completed the conquest of China and declared the Yuan dynasty in 1271. He moved the imperial centre to Dadu (modern Beijing), issued paper currency, patronised Tibetan Buddhism, and hosted visitors like Marco Polo at his court. His two failed invasions of Japan — thwarted by a typhoon the Japanese named kamikaze, "divine wind" — mark the outer limit of Mongol reach.',
};

export function figureBio(figure, lang) {
  if (!figure) return '';
  if (lang === 'en' && FIGURE_BIOS_EN[figure.fig_id]) return FIGURE_BIOS_EN[figure.fig_id];
  return figure.bio;
}

/**
 * English translations of achievements, facts, and quotes for marquee figures.
 * If a figure/field isn't present here, components fall back to the Mongolian source.
 */
export const FIGURE_ACHIEVEMENTS_EN = {
  1:  ['Unified the steppe tribes', 'Founded the Great Mongol State', 'Protected the Silk Road trade', 'Codified the Yasa law'],
  2:  ['Built Karakorum, the imperial capital', 'Led the European campaign', 'Strengthened the postal relay system'],
  3:  ['Sent envoys to the Pope in Rome', 'Strengthened the empire'],
  4:  ['Reformed imperial administration', 'Campaigned in the Middle East', 'Patronised the sciences'],
  5:  ['Founded the Yuan Dynasty', 'Unified China', 'Introduced paper currency', 'Built the Grand Canal'],
  31: ['Reunified the Mongol tribes', 'Reformed the imperial administration'],
};

export const FIGURE_FACT_EN = {
  1:  'Genghis Khan’s tomb has never been found.',
  2:  'Ögedei had vowed to limit his drinking, but reportedly broke the promise constantly.',
  3:  'Güyük’s letter to the Pope is preserved at the Vatican.',
  4:  'Möngke convened an inter-faith debate at his court, hearing every religion in person.',
  5:  'Kublai Khan launched two invasions of Japan; both were destroyed by typhoons.',
  31: 'Dayan Khan was enthroned as a child.',
};

export const FIGURE_QUOTE_EN = {
  1: { quote: 'I am the flail of God. Had you not committed great sins, Heaven would not have sent a punishment like me upon you.', qattr: 'Genghis Khan' },
  4: { quote: 'As the fingers of the hand are not alike, so the heavens have given different paths to people.', qattr: 'Möngke Khan' },
  5: { quote: 'One who is not willing to learn from defeat will never know victory.', qattr: 'Kublai Khan' },
};

export function figureAchievements(figure, lang) {
  if (!figure) return [];
  if (lang === 'en' && FIGURE_ACHIEVEMENTS_EN[figure.fig_id]) return FIGURE_ACHIEVEMENTS_EN[figure.fig_id];
  return figure.achs || [];
}

export function figureFact(figure, lang) {
  if (!figure) return '';
  if (lang === 'en' && FIGURE_FACT_EN[figure.fig_id]) return FIGURE_FACT_EN[figure.fig_id];
  return figure.fact || '';
}

export function figureQuote(figure, lang) {
  if (!figure) return { quote: '', qattr: '' };
  if (lang === 'en' && FIGURE_QUOTE_EN[figure.fig_id]) return FIGURE_QUOTE_EN[figure.fig_id];
  return { quote: figure.quote, qattr: figure.qattr };
}

/**
 * Story text for text-to-speech narration.
 *
 * Priority:
 *   1. Explicit `story` / `story_en` field on the figure record (authored in Admin)
 *   2. Composed narration from bio + fact + quote
 */
export function storyText(figure, lang, authored) {
  if (!figure) return '';

  // 1. Authored content (Phase C). `authored` is an object with get(slug, lang).
  if (authored?.get) {
    const entry = authored.get(`figure:${figure.fig_id}`, lang);
    if (entry?.text) return entry.text;
  }

  // 2. Legacy explicit fields on the figure record.
  if (lang === 'en' && figure.story_en) return figure.story_en;
  if (lang !== 'en' && figure.story) return figure.story;

  // Compose from existing fields when no explicit story is authored.
  const bio = figureBio(figure, lang);
  const fact = figureFact(figure, lang);
  const { quote, qattr } = figureQuote(figure, lang);
  const name = (lang === 'en' ? FIGURE_NAMES_EN[figure.fig_id] : figure.name) || figure.name;

  const parts = [];
  if (name) {
    parts.push(lang === 'en' ? `The story of ${name}.` : `${name}-ын түүх.`);
  }
  if (bio) parts.push(bio);
  if (fact) {
    parts.push(lang === 'en' ? `A notable fact: ${fact}` : `Сонирхолтой баримт: ${fact}`);
  }
  if (quote) {
    parts.push(
      lang === 'en'
        ? `In ${qattr ? qattr + '’s' : 'their'} own words: ${quote}`
        : `Өөрийнх нь үгээр: ${quote}`
    );
  }
  return parts.join(' ');
}

export const FIGURE_ROLES_EN = {
  1:  'Founder of the Mongol Empire',
  2:  '2nd Great Khan of the Mongol Empire',
  3:  '3rd Great Khan of the Mongol Empire',
  4:  '4th Great Khan of the Mongol Empire',
  5:  'Founder of the Yuan Dynasty',
  31: 'Reunifier of Mongolia',
};
