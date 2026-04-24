import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { CATEGORIES } from '@/lib/figuresData';
import CornerTicks from '@/components/ornaments/CornerTicks';
import BrassButton from '@/components/ornaments/BrassButton';

export default function CompareBar({ figures, compareList, onRemove, onClear, onOpenCompare }) {
  const selected = compareList.map(id => figures.find(f => f.fig_id === id)).filter(Boolean);

  return (
    <AnimatePresence>
      {compareList.length > 0 && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 260 }}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 bg-ink/95 backdrop-blur-md border border-brass/50 px-5 py-4 flex items-center gap-4 max-w-[calc(100vw-32px)] shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)]"
        >
          <CornerTicks size={10} inset={5} thickness={1} opacity={0.95} />

          <span className="font-meta text-[10px] tracking-[0.3em] uppercase text-brass/80">Collatio</span>

          <div className="flex items-center gap-2.5">
            {selected.map(fig => {
              const cat = CATEGORIES[fig.cat];
              return (
                <div key={fig.fig_id} className="relative">
                  <div
                    className="w-11 h-14 flex items-center justify-center border overflow-hidden"
                    style={{ borderColor: cat?.color, background: `${cat?.color}33` }}
                  >
                    {fig.front_img
                      ? <img src={fig.front_img} alt={fig.name} className="w-full h-full object-cover mix-blend-luminosity" crossOrigin="anonymous" />
                      : <span className="text-xl">{fig.ico}</span>
                    }
                  </div>
                  <button
                    onClick={() => onRemove(fig.fig_id)}
                    className="absolute -top-2 -right-2 w-4 h-4 bg-seal border border-brass/80 flex items-center justify-center hover:bg-seal-soft transition-colors"
                    aria-label="Хасах"
                  >
                    <X className="w-2.5 h-2.5 text-ivory" />
                  </button>
                </div>
              );
            })}
            {Array.from({ length: Math.max(0, 2 - selected.length) }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="w-11 h-14 border border-dashed border-brass/40 flex items-center justify-center font-meta text-brass/40 text-xs"
              >
                +
              </div>
            ))}
          </div>

          <div className="h-10 w-px bg-brass/35" />

          <div className="flex flex-col leading-tight">
            <span className="font-meta text-[9.5px] tracking-[0.26em] uppercase text-brass/80">
              {String(compareList.length).padStart(2, '0')} · Сонгогдсон
            </span>
            <span className="font-prose italic text-[11px] text-ivory/60">
              {compareList.length < 2 ? 'Нэг дэхийг нэмнэ үү' : 'Харьцуулахад бэлэн'}
            </span>
          </div>

          <div className="flex items-center gap-2 ml-auto flex-shrink-0">
            <button
              onClick={onClear}
              className="font-meta text-[10px] tracking-[0.24em] uppercase text-brass/70 hover:text-ivory transition-colors px-2 py-1"
            >
              Цэвэрлэх
            </button>
            <BrassButton
              variant="primary"
              size="sm"
              disabled={compareList.length < 2}
              onClick={onOpenCompare}
              className={compareList.length < 2 ? 'opacity-50 cursor-not-allowed' : ''}
            >
              Харьцуулах
            </BrassButton>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
