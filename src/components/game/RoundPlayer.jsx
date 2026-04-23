import { CheckCircle2, XCircle } from 'lucide-react';
import { figureName } from '@/lib/i18n';
import CornerTicks from '@/components/ornaments/CornerTicks';

/**
 * Self-contained in-round UI: quote card + 4 name options. Used by the solo
 * game and by live rooms alike. Pure presentation — caller owns state.
 */
export default function RoundPlayer({
  question,
  figures,
  picked,
  onPick,
  revealed = false,
  correctFigId = null,
  lang = 'mn',
}) {
  const showResult = revealed || picked !== null;

  return (
    <div className="space-y-8">
      <section className="relative bg-ink/60 border border-brass/35 px-6 md:px-12 py-10">
        <CornerTicks size={14} inset={8} thickness={1} opacity={0.95} />
        <span className="font-meta text-[9.5px] tracking-[0.32em] uppercase text-brass/70 block text-center mb-5">
          {lang === 'en' ? 'Quotation' : 'Ишлэл'}
        </span>
        <p
          className="font-display italic text-[clamp(1.2rem,3.2vw,2.1rem)] leading-snug text-ivory text-center"
          style={{ fontVariationSettings: '"opsz" 72, "SOFT" 80, "WONK" 1' }}
        >
          &laquo; {question.quote} &raquo;
        </p>
      </section>

      <div className="grid sm:grid-cols-2 gap-3">
        {question.optionFigIds.map((optFigId, i) => {
          const optFigure = figures.find((f) => f.fig_id === optFigId);
          const optName = figureName(optFigure, lang);
          const isCorrect = revealed && correctFigId === optFigId;
          const isPicked = picked === optFigId;
          let style = 'border-brass/40 hover:border-brass text-ivory bg-ink/40';
          if (showResult) {
            if (isCorrect) style = 'border-green-500/70 text-green-400 bg-green-500/10';
            else if (isPicked) style = 'border-seal/70 text-seal bg-seal/10';
            else style = 'border-border text-ivory/55 bg-ink/30 opacity-60';
          }
          return (
            <button
              key={optFigId}
              onClick={() => onPick(optFigId)}
              disabled={picked !== null}
              className={`group relative flex items-center gap-4 px-5 py-4 border ${style} text-left transition-colors`}
            >
              <span className="font-meta text-[9px] tracking-[0.3em] text-brass/70">
                {['I', 'II', 'III', 'IV'][i]}.
              </span>
              <span
                className="font-display text-[15px] leading-tight flex-1"
                style={{ fontVariationSettings: '"opsz" 30, "SOFT" 50' }}
              >
                {optName}
              </span>
              {showResult && isCorrect && <CheckCircle2 className="w-4 h-4 text-green-400" />}
              {showResult && isPicked && !isCorrect && <XCircle className="w-4 h-4 text-seal" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
