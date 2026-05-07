import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, Users } from 'lucide-react';
import GuestSlotsPanel from '@/components/GuestSlotsPanel';
import { isGuest } from '@/lib/authStore';
import { useLang } from '@/lib/i18n';

const COPY = {
  mn: {
    back: 'Буцах',
    chip: 'Профайл',
    title: 'Зочин дансууд',
    lede: 'Найз, ах дүү, гэр бүлийнхэндээ түр зочны эрх олго. Тус бүр нь өөрийн ахицтай, харин чиний дансанд XP нь нэгдэнэ. Зочин нь танаас нөхцөл бус 15 минут идэвхтэй холбоос авч нэвтэрнэ.',
    rules: ['5 хүртэлх зэрэгцээ слот', '15 минутын насжилттай холбоос', 'Цуцлахад зочны хандалт тэр даруй унтарна'],
  },
  en: {
    back: 'Back',
    chip: 'Profile',
    title: 'Guest accounts',
    lede: 'Hand a temporary guest seat to a friend, sibling, or family member. Each guest keeps their own progress while their XP rolls up to your account. Invite links are time-boxed to 15 minutes.',
    rules: ['Up to 5 concurrent slots', 'Invite links expire after 15 minutes', 'Revoking a slot kicks the guest immediately'],
  },
};

const tokens = {
  bg: '#0a0c14',
  surface: '#11141F',
  border: 'rgba(212,168,67,0.18)',
  borderStrong: 'rgba(212,168,67,0.42)',
  ink: '#EDE8D5',
  inkSoft: '#C9C0A8',
  body: '#A89F8A',
  brand: '#D4A843',
  brandSoft: 'rgba(212,168,67,0.12)',
  serif: '"Fraunces", "Source Serif 4", "EB Garamond", Georgia, serif',
};

const FONT_SANS =
  '"Inter Tight", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

export default function ProfileGuestsPage() {
  if (isGuest()) return <Navigate to="/" replace />;

  const { lang } = useLang();
  const navigate = useNavigate();
  const c = COPY[lang === 'en' ? 'en' : 'mn'];

  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/app');
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: tokens.bg,
        color: tokens.ink,
        fontFamily: FONT_SANS,
        WebkitFontSmoothing: 'antialiased',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Decorative parchment glow + grid */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse 70% 50% at 20% 0%, rgba(212,168,67,0.10) 0%, transparent 60%), ' +
            'radial-gradient(ellipse 60% 50% at 100% 100%, rgba(205,127,50,0.08) 0%, transparent 60%)',
          pointerEvents: 'none',
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(212,168,67,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(212,168,67,0.03) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage: 'radial-gradient(ellipse 80% 70% at 50% 0%, black 0%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 70% at 50% 0%, black 0%, transparent 80%)',
          pointerEvents: 'none',
        }}
      />

      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 5,
          background: 'rgba(10,12,20,0.85)',
          backdropFilter: 'blur(8px)',
          borderBottom: `1px solid ${tokens.border}`,
        }}
      >
        <div
          style={{
            maxWidth: 880,
            margin: '0 auto',
            padding: '14px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <button
            type="button"
            onClick={goBack}
            aria-label={c.back}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              borderRadius: 12,
              background: 'transparent',
              color: tokens.inkSoft,
              border: `1px solid ${tokens.border}`,
              fontSize: 13.5,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'background 160ms ease, border-color 160ms ease, color 160ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = tokens.brandSoft;
              e.currentTarget.style.borderColor = tokens.borderStrong;
              e.currentTarget.style.color = tokens.ink;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.borderColor = tokens.border;
              e.currentTarget.style.color = tokens.inkSoft;
            }}
          >
            <ArrowLeft size={14} /> {c.back}
          </button>
          <Link
            to="/app"
            style={{ marginLeft: 'auto', color: tokens.body, fontSize: 13.5, textDecoration: 'none' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = tokens.ink)}
            onMouseLeave={(e) => (e.currentTarget.style.color = tokens.body)}
          >
            Altan Domog
          </Link>
        </div>
      </header>

      <main
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: 880,
          margin: '0 auto',
          padding: '40px 24px 64px',
        }}
      >
        <section style={{ marginBottom: 28 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 9999,
              background: tokens.brandSoft,
              color: '#F2D88A',
              border: `1px solid ${tokens.borderStrong}`,
              fontSize: 12,
              fontWeight: 500,
              letterSpacing: 0.4,
            }}
          >
            <Users size={12} /> {c.chip}
          </span>
          <h1
            style={{
              margin: '14px 0 12px',
              fontFamily: tokens.serif,
              fontSize: 42,
              lineHeight: 1.05,
              letterSpacing: '-0.02em',
              color: tokens.ink,
            }}
          >
            {c.title}
          </h1>
          <p
            style={{
              margin: 0,
              maxWidth: 620,
              fontSize: 15.5,
              lineHeight: 1.6,
              color: tokens.body,
            }}
          >
            {c.lede}
          </p>
          <ul
            style={{
              margin: '20px 0 0',
              padding: 0,
              listStyle: 'none',
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            {c.rules.map((r) => (
              <li
                key={r}
                style={{
                  padding: '6px 10px',
                  borderRadius: 8,
                  background: tokens.surface,
                  border: `1px solid ${tokens.border}`,
                  color: tokens.inkSoft,
                  fontSize: 12.5,
                }}
              >
                {r}
              </li>
            ))}
          </ul>
        </section>

        <section
          style={{
            background: tokens.surface,
            border: `1px solid ${tokens.border}`,
            borderRadius: 16,
            padding: '24px 28px',
            boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset, 0 24px 60px -24px rgba(0,0,0,0.6)',
          }}
        >
          <GuestSlotsPanel />
        </section>
      </main>
    </div>
  );
}
