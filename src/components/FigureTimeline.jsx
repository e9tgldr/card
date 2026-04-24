import { TIMELINE_ITEMS } from '@/lib/figuresData';

// Per-figure personal timeline events derived from their data
function buildPersonalTimeline(figure) {
  const events = [];

  // Birth
  if (figure.yrs) {
    const match = figure.yrs.match(/(\d{3,4})/);
    if (match) {
      events.push({ era: match[1], type: 'birth', label: 'Мэндэлсэн', desc: `${figure.name} мэндэлсэн.` });
    }
  }

  // Achievements as events
  if (figure.achs?.length) {
    figure.achs.forEach((ach, i) => {
      events.push({ era: '—', type: 'achievement', label: `Гавьяа ${i + 1}`, desc: ach });
    });
  }

  // Death
  if (figure.yrs) {
    const deathMatch = figure.yrs.match(/(\d{3,4})\s*[-–]\s*(\d{3,4})/);
    if (deathMatch) {
      events.push({ era: deathMatch[2], type: 'death', label: 'Нас барсан', desc: `${figure.name} ${deathMatch[2]} онд нас барсан.` });
    }
  }

  return events;
}

// Find global timeline events that overlap with this figure's years
function getRelatedGlobalEvents(figure) {
  if (!figure.yrs) return [];
  const yearsMatch = figure.yrs.match(/(\d{3,4})\s*[-–]\s*(\d{3,4})/);
  if (!yearsMatch) return [];
  const start = parseInt(yearsMatch[1]);
  const end = parseInt(yearsMatch[2]);

  return TIMELINE_ITEMS.filter(item => {
    const eraMatch = item.era.match(/(\d{3,4})/);
    if (!eraMatch) return false;
    const eraYear = parseInt(eraMatch[1]);
    return eraYear >= start - 5 && eraYear <= end + 5;
  });
}

const typeConfig = {
  birth:       { color: 'bg-green-500',  border: 'border-green-500/40',  label: '🌱' },
  death:       { color: 'bg-gray-500',   border: 'border-gray-500/40',   label: '☽' },
  achievement: { color: 'bg-gold',       border: 'border-gold/40',       label: '⭐' },
  global:      { color: 'bg-crimson',    border: 'border-crimson/40',    label: '🌍' },
};

export default function FigureTimeline({ figure }) {
  const personal = buildPersonalTimeline(figure);
  const global = getRelatedGlobalEvents(figure);

  if (personal.length === 0 && global.length === 0) return null;

  return (
    <div className="space-y-4">
      <h3 className="font-cinzel text-sm font-semibold text-gold tracking-wider">ОН ДАРААЛАЛ</h3>

      {/* Personal timeline */}
      <div className="relative pl-5">
        <div className="absolute left-1.5 top-0 bottom-0 w-px bg-gradient-to-b from-gold/60 via-gold/20 to-transparent" />
        <div className="space-y-4">
          {personal.map((ev, i) => {
            const cfg = typeConfig[ev.type] || typeConfig.achievement;
            return (
              <div key={i} className="relative flex gap-3 items-start group">
                {/* Dot */}
                <div className={`absolute -left-5 mt-0.5 w-3.5 h-3.5 rounded-full ${cfg.color} border-2 ${cfg.border} flex-shrink-0 shadow-sm`} />
                {/* Content */}
                <div className={`flex-1 rounded-lg border ${cfg.border} bg-card/40 p-2.5 transition-colors group-hover:bg-card/70`}>
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="font-cinzel text-xs font-bold text-foreground">{cfg.label} {ev.label}</span>
                    {ev.era !== '—' && (
                      <span className="text-[10px] font-cinzel text-gold bg-gold/10 px-1.5 py-0.5 rounded-full">{ev.era}</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground font-body leading-relaxed">{ev.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Global context events */}
      {global.length > 0 && (
        <div className="mt-4">
          <h4 className="font-cinzel text-xs font-semibold text-muted-foreground tracking-wider mb-3 flex items-center gap-2">
            <span className="h-px flex-1 bg-border" />
            ТҮҮХэн Орчин
            <span className="h-px flex-1 bg-border" />
          </h4>
          <div className="grid gap-2">
            {global.map((ev, i) => (
              <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg border border-crimson/20 bg-crimson/5">
                <span className="text-[10px] font-cinzel text-crimson bg-crimson/10 px-1.5 py-0.5 rounded-full whitespace-nowrap mt-0.5">{ev.era}</span>
                <div>
                  <p className="font-cinzel text-xs font-semibold text-foreground">{ev.title}</p>
                  <p className="text-xs text-muted-foreground font-body">{ev.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}