const PIPE_SECTIONS = new Set(['CALLOUTS', 'ASK']);

export function parseChapter(raw) {
  if (!raw || typeof raw !== 'string') return {};
  const out = {};
  const sections = raw.split(/^## (\w+)\s*$/m);
  // sections[0] is preamble (ignored); then alternating [name, body, name, body, ...]
  for (let i = 1; i < sections.length; i += 2) {
    const name = sections[i];
    const body = (sections[i + 1] || '').trim();
    if (PIPE_SECTIONS.has(name)) {
      out[name] = body
        .split('\n')
        .filter((l) => l.trim().length > 0)
        .map((l) => l.split('|').map((c) => c.trim()));
    } else {
      out[name] = body;
    }
  }
  return out;
}
