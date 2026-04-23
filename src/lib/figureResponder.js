// Rule-based MN responder. Returns a first-person Mongolian answer string,
// or null if no intent matches (caller falls through to LLM tier).

const PATTERNS = [
  {
    id: 'birth_year',
    re: /хэзээ\s+төрс|төрсөн\s+он|хэдэн\s+онд\s+төрс/i,
    needs: ['yrs'],
    render: (f) => {
      const m = f.yrs?.match(/(\d{3,4})/);
      return m ? `Би ${m[1]} онд төрсөн.` : null;
    },
  },
  {
    id: 'death_year',
    re: /хэзээ\s+нас\s+бар|нас\s+барсан\s+он|хэзээ\s+ертөнцийн\s+мөнх/i,
    needs: ['yrs'],
    render: (f) => {
      const m = f.yrs?.match(/(\d{3,4})\s*[–\-—]\s*(\d{3,4})/);
      return m ? `Би ${m[2]} онд ертөнцийн мөнх бусыг үзүүлсэн.` : null;
    },
  },
  {
    id: 'lifespan',
    re: /хэзээ\s+амьдарсан|амьдралын\s+он|он\s+жил/i,
    needs: ['yrs'],
    render: (f) => `Миний амьдралын он ${f.yrs}.`,
  },
  // who_are_you must run before role — "Чи хэн бэ?" should give bio, not role summary.
  {
    id: 'who_are_you',
    re: /^чи\s+хэн(\s+бэ|\s+вэ)?\s*\??$|танилц|өөрийгөө/i,
    needs: ['bio'],
    render: (f) => `${f.bio}`,
  },
  {
    id: 'role',
    re: /чи\s+хэн\s+байсан|юу\s+болох\s+байс|ямар\s+хүн/i,
    needs: ['role'],
    render: (f) => `Намайг ${f.name} гэдэг. Би бол ${f.role}.`,
  },
  {
    id: 'achievements',
    re: /юу\s+хийс(эн|эн\s+бэ)|гавьяа|амжилт|бүтээсэн/i,
    needs: ['achs'],
    render: (f) => {
      if (!f.achs?.length) return null;
      const list = f.achs.map((a) => `• ${a}`).join('\n');
      return `Миний гол үйлсээс:\n${list}`;
    },
  },
  {
    id: 'quote',
    re: /нэрт\s+үг|ишлэл|алдартай\s+үг|хэлс(эн|эн\s+үг)/i,
    needs: ['quote'],
    render: (f) => (f.quote ? `"${f.quote}" — миний үг.` : null),
  },
  {
    id: 'fact',
    re: /сонирхолтой|сонин\s+юм|мэдэхгүй\s+зүйл|нууц/i,
    needs: ['fact'],
    render: (f) => (f.fact ? f.fact : null),
  },
  {
    id: 'bio',
    re: /түүх|амьдрал|намтар/i,
    needs: ['bio'],
    render: (f) => f.bio ?? null,
  },
];

export function tryAnswer(figure, userText, lang) {
  if (lang !== 'mn') return null;
  if (!figure || !userText) return null;
  const text = userText.trim();
  if (!text) return null;

  for (const p of PATTERNS) {
    if (!p.re.test(text)) continue;
    const ok = p.needs.every((k) => {
      const v = figure[k];
      return Array.isArray(v) ? v.length > 0 : v != null && v !== '';
    });
    if (!ok) continue;
    const result = p.render(figure);
    if (result) return result;
  }
  return null;
}
