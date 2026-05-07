import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAppSettings } from '@/hooks/useAppSettings';
import { FIGURES } from '@/lib/figuresData';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import ScrollProgress from '@/components/ScrollProgress';
import Navbar from '@/components/Navbar';
import HeroSection from '@/components/HeroSection';
import GallerySection from '@/components/GallerySection';
import TimelineSection from '@/components/TimelineSection';
import FigureModal from '@/components/FigureModal';
import ChatFAB from '@/components/ChatFAB';
import AdminPanel from '@/components/admin/AdminPanel';
import { ErrorBoundary } from '@/lib/feedback';
import MyTeamSection from '@/components/MyTeamSection';
import { useMyTeam } from '@/hooks/useMyTeam';
import CompareBar from '@/components/CompareBar';
import CompareModal from '@/components/CompareModal';
import { useCompare } from '@/hooks/useCompare';
import HistoricalMap from '@/components/HistoricalMap';
import ChaptersSection from '@/components/ChaptersSection';
import CodexRule from '@/components/ornaments/CodexRule';
import CornerTicks from '@/components/ornaments/CornerTicks';
import Fleuron from '@/components/ornaments/Fleuron';
import { useLang } from '@/lib/i18n';
import { useNavigate as useRouterNavigate } from 'react-router-dom';
import { Volume2, Quote as QuoteIcon, Users, Trophy, ChevronRight } from 'lucide-react';

function HomeEngagements() {
  const { t, lang } = useLang();
  const nav = useRouterNavigate();
  const cards = [
    {
      key: 'quotes',
      to: '/games/quotes',
      icon: QuoteIcon,
      tint: 'brass',
      kicker: lang === 'en' ? 'Solo' : 'Ганц',
      title: lang === 'en' ? 'Whose words?' : 'Хэний үг вэ?',
      sub: lang === 'en'
        ? 'Read the quotation, pick the figure. Score ranks on the leaderboard.'
        : 'Ишлэлийг уншиж, хэн хэлснийг сонго. Тэргүүлэгчдийн жагсаалтад нэрээ үлдээ.',
      cta: lang === 'en' ? 'Play' : 'Тоглох',
    },
    {
      key: 'live',
      to: '/games/quotes/live',
      icon: Users,
      tint: 'seal',
      kicker: lang === 'en' ? 'Party' : 'Багаараа',
      title: lang === 'en' ? 'Live rooms' : 'Живэ өрөө',
      sub: lang === 'en'
        ? '2–8 players, shared timer, one quote at a time. Create a room or join with a code.'
        : '2–8 тоглогч, нийтлэг хугацаа, нэг ишлэл. Код оруулан нэгд эсвэл өрөө үүсгэ.',
      cta: lang === 'en' ? 'Host or join' : 'Үүсгэх / нэгдэх',
    },
    {
      key: 'leaderboard',
      to: '/leaderboard',
      icon: Trophy,
      tint: 'brass',
      kicker: lang === 'en' ? 'Rankings' : 'Байр',
      title: lang === 'en' ? 'Leaderboard' : 'Тэргүүлэгчид',
      sub: lang === 'en'
        ? 'Weekly and all-time scores across every quote round and duel.'
        : '7 хоногийн болон бүх цагийн тэргүүлэгчид.',
      cta: lang === 'en' ? 'View' : 'Үзэх',
    },
    {
      key: 'tour',
      to: '/tour',
      icon: Volume2,
      tint: 'brass',
      kicker: lang === 'en' ? 'Listen' : 'Сонсох',
      title: lang === 'en' ? 'Story Tour' : 'Түүхэн Аялал',
      sub: lang === 'en'
        ? 'Walk the Codex from end to end with narration playing automatically.'
        : 'Кодексийн эхнээс сүүл хүртэл дуу автоматаар тоглож өгнө.',
      cta: lang === 'en' ? 'Begin tour' : 'Аяллыг эхлэх',
    },
  ];
  return (
    <section id="engagements" className="relative py-20 px-4 border-y border-brass/25">
      <div className="max-w-[84rem] mx-auto">
        <div className="text-center mb-10 space-y-4">
          <span className="codex-caption text-brass">
            {lang === 'en' ? 'Engagements' : 'Тоглоом & Аялал'}
          </span>
          <h2
            className="display-title text-[clamp(1.75rem,4vw,2.75rem)] text-ivory"
            style={{ fontVariationSettings: '"opsz" 96, "SOFT" 60, "wght" 520' }}
          >
            {lang === 'en'
              ? <>Step <span className="text-seal">into</span> the codex</>
              : <>Кодекстээ <span className="text-seal">оролцох</span></>}
          </h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-4 md:gap-5">
          {cards.map(c => {
            const Icon = c.icon;
            const borderColor = c.tint === 'seal'
              ? 'border-seal/50 hover:border-seal text-seal'
              : 'border-brass/50 hover:border-brass text-brass';
            return (
              <button
                key={c.key}
                onClick={() => nav(c.to)}
                className="group relative bg-ink/40 hover:bg-ink/60 border border-brass/30 hover:border-brass/70 transition-all text-left p-6 md:p-8 hover:-translate-y-0.5"
              >
                <CornerTicks size={12} inset={6} thickness={1} opacity={0.85} />
                <div className="flex items-start gap-5">
                  <span className={`w-14 h-14 flex items-center justify-center border ${borderColor} flex-shrink-0 transition-colors`}>
                    <Icon className="w-6 h-6" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="font-meta text-[9.5px] tracking-[0.32em] uppercase text-brass/80">
                      {c.kicker}
                    </span>
                    <h3
                      className="font-display text-2xl md:text-3xl text-ivory mt-1 leading-tight group-hover:text-seal transition-colors"
                      style={{ fontVariationSettings: '"opsz" 48, "SOFT" 60' }}
                    >
                      {c.title}
                    </h3>
                    <p className="font-prose italic text-sm text-ivory/70 mt-2 leading-relaxed">
                      {c.sub}
                    </p>
                    <span className="inline-flex items-center gap-2 mt-4 font-meta text-[10px] tracking-[0.28em] uppercase text-brass group-hover:text-ivory transition-colors">
                      {c.cta}
                      <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function HomeFooter({ settings }) {
  const { t } = useLang();
  return (
    <footer className="relative border-t border-brass/30 pt-14 pb-10 px-5">
      <div className="max-w-[82rem] mx-auto">
        <div className="flex flex-col items-center gap-5 text-center">
          <Fleuron size={36} className="opacity-70" />
          <div>
            <div className="font-meta text-[10px] tracking-[0.4em] uppercase text-brass/80">{t('footer.colophon')}</div>
            <div
              className="font-display text-2xl text-ivory mt-1"
              style={{ fontVariationSettings: '"opsz" 48, "SOFT" 60, "WONK" 1' }}
            >
              {settings.site_name}
            </div>
          </div>
          <p className="prose-body italic text-ivory/65 max-w-lg text-[14px]">
            {t('footer.body')}
          </p>
          <div className="w-full max-w-lg h-px bg-gradient-to-r from-transparent via-brass/55 to-transparent" />
          <div className="flex items-center gap-4 font-meta text-[9.5px] tracking-[0.3em] uppercase text-brass/60">
            <span>© MMXXVI</span>
            <span>·</span>
            <span>Altan Domog · Codex I</span>
            <span>·</span>
            <span>ULAANBAATAR</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

function HomeMapSection() {
  const { t } = useLang();
  return (
    <div id="map" className="relative py-24 px-4">
      <div className="max-w-[84rem] mx-auto">
        <div className="text-center space-y-5 mb-12">
          <CodexRule caption={t('codex.chapter.V')} fleuronSize={22} />
          <h2 className="display-title text-[clamp(2.2rem,5vw,4rem)] text-ivory">
            {t('map.title.prefix')} <span className="text-seal">{t('map.title.suffix')}</span>
          </h2>
          <p className="max-w-lg mx-auto prose-body italic text-ivory/70">
            {t('map.subtitle')}
          </p>
        </div>
        <div className="relative border border-brass/40 overflow-hidden">
          <HistoricalMap />
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [selectedFigure, setSelectedFigure] = useState(null);
  const [chatQuestion, setChatQuestion] = useState(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [figures, setFigures] = useState(FIGURES);
  const { team, toggleTeam, isInTeam, removeFromTeam, clearTeam } = useMyTeam();
  const { settings } = useAppSettings();
  const { compareList, toggleCompare, isInCompare, clearCompare, removeFromCompare } = useCompare();
  const [showCompare, setShowCompare] = useState(false);
  const location = useLocation();

  // Scroll to section when returning from a detail page
  useEffect(() => {
    if (location.state?.scrollTo) {
      setTimeout(() => {
        const el = document.getElementById(location.state.scrollTo);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [location.state]);

  // Load figures from DB, fallback to defaults
  const { data: dbFigures } = useQuery({
    queryKey: ['figures'],
    queryFn: () => base44.entities.Figure.list('-fig_id', 100),
    initialData: [],
  });

  useEffect(() => {
    if (dbFigures && dbFigures.length > 0) {
      // Merge DB data with defaults
      const merged = FIGURES.map(defaultFig => {
        const dbFig = dbFigures.find(d => d.fig_id === defaultFig.fig_id);
        return dbFig ? { ...defaultFig, ...dbFig } : defaultFig;
      });
      // Add any extra figures from DB
      dbFigures.forEach(dbFig => {
        if (!merged.find(m => m.fig_id === dbFig.fig_id)) {
          merged.push(dbFig);
        }
      });
      merged.sort((a, b) => a.fig_id - b.fig_id);
      setFigures(merged);
    }
  }, [dbFigures]);

  // Admin panel opens via Navbar button (gated on is_admin); listen for the event.
  useEffect(() => {
    const open = () => setShowAdmin(true);
    window.addEventListener('open-admin-panel', open);
    return () => window.removeEventListener('open-admin-panel', open);
  }, []);

  const scrollTo = useCallback((target) => {
    const el = document.getElementById(target);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const openModal = useCallback((figure) => {
    setSelectedFigure(figure);
  }, []);

  const askAI = useCallback((figure) => {
    setSelectedFigure(null);
    setChatQuestion(`${figure.name}-ын тухай дэлгэрэнгүй ярина уу`);
  }, []);

  return (
    <div className="min-h-screen bg-background font-body relative">
      <ScrollProgress />
      <Navbar onScrollTo={scrollTo} />

      <div id="hero">
        <HeroSection onExplore={() => scrollTo('gallery')} />
      </div>

      <div id="gallery">
        <GallerySection
          figures={figures}
          onCardClick={openModal}
          isInTeam={isInTeam}
          onToggleTeam={toggleTeam}
          isInCompare={isInCompare}
          onToggleCompare={toggleCompare}
        />
      </div>

      <div id="myteam">
        <MyTeamSection
          figures={figures}
          team={team}
          onCardClick={openModal}
          onRemove={removeFromTeam}
          onClear={clearTeam}
        />
      </div>

      <div id="chapters">
        <ChaptersSection figures={figures} />
      </div>

      <HomeEngagements />

      <HomeMapSection />

      <div id="timeline">
        <TimelineSection />
      </div>

      <HomeFooter settings={settings} />

      {/* Modal */}
      {selectedFigure && (
        <FigureModal
          figure={selectedFigure}
          onClose={() => setSelectedFigure(null)}
          onSelectFigure={openModal}
          onAskAI={askAI}
          isInTeam={isInTeam(selectedFigure.fig_id)}
          onToggleTeam={toggleTeam}
        />
      )}

      {/* Compare bar */}
      <CompareBar
        figures={figures}
        compareList={compareList}
        onRemove={removeFromCompare}
        onClear={clearCompare}
        onOpenCompare={() => setShowCompare(true)}
      />

      {/* Compare modal */}
      {showCompare && (
        <CompareModal
          figures={figures}
          compareList={compareList}
          onClose={() => setShowCompare(false)}
        />
      )}

      {/* Chat */}
      <ChatFAB
        initialQuestion={chatQuestion}
        onOpenModal={openModal}
      />

      {/* Admin */}
      {showAdmin && (
        <ErrorBoundary
          fallbackKey="toast.admin.crash"
          fallback={({ retry }) => {
            if (typeof document !== 'undefined') document.body.style.overflow = '';
            return (
              <div className="fixed inset-0 z-[200] bg-background flex items-center justify-center px-6 text-center text-ivory">
                <div className="max-w-md space-y-3">
                  <p className="font-prose">Админ панел гэнэт зогслоо.</p>
                  <button onClick={() => { retry(); setShowAdmin(false); }} className="font-meta text-[10px] tracking-[0.3em] uppercase text-brass hover:text-ivory">
                    Хаах
                  </button>
                </div>
              </div>
            );
          }}
        >
          <AdminPanel
            figures={figures}
            onClose={() => setShowAdmin(false)}
            onFiguresChange={setFigures}
          />
        </ErrorBoundary>
      )}
    </div>
  );
}