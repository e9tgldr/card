/**
 * English name and role translations for all 52 figures.
 * Used by `figureName()` and `figureRole()` helpers in i18n.jsx.
 *
 * Fallback behaviour: if a figure isn't mapped, the Mongolian original is returned.
 */

export const FIGURE_NAMES_EN = {
  // Khans
  1:  'Genghis Khan',
  2:  'Ögedei Khan',
  3:  'Kublai Khan',
  4:  'Möngke Khan',
  5:  'Tolui',
  6:  'Güyük Khan',
  7:  'Hülegü Khan',
  8:  'Batu Khan',
  9:  'Chagatai Khan',
  10: 'Jochi',
  11: 'Kaidu Khan',
  12: 'Dayan Khan',
  13: 'Bogd Khan',
  // Queens
  14: 'Börte Üjin',
  15: 'Sorghaghtani Beki',
  16: 'Mandukhai the Wise',
  17: 'Alan Gua',
  18: 'Khutulun',
  19: 'Töregene Khatun',
  20: 'Chabi',
  21: 'Hoelun',
  22: 'Yesüi Khatun',
  23: 'Abahai Khatun',
  // Warriors
  24: 'Subutai',
  25: 'Jebe',
  26: 'Muqali',
  27: 'Boorchu',
  28: 'Jelme',
  29: 'Chilaun',
  30: 'Qasar',
  31: 'Burundai',
  32: 'Bayan of the Baarin',
  33: 'Toghon Temür',
  34: 'Damdin Sükhbaatar',
  35: 'Zanabazar',
  // Political
  36: 'Yelü Chucai',
  37: 'Mahmud Yalavach',
  38: 'Shigi Qutuqu',
  39: 'Tata-tunga',
  40: 'Khorloogiin Choibalsan',
  41: 'Yumjaagiin Tsedenbal',
  42: 'Sanjaasürengiin Zorig',
  43: 'Amursana',
  44: 'Galdan Boshugtu Khan',
  // Cultural
  45: 'Rashid al-Din',
  46: 'Marco Polo',
  47: 'Zanabazar',
  48: 'Byambyn Rinchen',
  49: 'Dashdorjiin Natsagdorj',
  50: 'Jügderdemidiin Gürragchaa',
  51: 'Luvsanjamba Mördorj',
  52: 'Baldugiin Sharav',
};

/**
 * English biographies for a curated set of marquee figures.
 * Sparse: most figures have only name + role in English; figures listed here
 * also show a full English bio when the UI is set to EN mode.
 * FigureDetail falls back to Mongolian `figure.bio` when no entry exists here.
 */
export const FIGURE_BIOS_EN = {
  1: 'Born Temüjin, Genghis Khan is the greatest empire-builder in world history. He forged the scattered steppe tribes into a single nation in 1206, then swept across Eurasia in a generation — from the Pacific coast to the fringes of Europe. Behind the legend of conquest stands a ruler who codified law (the Yasa), standardised writing, protected the trade routes of the Silk Road, and insisted on meritocratic promotion in an age of hereditary privilege.',
  2: 'Third son of Genghis Khan and his chosen heir, Ögedei ruled as the second Great Khan from 1229. He built the imperial capital at Karakorum, extended the empire deep into Persia and the Jin lands, and authorised the campaign that brought Mongol horsemen to the Danube. Genial and dissolute in equal measure, he is remembered for securing his father’s conquests through administration as much as arms.',
  3: 'Grandson of Genghis Khan, Kublai completed the conquest of China and declared the Yuan dynasty in 1271. He moved the imperial centre to Dadu (modern Beijing), issued paper currency, patronised Tibetan Buddhism, and hosted visitors like Marco Polo at his court. His two failed invasions of Japan — thwarted by a typhoon the Japanese named kamikaze, "divine wind" — mark the outer limit of Mongol reach.',
  8: 'Batu Khan, grandson of Genghis and son of Jochi, led the great western campaign that swept through Kievan Rus’ and into Poland and Hungary in 1240–41. He founded the Golden Horde and set its capital at Sarai on the Volga. For more than two centuries, the Horde shaped the politics of eastern Europe and the rise of Muscovy.',
  13: 'The eighth Jebtsundamba Khutuktu, Bogd Khan was spiritual and — from 1911 — political head of an independent Mongolia. Under his brief theocratic rule, the country stepped out from under two centuries of Manchu authority. An eccentric, devoted to animals and photography, he remains Mongolia’s last reigning monarch.',
  16: 'Widowed young, Mandukhai led Mongol armies in person against the Oirats, then married the child-heir Batu Möngke — who would become Dayan Khan — and raised him at her side. Legend says she rode into battle while pregnant. Her alliance with Dayan reunified the Mongol tribes after more than a century of fragmentation and restored the Borjigid line.',
  24: 'The greatest of the Mongol generals, Subutai served four Great Khans across a career of more than forty years. He commanded the pincers that destroyed Kievan Rus’, Poland, and Hungary, fought on three continents, and is said to have led or directed more than sixty battles without a defeat. Military academies still study his campaigns for their coordinated use of deception, cavalry, and scouts.',
  34: 'Damdin Sükhbaatar — "Axe Hero" — led the 1921 People’s Revolution that freed Mongolia from Chinese and White-Russian occupation and founded the modern state. He died young, only two years after victory, and the central square of Ulaanbaatar bears his name to this day.',
  46: 'A Venetian merchant whose seventeen years at Kublai Khan’s court produced the Book of the Marvels of the World — the single most influential European account of Asia for centuries. European readers mocked him as "Il Milione" (Mr Million) for the scale of what he described; later travellers confirmed nearly all of it.',
  47: 'Öndör Gegeen Zanabazar — First Jebtsundamba Khutuktu, sculptor, linguist, and spiritual leader of Mongolia. He created the Soyombo script whose central emblem graces the national flag to this day, and left behind some of the most celebrated bronze buddhas of the Buddhist world.',
  50: 'Jügderdemidiin Gürragchaa became the first — and so far only — Mongolian cosmonaut when he flew aboard Soyuz 39 in 1981 under the Soviet Interkosmos programme, making Mongolia the second Asian nation in space. He later served as the country’s Minister of Defence.',
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
  3:  ['Founded the Yuan Dynasty', 'Unified China', 'Introduced paper currency', 'Built the Grand Canal'],
  8:  ['Founded the Golden Horde', 'Campaigned through Russia, Poland, and Hungary', 'Established the capital at Sarai'],
  13: ['Declared Mongolian independence', 'Led the theocratic state'],
  16: ['Led armies into battle personally', 'Protected the child Dayan Khan', 'Helped reunite the Mongol tribes'],
  24: ['Won over 65 battles', 'Led the European campaign', 'Defeated more than 20 states', 'Advanced Mongol military strategy'],
  34: ['Led the 1921 People’s Revolution', 'Defended Mongolian independence'],
  46: ['Wrote his account of the Yuan Empire', 'Opened a bridge between East and West'],
  47: ['Created the Soyombo script', 'Cast celebrated bronze buddhas', 'Led the Mongolian Buddhist tradition'],
  50: ['First Mongolian cosmonaut', 'Flew aboard Soyuz 39 in 1981', 'Second Asian in space'],
};

export const FIGURE_FACT_EN = {
  1:  'Genghis Khan’s tomb has never been found.',
  2:  'Ögedei had vowed to limit his drinking, but reportedly broke the promise constantly.',
  3:  'Kublai Khan launched two invasions of Japan; both were destroyed by typhoons.',
  8:  'Batu’s European campaign inspired terror across medieval Europe.',
  13: 'The Bogd Khan loved animals so much that he kept a private menagerie.',
  16: 'Mandukhai is said to have fought in battle while pregnant.',
  24: 'Subutai is reported to have marched his armies more than 200,000 km across thirty years.',
  34: 'The central square of Ulaanbaatar was named in Sükhbaatar’s honour.',
  46: 'Marco Polo’s travels were so unbelievable to Europeans that he was mocked as "Il Milione" — Mr Million.',
  47: 'Zanabazar created the Soyombo emblem that still crowns the Mongolian flag today.',
  50: 'Gürragchaa flew to space aboard Soyuz 39 through the Soviet Interkosmos programme.',
};

export const FIGURE_QUOTE_EN = {
  1:  { quote: 'I am the flail of God. Had you not committed great sins, Heaven would not have sent a punishment like me upon you.', qattr: 'Genghis Khan' },
  3:  { quote: 'One who is not willing to learn from defeat will never know victory.', qattr: 'Kublai Khan' },
  17: { quote: 'A single arrow is easily broken, but five arrows bound together cannot be broken.', qattr: 'Alan Gua' },
  34: { quote: 'No enemy can withstand our united strength.', qattr: 'D. Sükhbaatar' },
  36: { quote: 'An empire can be won on horseback, but it cannot be ruled from one.', qattr: 'Yelü Chucai' },
  49: { quote: 'My homeland, my homeland — the golden jewel of the earth.', qattr: 'D. Natsagdorj' },
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
  3:  'Founder of the Yuan Dynasty',
  4:  '4th Great Khan of the Mongol Empire',
  5:  'Youngest son of Genghis Khan',
  6:  '3rd Great Khan of the Mongol Empire',
  7:  'Founder of the Ilkhanate',
  8:  'Founder of the Golden Horde',
  9:  'Founder of the Chagatai Khanate',
  10: 'Eldest son of Genghis Khan',
  11: 'Khan of the Ögedeid line',
  12: 'Reunifier of Mongolia',
  13: 'Last Khan of Mongolia',
  14: 'First wife of Genghis Khan',
  15: 'Mother of four khans',
  16: 'Warrior Khatun of Mongolia',
  17: 'Legendary ancestral mother',
  18: 'Warrior princess',
  19: 'Regent of the Mongol Empire',
  20: 'Chief consort of Kublai Khan',
  21: 'Mother of Genghis Khan',
  22: 'Consort of Genghis Khan',
  23: 'Khatun of the Later Jin',
  24: 'Great general of the Mongols',
  25: 'Swift general of the Mongols',
  26: 'One of Genghis Khan’s Four Hounds',
  27: 'Genghis Khan’s first companion',
  28: 'One of Genghis Khan’s Four Hounds',
  29: 'Warrior companion',
  30: 'Brother of Genghis Khan',
  31: 'General of the Golden Horde',
  32: 'Yuan-dynasty general',
  33: 'Mongol warrior',
  34: 'Mongolian revolutionary',
  35: 'Spiritual warrior',
  36: 'Chief advisor to the Great Khans',
  37: 'Governor of Khwarezm',
  38: 'Chief judge',
  39: 'Uyghur scribe',
  40: 'Leader of the Mongolian People’s Republic',
  41: 'Leader of the Mongolian People’s Republic',
  42: 'Democratic revolutionary',
  43: 'Leader of the Oirats',
  44: 'Khan of the Dzungar Khanate',
  45: 'Great Persian historian',
  46: 'Traveller and chronicler',
  47: 'Sculptor and spiritual leader',
  48: 'Mongolian philologist',
  49: 'Founder of modern Mongolian literature',
  50: 'First Mongolian cosmonaut',
  51: 'Mongolian singer',
  52: 'Mongolian painter',
};
