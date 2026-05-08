import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import ContourBackground from '@/components/ornaments/ContourBackground';
import TukBanner from '@/components/ornaments/TukBanner';
import Fleuron from '@/components/ornaments/Fleuron';
import CornerTicks from '@/components/ornaments/CornerTicks';
import BrassButton from '@/components/ornaments/BrassButton';

const STATS = [
  { n: '52',   l: 'ЗҮТГЭЛТЭН',       r: 'I'   },
  { n: '05',   l: 'АНГИЛАЛ',         r: 'II'  },
  { n: '800+', l: 'ЖИЛИЙН ТҮҮХ',     r: 'III' },
  { n: '19',   l: 'ГАЗРЫН ЦЭГ',      r: 'IV'  },
];

// Mongolian bichig strings — vertical classical script (Monggol bichig)
const BICHIG_TOP = 'ᠮᠣᠩᠭᠣᠯ';       // "Mongol"
const BICHIG_BOT = 'ᠲᠡᠦᠬᠡ';         // "history"

export default function HeroSection({ onExplore }) {
  return (
    <section className="relative min-h-screen flex items-stretch overflow-hidden contour-bg pt-20 lg:pt-24">
      {/* Ambient backdrop: contour lines + radial warmth */}
      <ContourBackground density="high" opacity={0.13} />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 20% 40%, hsl(var(--seal)/0.12), transparent 55%),' +
            'radial-gradient(ellipse 60% 50% at 85% 70%, hsl(var(--brass)/0.08), transparent 60%)',
        }}
      />

      {/* Decorative fleurons at the four corners of the frame */}
      <div className="absolute top-24 left-6 opacity-50 hidden md:block">
        <Fleuron size={28} />
      </div>
      <div className="absolute top-24 right-6 opacity-50 hidden md:block scale-x-[-1]">
        <Fleuron size={28} />
      </div>

      {/* Inner frame with brass mount corners */}
      <div className="relative w-full max-w-[92rem] mx-auto px-6 md:px-12 pt-10 pb-16 md:py-20">
        <CornerTicks size={22} inset={12} thickness={1} opacity={0.65} />

        <div className="grid lg:grid-cols-[1fr_auto_0.85fr] gap-10 lg:gap-16 items-center min-h-[70vh]">

          {/* LEFT — editorial title block */}
          <div className="relative page-turn">
            {/* catalog number + imprint */}
            <div className="flex items-baseline gap-4 mb-6">
              <span className="catalog-no">Collection · Vol. I</span>
              <span className="h-px flex-1 bg-brass/30" />
              <span className="font-meta text-[10px] tracking-[0.24em] text-brass/70">MMXXVI</span>
            </div>

            <p className="font-meta text-[11px] tracking-[0.38em] uppercase text-brass/85 mb-4">
              Монголын Их Эзэнт Гүрний
            </p>

            <h1 className="display-title text-[clamp(3.2rem,9vw,9rem)] text-ivory">
              <motion.span
                initial={{ opacity: 0, x: -40, filter: 'blur(8px)' }}
                animate={{ opacity: 1, x: 0, filter: 'blur(0)' }}
                transition={{ duration: 1.1, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                className="block"
              >
                Хүмүүний
              </motion.span>
              <motion.span
                initial={{ opacity: 0, x: -40, filter: 'blur(8px)' }}
                animate={{ opacity: 1, x: 0, filter: 'blur(0)' }}
                transition={{ duration: 1.1, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="block text-seal"
                style={{ fontVariationSettings: '"opsz" 144, "SOFT" 80, "WONK" 1, "wght" 600' }}
              >
                Цуглуулга
              </motion.span>
            </h1>

            {/* Decorative sublabel */}
            <div className="flex items-center gap-3 mt-5 mb-7">
              <span className="block h-px w-10 bg-seal" />
              <span className="font-meta text-[10px] tracking-[0.5em] text-brass">ТАВИН ХОЁР · FIFTY-TWO</span>
              <span className="block h-px w-10 bg-brass" />
            </div>

            {/* Prose lead */}
            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.6 }}
              className="prose-body max-w-xl text-[1.05rem] leading-[1.75] italic text-ivory/80"
              style={{ fontVariationSettings: '"opsz" 40' }}
            >
              Тавин хоёр зүтгэлтний намтар, гавьяа, домог — найман зуун жилийн
              түүхийг нэгэн хөзрийн баглаанд багтаасан зураглалт цуглуулга.
            </motion.p>

            {/* CTA row */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.8 }}
              className="mt-10 flex flex-col sm:flex-row items-start sm:items-center gap-5"
            >
              <BrassButton
                onClick={onExplore}
                variant="primary"
                trailingIcon={<ChevronDown className="w-3.5 h-3.5" />}
              >
                Цуглуулга Нээх
              </BrassButton>
              <div className="flex flex-col">
                <span className="font-meta text-[9.5px] tracking-[0.26em] uppercase text-brass/60">Эсхүл</span>
                <a
                  href="#timeline"
                  className="font-display text-sm text-ivory/80 hover:text-ivory transition-colors border-b border-brass/45 hover:border-ivory pb-0.5"
                  style={{ fontVariationSettings: '"opsz" 24, "SOFT" 40' }}
                >
                  Он дарааллаар үзэх
                </a>
              </div>
            </motion.div>

            {/* Scroll hint */}
            <motion.div
              className="mt-14 flex items-center gap-3 opacity-60"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              transition={{ delay: 1.3 }}
            >
              <motion.span
                animate={{ y: [0, 5, 0] }}
                transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
                className="inline-block"
              >
                <ChevronDown className="w-3.5 h-3.5 text-brass" />
              </motion.span>
              <span className="font-meta text-[9px] tracking-[0.36em] uppercase text-brass/75">
                Хуудас эргүүлэх
              </span>
            </motion.div>
          </div>

          {/* MIDDLE — vertical Mongol bichig pillar */}
          <div className="hidden lg:flex flex-col items-center gap-6 self-stretch justify-center relative">
            <span className="block h-16 w-px bg-gradient-to-b from-transparent to-brass/60" />
            <span className="bichig font-bichig text-2xl tracking-wider text-brass/70">
              {BICHIG_TOP}
            </span>
            <span className="block w-1.5 h-1.5 rotate-45 bg-seal" />
            <span className="bichig font-bichig text-2xl tracking-wider text-brass/70">
              {BICHIG_BOT}
            </span>
            <span className="block h-16 w-px bg-gradient-to-t from-transparent to-brass/60" />
          </div>

          {/* RIGHT — sulde tug emblem + statistical dossier */}
          <div className="relative">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0)' }}
              transition={{ duration: 1.3, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="relative flex justify-center"
            >
              {/* Halo */}
              <span
                aria-hidden
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[320px] h-[320px] rounded-full pointer-events-none"
                style={{
                  background:
                    'radial-gradient(circle, hsl(var(--brass)/0.14) 0%, transparent 65%)',
                }}
              />
              <TukBanner size={120} className="relative z-10 drop-shadow-[0_4px_24px_rgba(198,154,74,0.35)]" />
            </motion.div>

            {/* Dossier block */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.7 }}
              className="relative mt-10 border border-brass/35 bg-ink/40 backdrop-blur-sm"
            >
              <CornerTicks size={10} inset={5} thickness={1} opacity={0.9} />
              <div className="px-6 py-5">
                <div className="flex items-baseline justify-between mb-4 pb-3 border-b border-brass/25">
                  <span className="font-meta text-[10px] tracking-[0.3em] uppercase text-brass">
                    DOSSIER
                  </span>
                  <span className="font-meta text-[9px] tracking-[0.2em] text-brass/60">01 / 04</span>
                </div>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-5">
                  {STATS.map((s) => (
                    <div key={s.l} className="flex flex-col">
                      <div className="flex items-baseline gap-2">
                        <span className="font-meta text-[9px] text-brass/55 tracking-widest">{s.r}.</span>
                        <dt className="font-meta text-[9px] tracking-[0.28em] uppercase text-ivory/55">
                          {s.l}
                        </dt>
                      </div>
                      <dd
                        className="font-display text-3xl md:text-4xl text-ivory mt-1"
                        style={{ fontVariationSettings: '"opsz" 96, "SOFT" 50, "WONK" 1, "wght" 550' }}
                      >
                        {s.n}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </motion.div>

            {/* Feature list (replaces pill chips) */}
            <motion.ul
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.95 }}
              className="mt-6 space-y-2 text-left"
            >
              {[
                ['α', 'Газар зүйн интерактив зураг'],
                ['β', 'Зүтгэлтэн бүрийг харьцуулах'],
                ['γ', 'AI-тай яриа үүсгэх'],
                ['δ', 'Мэдлэг шалгах асуумж'],
              ].map(([glyph, label]) => (
                <li key={label} className="flex items-baseline gap-3">
                  <span className="font-display text-brass/80" style={{ fontVariationSettings: '"opsz" 24' }}>{glyph}</span>
                  <span className="font-prose text-[13px] text-ivory/75">{label}</span>
                </li>
              ))}
            </motion.ul>
          </div>
        </div>
      </div>

      {/* Bottom fade */}
      <div
        className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, transparent, hsl(var(--ink)))' }}
      />
    </section>
  );
}
