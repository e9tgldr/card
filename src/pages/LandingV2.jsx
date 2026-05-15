import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
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
import JsonLd, { siteUrl } from '@/components/JsonLd';

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
      chip: '52 түүхэн зүтгэлтэн · Collection I',
      title1: 'Их Монгол Улсын',
      title2: 'түүхийн хөзөр',
      lede:
        'Чингис Хаанаас Занабазар хүртэл — 52 түүхэн дүрийн намтар, ишлэл, гавьяа нэг алтан хөзрийн багцад. Утсаараа AR-аар картаа таниулмагц AI хөтөч амьсгалтай ярьж өгнө.',
      ctaPrimary: 'Хөзрийн багц захиалах',
      ctaSecondary: 'Апп үзэх',
      scanLabel: 'AR таньсан',
      scanBody: 'Би бол Чингис Хаан. Намайг 1162 онд төрсөн…',
    },
    scroll3d: {
      ariaLabel: 'Алтан Домогийн 3D аялал',
      progress: 'Аяллын явц',
      targetTitle: 'AR карт танилт',
      targetBody: 'Камераа картын нүүр рүү чиглүүлэхэд систем аль дүрийн карт болохыг танина.',
      arHud: 'AR танилт ажиллаж байна',
      sceneFrame: 'Кино мэт 3D цагийн хонгил ба AR танилт',
      chapters: [
        {
          label: 'I',
          title: 'Цагийн хонгилоор хөвөх хөзөр',
          body: 'Алтан багцын дүрүүд нээлттэй 3D орон зайд давхарлан нисэж, зуунаар үргэлжлэх аяллын эхний хаалгыг нээнэ.',
        },
        {
          label: 'II',
          title: 'AR түгжээ карт дээр бууна',
          body: 'Нэг хөзөр камерын төвд орж ирэхэд танилтын хүрээ гэрэлтэн, тухайн дүрийг яг аль карт болохыг түгжинэ.',
        },
        {
          label: 'III',
          title: 'Зуунаар дамжих зам',
          body: '1162 оноос XX зуун хүртэлх үеүүд цагираг, тэмдэг, гэрлийн замаар урагшилж, дүр бүр өөрийн эринд байрлана.',
        },
        {
          label: 'IV',
          title: '52 дуу хоолой',
          body: 'Төгсгөлд нь бүх хөзөр оддын тойрог шиг нэгдэж, багц, апп, аудио, AI хөтөч нэг цуглуулга болж харагдана.',
        },
      ],
    },
    how: {
      chip: 'Хэрхэн ажилладаг вэ?',
      title: '30 секундэд түүхэн дүртэй ярилцана',
      lede: 'Хөзрөө гартаа барь, утсаараа AR-аар таниул — тэр чигтээ алдартай дүр амьсгалтай ярина.',
      visualLabel: 'AR card recognition',
      step: 'Алхам',
      steps: [
        {
          title: 'AR-аар картаа таниулах',
          desc: 'Картын нүүрийг утасны камерын голд барина — AR систем тухайн картын дүрийг шууд танина.',
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
        { name: 'Энгийн хувилбар', blurb: 'Анх танилцагчдад', features: ['52 хөзөр бүхий багц', 'AR танилттай AI чат', 'Монгол хэлний дэмжлэг', 'Стандарт хайрцаг'] },
        { name: 'Premium хувилбар', blurb: 'Хамгийн их сонгодог', features: ['52 хөзөр + 4 тусгай хөзөр', 'AR танилттай AI чат', '3 хэлний дэмжлэг', 'Дуут тайлбар', 'Premium хайрцаг'] },
        { name: 'Collector Edition', blurb: 'Цуглуулагчийн хайрцаг', features: ['56 хөзөр + 8 тусгай хөзөр', 'AR танилттай AI чат', '3 хэлний дэмжлэг', 'Дуут тайлбар', 'Алтан хүрээтэй хайрцаг', 'Дугаарлагдсан хувилбар', 'Гарын үсэгтэй сертификат'] },
      ],
    },
    cta: {
      chip: 'Collection I · 2026',
      title: '52 түүхэн дүртэй уулзахад нэг AR танилт л хүрнэ.',
      lede: 'Хөзрөө аваад, утсаараа таниулаад, эртний түүхээ амьд сонс.',
      primary: 'Premium багц захиалах',
      secondary: 'Эхлээд апп үзэх',
    },
    footer: 'Алтан Домог · Collection I',
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
  },
  en: {
    nav: {
      how: 'How it works',
      cards: 'Collection',
      features: 'Features',
      pricing: 'Pricing',
      scan: 'Recognize card (AR)',
      app: 'Open app',
    },
    hero: {
      chip: '52 historical figures · Collection I',
      title1: 'The cards of the',
      title2: 'Great Mongol Empire',
      lede:
        'From Genghis Khan to Zanabazar — 52 historical figures, their lives and words, gathered into one gold-edged deck. Point your phone at a card and AR recognition opens its AI guide.',
      ctaPrimary: 'Order the deck',
      ctaSecondary: 'See the app',
      scanLabel: 'AR recognized',
      scanBody: "I am Genghis Khan. I was born in 1162…",
    },
    scroll3d: {
      ariaLabel: 'Altan Domog 3D journey',
      progress: 'Journey progress',
      targetTitle: 'AR card recognition',
      targetBody: 'Point the camera at the card face so the system identifies which figure it belongs to.',
      arHud: 'AR recognition active',
      sceneFrame: 'Cinematic 3D timeline and AR recognition',
      chapters: [
        {
          label: 'I',
          title: 'Cards through the timeline',
          body: 'The gold deck opens in a wide 3D space, sending historical figures forward through a cinematic tunnel of centuries.',
        },
        {
          label: 'II',
          title: 'The AR lock finds one card',
          body: 'One card enters the recognition frame, the scanner locks onto its face, and the system identifies the exact historical figure.',
        },
        {
          label: 'III',
          title: 'Centuries in motion',
          body: 'From 1162 into the twentieth century, epochs move forward as rings, markers, and light paths around the figures.',
        },
        {
          label: 'IV',
          title: 'Fifty-two voices',
          body: 'The full deck resolves into a constellation of 52 cards: collection, app, audio, and AI guide in one experience.',
        },
      ],
    },
    how: {
      chip: 'How it works',
      title: 'Meet a historical figure in 30 seconds',
      lede: 'Hold a card, let AR recognize it, and the figure on the front begins talking back.',
      visualLabel: 'AR card recognition',
      step: 'Step',
      steps: [
        { title: 'Recognize the card in AR', desc: 'Hold the illustrated face inside the camera frame so AR can identify the exact card.' },
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
        { name: 'Standard', blurb: 'For first-timers', features: ['52-card deck', 'AI chat via AR recognition', 'Mongolian language', 'Standard box'] },
        { name: 'Premium', blurb: 'Most chosen', features: ['52 cards + 4 special', 'AI chat via AR recognition', 'Three languages', 'Audio biographies', 'Premium box'] },
        { name: 'Collector', blurb: "Collector's case", features: ['56 cards + 8 special', 'AI chat via AR recognition', 'Three languages', 'Audio biographies', 'Gold-edged case', 'Numbered edition', 'Signed certificate'] },
      ],
    },
    cta: {
      chip: 'Collection I · 2026',
      title: 'One AR recognition, fifty-two voices from history.',
      lede: 'Pick up a card, recognize it with your phone, and listen to history speak.',
      primary: 'Order the Premium deck',
      secondary: 'See the app first',
    },
    footer: 'Altan Domog · Collection I',
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
          <PrimaryButton to="/app" className="nav-primary-cta" aria-label={c.nav.app}>
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
        <header
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
          <p
            style={{
              fontFamily: FONT_SANS,
              fontSize: 11,
              letterSpacing: 3,
              color: tokens.accent,
              fontWeight: 700,
              textTransform: 'uppercase',
              margin: 0,
            }}
          >
            The Mongol Empire · 1206–1368
          </p>
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
        </header>
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
        <blockquote
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
            margin: 0,
          }}
          className="hidden-on-mobile"
        >
          <span style={{ color: tokens.accent, marginRight: 4 }}>“</span>
          {quoteOfDay.quote}
          <span style={{ color: tokens.accent, marginLeft: 4 }}>”</span>
          <cite
            style={{
              display: 'block',
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
          </cite>
        </blockquote>
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

const SCROLL_STORY_CARDS = [
  { rank: 'K', suit: '♠', name: 'Чингис Хаан', years: '1162–1227', accent: '#d4a843' },
  { rank: 'Q', suit: '♥', name: 'Бөртэ Үжин', years: '1161–1230', accent: '#b9572f' },
  { rank: 'J', suit: '♦', name: 'Сүбээдэй', years: '1175–1248', accent: '#7db2b7' },
  { rank: 'A', suit: '♣', name: 'Елүй Чуцай', years: '1190–1244', accent: '#c8a35d' },
  { rank: '9', suit: '♠', name: 'Занабазар', years: '1635–1723', accent: '#9a86d9' },
  { rank: '7', suit: '♦', name: 'Мандухай', years: '1449–1510', accent: '#d26952' },
];

const clamp01 = (value) => Math.max(0, Math.min(1, value));

function ARTargetGlyph({ className = '' }) {
  return (
    <span className={`ar-target-glyph ${className}`} aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
      <b />
      <em />
      <strong>AR</strong>
    </span>
  );
}

function createStoryTexture(THREE, draw, size = { width: 512, height: 768 }) {
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  draw(ctx, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = size.width < 512 ? 2 : 6;
  return texture;
}

function createScrollCardTexture(THREE, card, size) {
  return createStoryTexture(THREE, (ctx, w, h) => {
    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, '#171a22');
    bg.addColorStop(0.55, '#090a0f');
    bg.addColorStop(1, '#261309');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = '#f0cb68';
    ctx.lineWidth = 7;
    ctx.strokeRect(20, 20, w - 40, h - 40);
    ctx.strokeStyle = card.accent;
    ctx.lineWidth = 2;
    ctx.strokeRect(36, 36, w - 72, h - 72);

    ctx.fillStyle = card.accent;
    ctx.globalAlpha = 0.28;
    ctx.fillRect(58, 118, w - 116, 358);
    ctx.globalAlpha = 1;

    const halo = ctx.createRadialGradient(w / 2, 300, 30, w / 2, 300, 230);
    halo.addColorStop(0, `${card.accent}aa`);
    halo.addColorStop(0.48, `${card.accent}3a`);
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(58, 118, w - 116, 358);

    ctx.fillStyle = '#f7df92';
    ctx.font = '700 58px Georgia, serif';
    ctx.textAlign = 'left';
    ctx.fillText(card.rank, 58, 96);
    ctx.font = '44px Georgia, serif';
    ctx.fillStyle = card.accent;
    ctx.fillText(card.suit, 62, 146);

    ctx.textAlign = 'center';
    ctx.font = '700 88px Georgia, serif';
    ctx.fillStyle = 'rgba(255,247,223,0.92)';
    ctx.fillText(card.suit, w / 2, 322);

    ctx.strokeStyle = 'rgba(240,203,104,0.48)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(62, 512);
    ctx.lineTo(w - 62, 512);
    ctx.stroke();

    ctx.fillStyle = '#fff7df';
    ctx.font = '700 35px Georgia, serif';
    ctx.fillText(card.name, w / 2, 572);
    ctx.fillStyle = '#d4a843';
    ctx.font = '700 22px Arial, sans-serif';
    ctx.letterSpacing = '2px';
    ctx.fillText(card.years, w / 2, 612);

    ctx.fillStyle = 'rgba(237,232,213,0.58)';
    ctx.font = '700 17px Arial, sans-serif';
    ctx.fillText('ALTAN DOMOG · COLLECTION I', w / 2, 688);
  }, size);
}

function createRecognitionPanelTexture(THREE, c, size) {
  return createStoryTexture(THREE, (ctx, w, h) => {
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#111927');
    bg.addColorStop(0.52, '#070b12');
    bg.addColorStop(1, '#0a0c14');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    const glow = ctx.createRadialGradient(w / 2, h * 0.36, 20, w / 2, h * 0.36, w * 0.46);
    glow.addColorStop(0, 'rgba(118,212,216,0.34)');
    glow.addColorStop(0.42, 'rgba(118,212,216,0.12)');
    glow.addColorStop(1, 'rgba(118,212,216,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(118,212,216,0.68)';
    ctx.lineWidth = 3;
    ctx.strokeRect(72, 96, w - 144, h * 0.42);
    ctx.strokeStyle = 'rgba(230,188,82,0.62)';
    ctx.lineWidth = 2;
    ctx.strokeRect(112, 132, w - 224, h * 0.32);

    const cx = w / 2;
    const cy = h * 0.31;
    ctx.strokeStyle = 'rgba(118,212,216,0.58)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i += 1) {
      ctx.beginPath();
      ctx.arc(cx, cy, 44 + i * 28, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.strokeStyle = '#76d4d8';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(cx - 118, cy);
    ctx.lineTo(cx - 42, cy);
    ctx.moveTo(cx + 42, cy);
    ctx.lineTo(cx + 118, cy);
    ctx.moveTo(cx, cy - 118);
    ctx.lineTo(cx, cy - 42);
    ctx.moveTo(cx, cy + 42);
    ctx.lineTo(cx, cy + 118);
    ctx.stroke();

    ctx.fillStyle = '#e6bc52';
    ctx.font = '700 22px Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText((c.scroll3d.arHud || c.hero.scanLabel).toUpperCase(), 56, 540);

    ctx.fillStyle = '#ede8d5';
    ctx.font = '700 31px Georgia, serif';
    const text = c.hero.scanBody;
    const line = text.length > 26 ? `${text.slice(0, 26)}…` : text;
    ctx.fillText(line, 56, 592);

    ctx.fillStyle = 'rgba(118,212,216,0.72)';
    ctx.font = '800 18px Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('MATCH FOUND', w - 56, 540);
  }, size);
}

function createARTargetTexture(THREE, c, size = { width: 512, height: 512 }) {
  return createStoryTexture(THREE, (ctx, w, h) => {
    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, '#f7df92');
    bg.addColorStop(1, '#d4a843');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(7,8,12,0.82)';
    ctx.lineWidth = Math.max(4, w * 0.014);
    ctx.strokeRect(w * 0.055, h * 0.055, w * 0.89, h * 0.89);

    const cx = w / 2;
    const cy = h * 0.44;
    const frame = w * 0.58;
    const corner = frame * 0.22;
    const left = cx - frame / 2;
    const right = cx + frame / 2;
    const top = cy - frame / 2;
    const bottom = cy + frame / 2;

    ctx.strokeStyle = '#07080c';
    ctx.lineWidth = Math.max(7, w * 0.018);
    [
      [left, top, left + corner, top, left, top + corner],
      [right, top, right - corner, top, right, top + corner],
      [left, bottom, left + corner, bottom, left, bottom - corner],
      [right, bottom, right - corner, bottom, right, bottom - corner],
    ].forEach(([x1, y1, x2, y2, x3, y3]) => {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.moveTo(x1, y1);
      ctx.lineTo(x3, y3);
      ctx.stroke();
    });

    ctx.lineWidth = Math.max(3, w * 0.008);
    ctx.strokeStyle = 'rgba(7,8,12,0.68)';
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.arc(cx, cy, frame * (0.14 + i * 0.11), 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = '#07080c';
    ctx.beginPath();
    ctx.arc(cx, cy, frame * 0.055, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(7,8,12,0.9)';
    ctx.font = `800 ${Math.floor(w * 0.16)}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('AR', cx, cy + frame * 0.32);

    ctx.fillStyle = '#07080c';
    ctx.font = `700 ${Math.floor(w * 0.045)}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(c.scroll3d.targetTitle.toUpperCase(), w / 2, h * 0.86);
  }, size);
}

function ScrollStory3D({ c }) {
  const sectionRef = useRef(null);
  const stickyRef = useRef(null);
  const screenRef = useRef(null);
  const canvasRef = useRef(null);
  const progressRef = useRef(null);
  const activeStepRef = useRef(0);
  const [activeStep, setActiveStep] = useState(0);
  const [webglReady, setWebglReady] = useState(null);
  const chapters = c.scroll3d.chapters;
  const active = chapters[activeStep] || chapters[0];

  useEffect(() => {
    const section = sectionRef.current;
    const screen = screenRef.current;
    const canvas = canvasRef.current;
    if (!section || !screen || !canvas || typeof window === 'undefined') return undefined;

    const setProgressDom = (progress) => {
      if (progressRef.current) {
        progressRef.current.style.transform = `scaleX(${progress})`;
      }
      const nextStep = Math.min(chapters.length - 1, Math.floor(progress * chapters.length));
      if (nextStep !== activeStepRef.current) {
        activeStepRef.current = nextStep;
        setActiveStep(nextStep);
      }
    };

    const getProgress = () => {
      const rect = section.getBoundingClientRect();
      const travel = Math.max(1, rect.height - window.innerHeight);
      return clamp01(-rect.top / travel);
    };

    const deviceMemory = Number(navigator.deviceMemory || 8);
    const hardwareConcurrency = Number(navigator.hardwareConcurrency || 8);
    const mobileViewport = window.matchMedia?.('(max-width: 720px)').matches;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const lowPower = mobileViewport || deviceMemory <= 4 || hardwareConcurrency <= 4;
    const staticFallback = reduceMotion && lowPower;

    if (!window.WebGLRenderingContext || staticFallback) {
      setWebglReady(false);
      setProgressDom(getProgress());
      return undefined;
    }

    let disposed = false;
    let cleanupScene = () => {};

    import('three')
      .then((THREE) => {
        if (disposed) return;

        const disposables = new Set();
        const track = (item) => {
          if (item) disposables.add(item);
          return item;
        };

        let renderer;
        try {
          renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: !lowPower,
            alpha: true,
            powerPreference: lowPower ? 'low-power' : 'high-performance',
          });
        } catch {
          setWebglReady(false);
          setProgressDom(getProgress());
          return;
        }

        setWebglReady(true);
        renderer.setClearColor(0x07080c, 0);
        renderer.setPixelRatio(1);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = lowPower ? 0.98 : 1.08;

        const textureSize = lowPower
          ? { width: 384, height: 576 }
          : { width: 512, height: 768 };
        const squareTextureSize = lowPower
          ? { width: 384, height: 384 }
          : { width: 512, height: 512 };
        const visibleCards = lowPower ? SCROLL_STORY_CARDS.slice(0, 4) : SCROLL_STORY_CARDS;

        const scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(0x07080c, lowPower ? 0.045 : 0.035);

        const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 90);
        camera.position.set(0, 0.18, 7);

        const root = new THREE.Group();
        scene.add(root);

        const ambient = new THREE.AmbientLight(0xe5d1a0, lowPower ? 0.86 : 0.72);
        const key = new THREE.DirectionalLight(0xffe0a6, 2.2);
        key.position.set(4, 5, 6);
        const scan = new THREE.PointLight(0x76d4d8, 2.8, 9);
        scan.position.set(1.8, 0.5, -8.6);
        const ember = new THREE.PointLight(0xd4a843, lowPower ? 1.7 : 3.2, 14);
        ember.position.set(-2.4, -0.9, -15);
        scene.add(ambient, key, scan, ember);

        const cardGeo = track(new THREE.BoxGeometry(1.25, 1.82, 0.06, 1, 1, 1));
        const edgeMat = track(new THREE.MeshStandardMaterial({
          color: 0xd4a843,
          roughness: 0.24,
          metalness: 0.78,
        }));
        const backTexture = createStoryTexture(THREE, (ctx, w, h) => {
          const bg = ctx.createLinearGradient(0, 0, w, h);
          bg.addColorStop(0, '#211005');
          bg.addColorStop(0.5, '#090a0f');
          bg.addColorStop(1, '#151922');
          ctx.fillStyle = bg;
          ctx.fillRect(0, 0, w, h);
          ctx.strokeStyle = '#d4a843';
          ctx.lineWidth = 8;
          ctx.strokeRect(24, 24, w - 48, h - 48);
          ctx.strokeStyle = 'rgba(212,168,67,0.42)';
          ctx.lineWidth = 2;
          for (let i = 0; i < 11; i += 1) {
            ctx.beginPath();
            ctx.arc(w / 2, h / 2, 52 + i * 24, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.fillStyle = '#e6bc52';
          ctx.font = '700 34px Georgia, serif';
          ctx.textAlign = 'center';
          ctx.fillText('ALTAN DOMOG', w / 2, h / 2 + 10);
        }, textureSize);
        track(backTexture);
        const backMat = track(new THREE.MeshStandardMaterial({
          map: backTexture,
          roughness: 0.3,
          metalness: 0.22,
        }));

        const cardMeshes = visibleCards.map((card, index) => {
          const texture = track(createScrollCardTexture(THREE, card, textureSize));
          const faceMat = track(new THREE.MeshStandardMaterial({
            map: texture,
            roughness: 0.25,
            metalness: 0.2,
            transparent: true,
            opacity: 0.98,
          }));
          const mesh = new THREE.Mesh(cardGeo, [edgeMat, edgeMat, edgeMat, edgeMat, faceMat, backMat]);
          const row = index % 2 === 0 ? 1 : -1;
          mesh.position.set((index % 3 - 1) * 1.75, row * (0.72 + index * 0.02), -2.4 - index * 2.35);
          mesh.rotation.set(row * 0.13, (index % 2 ? -0.38 : 0.38), (index - 2.5) * 0.08);
          mesh.userData.base = {
            x: mesh.position.x,
            y: mesh.position.y,
            z: mesh.position.z,
            rx: mesh.rotation.x,
            ry: mesh.rotation.y,
            rz: mesh.rotation.z,
            speed: 0.18 + index * 0.025,
          };
          root.add(mesh);
          return mesh;
        });

        const ringGeo = track(new THREE.TorusGeometry(2.82, 0.012, 8, lowPower ? 54 : 94));
        const ringCount = lowPower ? 5 : 9;
        const rings = Array.from({ length: ringCount }, (_, index) => {
          const mat = track(new THREE.MeshBasicMaterial({
            color: index % 3 === 1 ? 0x76d4d8 : 0xd4a843,
            transparent: true,
            opacity: index % 3 === 1 ? 0.18 : 0.24,
          }));
          const ring = new THREE.Mesh(ringGeo, mat);
          ring.position.z = -1.8 - index * 2.35;
          ring.rotation.set(Math.PI / 2 + index * 0.03, 0, index * 0.24);
          root.add(ring);
          return ring;
        });

        const arTargetTexture = track(createARTargetTexture(THREE, c, squareTextureSize));
        const arTargetGeo = track(new THREE.BoxGeometry(1.12, 1.12, 0.04, 1, 1, 1));
        const arTargetMat = track(new THREE.MeshStandardMaterial({
          map: arTargetTexture,
          roughness: 0.22,
          metalness: 0.12,
          emissive: 0x2b2208,
          emissiveIntensity: 0.12,
        }));
        const arTargetCard = new THREE.Mesh(arTargetGeo, [edgeMat, edgeMat, edgeMat, edgeMat, arTargetMat, arTargetMat]);
        arTargetCard.position.set(-1.25, -0.2, -8.2);
        arTargetCard.rotation.set(0.06, 0.46, -0.08);
        root.add(arTargetCard);

        const recognitionTexture = track(createRecognitionPanelTexture(THREE, c, textureSize));
        const scannerPanelGeo = track(new THREE.BoxGeometry(1.42, 1.92, 0.06, 1, 1, 1));
        const scannerPanelEdge = track(new THREE.MeshStandardMaterial({ color: 0x101826, roughness: 0.34, metalness: 0.62 }));
        const scannerPanelFace = track(new THREE.MeshStandardMaterial({
          map: recognitionTexture,
          emissive: 0x102d34,
          emissiveIntensity: 0.58,
          roughness: 0.24,
        }));
        const scannerPanel = new THREE.Mesh(
          scannerPanelGeo,
          [scannerPanelEdge, scannerPanelEdge, scannerPanelEdge, scannerPanelEdge, scannerPanelFace, scannerPanelEdge],
        );
        scannerPanel.position.set(1.5, -0.02, -9.45);
        scannerPanel.rotation.set(0.07, -0.38, 0.08);
        root.add(scannerPanel);

        const scannerHaloGroup = new THREE.Group();
        scannerHaloGroup.position.set(-0.45, -0.05, -8.72);
        scannerHaloGroup.rotation.set(0.02, 0.18, -0.05);
        root.add(scannerHaloGroup);
        const scannerRingGeo = track(new THREE.TorusGeometry(0.76, 0.012, 8, lowPower ? 48 : 76));
        const scannerRingMats = [0x76d4d8, 0xe6bc52, 0x76d4d8].map((color, index) => track(new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: index === 1 ? 0.22 : 0.34,
          depthWrite: false,
        })));
        const scannerRings = scannerRingMats.map((mat, index) => {
          const ring = new THREE.Mesh(scannerRingGeo, mat);
          ring.scale.setScalar(0.72 + index * 0.22);
          ring.rotation.set(Math.PI / 2, index * 0.08, index * 0.34);
          scannerHaloGroup.add(ring);
          return ring;
        });

        const beamMat = track(new THREE.MeshBasicMaterial({
          color: 0x9df4ef,
          transparent: true,
          opacity: 0.26,
          side: THREE.DoubleSide,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }));
        const beam = new THREE.Mesh(track(new THREE.PlaneGeometry(2.2, 1.25)), beamMat);
        beam.position.set(0.32, -0.02, -8.8);
        beam.rotation.set(-0.2, 0.48, -0.08);
        root.add(beam);

        const markerGeo = track(new THREE.BoxGeometry(0.12, 0.86, 0.12));
        const markerMat = track(new THREE.MeshStandardMaterial({
          color: 0xd4a843,
          roughness: 0.28,
          metalness: 0.7,
          emissive: 0x2b1c08,
        }));
        const markerCount = lowPower ? 5 : 9;
        const markers = Array.from({ length: markerCount }, (_, index) => {
          const marker = new THREE.Mesh(markerGeo, markerMat);
          const angle = index * 0.72;
          marker.position.set(Math.cos(angle) * 1.8, Math.sin(angle) * 0.74, -13.4 - index * 0.68);
          marker.rotation.set(index * 0.08, angle, 0.18);
          root.add(marker);
          return marker;
        });

        const deckGroup = new THREE.Group();
        deckGroup.position.set(0.42, -0.1, -21.2);
        deckGroup.rotation.set(-0.08, -0.36, 0.06);
        root.add(deckGroup);
        const deckCardCount = lowPower ? 5 : 8;
        const deckCards = Array.from({ length: deckCardCount }, (_, index) => {
          const source = visibleCards[index % visibleCards.length];
          const texture = track(createScrollCardTexture(THREE, source, textureSize));
          const faceMat = track(new THREE.MeshStandardMaterial({
            map: texture,
            roughness: 0.28,
            metalness: 0.18,
          }));
          const mesh = new THREE.Mesh(cardGeo, [edgeMat, edgeMat, edgeMat, edgeMat, faceMat, backMat]);
          mesh.position.set(index * 0.035, index * 0.035, index * 0.018);
          mesh.rotation.z = index * 0.018;
          deckGroup.add(mesh);
          return mesh;
        });

        const constellationGroup = new THREE.Group();
        constellationGroup.position.set(0.42, -0.08, -21.2);
        root.add(constellationGroup);
        const miniGeo = track(new THREE.BoxGeometry(0.32, 0.47, 0.018));
        const miniFrontMat = track(new THREE.MeshStandardMaterial({
          color: 0xe6bc52,
          roughness: 0.22,
          metalness: 0.42,
          emissive: 0x3a2507,
          emissiveIntensity: 0.12,
        }));
        const miniBackMat = track(new THREE.MeshStandardMaterial({
          color: 0x151922,
          roughness: 0.32,
          metalness: 0.18,
        }));
        const miniCount = lowPower ? 14 : 28;
        const constellationCards = Array.from({ length: miniCount }, (_, index) => {
          const mesh = new THREE.Mesh(miniGeo, [edgeMat, edgeMat, edgeMat, edgeMat, miniFrontMat, miniBackMat]);
          const angle = (index / miniCount) * Math.PI * 2;
          const ring = index % 2 === 0 ? 1.74 : 2.32;
          mesh.position.set(Math.cos(angle) * ring, Math.sin(angle) * ring * 0.52, Math.sin(angle * 2) * 0.18);
          mesh.userData.baseZ = mesh.position.z;
          mesh.rotation.set(Math.sin(angle) * 0.24, -angle + Math.PI / 2, angle * 0.08);
          constellationGroup.add(mesh);
          return mesh;
        });

        const particleGeo = track(new THREE.BufferGeometry());
        const count = lowPower ? 56 : 132;
        const positions = new Float32Array(count * 3);
        for (let i = 0; i < count; i += 1) {
          const seed = Math.sin(i * 14.137) * 43758.5453;
          const rand = seed - Math.floor(seed);
          positions[i * 3] = (rand - 0.5) * 7;
          positions[i * 3 + 1] = (Math.sin(i * 3.71) - 0.5) * 3.6;
          positions[i * 3 + 2] = -1 - (i / count) * 24;
        }
        particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const particles = new THREE.Points(
          particleGeo,
          track(new THREE.PointsMaterial({
            color: 0xd4a843,
            size: 0.028,
            transparent: true,
            opacity: 0.55,
            depthWrite: false,
          })),
        );
        root.add(particles);

        let frame = 0;
        const clock = new THREE.Clock();
        const renderScale = lowPower ? 0.78 : Math.min(window.devicePixelRatio || 1, 1.35);

        const resize = () => {
          const width = Math.max(1, Math.floor(screen.clientWidth));
          const height = Math.max(1, Math.floor(screen.clientHeight));
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          renderer.setSize(Math.floor(width * renderScale), Math.floor(height * renderScale), false);
        };

        const render = () => {
          const progress = getProgress();
          setProgressDom(progress);
          const elapsed = reduceMotion ? 0 : clock.getElapsedTime();
          const cameraZ = 7.1 - progress * 24.8;
          camera.position.set(
            Math.sin(progress * Math.PI * 2.1) * 0.34,
            0.18 + Math.sin(progress * Math.PI) * 0.22,
            cameraZ,
          );
          camera.lookAt(
            Math.sin(progress * Math.PI * 1.5) * 0.45,
            Math.sin(progress * Math.PI * 0.8) * 0.12,
            cameraZ - 5.6,
          );

          root.rotation.y = Math.sin(progress * Math.PI * 2) * 0.08;
          root.rotation.x = Math.sin(progress * Math.PI) * 0.035;
          rings.forEach((ring, index) => {
            ring.rotation.z += reduceMotion ? 0 : 0.0018 + index * 0.00015;
            ring.material.opacity = 0.12 + Math.max(0, 1 - Math.abs(ring.position.z - cameraZ + 4) / 6) * 0.24;
          });
          cardMeshes.forEach((mesh, index) => {
            const base = mesh.userData.base;
            mesh.position.x = base.x + Math.sin(elapsed * 0.7 + index) * 0.09;
            mesh.position.y = base.y + Math.cos(elapsed * 0.62 + index * 1.7) * 0.08;
            mesh.rotation.x = base.rx + Math.sin(elapsed * 0.4 + index) * 0.08;
            mesh.rotation.y = base.ry + elapsed * base.speed + progress * (0.45 + index * 0.03);
            mesh.rotation.z = base.rz + Math.sin(elapsed * 0.5 + index) * 0.05;
          });
          scannerPanel.rotation.y = -0.38 + Math.sin(elapsed * 0.8) * 0.08 + progress * 0.2;
          scannerPanel.rotation.x = 0.07 + Math.sin(elapsed * 0.55) * 0.025;
          scannerRings.forEach((ring, index) => {
            ring.rotation.z += reduceMotion ? 0 : 0.014 + index * 0.006;
            ring.material.opacity = 0.08 + Math.max(0, 1 - Math.abs(progress - 0.38) * 5.2) * (index === 1 ? 0.24 : 0.42);
          });
          arTargetCard.rotation.y = 0.46 + Math.sin(elapsed * 0.7) * 0.05 - progress * 0.15;
          arTargetCard.rotation.z = -0.08 + Math.sin(elapsed * 0.5) * 0.025;
          beam.material.opacity = 0.14 + Math.sin(elapsed * 2.8) * 0.08 + Math.max(0, 1 - Math.abs(progress - 0.38) * 5) * 0.18;
          markers.forEach((marker, index) => {
            marker.rotation.y += reduceMotion ? 0 : 0.008 + index * 0.0008;
          });
          deckGroup.rotation.y = -0.36 + progress * 0.55 + Math.sin(elapsed * 0.45) * 0.06;
          deckCards.forEach((mesh, index) => {
            mesh.position.z = index * 0.018 + Math.sin(elapsed + index) * 0.006;
          });
          constellationGroup.rotation.y = elapsed * 0.045 + progress * 0.75;
          constellationGroup.rotation.z = Math.sin(elapsed * 0.28) * 0.035;
          constellationCards.forEach((mesh, index) => {
            const pulse = Math.sin(elapsed * 1.4 + index * 0.7) * 0.035;
            mesh.position.z = mesh.userData.baseZ + pulse;
            mesh.rotation.z += reduceMotion ? 0 : 0.0025;
          });
          particles.rotation.y = elapsed * 0.025 + progress * 0.35;
          renderer.render(scene, camera);
          frame = window.requestAnimationFrame(render);
        };

        resize();
        window.addEventListener('resize', resize);
        render();

        cleanupScene = () => {
          window.removeEventListener('resize', resize);
          window.cancelAnimationFrame(frame);
          disposables.forEach((item) => item?.dispose?.());
          renderer.dispose();
          renderer.forceContextLoss?.();
        };
      })
      .catch(() => {
        if (!disposed) {
          setWebglReady(false);
          setProgressDom(getProgress());
        }
      });

    return () => {
      disposed = true;
      cleanupScene();
    };
  }, [c, chapters]);

  return (
    <section
      ref={sectionRef}
      className="scroll-3d-section"
      aria-label={c.scroll3d.ariaLabel}
      data-section="scroll-3d"
      data-landing-scroll-hybrid
    >
      <div ref={stickyRef} className="scroll-3d-sticky">
        <div className="scroll-3d-layout">
          <div className="scroll-3d-copy">
            <p>{active.label}</p>
            <h2>{active.title}</h2>
            <span>{active.body}</span>
            <div className="scroll-ar-card" data-landing-scroll-ar aria-label={`${c.scroll3d.targetTitle}: ${c.scroll3d.targetBody}`}>
              <ARTargetGlyph />
              <span>
                <strong>{c.scroll3d.targetTitle}</strong>
                <small>{c.scroll3d.targetBody}</small>
              </span>
            </div>
            <div className="scroll-3d-progress" aria-label={c.scroll3d.progress}>
              <i ref={progressRef} />
            </div>
            <div className="scroll-3d-dots" aria-hidden="true">
              {chapters.map((chapter, index) => (
                <b key={chapter.label} className={index === activeStep ? 'is-active' : ''} />
              ))}
            </div>
          </div>

            <div className="scroll-scene-wrap" aria-label={c.scroll3d.sceneFrame} data-landing-scroll-scanner>
            <div ref={screenRef} className="scroll-scene-stage" data-landing-scroll-scene>
              <canvas
                ref={canvasRef}
                className="scroll-3d-canvas"
                data-landing-scroll-canvas
                aria-hidden="true"
              />
              <div className="scroll-3d-vignette" aria-hidden="true" />
              <div className={`scroll-3d-fallback ${webglReady === false ? 'is-visible' : ''}`} aria-hidden="true">
                {SCROLL_STORY_CARDS.slice(0, 4).map((card, index) => (
                  <span key={card.name} style={{ '--i': index }}>
                    {card.rank}
                  </span>
                ))}
              </div>
              <div className="scroll-scene-hud" aria-hidden="true">
                <ScanLine size={16} />
                <span>{c.scroll3d.arHud}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
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

const HOW_ICONS = [ScanLine, MessageCircle, HelpCircle, Volume2];

function HowItWorks({ c }) {
  return (
    <section
      id="how"
      className="scan-lab-section"
      style={{ padding: `${SECTION_PADY + 20}px 24px`, background: tokens.surface, borderTop: `1px solid ${tokens.border}` }}
    >
      <div className="scan-lab-grid" style={{ maxWidth: 1200, margin: '0 auto' }}>
        <Reveal className="scan-lab-visual-wrap">
          <div className="scan-lab-visual" aria-hidden="true">
            <div className="scan-lab-gantry" />
            <div className="scan-lab-beam" />
            <div className="scan-lab-card">
              <div className="scan-lab-card-media" style={{ backgroundImage: `url(${PORTRAITS.genghis})` }} />
              <span>K</span>
              <strong>Чингис Хаан</strong>
              <small>{c.how.visualLabel}</small>
            </div>
            <div className="scan-lab-phone">
              <div className="scan-lab-phone-screen">
                <ScanLine size={40} />
                <p>{c.hero.scanLabel}</p>
                <strong>{c.hero.scanBody}</strong>
              </div>
            </div>
            <div className="scan-lab-floor" />
          </div>
        </Reveal>

        <div className="scan-lab-copy">
          <Reveal>
            <div style={{ marginBottom: 32 }}>
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
                color: tokens.body,
                fontSize: 17,
                lineHeight: 1.6,
              }}
            >
              {c.how.lede}
            </p>
          </div>
          </Reveal>

          <ol className="scan-step-list">
            {c.how.steps.map((s, i) => {
              const Icon = HOW_ICONS[i] || ScanLine;
              return (
                <Reveal key={s.title} delay={i * 80}>
                  <li className="scan-step-card">
                    <span className="scan-step-index">{String(i + 1).padStart(2, '0')}</span>
                    <span className="scan-step-icon" aria-hidden="true">
                      <Icon size={20} />
                    </span>
                    <div>
                      <p>{c.how.step} {i + 1}</p>
                      <h3>{s.title}</h3>
                      <span>{s.desc}</span>
                    </div>
                  </li>
                </Reveal>
              );
            })}
          </ol>
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
              <article
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
                <figure
                  style={{
                    aspectRatio: '4/5',
                    position: 'relative',
                    overflow: 'hidden',
                    background: '#1F1B14',
                    margin: 0,
                  }}
                >
                  <img
                    src={card.img}
                    alt={`Portrait of ${card.name}`}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    loading="lazy"
                  />
                  <span
                    aria-hidden="true"
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
                    <span
                      style={{
                        display: 'block',
                        fontSize: 16,
                        color: card.suit === '♥' || card.suit === '♦' ? tokens.bronze : tokens.brand,
                        marginTop: 2,
                      }}
                    >
                      {card.suit}
                    </span>
                  </span>
                  <figcaption
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
                    <h3 style={{ fontWeight: 700, fontSize: 17.5, lineHeight: 1.15, margin: 0 }}>
                      {card.name}
                    </h3>
                    <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12.5, marginTop: 4, marginBottom: 0 }}>
                      {card.role} · <time>{card.years}</time>
                    </p>
                  </figcaption>
                </figure>
              </article>
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
                <article
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
                  <span
                    aria-hidden="true"
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
                  </span>
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
                </article>
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
              <article
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
                <header>
                  <p
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      letterSpacing: 1.4,
                      textTransform: 'uppercase',
                      color: t.highlighted ? tokens.brandOnSoft : tokens.hint,
                      margin: 0,
                    }}
                  >
                    {t.blurb}
                  </p>
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
                  <p
                    style={{
                      marginTop: 12,
                      fontSize: 38,
                      fontWeight: 700,
                      letterSpacing: -0.6,
                      color: t.highlighted ? tokens.brandStrong : tokens.ink,
                      marginBottom: 0,
                    }}
                  >
                    <data value={t.price}>{t.price}</data>
                  </p>
                </header>
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
              </article>
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

  const ldData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': siteUrl('/#webpage'),
        url: siteUrl('/'),
        name: lang === 'en'
          ? 'Altan Domog — 52 figures of Mongolian history'
          : 'Altan Domog — 52 түүхэн зүтгэлтэн',
        description: lang === 'en'
          ? '52 figures of Mongolian history — from Genghis Khan to Zanabazar — gathered into a gold-edged playing card deck. AR recognition identifies each card and an AI guide answers in the figure’s voice.'
          : '52 түүхэн зүтгэлтний намтар, гавьяа, домог — Чингис Хаанаас Занабазар хүртэл, нэг алтан хөзрийн багцад. AR танилт картаа таньж, AI хөтөч уг дүрийн дуугаар хариулна.',
        inLanguage: lang === 'en' ? 'en' : 'mn',
        isPartOf: { '@id': siteUrl('/#website') },
        about: { '@id': siteUrl('/#product') },
        primaryImageOfPage: {
          '@type': 'ImageObject',
          url: siteUrl('/logo.png'),
        },
        breadcrumb: { '@id': siteUrl('/#breadcrumb-home') },
      },
      {
        '@type': 'BreadcrumbList',
        '@id': siteUrl('/#breadcrumb-home'),
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Altan Domog', item: siteUrl('/') },
        ],
      },
      {
        '@type': 'FAQPage',
        '@id': siteUrl('/#faq'),
        mainEntity: c.how.steps.map((s) => ({
          '@type': 'Question',
          name: s.title,
          acceptedAnswer: { '@type': 'Answer', text: s.desc },
        })),
      },
      {
        '@type': 'Product',
        '@id': siteUrl('/#product-offers'),
        name: 'Altan Domog — Collection I',
        brand: { '@id': siteUrl('/#organization') },
        description: lang === 'en'
          ? 'A 52-card historical playing deck. AR recognition identifies each card face and opens an AI-guided conversation with the figure pictured.'
          : '52 түүхэн дүртэй хөзрийн багц. AR танилт хөзрийн нүүрийг таньж, AI хөтөч уг дүрийн дуугаар ярина.',
        image: siteUrl('/logo.png'),
        offers: [
          {
            '@type': 'Offer',
            name: 'Standard',
            price: '29900',
            priceCurrency: 'MNT',
            availability: 'https://schema.org/PreOrder',
            url: siteUrl('/order?tier=basic'),
          },
          {
            '@type': 'Offer',
            name: 'Premium',
            price: '49900',
            priceCurrency: 'MNT',
            availability: 'https://schema.org/PreOrder',
            url: siteUrl('/order?tier=premium'),
          },
          {
            '@type': 'Offer',
            name: 'Collector',
            price: '99000',
            priceCurrency: 'MNT',
            availability: 'https://schema.org/PreOrder',
            url: siteUrl('/order?tier=collector'),
          },
        ],
      },
    ],
  };

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
      <JsonLd id="landing" data={ldData} />
      <NavBar c={c} />
      <main>
        <Hero c={c} />
        <ScrollStory3D c={c} />
        <StatsBand c={c} />
        <HowItWorks c={c} />
        <CardCollectionV2 c={c} />
        <Features c={c} />
        <Pricing c={c} />
        <CTABand c={c} />
      </main>
      <Footer c={c} />
      <style>{`
        .scroll-3d-section {
          position: relative;
          min-height: 410vh;
          margin-top: -1px;
          background: #07080c;
        }
        .scroll-3d-sticky {
          position: sticky;
          top: 0;
          height: 100vh;
          min-height: 680px;
          overflow: hidden;
          isolation: isolate;
          background:
            radial-gradient(circle at 74% 42%, rgba(118,212,216,0.12), transparent 30%),
            linear-gradient(180deg, #07080c 0%, #0d111a 48%, #07080c 100%),
            repeating-linear-gradient(90deg, rgba(212,168,67,0.04) 0 1px, transparent 1px 92px);
        }
        .scroll-3d-sticky::before {
          content: '';
          position: absolute;
          inset: 0;
          z-index: 0;
          background:
            linear-gradient(90deg, rgba(7,8,12,0.94) 0%, rgba(7,8,12,0.7) 34%, rgba(7,8,12,0.14) 70%, rgba(7,8,12,0.74) 100%),
            linear-gradient(180deg, rgba(7,8,12,0.62), transparent 28%, transparent 66%, rgba(7,8,12,0.78));
          pointer-events: none;
        }
        .scroll-3d-sticky::after {
          content: '';
          position: absolute;
          inset: 0;
          z-index: 1;
          background:
            linear-gradient(115deg, transparent 0%, rgba(118,212,216,0.08) 42%, transparent 58%),
            repeating-linear-gradient(0deg, rgba(255,255,255,0.025) 0 1px, transparent 1px 9px);
          mix-blend-mode: screen;
          opacity: 0.5;
          pointer-events: none;
        }
        .scroll-3d-layout {
          position: relative;
          z-index: 4;
          height: 100%;
          width: min(1320px, 100%);
          margin: 0 auto;
          padding: clamp(96px, 12vh, 136px) clamp(24px, 5vw, 64px) clamp(42px, 7vh, 76px);
          display: grid;
          grid-template-columns: minmax(320px, 0.74fr) minmax(480px, 1.06fr);
          gap: clamp(24px, 5vw, 72px);
          align-items: center;
        }
        .scroll-3d-canvas {
          position: absolute;
          inset: 0;
          z-index: 1;
          width: 100%;
          height: 100%;
          display: block;
        }
        .scroll-3d-vignette {
          position: absolute;
          inset: 0;
          z-index: 3;
          background:
            radial-gradient(ellipse at 50% 42%, transparent 0%, transparent 50%, rgba(7,8,12,0.58) 88%),
            linear-gradient(180deg, rgba(7,8,12,0.18), transparent 18%, transparent 72%, rgba(7,8,12,0.78) 100%);
          pointer-events: none;
        }
        .scroll-3d-copy {
          position: relative;
          z-index: 5;
          width: min(480px, calc(100% - 48px));
          color: #ede8d5;
          text-shadow: 0 20px 58px rgba(0,0,0,0.62);
        }
        .scroll-3d-copy > p {
          margin: 0 0 14px;
          color: #76d4d8;
          font-family: ${tokens.serif};
          font-size: clamp(2.2rem, 5vw, 4.9rem);
          font-weight: 600;
          font-style: italic;
          line-height: 0.8;
        }
        .scroll-3d-copy h2 {
          margin: 0;
          color: #fff7df;
          font-family: ${tokens.serif};
          font-size: clamp(2.08rem, 5vw, 4.8rem);
          font-weight: 600;
          line-height: 0.94;
          letter-spacing: 0;
        }
        .scroll-3d-copy > span {
          display: block;
          margin-top: 18px;
          max-width: 420px;
          color: rgba(237,232,213,0.76);
          font-family: ${FONT_SANS};
          font-size: clamp(0.98rem, 1.28vw, 1.13rem);
          line-height: 1.68;
        }
        .scroll-ar-card {
          width: min(420px, 100%);
          margin-top: 26px;
          display: grid;
          grid-template-columns: 84px minmax(0, 1fr);
          gap: 16px;
          align-items: center;
          padding: 14px;
          border: 1px solid rgba(212,168,67,0.28);
          background:
            linear-gradient(135deg, rgba(255,255,255,0.07), rgba(255,255,255,0.018)),
            rgba(10,12,20,0.72);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 24px 56px rgba(0,0,0,0.32);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
        }
        .scroll-ar-card > span:not(.ar-target-glyph) {
          min-width: 0;
        }
        .scroll-ar-card strong {
          display: block;
          color: #f2d88a;
          font-family: ${FONT_SANS};
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 1.9px;
          text-transform: uppercase;
        }
        .scroll-ar-card small {
          display: block;
          margin-top: 8px;
          color: rgba(237,232,213,0.7);
          font-family: ${FONT_SANS};
          font-size: 0.86rem;
          line-height: 1.45;
        }
        .ar-target-glyph {
          position: relative;
          display: block;
          width: 84px;
          height: 84px;
          background: linear-gradient(135deg, #f7df92, #d4a843);
          border: 1px solid rgba(255,255,255,0.18);
          box-shadow: 0 16px 34px rgba(212,168,67,0.18);
        }
        .ar-target-glyph i {
          position: absolute;
          width: 22px;
          height: 22px;
          border-color: #07080c;
          opacity: 0.9;
        }
        .ar-target-glyph i:nth-child(1) { left: 9px; top: 9px; border-left: 3px solid; border-top: 3px solid; }
        .ar-target-glyph i:nth-child(2) { right: 9px; top: 9px; border-right: 3px solid; border-top: 3px solid; }
        .ar-target-glyph i:nth-child(3) { left: 9px; bottom: 9px; border-left: 3px solid; border-bottom: 3px solid; }
        .ar-target-glyph i:nth-child(4) { right: 9px; bottom: 9px; border-right: 3px solid; border-bottom: 3px solid; }
        .ar-target-glyph b,
        .ar-target-glyph em {
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          border: 2px solid rgba(7,8,12,0.72);
          border-radius: 999px;
        }
        .ar-target-glyph b {
          width: 42px;
          height: 42px;
        }
        .ar-target-glyph em {
          width: 24px;
          height: 24px;
          font-style: normal;
        }
        .ar-target-glyph strong {
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          color: #07080c;
          font-size: 11px;
          letter-spacing: 0;
          line-height: 1;
        }
        .scroll-scene-wrap {
          position: relative;
          z-index: 5;
          min-width: 0;
          width: min(820px, 58vw);
          height: min(76vh, 720px);
          min-height: 520px;
          justify-self: end;
          transform: perspective(1300px) rotateY(-5deg) rotateX(2deg);
        }
        .scroll-scene-stage {
          position: relative;
          width: 100%;
          height: 100%;
          margin-left: auto;
          overflow: visible;
          background:
            radial-gradient(ellipse at 54% 45%, rgba(118,212,216,0.2), transparent 32%),
            radial-gradient(ellipse at 48% 62%, rgba(212,168,67,0.13), transparent 46%);
          contain: layout paint size;
        }
        .scroll-scene-stage::before {
          content: '';
          position: absolute;
          inset: 10% 4% 5%;
          z-index: 4;
          background:
            linear-gradient(90deg, transparent, rgba(118,212,216,0.16), transparent),
            repeating-linear-gradient(90deg, rgba(242,216,138,0.1) 0 1px, transparent 1px 84px);
          opacity: 0.42;
          transform: perspective(900px) rotateX(66deg);
          filter: blur(0.2px);
          pointer-events: none;
        }
        .scroll-scene-hud {
          position: absolute;
          right: clamp(6px, 4vw, 52px);
          bottom: clamp(8px, 4vh, 34px);
          z-index: 6;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          border: 1px solid rgba(118,212,216,0.32);
          background: rgba(7,8,12,0.72);
          color: #f2d88a;
          font-family: ${FONT_SANS};
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 1.3px;
          text-transform: uppercase;
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
        }
        .scroll-scene-hud svg {
          color: #76d4d8;
          flex-shrink: 0;
        }
        .scroll-3d-progress {
          position: relative;
          width: min(360px, 72vw);
          height: 2px;
          margin-top: 28px;
          overflow: hidden;
          background: rgba(237,232,213,0.18);
        }
        .scroll-3d-progress i {
          position: absolute;
          inset: 0;
          display: block;
          transform: scaleX(0);
          transform-origin: left center;
          background: linear-gradient(90deg, #76d4d8, #e6bc52);
          box-shadow: 0 0 22px rgba(118,212,216,0.38);
        }
        .scroll-3d-dots {
          display: flex;
          gap: 10px;
          margin-top: 18px;
        }
        .scroll-3d-dots b {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          border: 1px solid rgba(237,232,213,0.34);
          background: transparent;
          transition: background 200ms ease, border-color 200ms ease, transform 200ms ease;
        }
        .scroll-3d-dots b.is-active {
          border-color: #e6bc52;
          background: #e6bc52;
          transform: scale(1.18);
        }
        .scroll-3d-fallback {
          position: absolute;
          inset: 0;
          z-index: 2;
          display: none;
          perspective: 1200px;
          transform-style: preserve-3d;
          pointer-events: none;
        }
        .scroll-3d-fallback.is-visible {
          display: block;
        }
        .scroll-3d-fallback span {
          position: absolute;
          left: calc(30% + var(--i) * 7%);
          top: calc(14% + var(--i) * 9%);
          width: clamp(96px, 36%, 168px);
          aspect-ratio: 5 / 7.3;
          display: grid;
          place-items: center;
          border: 1px solid rgba(230,188,82,0.72);
          background: linear-gradient(145deg, #171a22, #07080c 58%, #281508);
          color: #e6bc52;
          font-family: ${tokens.serif};
          font-size: clamp(3rem, 7vw, 5.6rem);
          box-shadow: inset 0 0 0 7px rgba(7,8,12,0.9), inset 0 0 0 8px rgba(212,168,67,0.36), 0 32px 70px rgba(0,0,0,0.46);
          transform: translateZ(calc(var(--i) * 60px)) rotateY(calc(-24deg + var(--i) * 13deg)) rotateZ(calc(-8deg + var(--i) * 4deg));
        }
        .scan-lab-section {
          position: relative;
          overflow: hidden;
        }
        .scan-lab-section::before {
          content: '';
          position: absolute;
          inset: 0;
          background:
            radial-gradient(circle at 20% 32%, rgba(212,168,67,0.16), transparent 30%),
            linear-gradient(120deg, rgba(7,8,12,0.2), transparent 52%);
          pointer-events: none;
        }
        .scan-lab-grid {
          position: relative;
          display: grid;
          grid-template-columns: minmax(320px, 0.95fr) minmax(0, 1.05fr);
          gap: clamp(34px, 6vw, 72px);
          align-items: center;
        }
        .scan-lab-visual-wrap {
          min-width: 0;
        }
        .scan-lab-visual {
          position: relative;
          min-height: 560px;
          perspective: 1500px;
          transform-style: preserve-3d;
        }
        .scan-lab-gantry {
          position: absolute;
          left: 9%;
          top: 6%;
          width: 78%;
          height: 22%;
          border: 1px solid rgba(212,168,67,0.2);
          border-bottom: 0;
          background: linear-gradient(180deg, rgba(255,255,255,0.045), transparent);
          transform: rotateX(64deg) translateZ(34px);
          box-shadow: 0 26px 58px rgba(0,0,0,0.34);
        }
        .scan-lab-floor {
          position: absolute;
          left: 2%;
          right: 2%;
          bottom: 8%;
          height: 32%;
          border-radius: 50%;
          border: 1px solid rgba(212,168,67,0.16);
          background:
            radial-gradient(ellipse at center, rgba(237,232,213,0.14), rgba(212,168,67,0.07) 36%, rgba(7,8,12,0.2) 64%, transparent 76%);
          transform: rotateX(72deg) translateZ(-60px);
        }
        .scan-lab-card {
          position: absolute;
          left: 17%;
          top: 19%;
          width: clamp(166px, 21vw, 238px);
          aspect-ratio: 5 / 7.3;
          border: 1px solid rgba(255,224,140,0.72);
          border-radius: 11px;
          overflow: hidden;
          transform: translateZ(110px) rotateY(25deg) rotateX(7deg) rotateZ(-5deg);
          background: #0d0f16;
          box-shadow:
            inset 0 0 0 6px rgba(7,8,12,0.88),
            inset 0 0 0 7px rgba(212,168,67,0.42),
            0 38px 62px rgba(0,0,0,0.48);
        }
        .scan-lab-card::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(115deg, transparent 20%, rgba(255,255,255,0.2) 35%, transparent 48%);
          mix-blend-mode: screen;
        }
        .scan-lab-card-media {
          position: absolute;
          inset: 13% 10% 26%;
          border: 1px solid rgba(212,168,67,0.4);
          background-size: cover;
          background-position: 50% 14%;
          box-shadow: inset 0 -50px 40px rgba(0,0,0,0.65);
        }
        .scan-lab-card span {
          position: absolute;
          left: 10%;
          top: 7%;
          color: #e6bc52;
          font-family: ${tokens.serif};
          font-size: 1.55rem;
          font-weight: 700;
        }
        .scan-lab-card strong {
          position: absolute;
          left: 11%;
          right: 11%;
          bottom: 13%;
          color: #fff7df;
          font-family: ${tokens.serif};
          font-size: 1.2rem;
          line-height: 1;
        }
        .scan-lab-card small {
          position: absolute;
          left: 11%;
          right: 11%;
          bottom: 8%;
          color: rgba(237,232,213,0.62);
          font-size: 0.66rem;
          letter-spacing: 1.4px;
          text-transform: uppercase;
        }
        .scan-lab-beam {
          position: absolute;
          left: 33%;
          top: 28%;
          width: 38%;
          height: 30%;
          background: linear-gradient(90deg, transparent, rgba(242,216,138,0.4), rgba(255,255,255,0.22), transparent);
          clip-path: polygon(6% 32%, 100% 0, 78% 100%, 0 70%);
          transform: translateZ(150px) rotateX(59deg) rotateZ(-8deg);
          filter: drop-shadow(0 0 26px rgba(212,168,67,0.32));
          animation: scanSweep 3.8s ease-in-out infinite;
          z-index: 4;
        }
        .scan-lab-phone {
          position: absolute;
          right: 8%;
          top: 34%;
          width: clamp(140px, 18vw, 196px);
          aspect-ratio: 0.57;
          padding: 10px;
          border-radius: 28px;
          background: linear-gradient(140deg, #3b3e49, #06070a 70%);
          border: 1px solid rgba(255,255,255,0.16);
          transform: translateZ(185px) rotateY(-25deg) rotateX(8deg) rotateZ(7deg);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.16), 0 34px 70px rgba(0,0,0,0.5);
          z-index: 5;
        }
        .scan-lab-phone-screen {
          position: relative;
          height: 100%;
          overflow: hidden;
          border-radius: 20px;
          padding: 20px 14px;
          border: 1px solid rgba(212,168,67,0.2);
          background:
            radial-gradient(circle at 50% 24%, rgba(212,168,67,0.25), transparent 36%),
            linear-gradient(180deg, #10141d, #07080c);
          color: rgba(237,232,213,0.75);
        }
        .scan-lab-phone-screen svg {
          color: #e6bc52;
        }
        .scan-lab-phone-screen p {
          margin: 22px 0 8px;
          color: #e6bc52;
          font-size: 9px;
          letter-spacing: 1.4px;
          text-transform: uppercase;
          font-weight: 800;
        }
        .scan-lab-phone-screen strong {
          display: block;
          font-size: 12px;
          line-height: 1.45;
        }
        .scan-step-list {
          display: grid;
          gap: 14px;
          margin: 0;
          padding: 0;
          list-style: none;
        }
        .scan-step-card {
          position: relative;
          display: grid;
          grid-template-columns: auto auto minmax(0, 1fr);
          gap: 16px;
          align-items: flex-start;
          padding: 20px;
          border: 1px solid rgba(212,168,67,0.18);
          background:
            linear-gradient(135deg, rgba(255,255,255,0.055), rgba(255,255,255,0.012)),
            rgba(10,12,20,0.62);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.07), 0 24px 52px rgba(0,0,0,0.24);
          transform: perspective(900px) rotateY(-1.6deg);
          transition: transform 180ms ease, border-color 180ms ease, background 180ms ease;
        }
        .scan-step-card:hover {
          transform: perspective(900px) rotateY(0deg) translateY(-2px);
          border-color: rgba(212,168,67,0.42);
          background: linear-gradient(135deg, rgba(212,168,67,0.12), rgba(255,255,255,0.018)), rgba(10,12,20,0.78);
        }
        .scan-step-index {
          color: rgba(212,168,67,0.34);
          font-family: ${tokens.serif};
          font-size: 1.8rem;
          font-weight: 650;
          line-height: 1;
          min-width: 42px;
        }
        .scan-step-icon {
          width: 42px;
          height: 42px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(212,168,67,0.25);
          background: rgba(212,168,67,0.09);
          color: #e6bc52;
        }
        .scan-step-card p {
          margin: 0;
          color: rgba(237,232,213,0.48);
          font-size: 10px;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          font-weight: 800;
        }
        .scan-step-card h3 {
          margin: 4px 0 0;
          color: #ede8d5;
          font-size: 1.08rem;
          font-weight: 700;
          letter-spacing: 0;
        }
        .scan-step-card span:not(.scan-step-index):not(.scan-step-icon) {
          display: block;
          margin-top: 8px;
          color: #a89f8a;
          font-size: 0.94rem;
          line-height: 1.55;
        }
        @keyframes scanSweep {
          0%, 100% { opacity: 0.48; transform: translateZ(150px) rotateX(62deg) rotateZ(-14deg) translateX(-5%); }
          50% { opacity: 0.94; transform: translateZ(150px) rotateX(62deg) rotateZ(-14deg) translateX(5%); }
        }
        .bento-grid > .bento-hero { grid-column: 1 / 3; grid-row: 1 / 3; }
        .bento-grid > .bento-wide { grid-column: 1 / 5; }
        @media (max-width: 880px) {
          .scroll-3d-section {
            min-height: 380vh;
          }
          .scroll-3d-sticky {
            min-height: 760px;
          }
          .scroll-3d-sticky::before {
            background:
              linear-gradient(180deg, rgba(7,8,12,0.78) 0%, rgba(7,8,12,0.24) 44%, rgba(7,8,12,0.9) 100%);
          }
          .scroll-3d-layout {
            grid-template-columns: 1fr;
            grid-template-rows: minmax(360px, 1fr) auto;
            gap: 20px;
            padding: 92px 24px 34px;
            align-items: end;
          }
          .scroll-3d-copy {
            width: 100%;
          }
          .scroll-3d-copy > span {
            max-width: 560px;
          }
          .scroll-scene-wrap {
            grid-row: 1;
            align-self: center;
            width: 100%;
            height: min(58vh, 560px);
            min-height: 410px;
            transform: perspective(1200px) rotateY(-3deg) rotateX(1deg);
          }
          .scroll-scene-stage {
            width: 100%;
          }
          .scroll-ar-card {
            grid-template-columns: 72px minmax(0, 1fr);
            max-width: 520px;
          }
          .ar-target-glyph {
            width: 72px;
            height: 72px;
          }
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
          .scan-lab-grid {
            grid-template-columns: 1fr !important;
          }
          .scan-lab-visual {
            min-height: 480px;
            max-width: 620px;
            margin: 0 auto;
          }
          .scan-step-card {
            grid-template-columns: auto minmax(0, 1fr);
          }
          .scan-step-index {
            display: none;
          }
          .hidden-on-mobile { display: none !important; }
          .bento-grid { grid-template-columns: 1fr !important; }
          .bento-grid > .bento-hero,
          .bento-grid > .bento-wide,
          .bento-grid > .bento-small { grid-column: auto !important; grid-row: auto !important; }
          .stats-band-grid { grid-template-columns: repeat(2, 1fr) !important; row-gap: 32px !important; }
          .stats-band-grid > div:nth-child(3) { border-left: none !important; padding-left: 0 !important; }
        }
        @media (max-width: 560px) {
          .scroll-3d-section {
            min-height: 350vh;
          }
          .scroll-3d-sticky {
            min-height: 100svh;
          }
          .scroll-3d-layout {
            grid-template-rows: minmax(300px, 1fr) auto;
            padding: 88px 20px max(24px, env(safe-area-inset-bottom));
            gap: 12px;
          }
          .scroll-scene-wrap {
            height: min(48vh, 430px);
            min-height: 300px;
            transform: perspective(1000px) rotateY(-2deg);
          }
          .scroll-scene-stage::before {
            inset: 18% -4% 8%;
          }
          .scroll-scene-hud {
            right: 12px;
            bottom: 12px;
            padding: 8px 9px;
            font-size: 8px;
          }
          .scroll-3d-copy {
            width: 100%;
          }
          .scroll-3d-copy > p {
            font-size: 2.45rem;
            margin-bottom: 10px;
          }
          .scroll-3d-copy h2 {
            font-size: clamp(2rem, 12vw, 3.18rem);
            max-width: 10ch;
          }
          .scroll-3d-copy > span {
            max-width: 38ch;
            font-size: 0.95rem;
            line-height: 1.55;
          }
          .scroll-ar-card {
            grid-template-columns: 56px minmax(0, 1fr);
            gap: 12px;
            padding: 11px;
            margin-top: 16px;
          }
          .ar-target-glyph {
            width: 56px;
            height: 56px;
          }
          .scroll-ar-card small {
            font-size: 0.76rem;
            line-height: 1.35;
          }
          .scroll-3d-progress {
            width: min(280px, 78vw);
            margin-top: 22px;
          }
          .scroll-3d-fallback span {
            left: calc(24% + var(--i) * 8%);
            top: calc(16% + var(--i) * 10%);
          }
          .nav-primary-cta {
            width: 54px !important;
            height: 54px !important;
            padding: 0 !important;
            justify-content: center !important;
            border-radius: 15px !important;
            font-size: 0 !important;
            flex-shrink: 0 !important;
          }
          .nav-primary-cta svg {
            width: 18px !important;
            height: 18px !important;
          }
          .scan-lab-visual {
            min-height: 420px;
          }
          .scan-lab-card {
            left: 9%;
            top: 21%;
            width: 158px;
          }
          .scan-lab-phone {
            right: 1%;
            width: 132px;
          }
          .scan-step-card {
            padding: 17px;
            gap: 12px;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .scan-lab-beam {
            animation: none !important;
          }
          .scroll-3d-dots b {
            transition: none !important;
          }
        }
      `}</style>
    </div>
  );
}
