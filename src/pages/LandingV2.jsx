import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  QrCode,
  MessageCircle,
  HelpCircle,
  Volume2,
  BookOpen,
  Bot,
  Headphones,
  Globe,
  Gift,
  Award,
  Check,
  Sparkles,
  ScanLine,
} from 'lucide-react';
import { useLang } from '@/lib/i18n';
import { SepiaPortrait } from '@/components/photo/SepiaPortrait';
import { useFeaturedToday } from '@/hooks/useFeaturedToday';
import { useQuoteToday } from '@/hooks/useQuoteToday';
import { useFiguresWithDb } from '@/hooks/useFiguresWithDb';

const FONT_SANS =
  '"Inter Tight", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

const tokens = {
  bg: '#0a0c14',
  surface: '#11141F',
  surfaceMuted: '#1A1F2E',
  surfaceHigh: '#252B3D',
  ink: '#EDE8D5',
  inkSoft: '#C9C0A8',
  body: '#A89F8A',
  hint: '#6B6557',
  border: 'rgba(212,168,67,0.18)',
  borderStrong: 'rgba(212,168,67,0.42)',
  brand: '#D4A843',
  brandStrong: '#E6BC52',
  brandSoft: 'rgba(212,168,67,0.12)',
  brandOnSoft: '#F2D88A',
  bronze: '#CD7F32',
  bronzeSoft: 'rgba(205,127,50,0.14)',
  serif: '"Fraunces", "Source Serif 4", "EB Garamond", Georgia, serif',
  accent: '#FFCC00',
};

const COPY = {
  mn: {
    nav: {
      how: 'Хэрхэн ажилладаг',
      cards: 'Цуглуулга',
      features: 'Онцлогууд',
      pricing: 'Үнэ',
      scan: 'AR-аар таниулах',
      app: 'Апп руу орох',
    },
    hero: {
      chip: '52 түүхэн зүтгэлтэн · Codex I',
      title1: 'Их Монгол Улсын',
      title2: 'түүхийн хөзөр',
      lede:
        'Чингис Хаанаас Занабазар хүртэл — 52 түүхэн дүрийн намтар, ишлэл, гавьяа нэг алтан хөзрийн багцад. QR уншуулмагц AI хөтөч амьсгалтай ярьж өгнө.',
      ctaPrimary: 'Хөзрийн багц захиалах',
      ctaSecondary: 'Апп үзэх',
      scanLabel: 'QR уншуулсан',
      scanBody: 'Би бол Чингис Хаан. Намайг 1162 онд төрсөн…',
    },
    how: {
      chip: 'Хэрхэн ажилладаг вэ?',
      title: '30 секундэд түүхэн дүртэй ярилцана',
      lede: 'Хөзрөө гартаа барь, утсаараа QR-ыг уншуул — тэр чигтээ алдартай дүр амьсгалтай ярина.',
      step: 'Алхам',
      steps: [
        {
          title: 'QR код уншуулах',
          desc: 'Хөзөр бүрийн арын алтан QR-ыг утсаараа сканнердаж эхэлнэ — апп суулгах шаардлагагүй.',
        },
        {
          title: 'Зүтгэлтэн амилна',
          desc: 'Хөзөрт буй дүр AI-гийн тусламжтайгаар танаас сая асуугдсан юм шиг хариулт өгнө.',
        },
        {
          title: 'Юу ч асуу',
          desc: 'Төрсөн жил, байлдан дагуулалт, гэр бүл, эш үг — танд сонирхолтой зүйлийг эсрэг талаас нь нээ.',
        },
        {
          title: '3 хэлээр сонс',
          desc: 'Монгол, Англи, Хятад — хариултыг уншуулах эсвэл мэргэжлийн дуу оруулагчийн дуугаар сонсох сонголттой.',
        },
      ],
    },
    cards: {
      chip: 'Цуглуулга',
      title: 'Хаад · хатад · жанжид · зөвлөхүүд',
      all: 'Бүх 52 дүр',
      roles: { khan: 'Их хаан', queen: 'Хатан хаан', general: 'Жанжин', advisor: 'Зөвлөх' },
    },
    features: {
      chip: 'Онцлогууд',
      title: 'Яагаад Алтан Домог?',
      lede:
        'Энгийн тоглоомын хөзөр биш — судлаачийн өгөгдөл, уран бүтээлчийн дизайн, AI-гийн мэдлэг нэгдсэн цуглуулагчийн эд.',
      list: [
        { title: '52 зүтгэлтэн', desc: 'Хаад, хатад, жанжид, соёлын зүтгэлтэн — МЭ 1162 оноос XX зуун хүртэлх Монголын агуу дүрүүд нэг багцад.' },
        { title: 'AI түүхэн хөтөч', desc: 'Хөзөр бүрийн цаана мэргэжилтний өгөгдлөөр бэлтгэсэн AI — байлдааны тактик, гэр бүл, эш үгийг нэг дор хариулна.' },
        { title: 'Дуут намтар', desc: 'Монгол дикторын уншсан 2–3 минутын хураангуй — аялалдаа, унтахынхаа өмнө чих шингээж сонсоорой.' },
        { title: 'Монгол · Eng · 中文', desc: 'Гурван хэлний интерфейс ба AI хариулт — гадаадын найз, ач зээд бэлэглэхэд санаа зоволтгүй.' },
        { title: 'Төрөл бүрийн бэлэг', desc: 'Алтан хүрээтэй хайрцаг, мэндчилгээний карт, дугаарлагдсан серийн дугаар — уламжлалт баярт тохирсон бэлэг.' },
        { title: 'Цуглуулагчийн чанар', desc: '330 gsm алтан цаас, дулаан товойлгосон лого, UV лак — бат бөх, гоёмсог — хэрэглэж ч, үзүүлж ч урт насална.' },
      ],
    },
    pricing: {
      chip: 'Үнэ',
      title: 'Үнийн санал',
      lede: 'Өөртөө суралцах, хайртай хүндээ бэлэглэх, эсвэл цуглуулагчийн хайрцагт үлдээх — гурван түвшин.',
      pickBadge: 'Сонгомол',
      cta: 'Захиалах',
      tiers: [
        { name: 'Энгийн хувилбар', blurb: 'Анх танилцагчдад', features: ['52 хөзөр бүхий багц', 'QR код бүхий AI чат', 'Монгол хэлний дэмжлэг', 'Стандарт хайрцаг'] },
        { name: 'Premium хувилбар', blurb: 'Хамгийн их сонгодог', features: ['52 хөзөр + 4 тусгай хөзөр', 'QR код бүхий AI чат', '3 хэлний дэмжлэг', 'Дуут тайлбар', 'Premium хайрцаг'] },
        { name: 'Collector Edition', blurb: 'Цуглуулагчийн хайрцаг', features: ['56 хөзөр + 8 тусгай хөзөр', 'QR код бүхий AI чат', '3 хэлний дэмжлэг', 'Дуут тайлбар', 'Алтан хүрээтэй хайрцаг', 'Дугаарлагдсан хувилбар', 'Гарын үсэгтэй сертификат'] },
      ],
    },
    cta: {
      chip: 'Codex I · 2026',
      title: '52 түүхэн дүртэй уулзахад нэг QR л хүрнэ.',
      lede: 'Хөзрөө аваад, утсаараа уншуулаад, эртний түүхээ амьд сонс.',
      primary: 'Premium багц захиалах',
      secondary: 'Эхлээд апп үзэх',
    },
    footer: 'Алтан Домог · Codex I',
    cityline: 'Ulaanbaatar · ',
    heroMeta: ['52 ЗҮТГЭЛТЭН', '5 ЦАГ ҮЕ', '1206–1924', 'MN · EN · 中文'],
    quoteAttribLabel: 'Өдрийн үг',
    stats: {
      band: [
        { num: '52', label: 'Зүтгэлтэн' },
        { num: '5', label: 'Цаг үе' },
        { num: '8', label: 'Зууны түүх' },
        { num: '3', label: 'Хэл' },
      ],
    },
    featured: {
      chip: 'Онцолж буй',
      title: 'Цуглуулгын дөрвөн дүр',
      view: 'Бүх 52 дүрийг харах',
    },
  },
  en: {
    nav: {
      how: 'How it works',
      cards: 'Collection',
      features: 'Features',
      pricing: 'Pricing',
      scan: 'Scan card (AR)',
      app: 'Open app',
    },
    hero: {
      chip: '52 historical figures · Codex I',
      title1: 'The cards of the',
      title2: 'Great Mongol Empire',
      lede:
        'From Genghis Khan to Zanabazar — 52 historical figures, their lives and words, gathered into one gold-edged deck. Scan the QR and an AI guide speaks back, in their voice.',
      ctaPrimary: 'Order the deck',
      ctaSecondary: 'See the app',
      scanLabel: 'QR scanned',
      scanBody: "I am Genghis Khan. I was born in 1162…",
    },
    how: {
      chip: 'How it works',
      title: 'Meet a historical figure in 30 seconds',
      lede: 'Hold a card, scan its QR — and the figure on the front begins talking back.',
      step: 'Step',
      steps: [
        { title: 'Scan the QR', desc: 'Each card has a gold QR on its back. Open your phone camera — no app to install.' },
        { title: 'The figure awakens', desc: "An AI trained on each figure's history responds as if you'd just asked them yourself." },
        { title: 'Ask anything', desc: 'Birth year, conquests, family, sayings — pull on whichever thread you find interesting.' },
        { title: 'Listen in three languages', desc: 'Mongolian, English, Chinese — read the answer or hear it in a professional narrator’s voice.' },
      ],
    },
    cards: {
      chip: 'The collection',
      title: 'Khans · queens · generals · advisors',
      all: 'All 52 figures',
      roles: { khan: 'Great Khan', queen: 'Empress', general: 'General', advisor: 'Advisor' },
    },
    features: {
      chip: 'Features',
      title: 'Why Altan Domog?',
      lede: 'Not an ordinary deck — researched data, fine artwork, and AI knowledge bound together as a collector’s object.',
      list: [
        { title: '52 figures', desc: 'Khans, queens, generals, scholars — the great figures of Mongol history from 1162 to the 20th century, in one deck.' },
        { title: 'AI history guide', desc: 'Each card is backed by an AI primed on expert sources — battle tactics, family, sayings, all in one chat.' },
        { title: 'Audio biographies', desc: 'A 2–3 minute Mongolian narration per figure — for the commute, the bedside, or the long road.' },
        { title: 'Mongolian · English · 中文', desc: 'Three-language UI and AI replies — gift it to a friend abroad without translation worry.' },
        { title: 'Gift-ready', desc: 'Gold-edged box, greeting card, numbered serial — the kind of present that holds up at a holiday table.' },
        { title: "Collector's quality", desc: '330 gsm gold-stock paper, warm-embossed crest, UV lacquer — built to be played with, displayed, and kept.' },
      ],
    },
    pricing: {
      chip: 'Pricing',
      title: 'Choose your edition',
      lede: 'Learn for yourself, gift it forward, or keep it in a collector’s case — three tiers.',
      pickBadge: 'Most chosen',
      cta: 'Order',
      tiers: [
        { name: 'Standard', blurb: 'For first-timers', features: ['52-card deck', 'AI chat via QR', 'Mongolian language', 'Standard box'] },
        { name: 'Premium', blurb: 'Most chosen', features: ['52 cards + 4 special', 'AI chat via QR', 'Three languages', 'Audio biographies', 'Premium box'] },
        { name: 'Collector', blurb: "Collector's case", features: ['56 cards + 8 special', 'AI chat via QR', 'Three languages', 'Audio biographies', 'Gold-edged case', 'Numbered edition', 'Signed certificate'] },
      ],
    },
    cta: {
      chip: 'Codex I · 2026',
      title: 'One scan, fifty-two voices from history.',
      lede: 'Pick up a card, scan it with your phone, and listen to history speak.',
      primary: 'Order the Premium deck',
      secondary: 'See the app first',
    },
    footer: 'Altan Domog · Codex I',
    cityline: 'Ulaanbaatar · ',
    heroMeta: ['52 FIGURES', '5 EPOCHS', '1206–1924', 'MN · EN · 中文'],
    quoteAttribLabel: 'Quote of the day',
    stats: {
      band: [
        { num: '52', label: 'Figures' },
        { num: '5', label: 'Epochs' },
        { num: '8', label: 'Centuries' },
        { num: '3', label: 'Languages' },
      ],
    },
    featured: {
      chip: 'Featured',
      title: 'Four faces from the codex',
      view: 'See all 52 figures',
    },
  },
};

const PORTRAITS = {
  genghis: 'https://media.base44.com/images/public/69e6f6bdacc080e2495e1601/fd166574c_generated_5129f3ac.png',
  borte: 'https://media.base44.com/images/public/69e6f6bdacc080e2495e1601/0a8798933_generated_e066f3d0.png',
  subedei: 'https://media.base44.com/images/public/69e6f6bdacc080e2495e1601/3c56968eb_generated_c3091fa9.png',
  yelu: 'https://media.base44.com/images/public/69e6f6bdacc080e2495e1601/507c0c30a_generated_77486eba.png',
};

const SECTION_PADY = 72;

function useReveal(threshold = 0.15) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setVisible(true)),
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

function Reveal({ children, delay = 0, className = '' }) {
  const { ref, visible } = useReveal();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(16px)',
        transition: `opacity 700ms ease ${delay}ms, transform 700ms ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

function PrimaryButton({ to, href, children, ...rest }) {
  const Tag = to ? Link : 'a';
  const linkProps = to ? { to } : { href };
  return (
    <Tag
      {...linkProps}
      {...rest}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '12px 22px',
        borderRadius: 14,
        background: tokens.brand,
        color: tokens.bg,
        fontWeight: 700,
        fontSize: 15,
        letterSpacing: 0.1,
        textDecoration: 'none',
        transition: 'transform 180ms ease, box-shadow 180ms ease, background 180ms ease',
        boxShadow: '0 1px 0 rgba(255,255,255,0.12) inset, 0 8px 24px rgba(212,168,67,0.32)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = tokens.brandStrong;
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = tokens.brand;
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {children}
    </Tag>
  );
}

function Chip({ children, tone = 'neutral' }) {
  const palettes = {
    neutral: { bg: tokens.surfaceMuted, fg: tokens.inkSoft, bd: tokens.border },
    brand: { bg: tokens.brandSoft, fg: tokens.brandOnSoft, bd: tokens.borderStrong },
  };
  const p = palettes[tone] || palettes.neutral;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        borderRadius: 9999,
        background: p.bg,
        color: p.fg,
        border: `1px solid ${p.bd}`,
        fontSize: 12.5,
        fontWeight: 500,
        letterSpacing: 0.2,
      }}
    >
      {children}
    </span>
  );
}

function LangToggle() {
  const { lang, setLang } = useLang();
  const opt = (code, label) => {
    const active = lang === code;
    return (
      <button
        key={code}
        onClick={() => setLang(code)}
        style={{
          padding: '6px 12px',
          borderRadius: 9999,
          background: active ? tokens.brand : 'transparent',
          color: active ? tokens.bg : tokens.body,
          border: 'none',
          fontSize: 12.5,
          fontWeight: 700,
          letterSpacing: 0.4,
          cursor: 'pointer',
          transition: 'all 160ms ease',
        }}
      >
        {label}
      </button>
    );
  };
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: 3,
        borderRadius: 9999,
        background: tokens.surfaceMuted,
        border: `1px solid ${tokens.border}`,
      }}
    >
      {opt('mn', 'MN')}
      {opt('en', 'EN')}
    </div>
  );
}

function NavBar({ c }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const links = [
    { label: c.nav.how, href: '#how' },
    { label: c.nav.cards, href: '#cards' },
    { label: c.nav.features, href: '#features' },
    { label: c.nav.pricing, href: '#pricing' },
  ];

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: scrolled ? 'rgba(10,12,20,0.85)' : 'rgba(10,12,20,0.0)',
        backdropFilter: scrolled ? 'saturate(180%) blur(12px)' : 'none',
        WebkitBackdropFilter: scrolled ? 'saturate(180%) blur(12px)' : 'none',
        borderBottom: scrolled ? `1px solid ${tokens.border}` : '1px solid transparent',
        transition: 'all 200ms ease',
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '14px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <Link to="/v2" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 6,
              borderRadius: 9999,
              background: 'rgba(10,12,20,0.78)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              border: '1px solid rgba(212,168,67,0.35)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
            }}
          >
            <img
              src="/logo.png"
              alt="Altan Domog"
              style={{ height: 56, width: 'auto', display: 'block' }}
            />
          </span>
          <span style={{ color: tokens.ink, fontWeight: 700, fontSize: 19, letterSpacing: 0.2 }}>
            Altan Domog
          </span>
        </Link>

        <nav style={{ display: 'flex', alignItems: 'center', gap: 28 }} className="hidden-on-mobile">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              style={{
                color: tokens.body,
                fontSize: 14.5,
                fontWeight: 500,
                textDecoration: 'none',
                transition: 'color 160ms ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = tokens.ink)}
              onMouseLeave={(e) => (e.currentTarget.style.color = tokens.body)}
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <LangToggle />
          <Link
            to="/ar"
            className="hidden-on-mobile"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '11px 18px',
              borderRadius: 14,
              background: 'transparent',
              color: tokens.ink,
              fontWeight: 600,
              fontSize: 14,
              letterSpacing: 0.1,
              textDecoration: 'none',
              border: `1px solid ${tokens.borderStrong}`,
              transition: 'background 180ms ease, border-color 180ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = tokens.brandSoft;
              e.currentTarget.style.borderColor = tokens.brand;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.borderColor = tokens.borderStrong;
            }}
          >
            <ScanLine size={15} />
            {c.nav.scan}
          </Link>
          <PrimaryButton to="/app">
            {c.nav.app}
            <ArrowRight size={16} />
          </PrimaryButton>
        </div>
      </div>
    </header>
  );
}

function Hero({ c }) {
  const featured = useFeaturedToday();
  const quoteOfDay = useQuoteToday();
  return (
    <section
      style={{
        position: 'relative',
        padding: 0,
        overflow: 'hidden',
        minHeight: 'clamp(560px, 82vh, 760px)',
        background:
          'radial-gradient(ellipse at 75% 35%, #6a4828 0%, #2a1810 45%, #0a0606 100%)',
      }}
      className="hero-natgeo"
    >
      <div
        className="hero-natgeo-photo"
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
        }}
      >
        {featured ? (
          <SepiaPortrait
            figure={featured}
            scene={featured.scene}
            aspectRatio="auto"
            size="100%"
            fit="cover"
            position="50% 22%"
            tilt
            priority
          />
        ) : null}
      </div>
      <div
        aria-hidden="true"
        className="hero-natgeo-readability"
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 2,
          background:
            'linear-gradient(90deg, rgba(10,6,6,0.85) 0%, rgba(20,12,8,0.55) 35%, rgba(20,12,8,0.15) 60%, rgba(20,12,8,0) 100%), linear-gradient(0deg, rgba(10,6,6,0.55) 0%, rgba(10,6,6,0) 50%)',
          pointerEvents: 'none',
        }}
      />
      <div
        className="hero-natgeo-grid"
        style={{
          position: 'relative',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
          minHeight: 'inherit',
          zIndex: 3,
        }}
      >
        <div
          className="hero-natgeo-text"
          style={{
            position: 'relative',
            gridColumn: '1 / 2',
            gridRow: '1 / 2',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            padding: 'clamp(28px, 4vw, 56px) clamp(24px, 4vw, 56px) clamp(36px, 6vw, 72px)',
            maxWidth: 720,
            zIndex: 3,
          }}
        >
          <div
            style={{
              fontFamily: FONT_SANS,
              fontSize: 11,
              letterSpacing: 3,
              color: tokens.accent,
              fontWeight: 700,
              textTransform: 'uppercase',
            }}
          >
            The Mongol Empire · 1206–1368
          </div>
          <h1
            style={{
              marginTop: 14,
              fontFamily: tokens.serif,
              fontSize: 'clamp(2.4rem, 5.4vw, 4.4rem)',
              fontWeight: 600,
              lineHeight: 0.95,
              letterSpacing: -0.3,
              color: '#fff',
            }}
          >
            {c.hero.title1}
            <br />
            <em
              style={{
                fontStyle: 'italic',
                fontWeight: 500,
                color: tokens.accent,
              }}
            >
              {c.hero.title2}
            </em>
          </h1>
          <p
            style={{
              marginTop: 18,
              fontFamily: FONT_SANS,
              fontSize: 16,
              lineHeight: 1.55,
              color: 'rgba(255,255,255,0.78)',
              maxWidth: 540,
            }}
          >
            {c.hero.lede}
          </p>
          <div style={{ marginTop: 24, display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <Link
              to="/order?tier=premium"
              style={{
                background: tokens.accent,
                color: tokens.bg,
                padding: '12px 22px',
                fontFamily: FONT_SANS,
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: 1.5,
                textTransform: 'uppercase',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              {c.hero.ctaPrimary} <ArrowRight size={16} />
            </Link>
            <Link
              to="/app"
              style={{
                color: '#fff',
                fontFamily: FONT_SANS,
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: 1,
                textTransform: 'uppercase',
                textDecoration: 'none',
                paddingBottom: 4,
                borderBottom: '1px solid rgba(255,255,255,0.5)',
              }}
            >
              {c.hero.ctaSecondary}
            </Link>
          </div>
        </div>
      </div>
      <div
        data-hero="meta-strip"
        className="hidden-on-mobile"
        style={{
          position: 'absolute',
          left: 'clamp(24px, 4vw, 56px)',
          top: 'clamp(24px, 3vw, 36px)',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          zIndex: 4,
        }}
      >
        <div style={{ width: 36, height: 3, background: tokens.accent, flexShrink: 0 }} />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            fontFamily: FONT_SANS,
            fontSize: 10.5,
            letterSpacing: 2.5,
            color: 'rgba(255,255,255,0.78)',
            fontWeight: 600,
            textTransform: 'uppercase',
          }}
        >
          {c.heroMeta.map((item, i) => (
            <span key={item} style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
              {i > 0 ? <span style={{ opacity: 0.35 }}>·</span> : null}
              {item}
            </span>
          ))}
        </div>
      </div>
      {quoteOfDay ? (
        <div
          data-hero="quote-of-day"
          style={{
            position: 'absolute',
            right: 'clamp(24px, 4vw, 56px)',
            top: 'clamp(76px, 9vh, 116px)',
            maxWidth: 'min(440px, 38vw)',
            fontFamily: tokens.serif,
            fontStyle: 'italic',
            fontWeight: 500,
            fontSize: 'clamp(1.15rem, 1.7vw, 1.6rem)',
            lineHeight: 1.32,
            color: 'rgba(255,255,255,0.94)',
            textAlign: 'right',
            zIndex: 4,
            textShadow: '0 2px 18px rgba(0,0,0,0.55)',
            pointerEvents: 'none',
          }}
          className="hidden-on-mobile"
        >
          <span style={{ color: tokens.accent, marginRight: 4 }}>“</span>
          {quoteOfDay.quote}
          <span style={{ color: tokens.accent, marginLeft: 4 }}>”</span>
          <div
            style={{
              marginTop: 10,
              fontFamily: FONT_SANS,
              fontStyle: 'normal',
              fontSize: 10,
              letterSpacing: 2.2,
              color: tokens.accent,
              textTransform: 'uppercase',
              fontWeight: 700,
            }}
          >
            — {quoteOfDay.attr}
            {quoteOfDay.yrs ? <span style={{ opacity: 0.7 }}> · {quoteOfDay.yrs}</span> : null}
          </div>
        </div>
      ) : null}
      <div
        className="hidden-on-mobile"
        style={{
          position: 'absolute',
          right: 'clamp(24px, 4vw, 56px)',
          top: 'clamp(24px, 3vw, 36px)',
          fontFamily: FONT_SANS,
          fontSize: 10,
          letterSpacing: 3,
          color: 'rgba(255,255,255,0.85)',
          fontWeight: 600,
          textTransform: 'uppercase',
          zIndex: 4,
        }}
      >
        {c.hero.chip}
      </div>
      {featured ? (
        <div
          data-hero="pictured-caption"
          className="hidden-on-mobile"
          style={{
            position: 'absolute',
            right: 'clamp(24px, 4vw, 56px)',
            bottom: 'clamp(24px, 3vw, 36px)',
            fontFamily: FONT_SANS,
            fontSize: 10,
            letterSpacing: 2,
            color: 'rgba(255,255,255,0.55)',
            textTransform: 'uppercase',
            textAlign: 'right',
            lineHeight: 1.6,
            fontStyle: 'italic',
            zIndex: 4,
          }}
        >
          {featured.scene ? (
            <>
              <span style={{ color: tokens.accent }}>Pictured:</span> {featured.scene.title?.en ?? 'Historical scene'}
              <br />
              <span style={{ opacity: 0.75 }}>{featured.scene.credit}</span>
              <br />
              <span style={{ opacity: 0.85 }}>Featuring {featured.name}, {featured.yrs || '—'}</span>
            </>
          ) : (
            <>
              <span style={{ color: tokens.accent }}>Pictured:</span> {featured.name}, {featured.yrs || '—'}
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}

function StatsBand({ c }) {
  return (
    <section
      data-section="stats-band"
      style={{
        borderTop: `1px solid ${tokens.border}`,
        borderBottom: `1px solid ${tokens.border}`,
        background: 'linear-gradient(180deg, rgba(20,12,8,0.4), rgba(10,6,6,0.6))',
        padding: 'clamp(48px, 7vw, 80px) clamp(24px, 4vw, 56px)',
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 'clamp(20px, 4vw, 56px)',
        }}
        className="stats-band-grid"
      >
        {c.stats.band.map((s, i) => (
          <div
            key={s.label}
            style={{
              borderLeft: i > 0 ? `1px solid ${tokens.border}` : 'none',
              paddingLeft: i > 0 ? 'clamp(16px, 2.5vw, 36px)' : 0,
            }}
          >
            <div
              style={{
                fontFamily: tokens.serif,
                fontWeight: 600,
                fontSize: 'clamp(2.4rem, 5vw, 4rem)',
                lineHeight: 1,
                letterSpacing: -1,
                color: tokens.accent,
                fontStyle: 'italic',
              }}
            >
              {s.num}
            </div>
            <div
              style={{
                marginTop: 12,
                fontFamily: FONT_SANS,
                fontSize: 11,
                letterSpacing: 2.5,
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.66)',
                fontWeight: 600,
              }}
            >
              {s.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function FeaturedFiguresStrip({ c }) {
  const allFigures = useFiguresWithDb();
  const portrayed = allFigures.filter((f) => f.front_img || f.portrait_url);
  return (
    <section
      data-section="featured-figures"
      style={{
        padding: 'clamp(56px, 8vw, 96px) clamp(24px, 4vw, 56px)',
        background: tokens.bg,
      }}
    >
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 24,
            marginBottom: 'clamp(28px, 4vw, 44px)',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div
              style={{
                fontFamily: FONT_SANS,
                fontSize: 11,
                letterSpacing: 3,
                color: tokens.accent,
                fontWeight: 700,
                textTransform: 'uppercase',
              }}
            >
              {c.featured.chip}
            </div>
            <h2
              style={{
                marginTop: 10,
                fontFamily: tokens.serif,
                fontWeight: 600,
                fontSize: 'clamp(1.8rem, 3.4vw, 2.6rem)',
                lineHeight: 1.05,
                letterSpacing: -0.3,
                color: tokens.ink,
              }}
            >
              {c.featured.title}
            </h2>
          </div>
          <Link
            to="/figures"
            style={{
              color: tokens.accent,
              fontFamily: FONT_SANS,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 1.4,
              textTransform: 'uppercase',
              textDecoration: 'none',
              paddingBottom: 6,
              borderBottom: `1px solid ${tokens.accent}`,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {c.featured.view} <ArrowRight size={14} />
          </Link>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 'clamp(16px, 2.5vw, 28px)',
          }}
        >
          {portrayed.map((f) => (
            <Link
              key={f.fig_id}
              to={`/figures/${f.fig_id}`}
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <div
                style={{
                  position: 'relative',
                  aspectRatio: '3/4',
                  overflow: 'hidden',
                  borderRadius: 8,
                  border: `1px solid ${tokens.border}`,
                  background: tokens.surface,
                  transition: 'transform 220ms ease, border-color 220ms ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.borderColor = tokens.accent;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = tokens.border;
                }}
              >
                <img
                  src={f.front_img || f.portrait_url}
                  alt={f.name}
                  loading="lazy"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    objectPosition: '50% 22%',
                    filter: f.front_img
                      ? 'none'
                      : 'sepia(0.18) contrast(1.18) saturate(1.05)',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background:
                      'linear-gradient(0deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 50%)',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: 16,
                    right: 16,
                    bottom: 14,
                  }}
                >
                  <div
                    style={{
                      fontFamily: tokens.serif,
                      fontWeight: 600,
                      fontSize: 18,
                      lineHeight: 1.18,
                      color: '#fff',
                    }}
                  >
                    {f.name}
                  </div>
                  <div
                    style={{
                      fontFamily: FONT_SANS,
                      fontSize: 10.5,
                      letterSpacing: 1.8,
                      textTransform: 'uppercase',
                      color: tokens.accent,
                      marginTop: 6,
                      fontWeight: 700,
                    }}
                  >
                    {f.yrs}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

const HOW_ICONS = [QrCode, MessageCircle, HelpCircle, Volume2];

function HowItWorks({ c }) {
  return (
    <section
      id="how"
      style={{ padding: `${SECTION_PADY}px 24px`, background: tokens.surface, borderTop: `1px solid ${tokens.border}` }}
    >
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <Reveal>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <Chip>{c.how.chip}</Chip>
            <h2
              style={{
                marginTop: 14,
                fontSize: 'clamp(2rem, 4vw, 2.75rem)',
                color: tokens.ink,
                fontWeight: 800,
                letterSpacing: -0.4,
                lineHeight: 1.1,
              }}
            >
              {c.how.title}
            </h2>
            <p
              style={{
                marginTop: 14,
                maxWidth: 620,
                margin: '14px auto 0',
                color: tokens.body,
                fontSize: 17,
                lineHeight: 1.6,
              }}
            >
              {c.how.lede}
            </p>
          </div>
        </Reveal>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 20,
          }}
        >
          {c.how.steps.map((s, i) => {
            const Icon = HOW_ICONS[i] || QrCode;
            return (
              <Reveal key={s.title} delay={i * 80}>
                <div
                  style={{
                    background: tokens.bg,
                    border: `1px solid ${tokens.border}`,
                    borderRadius: 22,
                    padding: 24,
                    height: '100%',
                    transition: 'transform 200ms ease, box-shadow 200ms ease, border-color 200ms ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 18px 40px -22px rgba(15,23,42,0.15)';
                    e.currentTarget.style.borderColor = tokens.borderStrong;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.borderColor = tokens.border;
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      background: tokens.brandSoft,
                      color: tokens.brand,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 18,
                    }}
                  >
                    <Icon size={20} />
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      letterSpacing: 1.4,
                      color: tokens.hint,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                    }}
                  >
                    {c.how.step} {i + 1}
                  </div>
                  <h3
                    style={{
                      marginTop: 6,
                      fontSize: 19,
                      fontWeight: 700,
                      color: tokens.ink,
                    }}
                  >
                    {s.title}
                  </h3>
                  <p
                    style={{
                      marginTop: 10,
                      fontSize: 14.5,
                      lineHeight: 1.55,
                      color: tokens.body,
                    }}
                  >
                    {s.desc}
                  </p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function CardCollectionV2({ c }) {
  const collection = [
    { name: 'Чингис Хаан', years: '1162–1227', role: c.cards.roles.khan, rank: 'K', suit: '♠', img: PORTRAITS.genghis },
    { name: 'Бөртэ Үжин', years: '1161–1230', role: c.cards.roles.queen, rank: 'Q', suit: '♥', img: PORTRAITS.borte },
    { name: 'Сүбээдэй Баатар', years: '1175–1248', role: c.cards.roles.general, rank: 'J', suit: '♦', img: PORTRAITS.subedei },
    { name: 'Елүй Чуцай', years: '1190–1244', role: c.cards.roles.advisor, rank: 'A', suit: '♣', img: PORTRAITS.yelu },
  ];
  return (
    <section id="cards" style={{ padding: `${SECTION_PADY}px 24px`, background: tokens.bg }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <Reveal>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              gap: 24,
              marginBottom: 32,
              flexWrap: 'wrap',
            }}
          >
            <div>
              <Chip>{c.cards.chip}</Chip>
              <h2
                style={{
                  marginTop: 14,
                  fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)',
                  color: tokens.ink,
                  fontWeight: 800,
                  letterSpacing: -0.4,
                }}
              >
                {c.cards.title}
              </h2>
            </div>
            <Link
              to="/figures"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                color: tokens.ink,
                fontWeight: 600,
                fontSize: 14.5,
                textDecoration: 'none',
                borderBottom: `1px solid ${tokens.borderStrong}`,
                paddingBottom: 4,
              }}
            >
              {c.cards.all} <ArrowRight size={14} />
            </Link>
          </div>
        </Reveal>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 20,
          }}
        >
          {collection.map((card, i) => (
            <Reveal key={card.name} delay={i * 60}>
              <div
                style={{
                  background: tokens.surface,
                  border: `1px solid ${tokens.border}`,
                  borderRadius: 24,
                  overflow: 'hidden',
                  transition: 'transform 200ms ease, box-shadow 200ms ease',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-3px)';
                  e.currentTarget.style.boxShadow = '0 24px 48px -28px rgba(15,23,42,0.22)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div
                  style={{
                    aspectRatio: '4/5',
                    position: 'relative',
                    overflow: 'hidden',
                    background: '#1F1B14',
                  }}
                >
                  <img
                    src={card.img}
                    alt={card.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    loading="lazy"
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: 14,
                      left: 16,
                      color: tokens.brand,
                      fontWeight: 800,
                      fontSize: 22,
                      lineHeight: 1,
                      textShadow: '0 1px 2px rgba(0,0,0,0.6)',
                    }}
                  >
                    {card.rank}
                    <div
                      style={{
                        fontSize: 16,
                        color: card.suit === '♥' || card.suit === '♦' ? tokens.bronze : tokens.brand,
                        marginTop: 2,
                      }}
                    >
                      {card.suit}
                    </div>
                  </div>
                  <div
                    style={{
                      position: 'absolute',
                      left: 16,
                      right: 16,
                      bottom: 14,
                      color: '#fff',
                      background: 'linear-gradient(to top, rgba(0,0,0,0.6), rgba(0,0,0,0))',
                      paddingTop: 30,
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 17.5, lineHeight: 1.15 }}>
                      {card.name}
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12.5, marginTop: 4 }}>
                      {card.role} · {card.years}
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

const FEATURE_ICONS = [BookOpen, Bot, Headphones, Globe, Gift, Award];

// Stitch-style bento: hero (2x2) + 4 small (1x1) + 1 wide (4x1)
const BENTO_LAYOUT = [
  { variant: 'hero', area: '1 / 1 / 3 / 3' },
  { variant: 'small', area: '1 / 3 / 2 / 4' },
  { variant: 'small', area: '1 / 4 / 2 / 5' },
  { variant: 'small', area: '2 / 3 / 3 / 4' },
  { variant: 'small', area: '2 / 4 / 3 / 5' },
  { variant: 'wide', area: '3 / 1 / 4 / 5' },
];

function Features({ c }) {
  return (
    <section
      id="features"
      style={{ padding: `${SECTION_PADY}px 24px`, background: tokens.surface, borderTop: `1px solid ${tokens.border}` }}
    >
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <Reveal>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <Chip>{c.features.chip}</Chip>
            <h2
              style={{
                marginTop: 14,
                fontSize: 'clamp(2rem, 4vw, 2.75rem)',
                color: tokens.ink,
                fontWeight: 800,
                letterSpacing: -0.4,
                lineHeight: 1.1,
              }}
            >
              {c.features.title}
            </h2>
            <p
              style={{
                marginTop: 14,
                maxWidth: 640,
                margin: '14px auto 0',
                color: tokens.body,
                fontSize: 17,
                lineHeight: 1.6,
              }}
            >
              {c.features.lede}
            </p>
          </div>
        </Reveal>

        <div
          className="bento-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            gridAutoRows: 'minmax(180px, auto)',
            gap: 16,
          }}
        >
          {c.features.list.map((f, i) => {
            const Icon = FEATURE_ICONS[i] || BookOpen;
            const layout = BENTO_LAYOUT[i] || { variant: 'small' };
            const isHero = layout.variant === 'hero';
            const isWide = layout.variant === 'wide';
            return (
              <Reveal key={f.title} delay={i * 60} className={`bento-tile bento-${layout.variant}`}>
                <div
                  style={{
                    background: isHero ? tokens.brandSoft : tokens.surfaceMuted,
                    border: `1px solid ${tokens.border}`,
                    borderRadius: 16,
                    padding: isHero ? 32 : 24,
                    height: '100%',
                    display: 'flex',
                    flexDirection: isWide ? 'row' : 'column',
                    alignItems: isWide ? 'center' : 'stretch',
                    gap: isWide ? 24 : 0,
                  }}
                >
                  <div
                    style={{
                      width: isHero ? 56 : 44,
                      height: isHero ? 56 : 44,
                      borderRadius: 12,
                      background: isHero ? tokens.brand : tokens.surface,
                      border: isHero ? 'none' : `1px solid ${tokens.border}`,
                      color: isHero ? tokens.bg : tokens.brand,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: isWide ? 0 : 18,
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={isHero ? 26 : 20} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3
                      style={{
                        fontSize: isHero ? 28 : 19,
                        fontWeight: 600,
                        color: tokens.ink,
                        letterSpacing: -0.2,
                        lineHeight: 1.15,
                      }}
                    >
                      {f.title}
                    </h3>
                    <p
                      style={{
                        marginTop: isHero ? 14 : 10,
                        fontSize: isHero ? 15.5 : 14.5,
                        lineHeight: 1.55,
                        color: tokens.body,
                      }}
                    >
                      {f.desc}
                    </p>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Pricing({ c }) {
  const tiers = c.pricing.tiers.map((t, i) => ({
    ...t,
    key: ['basic', 'premium', 'collector'][i],
    price: ['29,900₮', '49,900₮', '99,000₮'][i],
    highlighted: i === 1,
  }));
  return (
    <section id="pricing" style={{ padding: `${SECTION_PADY}px 24px`, background: tokens.bg }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <Reveal>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <Chip>{c.pricing.chip}</Chip>
            <h2
              style={{
                marginTop: 14,
                fontSize: 'clamp(2rem, 4vw, 2.75rem)',
                color: tokens.ink,
                fontWeight: 800,
                letterSpacing: -0.4,
              }}
            >
              {c.pricing.title}
            </h2>
            <p
              style={{
                marginTop: 14,
                maxWidth: 620,
                margin: '14px auto 0',
                color: tokens.body,
                fontSize: 17,
                lineHeight: 1.6,
              }}
            >
              {c.pricing.lede}
            </p>
          </div>
        </Reveal>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 18,
            alignItems: 'stretch',
          }}
        >
          {tiers.map((t, i) => (
            <Reveal key={t.key} delay={i * 80}>
              <div
                style={{
                  position: 'relative',
                  background: t.highlighted ? tokens.brandSoft : tokens.surface,
                  color: tokens.ink,
                  border: t.highlighted
                    ? `2px solid ${tokens.brand}`
                    : `1px solid ${tokens.border}`,
                  borderRadius: 28,
                  padding: 28,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: 'none',
                }}
              >
                {t.highlighted && (
                  <span
                    style={{
                      position: 'absolute',
                      top: -12,
                      left: 24,
                      padding: '4px 12px',
                      borderRadius: 9999,
                      background: tokens.brand,
                      color: tokens.bg,
                      fontSize: 11.5,
                      fontWeight: 700,
                      letterSpacing: 0.6,
                      textTransform: 'uppercase',
                    }}
                  >
                    {c.pricing.pickBadge}
                  </span>
                )}
                <div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      letterSpacing: 1.4,
                      textTransform: 'uppercase',
                      color: t.highlighted ? tokens.brandOnSoft : tokens.hint,
                    }}
                  >
                    {t.blurb}
                  </div>
                  <h3
                    style={{
                      marginTop: 6,
                      fontSize: 22,
                      fontWeight: 600,
                      color: tokens.ink,
                    }}
                  >
                    {t.name}
                  </h3>
                  <div
                    style={{
                      marginTop: 12,
                      fontSize: 38,
                      fontWeight: 700,
                      letterSpacing: -0.6,
                      color: t.highlighted ? tokens.brandStrong : tokens.ink,
                    }}
                  >
                    {t.price}
                  </div>
                </div>
                <ul style={{ marginTop: 22, padding: 0, listStyle: 'none', flex: 1 }}>
                  {t.features.map((f) => (
                    <li
                      key={f}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 10,
                        marginBottom: 12,
                        fontSize: 14.5,
                        color: tokens.body,
                      }}
                    >
                      <Check
                        size={16}
                        style={{
                          marginTop: 3,
                          color: tokens.brand,
                          flexShrink: 0,
                        }}
                      />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  to={`/order?tier=${t.key}`}
                  style={{
                    marginTop: 24,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    width: '100%',
                    padding: '13px 18px',
                    borderRadius: 16,
                    background: t.highlighted ? tokens.brand : 'transparent',
                    color: t.highlighted ? tokens.bg : tokens.brand,
                    fontWeight: 700,
                    fontSize: 15,
                    textDecoration: 'none',
                    border: t.highlighted ? 'none' : `1px solid ${tokens.borderStrong}`,
                    transition: 'transform 180ms ease, background 180ms ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-1px)')}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                >
                  {c.pricing.cta} <ArrowRight size={16} />
                </Link>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTABand({ c }) {
  return (
    <section
      style={{ padding: `${SECTION_PADY - 16}px 24px`, background: tokens.surface, borderTop: `1px solid ${tokens.border}` }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          background: tokens.surfaceMuted,
          borderRadius: 28,
          padding: 'clamp(28px, 5vw, 56px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 24,
          flexWrap: 'wrap',
          color: tokens.ink,
        }}
      >
        <div style={{ maxWidth: 580 }}>
          <Chip tone="brand">
            <Sparkles size={14} /> {c.cta.chip}
          </Chip>
          <h3
            style={{
              marginTop: 14,
              fontSize: 'clamp(1.6rem, 3vw, 2.2rem)',
              fontWeight: 600,
              letterSpacing: -0.4,
              lineHeight: 1.15,
              color: tokens.ink,
            }}
          >
            {c.cta.title}
          </h3>
          <p style={{ marginTop: 12, color: tokens.body, fontSize: 16, lineHeight: 1.55 }}>
            {c.cta.lede}
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 220 }}>
          <Link
            to="/order?tier=premium"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '13px 20px',
              borderRadius: 16,
              background: tokens.brand,
              color: tokens.bg,
              fontWeight: 700,
              fontSize: 15,
              textDecoration: 'none',
            }}
          >
            {c.cta.primary} <ArrowRight size={16} />
          </Link>
          <Link
            to="/app"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '12px 20px',
              borderRadius: 16,
              background: 'transparent',
              color: tokens.ink,
              fontWeight: 600,
              fontSize: 14.5,
              textDecoration: 'none',
              border: `1px solid ${tokens.borderStrong}`,
            }}
          >
            {c.cta.secondary}
          </Link>
        </div>
      </div>
    </section>
  );
}

function Footer({ c }) {
  return (
    <footer
      style={{ padding: '36px 24px 48px', background: tokens.bg, borderTop: `1px solid ${tokens.border}` }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              width: 28,
              height: 28,
              borderRadius: 9,
              background: tokens.brand,
              color: tokens.bg,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: 12,
              letterSpacing: 0.4,
            }}
          >
            АД
          </span>
          <span style={{ color: tokens.ink, fontWeight: 600, fontSize: 14.5 }}>{c.footer}</span>
        </div>
        <div style={{ color: tokens.hint, fontSize: 13, letterSpacing: 0.4 }}>
          © MMXXVI · {c.cityline}
        </div>
      </div>
    </footer>
  );
}

export default function LandingV2() {
  const { lang } = useLang();
  const c = COPY[lang] || COPY.mn;
  return (
    <div
      style={{
        minHeight: '100vh',
        background: tokens.bg,
        color: tokens.ink,
        fontFamily: FONT_SANS,
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
      }}
    >
      <NavBar c={c} />
      <Hero c={c} />
      <StatsBand c={c} />
      <FeaturedFiguresStrip c={c} />
      <HowItWorks c={c} />
      <CardCollectionV2 c={c} />
      <Features c={c} />
      <Pricing c={c} />
      <CTABand c={c} />
      <Footer c={c} />
      <style>{`
        .bento-grid > .bento-hero { grid-column: 1 / 3; grid-row: 1 / 3; }
        .bento-grid > .bento-wide { grid-column: 1 / 5; }
        @media (max-width: 880px) {
          .hero-grid { grid-template-columns: 1fr !important; gap: 32px !important; }
          .hero-natgeo-grid {
            grid-template-columns: 1fr !important;
          }
          .hero-natgeo-text {
            grid-column: 1 / -1 !important;
            grid-row: 1 / 2 !important;
            max-width: 100% !important;
            justify-content: flex-end !important;
          }
          .hero-natgeo-readability {
            background:
              linear-gradient(0deg, rgba(10,6,6,0.92) 0%, rgba(10,6,6,0.55) 45%, rgba(10,6,6,0.1) 100%) !important;
          }
          .hidden-on-mobile { display: none !important; }
          .bento-grid { grid-template-columns: 1fr !important; }
          .bento-grid > .bento-hero,
          .bento-grid > .bento-wide,
          .bento-grid > .bento-small { grid-column: auto !important; grid-row: auto !important; }
          .stats-band-grid { grid-template-columns: repeat(2, 1fr) !important; row-gap: 32px !important; }
          .stats-band-grid > div:nth-child(3) { border-left: none !important; padding-left: 0 !important; }
        }
      `}</style>
    </div>
  );
}
