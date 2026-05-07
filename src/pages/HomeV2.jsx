import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  Users,
  Trophy,
  Volume2,
  Quote as QuoteIcon,
  ScanLine,
  Map as MapIcon,
  Plus,
  Wrench,
  Clock,
  Search,
} from 'lucide-react';
import { useLang } from '@/lib/i18n';
import { isGuest } from '@/lib/authStore';
import { FIGURES, CATEGORIES, ERAS, ERA_KEYS, getEra } from '@/lib/figuresData';
import { SepiaPortrait } from '@/components/photo/SepiaPortrait';
import { useFeaturedToday } from '@/hooks/useFeaturedToday';
import { useQuoteToday } from '@/hooks/useQuoteToday';
import { useMyTeam } from '@/hooks/useMyTeam';
import { useCompare } from '@/hooks/useCompare';
import { useAppSettings } from '@/hooks/useAppSettings';
import { base44 } from '@/api/base44Client';
import ChatFAB from '@/components/ChatFAB';
import Card3D from '@/components/Card3D';
import FigureTileV2 from '@/components/FigureTileV2';
import ScrollProgress from '@/components/ScrollProgress';
import FigureModal from '@/components/FigureModal';
import CompareBar from '@/components/CompareBar';
import CompareModal from '@/components/CompareModal';
import HistoricalMap from '@/components/HistoricalMap';
import TimelineSection from '@/components/TimelineSection';
import AdminPanel from '@/components/admin/AdminPanel';
import { ErrorBoundary } from '@/lib/feedback';

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

const SECTION_PADY = 64;

const COPY = {
  mn: {
    nav: { figures: 'Дүрүүд', team: 'Миний баг', engagements: 'Тоглоом', chapters: 'Бүлгүүд', classic: 'Хуучин', scan: 'AR-аар таниулах', guests: 'Зочин' },
    hero: {
      kicker: 'Кодекс I',
      title1: 'Алтан Домогийн',
      title2: 'нүүр',
      lede: '52 түүхэн дүрийн намтар, эш үг, дуу хоолой — нэг код. Хөзрөө уншуулж эхэл, эсвэл доорх кодексийг сэрүүн.',
      cta: 'Хөзөр уншуулах',
      ctaAlt: 'Бүх 52 дүр',
    },
    team: {
      chip: 'Миний баг',
      empty: 'Чи багаа шилэн ав. Дүрүүдийн дотроос дуртайгаа сонгоод энд цуглуулна.',
      build: 'Баг бүрдүүлэх',
      addMore: 'Нэмэх',
    },
    explore: {
      chip: 'Кодекс',
      title: 'Өнөөдөр хэнтэй уулзах вэ?',
      lede: 'Хаад, хатад, жанжид, зөвлөх, соёлын зүтгэлтэн — эхлэхдээ тохирох хэдийг сонгож үзээрэй.',
      all: 'Бүх 52',
      view2D: '🃏 2D',
      view3D: '🎴 3D',
      viewLabel: 'Үзэх горим',
      searchPlaceholder: 'Нэр, цол, эсвэл намтраар хайх…',
      catLabel: 'Бүлэг',
      eraLabel: 'Үе',
      allLabel: 'Бүгд',
      results: 'үр дүн',
      featuredHint: 'санал болгосон 8',
      empty: 'Үр дүн олдсонгүй. Хайлтын үгээ дахин оролдоорой.',
    },
    engagements: {
      chip: 'Оролц',
      title: 'Кодекстэй наадах',
      cards: [
        { kicker: 'Ганц', title: 'Хэний үг вэ?', sub: 'Ишлэлийг уншиж, хэн хэлснийг сонго. Тэргүүлэгчдийн жагсаалтад нэрээ үлдээ.' },
        { kicker: 'Багаараа', title: 'Живэ өрөө', sub: '2–8 тоглогч, нийтлэг хугацаа, нэг ишлэл. Код оруулан нэгд эсвэл өрөө үүсгэ.' },
        { kicker: 'Байр', title: 'Тэргүүлэгчид', sub: '7 хоногийн болон бүх цагийн жагсаалт.' },
        { kicker: 'Сонсох', title: 'Түүхэн аялал', sub: 'Кодексийн эхнээс сүүл хүртэл дуу автоматаар тоглоно.' },
      ],
    },
    chapters: {
      chip: 'Түүхэн бүлгүүд',
      title: 'Кодексийн бүтэц',
      lede: 'Зургаан бүлэгт хуваагдсан түүхэн дүрүүд — домогт өвгөдөөс орчин цагийн баатрууд хүртэл.',
      list: [
        { num: 'I', title: 'Хаад', count: '13 дүр', desc: 'Чингисээс Богд хүртэл — Их Монголын ширээний өв.' },
        { num: 'II', title: 'Хатад', count: '10 дүр', desc: 'Бөртэгээс Мандухай хүртэл — ширээний цаадахь хүчирхэг хатад.' },
        { num: 'III', title: 'Жанжид', count: '12 дүр', desc: 'Сүбээдэйгээс Сүхбаатар хүртэл — байлдан дагуулагчид.' },
        { num: 'IV', title: 'Зөвлөхүүд', count: '9 дүр', desc: 'Елүй Чуцайгаас Цэдэнбал хүртэл — улсыг бичиж босгогчид.' },
        { num: 'V', title: 'Соёл', count: '5 дүр', desc: 'Бичээч, уран барималч, лама — Монголын оюун санааг тээгчид.' },
        { num: 'VI', title: 'Орчин үе', count: '3 дүр', desc: 'XX зууны баатрууд — тусгаар тогтнолын тэмцэл.' },
      ],
      open: 'Бүлэг нээх',
    },
    map: {
      chip: 'Газар нутаг',
      title: 'Эзэнт гүрэн зурагтаа',
      desc: 'Хархорумаас Багдад, Будапештээс Дайду хүртэл — байлдааны замнал, ноёрхлын хил.',
      cta: 'Зураг үзэх',
    },
    timeline: {
      chip: 'Цаг хугацаа',
      title: 'Кодекс цагийн шугаман дээр',
      lede: '52 түүхэн дүрийг үе хоорондын хамаарал, ноёрхлын тэлэлтээр цогцолсон харах.',
    },
    nav_admin: 'Удирдлага',
    foot: { rights: 'Алтан Домог · Codex I · Ulaanbaatar' },
  },
  en: {
    nav: { figures: 'Figures', team: 'My team', engagements: 'Play', chapters: 'Chapters', classic: 'Classic', scan: 'Scan card (AR)', guests: 'Guests' },
    hero: {
      kicker: 'Codex I',
      title1: 'The face of',
      title2: 'Altan Domog',
      lede: '52 lives, 52 voices — one code. Scan a card and meet a figure, or wake the codex below.',
      cta: 'Scan a card',
      ctaAlt: 'All 52 figures',
    },
    team: {
      chip: 'My team',
      empty: 'Build your team. Pick the figures you want to keep close — they’ll live here.',
      build: 'Build a team',
      addMore: 'Add more',
    },
    explore: {
      chip: 'The codex',
      title: 'Who are you meeting today?',
      lede: 'Khans, queens, generals, advisors, cultural figures — pick a few to start with.',
      all: 'See all 52',
      view2D: '🃏 2D',
      view3D: '🎴 3D',
      viewLabel: 'View mode',
      searchPlaceholder: 'Search by name, role, or biography…',
      catLabel: 'Group',
      eraLabel: 'Era',
      allLabel: 'All',
      results: 'results',
      featuredHint: 'curated 8',
      empty: 'No matches. Try a different search term.',
    },
    engagements: {
      chip: 'Play',
      title: 'Engage with the codex',
      cards: [
        { kicker: 'Solo', title: 'Whose words?', sub: 'Read the quote, pick the figure. Your score lands on the leaderboard.' },
        { kicker: 'Party', title: 'Live rooms', sub: '2–8 players, shared timer, one quote at a time. Host or join with a code.' },
        { kicker: 'Rankings', title: 'Leaderboard', sub: 'Weekly and all-time scores across every quote round and duel.' },
        { kicker: 'Listen', title: 'Story Tour', sub: 'Walk the codex end to end with narration playing automatically.' },
      ],
    },
    chapters: {
      chip: 'Chapters',
      title: 'How the codex is laid out',
      lede: 'Six chapters of figures — from mythic ancestors to the heroes of the modern republic.',
      list: [
        { num: 'I', title: 'Khans', count: '13 figures', desc: 'From Genghis to the last Bogd — the throne of the Great Mongol state.' },
        { num: 'II', title: 'Queens', count: '10 figures', desc: 'From Borte to Mandukhai — the power behind and on the throne.' },
        { num: 'III', title: 'Warriors', count: '12 figures', desc: 'From Subedei to Sukhbaatar — the conquerors and defenders.' },
        { num: 'IV', title: 'Advisors', count: '9 figures', desc: 'From Yelü Chucai to Tsedenbal — the writers of the state.' },
        { num: 'V', title: 'Culture', count: '5 figures', desc: 'Scribes, sculptors, lamas — the carriers of the Mongol mind.' },
        { num: 'VI', title: 'Modern', count: '3 figures', desc: 'Twentieth-century heroes of the independence struggle.' },
      ],
      open: 'Open chapter',
    },
    map: {
      chip: 'Geography',
      title: 'The empire on a map',
      desc: 'From Karakorum to Baghdad, Budapest to Dadu — the campaigns and the borders of dominion.',
      cta: 'Open the map',
    },
    timeline: {
      chip: 'Timeline',
      title: 'The codex on a timeline',
      lede: 'See all 52 figures placed against each other and against the rise and ebb of imperial reach.',
    },
    nav_admin: 'Admin',
    foot: { rights: 'Altan Domog · Codex I · Ulaanbaatar' },
  },
};

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
        transform: visible ? 'translateY(0)' : 'translateY(14px)',
        transition: `opacity 700ms ease ${delay}ms, transform 700ms ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

function Chip({ children, tone = 'neutral' }) {
  const palettes = {
    neutral: { bg: tokens.surfaceMuted, fg: tokens.inkSoft, bd: tokens.border },
    brand: { bg: tokens.brandSoft, fg: tokens.brandOnSoft, bd: tokens.borderStrong },
    dark: { bg: 'rgba(212,168,67,0.06)', fg: tokens.ink, bd: tokens.border },
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

function PrimaryButton({ to, href, onClick, children, ...rest }) {
  const Tag = to ? Link : 'a';
  const linkProps = to ? { to } : { href: href || '#' };
  return (
    <Tag
      {...linkProps}
      onClick={onClick}
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
        cursor: 'pointer',
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

function GhostButton({ to, href, onClick, children, ...rest }) {
  const Tag = to ? Link : 'a';
  const linkProps = to ? { to } : { href: href || '#' };
  return (
    <Tag
      {...linkProps}
      onClick={onClick}
      {...rest}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '11px 20px',
        borderRadius: 14,
        background: 'transparent',
        color: tokens.ink,
        fontWeight: 600,
        fontSize: 14.5,
        letterSpacing: 0.1,
        textDecoration: 'none',
        cursor: 'pointer',
        border: `1px solid ${tokens.borderStrong}`,
        transition: 'background 180ms ease, transform 180ms ease, border-color 180ms ease',
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
      {children}
    </Tag>
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

function NavBar({ c, isAdmin = false, showGuests = false, onOpenAdmin }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const links = [
    { label: c.nav.figures, href: '#explore' },
    { label: c.nav.team, href: '#team' },
    { label: c.nav.engagements, href: '#engagements' },
    { label: c.nav.chapters, href: '#chapters' },
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
          maxWidth: 1280,
          margin: '0 auto',
          padding: '14px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <Link to="/v2/app" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
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
          {isAdmin && (
            <button
              type="button"
              onClick={onOpenAdmin}
              aria-label={c.nav_admin}
              className="hidden-on-mobile"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                borderRadius: 14,
                background: 'transparent',
                color: tokens.brand,
                border: `1px solid ${tokens.borderStrong}`,
                fontSize: 13.5,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background 160ms ease, border-color 160ms ease',
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
              <Wrench size={14} /> {c.nav_admin}
            </button>
          )}
          {showGuests && (
            <GhostButton to="/profile/guests" className="hidden-on-mobile" aria-label={c.nav.guests}>
              <Users size={14} style={{ marginRight: 6 }} />
              <span style={{ fontSize: 13.5 }}>{c.nav.guests}</span>
            </GhostButton>
          )}
          <GhostButton to="/v1/app" className="hidden-on-mobile">
            <span style={{ fontSize: 13.5 }}>{c.nav.classic}</span>
          </GhostButton>
          <PrimaryButton to="/ar">
            <ScanLine size={16} /> {c.nav.scan}
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
        background: tokens.bg,
        borderBottom: `1px solid ${tokens.border}`,
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: '48px 36px 0',
          display: 'grid',
          gridTemplateColumns: '32% 1fr',
          gap: 36,
          alignItems: 'stretch',
          minHeight: 320,
        }}
        className="hero-grid-app"
      >
        <div style={{ position: 'relative' }}>
          {featured ? (
            <SepiaPortrait
              figure={featured}
              scene={featured.scene}
              aspectRatio={featured.scene ? '16/9' : '3/4'}
              size="100%"
              caption="Featured · ★"
              priority
            />
          ) : null}
        </div>
        <Reveal>
          <div style={{ paddingTop: 8 }}>
            <div
              data-hero="meta-strip"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                marginBottom: 18,
              }}
            >
              <div style={{ width: 32, height: 3, background: tokens.accent, flexShrink: 0 }} />
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  fontFamily: FONT_SANS,
                  fontSize: 10,
                  letterSpacing: 2.5,
                  color: 'rgba(255,255,255,0.66)',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  flexWrap: 'wrap',
                }}
              >
                <span>52 Зүтгэлтэн</span>
                <span style={{ opacity: 0.35 }}>·</span>
                <span>5 Цаг үе</span>
                <span style={{ opacity: 0.35 }}>·</span>
                <span>1206–1924</span>
              </div>
            </div>
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
              Codex I · 52 figures · 3 languages
            </div>
            <h1
              style={{
                marginTop: 14,
                fontFamily: tokens.serif,
                fontSize: 'clamp(2.2rem, 4.4vw, 3.6rem)',
                fontWeight: 600,
                lineHeight: 0.95,
                letterSpacing: -0.3,
                color: tokens.ink,
              }}
            >
              {c.hero.title1}{' '}
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
                marginTop: 14,
                fontFamily: FONT_SANS,
                fontSize: 15,
                lineHeight: 1.55,
                color: 'rgba(255,255,255,0.7)',
                maxWidth: 560,
              }}
            >
              {c.hero.lede}
            </p>
            {quoteOfDay ? (
              <blockquote
                data-hero="quote-of-day"
                style={{
                  marginTop: 22,
                  paddingLeft: 18,
                  borderLeft: `2px solid ${tokens.accent}`,
                  maxWidth: 560,
                  fontFamily: tokens.serif,
                  fontStyle: 'italic',
                  fontWeight: 500,
                  fontSize: 'clamp(1.05rem, 1.6vw, 1.35rem)',
                  lineHeight: 1.35,
                  color: 'rgba(255,255,255,0.92)',
                }}
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
              </blockquote>
            ) : null}
            <div style={{ marginTop: 22, display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
              <Link
                to="/ar"
                style={{
                  background: tokens.accent,
                  color: tokens.bg,
                  padding: '10px 20px',
                  fontFamily: FONT_SANS,
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: 1.5,
                  textTransform: 'uppercase',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <ScanLine size={14} /> {c.hero.cta}
              </Link>
              <Link
                to="/figures"
                style={{
                  color: tokens.ink,
                  fontFamily: FONT_SANS,
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                  textDecoration: 'none',
                  paddingBottom: 4,
                  borderBottom: '1px solid rgba(255,255,255,0.4)',
                }}
              >
                {c.hero.ctaAlt}
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
      {featured ? (
        <div
          data-hero="rotates-caption"
          style={{
            maxWidth: 1280,
            margin: '0 auto',
            padding: '12px 36px',
            marginTop: 32,
            borderTop: '1px solid rgba(255,204,0,0.2)',
            fontFamily: FONT_SANS,
            fontSize: 10,
            letterSpacing: 2,
            color: 'rgba(255,255,255,0.5)',
            textTransform: 'uppercase',
            fontStyle: 'italic',
            display: 'flex',
            justifyContent: 'space-between',
            gap: 14,
            flexWrap: 'wrap',
          }}
        >
          <span>
            {featured.scene ? (
              <>
                <span style={{ color: tokens.accent }}>{featured.scene.title?.en ?? 'Scene'}</span> · {featured.scene.credit} · featuring {featured.name}, {featured.yrs || '—'}
              </>
            ) : (
              <>
                Featured: <span style={{ color: tokens.accent }}>{featured.name}</span> · {featured.yrs || '—'}
              </>
            )}
          </span>
          <span>★ rotates daily</span>
        </div>
      ) : null}
    </section>
  );
}

// FigureTile, PORTRAIT_FALLBACKS, and CategoryIcon now live in @/components/FigureTileV2
// (re-exported for shared use across Figures and Collection pages).

function MyTeamStrip({ c, figures, onFigureClick }) {
  const { team } = useMyTeam();
  const teamFigures = useMemo(
    () => team.map((id) => figures.find((f) => f.fig_id === id)).filter(Boolean),
    [team, figures]
  );

  return (
    <section
      id="team"
      style={{ padding: `${SECTION_PADY}px 24px`, background: tokens.surface, borderTop: `1px solid ${tokens.border}` }}
    >
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <Reveal>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              gap: 16,
              marginBottom: 28,
              flexWrap: 'wrap',
            }}
          >
            <div>
              <Chip>
                <Users size={14} /> {c.team.chip}
              </Chip>
              <h2
                style={{
                  marginTop: 14,
                  fontSize: 'clamp(1.6rem, 3.2vw, 2.2rem)',
                  fontWeight: 800,
                  letterSpacing: -0.4,
                  color: tokens.ink,
                }}
              >
                {team.length} / 5
              </h2>
            </div>
            <GhostButton to="/figures">
              {team.length === 0 ? c.team.build : c.team.addMore}
              <Plus size={16} />
            </GhostButton>
          </div>
        </Reveal>

        {team.length === 0 ? (
          <Reveal delay={60}>
            <div
              style={{
                background: tokens.bg,
                border: `1px dashed ${tokens.borderStrong}`,
                borderRadius: 22,
                padding: 32,
                textAlign: 'center',
                color: tokens.body,
                fontSize: 15,
                lineHeight: 1.55,
              }}
            >
              {c.team.empty}
            </div>
          </Reveal>
        ) : (
          <div
            style={{
              display: 'flex',
              gap: 16,
              overflowX: 'auto',
              paddingBottom: 8,
              scrollSnapType: 'x mandatory',
            }}
          >
            {teamFigures.map((figure, i) => (
              <Reveal key={figure.fig_id} delay={i * 60}>
                <div style={{ width: 260, flexShrink: 0, scrollSnapAlign: 'start' }}>
                  <FigureTileV2 figure={figure} owned onClick={() => onFigureClick(figure)} />
                </div>
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function FilterChip({ active, onClick, roman, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: 6,
        padding: '6px 0',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        color: active ? tokens.ink : tokens.body,
        transition: 'color 160ms ease',
        flexShrink: 0,
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.color = tokens.inkSoft;
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.color = tokens.body;
      }}
    >
      <span
        style={{
          fontSize: 10,
          letterSpacing: 2.4,
          fontWeight: 600,
          color: active ? tokens.brand : tokens.hint,
        }}
      >
        {roman}.
      </span>
      <span
        style={{
          fontSize: 13.5,
          fontWeight: active ? 700 : 500,
          letterSpacing: 0.2,
        }}
      >
        {label}
      </span>
      {active && (
        <span
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: -2,
            height: 1,
            background: tokens.brand,
          }}
        />
      )}
    </button>
  );
}

function ExploreFigures({ c, figures, onFigureClick, onToggleCompare, isInCompare, lang }) {
  const [view3D, setView3D] = useState(false);
  const [catFilter, setCatFilter] = useState('all');
  const [eraFilter, setEraFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 200);
    return () => clearTimeout(id);
  }, [search]);

  const filtersActive =
    catFilter !== 'all' || eraFilter !== 'all' || debouncedSearch.length > 0;

  const featured = useMemo(() => {
    const order = ['khans', 'queens', 'warriors', 'political', 'cultural', 'modern'];
    const seen = new Set();
    const picks = [];
    order.forEach((cat) => {
      figures
        .filter((f) => f.cat === cat)
        .slice(0, 2)
        .forEach((f) => {
          if (!seen.has(f.fig_id)) {
            seen.add(f.fig_id);
            picks.push(f);
          }
        });
    });
    return picks.slice(0, 8);
  }, [figures]);

  const filtered = useMemo(() => {
    let list = figures;
    if (catFilter !== 'all') list = list.filter((f) => f.cat === catFilter);
    if (eraFilter !== 'all') list = list.filter((f) => getEra(f) === eraFilter);
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter((f) =>
        ((f.name || '').toLowerCase().includes(q)) ||
        ((f.role || '').toLowerCase().includes(q)) ||
        ((f.bio || '').toLowerCase().includes(q))
      );
    }
    return list;
  }, [figures, catFilter, eraFilter, debouncedSearch]);

  const display = filtersActive ? filtered : featured;

  const toggleOpt = (mode, label) => {
    const active = (mode === '3d') === view3D;
    return (
      <button
        key={mode}
        onClick={() => setView3D(mode === '3d')}
        style={{
          padding: '6px 14px',
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

  const catOpts = [
    { key: 'all', roman: '∑', label: c.explore.allLabel },
    ...Object.entries(CATEGORIES).map(([key, cat]) => ({
      key,
      roman: cat.roman,
      label: lang === 'en' ? cat.label_en : cat.label,
    })),
  ];

  const eraOpts = [
    { key: 'all', roman: '∑', label: c.explore.allLabel },
    ...ERA_KEYS.map((key) => ({
      key,
      roman: ERAS[key].roman,
      label: lang === 'en' ? ERAS[key].label_en : ERAS[key].label,
    })),
  ];

  return (
    <section id="explore" style={{ padding: `${SECTION_PADY}px 24px`, background: tokens.bg }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <Reveal>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              gap: 24,
              marginBottom: 24,
              flexWrap: 'wrap',
            }}
          >
            <div>
              <Chip>{c.explore.chip}</Chip>
              <h2
                style={{
                  marginTop: 14,
                  fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)',
                  color: tokens.ink,
                  fontWeight: 800,
                  letterSpacing: -0.4,
                }}
              >
                {c.explore.title}
              </h2>
              <p
                style={{
                  marginTop: 10,
                  maxWidth: 540,
                  fontSize: 16,
                  lineHeight: 1.6,
                  color: tokens.body,
                }}
              >
                {c.explore.lede}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: 3,
                  borderRadius: 9999,
                  background: tokens.surfaceMuted,
                  border: `1px solid ${tokens.border}`,
                }}
                aria-label={c.explore.viewLabel}
              >
                {toggleOpt('2d', c.explore.view2D)}
                {toggleOpt('3d', c.explore.view3D)}
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
                {c.explore.all} <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </Reveal>

        <Reveal delay={60}>
          <div
            style={{
              borderTop: `1px solid ${tokens.border}`,
              borderBottom: `1px solid ${tokens.border}`,
              padding: '14px 0',
              marginBottom: 28,
            }}
          >
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
              }}
            >
              <div style={{ position: 'relative', minWidth: 220, flex: '0 0 auto' }}>
                <Search
                  size={14}
                  style={{
                    position: 'absolute',
                    left: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: tokens.brand,
                    opacity: 0.7,
                    pointerEvents: 'none',
                  }}
                />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={c.explore.searchPlaceholder}
                  aria-label={c.explore.searchPlaceholder}
                  style={{
                    width: '100%',
                    height: 38,
                    padding: '0 14px 0 34px',
                    borderRadius: 9999,
                    background: tokens.surfaceMuted,
                    border: `1px solid ${tokens.border}`,
                    color: tokens.ink,
                    fontSize: 13.5,
                    fontFamily: FONT_SANS,
                    outline: 'none',
                    transition: 'border-color 160ms ease, background 160ms ease',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = tokens.brand;
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = tokens.border;
                  }}
                />
              </div>

              <div
                className="filter-row"
                style={{
                  display: 'flex',
                  gap: 18,
                  alignItems: 'baseline',
                  overflowX: 'auto',
                  flex: '1 1 auto',
                  minWidth: 0,
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    letterSpacing: 2.4,
                    textTransform: 'uppercase',
                    color: tokens.hint,
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  {c.explore.catLabel}
                </span>
                {catOpts.map((opt) => (
                  <FilterChip
                    key={opt.key}
                    active={catFilter === opt.key}
                    onClick={() => setCatFilter(opt.key)}
                    roman={opt.roman}
                    label={opt.label}
                  />
                ))}
              </div>
            </div>

            <div
              className="filter-row"
              style={{
                marginTop: 10,
                paddingTop: 10,
                borderTop: `1px dashed ${tokens.border}`,
                display: 'flex',
                gap: 18,
                alignItems: 'baseline',
                overflowX: 'auto',
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  letterSpacing: 2.4,
                  textTransform: 'uppercase',
                  color: tokens.hint,
                  fontWeight: 600,
                  flexShrink: 0,
                }}
              >
                {c.explore.eraLabel}
              </span>
              {eraOpts.map((opt) => (
                <FilterChip
                  key={opt.key}
                  active={eraFilter === opt.key}
                  onClick={() => setEraFilter(opt.key)}
                  roman={opt.roman}
                  label={opt.label}
                />
              ))}
            </div>

            <p
              style={{
                marginTop: 10,
                fontSize: 11,
                letterSpacing: 1.6,
                textTransform: 'uppercase',
                color: tokens.hint,
                fontWeight: 600,
              }}
            >
              <span style={{ color: tokens.ink }}>
                {String(display.length).padStart(2, '0')}
              </span>
              {' / '}
              {figures.length} {c.explore.results}
              {!filtersActive && (
                <span style={{ marginLeft: 12, color: tokens.brand }}>
                  · {c.explore.featuredHint}
                </span>
              )}
            </p>
          </div>
        </Reveal>

        {display.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '64px 24px',
              color: tokens.body,
              fontSize: 15,
              lineHeight: 1.6,
              background: tokens.surface,
              border: `1px dashed ${tokens.border}`,
              borderRadius: 22,
            }}
          >
            {c.explore.empty}
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 22,
            }}
          >
            {display.map((f, i) => (
              <Reveal key={f.fig_id} delay={Math.min(i * 30, 480)}>
                {view3D ? (
                  <Card3D figure={f} onClick={() => onFigureClick(f)} index={i} />
                ) : (
                  <FigureTileV2
                    figure={f}
                    onClick={() => onFigureClick(f)}
                    onToggleCompare={onToggleCompare}
                    isInCompare={isInCompare?.(f.fig_id)}
                  />
                )}
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

const ENGAGEMENT_ICONS = [QuoteIcon, Users, Trophy, Volume2];
const ENGAGEMENT_ROUTES = ['/games/quotes', '/games/quotes/live', '/leaderboard', '/tour'];

function Engagements({ c }) {
  return (
    <section
      id="engagements"
      style={{ padding: `${SECTION_PADY}px 24px`, background: tokens.surface, borderTop: `1px solid ${tokens.border}` }}
    >
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <Reveal>
          <div style={{ marginBottom: 32 }}>
            <Chip>{c.engagements.chip}</Chip>
            <h2
              style={{
                marginTop: 14,
                fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)',
                color: tokens.ink,
                fontWeight: 800,
                letterSpacing: -0.4,
              }}
            >
              {c.engagements.title}
            </h2>
          </div>
        </Reveal>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 18,
          }}
        >
          {c.engagements.cards.map((card, i) => {
            const Icon = ENGAGEMENT_ICONS[i] || QuoteIcon;
            const to = ENGAGEMENT_ROUTES[i] || '/';
            return (
              <Reveal key={card.title} delay={i * 60}>
                <Link
                  to={to}
                  style={{
                    display: 'block',
                    textDecoration: 'none',
                    background: tokens.bg,
                    border: `1px solid ${tokens.border}`,
                    borderRadius: 22,
                    padding: 24,
                    transition: 'transform 200ms ease, box-shadow 200ms ease, border-color 200ms ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 18px 40px -22px rgba(15,23,42,0.18)';
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
                    {card.kicker}
                  </div>
                  <h3
                    style={{
                      marginTop: 6,
                      fontSize: 19,
                      fontWeight: 700,
                      color: tokens.ink,
                    }}
                  >
                    {card.title}
                  </h3>
                  <p
                    style={{
                      marginTop: 8,
                      fontSize: 14.5,
                      lineHeight: 1.55,
                      color: tokens.body,
                    }}
                  >
                    {card.sub}
                  </p>
                  <div
                    style={{
                      marginTop: 18,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      color: tokens.ink,
                      fontSize: 13.5,
                      fontWeight: 600,
                    }}
                  >
                    <ArrowRight size={14} />
                  </div>
                </Link>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Chapters({ c }) {
  return (
    <section id="chapters" style={{ padding: `${SECTION_PADY}px 24px`, background: tokens.bg }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <Reveal>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <Chip>{c.chapters.chip}</Chip>
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
              {c.chapters.title}
            </h2>
            <p
              style={{
                marginTop: 14,
                maxWidth: 600,
                margin: '14px auto 0',
                color: tokens.body,
                fontSize: 17,
                lineHeight: 1.6,
              }}
            >
              {c.chapters.lede}
            </p>
          </div>
        </Reveal>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 18,
          }}
        >
          {c.chapters.list.map((ch, i) => (
            <Reveal key={ch.num} delay={i * 50}>
              <Link
                to={`/story/${i + 1}`}
                style={{
                  display: 'block',
                  textDecoration: 'none',
                  background: tokens.surface,
                  border: `1px solid ${tokens.border}`,
                  borderRadius: 22,
                  padding: 24,
                  height: '100%',
                  transition: 'transform 200ms ease, box-shadow 200ms ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 18px 40px -22px rgba(15,23,42,0.18)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    marginBottom: 14,
                  }}
                >
                  <span
                    style={{
                            fontSize: 36,
                      fontWeight: 600,
                      letterSpacing: -1,
                      color: tokens.brand,
                      lineHeight: 1,
                    }}
                  >
                    {ch.num}
                  </span>
                  <span style={{ color: tokens.hint, fontSize: 12, fontWeight: 600, letterSpacing: 0.6 }}>
                    {ch.count}
                  </span>
                </div>
                <h3 style={{ fontSize: 22, fontWeight: 700, color: tokens.ink, letterSpacing: -0.2 }}>
                  {ch.title}
                </h3>
                <p style={{ marginTop: 10, fontSize: 14.5, lineHeight: 1.55, color: tokens.body }}>
                  {ch.desc}
                </p>
                <div
                  style={{
                    marginTop: 16,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    color: tokens.ink,
                    fontSize: 13.5,
                    fontWeight: 600,
                  }}
                >
                  {c.chapters.open} <ArrowRight size={14} />
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function MapBand({ c }) {
  return (
    <section style={{ padding: `${SECTION_PADY}px 24px`, background: tokens.surface, borderTop: `1px solid ${tokens.border}` }}>
      <div
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          background: tokens.surfaceMuted,
          color: tokens.ink,
          borderRadius: 28,
          padding: 'clamp(28px, 5vw, 48px)',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)',
          gap: 32,
          alignItems: 'center',
        }}
        className="map-band"
      >
        <div>
          <Chip tone="brand">
            <MapIcon size={14} /> {c.map.chip}
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
            {c.map.title}
          </h3>
          <p style={{ marginTop: 12, color: tokens.body, fontSize: 16, lineHeight: 1.55 }}>
            {c.map.desc}
          </p>
          <div style={{ marginTop: 22 }}>
            <Link
              to="/app#map"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '12px 20px',
                borderRadius: 16,
                background: tokens.brand,
                color: tokens.bg,
                fontWeight: 700,
                fontSize: 14.5,
                textDecoration: 'none',
              }}
            >
              {c.map.cta} <ArrowRight size={16} />
            </Link>
          </div>
        </div>
        <div
          id="map"
          style={{
            position: 'relative',
            aspectRatio: '4 / 3',
            borderRadius: 16,
            background: tokens.surface,
            border: `1px solid ${tokens.borderStrong}`,
            overflow: 'hidden',
          }}
        >
          <HistoricalMap />
        </div>
      </div>
    </section>
  );
}

function TimelineBand({ c }) {
  return (
    <section
      id="timeline"
      style={{ padding: `${SECTION_PADY}px 24px`, background: tokens.bg, borderTop: `1px solid ${tokens.border}` }}
    >
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <Reveal>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 9999,
                background: tokens.brandSoft,
                color: tokens.brandOnSoft,
                border: `1px solid ${tokens.borderStrong}`,
                fontSize: 12.5,
                fontWeight: 600,
                letterSpacing: 0.4,
              }}
            >
              <Clock size={14} /> {c.timeline.chip}
            </span>
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
              {c.timeline.title}
            </h2>
            <p
              style={{
                marginTop: 14,
                maxWidth: 600,
                margin: '14px auto 0',
                color: tokens.body,
                fontSize: 17,
                lineHeight: 1.6,
              }}
            >
              {c.timeline.lede}
            </p>
          </div>
        </Reveal>
        <div
          style={{
            background: tokens.surface,
            border: `1px solid ${tokens.border}`,
            borderRadius: 22,
            overflow: 'hidden',
          }}
        >
          <TimelineSection />
        </div>
      </div>
    </section>
  );
}

function Foot({ c }) {
  return (
    <footer style={{ padding: '36px 24px 48px', background: tokens.bg, borderTop: `1px solid ${tokens.border}` }}>
      <div
        style={{
          maxWidth: 1280,
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
          <span style={{ color: tokens.ink, fontWeight: 600, fontSize: 14.5 }}>{c.foot.rights}</span>
        </div>
        <div style={{ color: tokens.hint, fontSize: 13, letterSpacing: 0.4 }}>© MMXXVI</div>
      </div>
    </footer>
  );
}

export default function HomeV2() {
  const { lang } = useLang();
  const c = COPY[lang] || COPY.mn;
  const location = useLocation();
  const [figures, setFigures] = useState(FIGURES);
  const [selectedFigure, setSelectedFigure] = useState(null);
  const [chatQuestion, setChatQuestion] = useState(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const { isInTeam, toggleTeam } = useMyTeam();
  const { compareList, toggleCompare, isInCompare, removeFromCompare, clearCompare } = useCompare();
  const { settings } = useAppSettings();

  const { data: dbFigures } = useQuery({
    queryKey: ['figures'],
    queryFn: () => base44.entities.Figure.list('-fig_id', 100),
    initialData: [],
  });

  useEffect(() => {
    if (dbFigures && dbFigures.length > 0) {
      const merged = FIGURES.map((defaultFig) => {
        const dbFig = dbFigures.find((d) => d.fig_id === defaultFig.fig_id);
        if (!dbFig) return defaultFig;
        const overrides = Object.fromEntries(
          Object.entries(dbFig).filter(([, v]) => v != null)
        );
        return { ...defaultFig, ...overrides };
      });
      dbFigures.forEach((dbFig) => {
        if (!merged.find((m) => m.fig_id === dbFig.fig_id)) merged.push(dbFig);
      });
      merged.sort((a, b) => a.fig_id - b.fig_id);
      setFigures(merged);
    }
  }, [dbFigures]);

  // Admin panel opens via Navbar event (legacy contract — keep listening so older
  // admin-trigger surfaces still work when they redirect to /app).
  useEffect(() => {
    const open = () => setShowAdmin(true);
    window.addEventListener('open-admin-panel', open);
    return () => window.removeEventListener('open-admin-panel', open);
  }, []);

  // Scroll-to-section when returning from a detail page (replicates legacy Home behavior).
  useEffect(() => {
    if (location.state?.scrollTo) {
      const id = location.state.scrollTo;
      setTimeout(() => {
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [location.state]);

  const openModal = useCallback((figure) => setSelectedFigure(figure), []);
  const askAI = useCallback((figure) => {
    setSelectedFigure(null);
    const phrase = lang === 'en'
      ? `Tell me more about ${figure.name}`
      : `${figure.name}-ын тухай дэлгэрэнгүй ярина уу`;
    setChatQuestion(phrase);
  }, [lang]);

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
      <ScrollProgress />
      <NavBar
        c={c}
        isAdmin={!!settings?.is_admin}
        showGuests={!isGuest()}
        onOpenAdmin={() => setShowAdmin(true)}
      />
      <Hero c={c} />
      <MyTeamStrip c={c} figures={figures} onFigureClick={openModal} />
      <ExploreFigures
        c={c}
        lang={lang}
        figures={figures}
        onFigureClick={openModal}
        onToggleCompare={(f) => toggleCompare(f.fig_id)}
        isInCompare={isInCompare}
      />
      <Engagements c={c} />
      <Chapters c={c} />
      <TimelineBand c={c} />
      <MapBand c={c} />
      <Foot c={c} />

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

      <CompareBar
        figures={figures}
        compareList={compareList}
        onRemove={removeFromCompare}
        onClear={clearCompare}
        onOpenCompare={() => setShowCompare(true)}
      />

      {showCompare && (
        <CompareModal
          figures={figures}
          compareList={compareList}
          onClose={() => setShowCompare(false)}
        />
      )}

      <ChatFAB initialQuestion={chatQuestion} onOpenModal={openModal} />

      {showAdmin && (
        <ErrorBoundary
          fallbackKey="toast.admin.crash"
          fallback={({ retry }) => {
            // Defensive: an ErrorBoundary catch may pre-empt the panel's own
            // body-overflow cleanup if React skips the unmount commit.
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

      <style>{`
        @media (max-width: 880px) {
          .hidden-on-mobile { display: none !important; }
          .map-band { grid-template-columns: 1fr !important; }
          .hero-grid-app { grid-template-columns: 1fr !important; gap: 24px !important; padding: 32px 24px 0 !important; }
        }
      `}</style>
    </div>
  );
}
