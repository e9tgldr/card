/**
 * Typed relationship map for figure pairs.
 *
 * Shape: REL_TYPES[fromFigId] = { [toFigId]: type }
 *
 * Types:
 *   'kin'     — blood / marital kinship (mother, father, sibling, spouse, child)
 *   'ally'    — sworn companion, trusted general, loyal vassal
 *   'rival'   — adversary, dynastic rival, competitor
 *   'mentor'  — advisor, teacher, or subordinate-advisor relationship
 *   'heir'    — direct successor
 *
 * Rendered in the Related tab next to each related figure.  Unknown pairs
 * render no badge (the relation still shows, just untyped).
 *
 * The map is sparse — only well-documented relationships are typed.
 */

export const REL_TYPE_META = {
  kin:    { label: 'Төрөл',     label_en: 'Kin',     color: 'hsl(var(--seal))' },
  ally:   { label: 'Хамтрагч',  label_en: 'Ally',    color: 'hsl(var(--brass))' },
  rival:  { label: 'Өрсөлдөгч', label_en: 'Rival',   color: 'hsl(var(--lapis))' },
  mentor: { label: 'Зөвлөх',    label_en: 'Advisor', color: 'hsl(var(--brass-deep))' },
  heir:   { label: 'Залгамжлагч', label_en: 'Heir',  color: 'hsl(var(--seal))' },
};

// Directed pair → type.  "A is X of B."
// Lookup: relType(fromId, toId) returns symmetric-ish best match.
export const REL_TYPES = {
  // Chinggis's circle (fig_id 1)
  1: {
    2:  'heir',   // Genghis → Ögedei (heir)
    3:  'kin',    // → Kublai (grandson)
    5:  'kin',    // → Tolui (son)
    9:  'kin',    // → Chagatai (son)
    10: 'kin',    // → Jochi (son)
    14: 'kin',    // → Börte (wife)
    17: 'kin',    // → Alan Gua (ancestor)
    21: 'kin',    // → Öelün (mother)
    22: 'kin',    // → Yesüi (wife)
    24: 'ally',   // → Subutai
    25: 'ally',   // → Jebe
    26: 'ally',   // → Muqali
    27: 'ally',   // → Boorchu
    28: 'ally',   // → Jelme
    29: 'ally',   // → Chilaun
    30: 'kin',    // → Khasar (brother)
    36: 'mentor', // → Yelü Chucai (his advisor)
    38: 'kin',    // → Shiki Qutuqu (adopted son)
    39: 'mentor', // → Tatatunga (scribe)
  },
  2: {   // Ögedei
    1:  'heir', 6: 'heir', 19: 'kin', 15: 'kin', 36: 'mentor', 24: 'ally', 37: 'mentor',
  },
  3: {   // Kublai
    1:  'kin', 4: 'kin', 5: 'kin', 7: 'kin', 11: 'rival', 15: 'kin', 20: 'kin', 32: 'ally', 45: 'mentor', 46: 'ally',
  },
  4: {   // Möngke
    1:  'kin', 3: 'kin', 5: 'kin', 7: 'kin', 15: 'kin',
  },
  5: {   // Tolui
    1: 'kin', 2: 'kin', 3: 'kin', 4: 'kin', 7: 'kin', 15: 'kin',
  },
  6: { 2: 'heir', 1: 'kin', 19: 'kin' }, // Güyük
  7: { 1: 'kin', 3: 'kin', 4: 'kin', 5: 'kin', 45: 'ally' }, // Hülegü
  8: { 1: 'kin', 10: 'kin', 31: 'ally', 24: 'ally' }, // Batu → ally of Subutai
  9: { 1: 'kin', 2: 'kin', 10: 'kin' }, // Chagatai
  10: { 1: 'heir', 8: 'kin', 9: 'kin' }, // Jochi
  11: { 2: 'kin', 3: 'rival', 18: 'kin' }, // Khaidu — fought Kublai
  12: { 13: 'kin', 16: 'ally' }, // Daian — allied with Mandukhai
  13: { 12: 'kin', 40: 'rival' }, // Bogd Khan
  14: { 1: 'kin', 17: 'kin', 15: 'kin', 21: 'kin' }, // Börte
  15: { 5: 'kin', 3: 'kin', 4: 'kin', 7: 'kin', 14: 'kin' }, // Sorghaghtani
  16: { 12: 'ally', 14: 'kin' }, // Mandukhai (married young Dayan)
  17: { 1: 'kin', 14: 'kin' }, // Alan Gua
  18: { 11: 'kin', 3: 'rival' }, // Khutulun (Khaidu's daughter)
  19: { 2: 'kin', 6: 'kin' }, // Töregene
  20: { 3: 'kin', 15: 'kin' }, // Chabi
  21: { 1: 'kin', 14: 'kin', 17: 'kin' }, // Öelün
  22: { 1: 'kin', 14: 'kin' }, // Yesüi
  23: { 16: 'kin' }, // Abahai
  24: { 1: 'ally', 8: 'ally', 25: 'ally' }, // Subutai
  25: { 24: 'ally', 1: 'ally', 26: 'ally' }, // Jebe
  26: { 1: 'ally', 24: 'ally', 25: 'ally' }, // Muqali
  27: { 1: 'ally', 26: 'ally', 28: 'ally' }, // Boorchu
  28: { 1: 'ally', 27: 'ally', 26: 'ally' }, // Jelme
  29: { 1: 'ally', 27: 'ally', 28: 'ally' }, // Chilaun
  30: { 1: 'kin', 21: 'kin' }, // Khasar
  31: { 8: 'ally', 24: 'ally' }, // Burundai
  32: { 3: 'ally', 24: 'ally' }, // Bayan — Kublai's general
  33: { 3: 'kin', 32: 'ally' }, // Toghon Temur
  34: { 13: 'ally', 40: 'ally' }, // Sükhbaatar
  35: { 47: 'kin', 13: 'ally' }, // Zanabazar (warrior card)
  36: { 1: 'mentor', 2: 'mentor', 37: 'ally' }, // Yelü Chucai
  37: { 36: 'ally', 1: 'mentor' }, // Mahmud Yalavach
  38: { 1: 'kin', 36: 'ally' }, // Shiki Qutuqu (adopted)
  39: { 1: 'mentor', 36: 'ally' }, // Tatatunga
  40: { 34: 'ally', 13: 'rival' }, // Choibalsan
  41: { 40: 'kin', 42: 'rival' }, // Tsedenbal
  42: { 34: 'ally', 40: 'rival' }, // Zorig
  43: { 13: 'kin', 44: 'kin' }, // Amarsanaa
  44: { 43: 'ally', 13: 'kin' }, // Galdan Boshigt
  45: { 7: 'mentor', 46: 'ally' }, // Rashid — served Il-Khan
  46: { 3: 'ally', 45: 'ally' }, // Marco Polo
  47: { 35: 'kin', 13: 'ally' }, // Zanabazar (cultural card)
  48: { 49: 'ally', 47: 'mentor' }, // Rinchen
  49: { 48: 'ally', 50: 'ally' }, // Natsagdorj
  50: { 49: 'ally', 51: 'ally' }, // Gürragchaa
  51: { 49: 'ally', 52: 'ally' }, // Murdorj
  52: { 47: 'ally', 48: 'ally' }, // B. Sharav
};

/**
 * Look up the relationship type from `fromId` → `toId`.  Returns null if unknown.
 * Falls back to symmetric lookup (reverse edge) if the direct edge isn't set.
 */
export function relType(fromId, toId) {
  const direct = REL_TYPES[fromId]?.[toId];
  if (direct) return direct;
  const reverse = REL_TYPES[toId]?.[fromId];
  return reverse || null;
}
