import { CATEGORIES, ERAS, getEra } from '@/lib/figuresData';
import { figureName, figureRole, figureAchievements } from '@/lib/i18n';

/**
 * compareLocally — produce a similarities/differences/overall summary from
 * data alone, without calling the cloud LLM. Used as a fallback when
 * `base44.integrations.Core.InvokeLLM` is stubbed (local dev mode) or fails.
 *
 * Returns the same shape the AI path emits:
 *   { similarities: string[], differences: string[], overall: string }
 */
export function compareLocally(figures, lang = 'mn') {
  if (!figures || figures.length < 2) return { similarities: [], differences: [], overall: '' };

  const isEn = lang === 'en';
  const T = isEn ? EN : MN;

  const cats = figures.map(f => f.cat);
  const eras = figures.map(f => getEra(f));
  const years = figures.map(f => extractStartYear(f.yrs));
  const achCounts = figures.map(f => (figureAchievements(f, lang) || []).length);
  const names = figures.map(f => figureName(f, lang));

  const similarities = [];
  const differences = [];

  // Same category?
  if (cats.every(c => c === cats[0])) {
    const c = isEn ? (CATEGORIES[cats[0]]?.label_en || CATEGORIES[cats[0]]?.label) : CATEGORIES[cats[0]]?.label;
    similarities.push(T.sameCategory(c));
  } else {
    differences.push(T.diffCategory(figures.map(f => ({
      name: figureName(f, lang),
      cat: isEn ? (CATEGORIES[f.cat]?.label_en || CATEGORIES[f.cat]?.label) : CATEGORIES[f.cat]?.label,
    }))));
  }

  // Same era?
  if (eras.every(e => e === eras[0])) {
    const eraLabel = isEn ? (ERAS[eras[0]]?.label_en || ERAS[eras[0]]?.label) : ERAS[eras[0]]?.label;
    similarities.push(T.sameEra(eraLabel));
  } else {
    differences.push(T.diffEra(figures.map((f, i) => ({
      name: names[i],
      era: isEn ? (ERAS[eras[i]]?.label_en || ERAS[eras[i]]?.label) : ERAS[eras[i]]?.label,
    }))));
  }

  // Year span
  const validYears = years.filter(y => y != null);
  if (validYears.length === figures.length) {
    const span = Math.max(...validYears) - Math.min(...validYears);
    if (span === 0) {
      similarities.push(T.sameYear(validYears[0]));
    } else if (span <= 50) {
      similarities.push(T.contemporaries(span));
    } else {
      differences.push(T.yearSpan(span));
    }
  }

  // Achievements
  const totalAchs = achCounts.reduce((a, b) => a + b, 0);
  if (totalAchs > 0) {
    const maxIdx = achCounts.indexOf(Math.max(...achCounts));
    const minIdx = achCounts.indexOf(Math.min(...achCounts));
    if (achCounts[maxIdx] === achCounts[minIdx]) {
      similarities.push(T.sameAchCount(achCounts[0]));
    } else {
      differences.push(T.achCountDiff(names[maxIdx], achCounts[maxIdx], names[minIdx], achCounts[minIdx]));
    }
  }

  // Roles overlap by keyword
  const roleWords = figures.map(f => keywords(figureRole(f, lang) || ''));
  if (roleWords.length >= 2) {
    let common = roleWords[0];
    for (let i = 1; i < roleWords.length; i++) {
      common = common.filter(w => roleWords[i].includes(w));
    }
    if (common.length > 0) {
      similarities.push(T.sharedRoleKeyword(common[0]));
    }
  }

  // Overall — short paragraph
  const overall = T.overall(names, similarities.length, differences.length);

  return { similarities, differences, overall };
}

// ────────────────────────────────────────────────────────────────────────
function extractStartYear(yrs) {
  if (!yrs) return null;
  const m = String(yrs).match(/\d{3,4}/);
  return m ? parseInt(m[0], 10) : null;
}

function keywords(s) {
  return String(s)
    .split(/[\s,;·]+/)
    .map(w => w.trim().toLowerCase())
    .filter(w => w.length > 3);
}

const list = (items, conj) => {
  if (items.length <= 1) return items.join('');
  if (items.length === 2) return `${items[0]} ${conj} ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} ${conj} ${items[items.length - 1]}`;
};

// ────────────────────────────────────────────────────────────────────────
const EN = {
  sameCategory: (c) => `Both belong to the same category — ${c}.`,
  diffCategory: (rows) => `They span different categories: ${rows.map(r => `${r.name} (${r.cat})`).join(', ')}.`,
  sameEra:      (e) => `They lived in the same era — ${e}.`,
  diffEra:      (rows) => `They belong to different eras: ${rows.map(r => `${r.name} → ${r.era}`).join(', ')}.`,
  sameYear:     (y) => `They share the same starting year (${y}).`,
  contemporaries: (n) => `Their lives overlapped within roughly ${n} years — they were contemporaries.`,
  yearSpan:     (n) => `Their lives span about ${n} years apart, placing them in different generations.`,
  sameAchCount: (n) => `Each has the same number of recorded achievements (${n}).`,
  achCountDiff: (a, an, b, bn) => `${a} has ${an} recorded achievements while ${b} has only ${bn}.`,
  sharedRoleKeyword: (w) => `Their roles share a common thread — both are connected to “${w}”.`,
  overall: (names, simN, diffN) =>
    `Comparing ${list(names, 'and')}: ${simN} shared trait${simN === 1 ? '' : 's'} and ${diffN} clear difference${diffN === 1 ? '' : 's'} surface from the collection data alone.`,
};

const MN = {
  sameCategory: (c) => `Хоёулаа ижил ангилалд хамаардаг — ${c}.`,
  diffCategory: (rows) => `Тэд өөр өөр ангилалд хамаардаг: ${rows.map(r => `${r.name} (${r.cat})`).join(', ')}.`,
  sameEra:      (e) => `Тэд нэг үед амьдарсан — ${e}.`,
  diffEra:      (rows) => `Өөр өөр түүхэн үеийн хүмүүс: ${rows.map(r => `${r.name} → ${r.era}`).join(', ')}.`,
  sameYear:     (y) => `Хоёулаа ${y} онтой холбоотой.`,
  contemporaries: (n) => `Тэдний амьдрал ${n} хүрэхгүй жилийн зайтай — үеийн хүмүүс.`,
  yearSpan:     (n) => `Тэдний хооронд ойролцоогоор ${n} жилийн зөрүү бий — өөр өөр үеийн.`,
  sameAchCount: (n) => `Тэмдэглэгдсэн гавьяа адил тоотой (${n}).`,
  achCountDiff: (a, an, b, bn) => `${a} нь ${an} гавьяатай, харин ${b} ${bn} гавьяатай тэмдэглэгдсэн.`,
  sharedRoleKeyword: (w) => `Үүрэгт нь нэг түлхүүр үг давхцаж байна — “${w}”.`,
  overall: (names, simN, diffN) =>
    `${list(names, 'болон')}-ыг харьцуулахад: цуглуулгын өгөгдлөөс ${simN} ижил тал, ${diffN} ялгаатай тал тодорсон.`,
};
