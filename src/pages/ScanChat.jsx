import { useState, useRef, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Send, Volume2, X, ArrowLeft } from 'lucide-react';
import { FIGURES } from '@/lib/figuresData';
import { useFigureChat } from '@/hooks/useFigureChat';
import { useFigureVoices } from '@/hooks/useVoices';
import { useOwnedFigures } from '@/hooks/useOwnedFigures';
import { currentSession } from '@/lib/authStore';
import { supabase } from '@/lib/supabase';
import ScanNotFound from '@/components/ScanNotFound';
import { ErrorBoundary } from '@/lib/feedback';

const LANG_LABELS = [
  { code: 'mn', label: 'Монгол' },
  { code: 'en', label: 'English' },
  { code: 'cn', label: '中文' },
];

const LANG_ARIA = {
  mn: { mn: 'Монгол хэл рүү шилжих', en: 'Switch to Mongolian', cn: '切换到蒙古语' },
  en: { mn: 'Англи хэл рүү шилжих',   en: 'Switch to English',   cn: '切换到英语' },
  cn: { mn: 'Хятад хэл рүү шилжих',   en: 'Switch to Chinese',   cn: '切换到中文' },
};

const AI_THINKING = { mn: 'AI бодож байна…', en: 'AI is thinking…', cn: 'AI 思考中…' };

const SIGN_UP_BANNER = {
  mn: { body: 'Яриаг хадгалаад түүх, төхөөрөмжүүд хооронд харж болно.', cta: 'Бүртгэл үүсгэх' },
  en: { body: 'Sign up to save chats — keep your history across devices.', cta: 'Sign up' },
  cn: { body: '注册以保存对话历史并跨设备同步。', cta: '注册' },
};

const DISMISS_LABELS = { mn: 'Хаах', en: 'Dismiss', cn: '关闭' };

export default function ScanChat() {
  const { figId } = useParams();
  const figure = FIGURES.find((f) => String(f.fig_id) === String(figId));

  if (!figure) return <ScanNotFound />;

  return <ScanChatInner figure={figure} />;
}

function ScanChatInner({ figure }) {
  const navigate = useNavigate();

  const session = currentSession();
  const userId = session?.account_id ?? null;
  const { figIds } = useOwnedFigures(userId);
  const owned = figIds.includes(figure.fig_id);
  const [claimed, setClaimed] = useState(false);
  const claimAttempted = useRef(false);

  useEffect(() => {
    if (!userId || owned || claimAttempted.current) return;
    claimAttempted.current = true;
    supabase.functions.invoke('claim-card', { body: { fig_id: figure.fig_id } })
      .then(({ data, error }) => {
        if (!error && data?.ok && data.owned) setClaimed(true);
      })
      .catch((err) => console.warn('claim-card failed', err));
  }, [userId, owned, figure.fig_id]);

  const isOwnedForChat = owned || claimed;

  const { messages, lang, busy, send, switchLang } = useFigureChat(figure, { userId, owned: isOwnedForChat });
  const { voiceIdForLang } = useFigureVoices(figure.fig_id);
  const [input, setInput] = useState('');
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const scrollRef = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, busy]);

  const handleSend = (e) => {
    e.preventDefault();
    send(input);
    setInput('');
  };

  return (
    <div className="min-h-screen flex flex-col bg-ink">
      <header className="flex-shrink-0 px-4 py-3 flex items-center gap-3 border-b border-brass/25 bg-ink/90">
        <button
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
          className="w-8 h-8 flex items-center justify-center text-brass/80 hover:text-ivory transition-colors"
          aria-label="Back"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 border border-brass bg-brass/10">
          <span className="text-xl">{figure.ico}</span>
        </div>
        <div className="min-w-0">
          <div className="font-display text-base text-ivory truncate">{figure.name}</div>
          <div className="font-meta text-[10px] tracking-[0.2em] uppercase text-brass/80">
            {figure.yrs} · AI · Онлайн
          </div>
        </div>
        <div className="ml-auto flex gap-1">
          {LANG_LABELS.map(({ code, label }) => (
            <button
              key={code}
              onClick={() => switchLang(code)}
              aria-label={LANG_ARIA[code]?.[lang] || LANG_ARIA[code]?.en || label}
              className={`rounded-full px-2.5 py-1 font-meta text-[10px] tracking-[0.12em] border transition ${
                lang === code
                  ? 'bg-brass text-ink border-brass'
                  : 'bg-transparent text-ivory border-brass/40'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        <ErrorBoundary fallbackKey="toast.scan.aiFailed">
          {messages.map((m, i) => (
            <MessageBubble key={i} message={m} voiceIdForLang={voiceIdForLang} />
          ))}
          {busy && (
            <div className="flex items-center gap-3">
              <TypingIndicator />
              <span className="font-meta text-[10px] tracking-[0.2em] uppercase text-brass/70">
                {AI_THINKING[lang] || AI_THINKING.en}
              </span>
            </div>
          )}
          <div ref={bottomRef} />
        </ErrorBoundary>
      </div>

      {!bannerDismissed && (
        <div className="flex-shrink-0 flex items-center gap-3 px-4 py-2 text-xs font-prose italic border-t border-brass/20 bg-brass/5 text-ivory">
          <span className="flex-1">
            {(SIGN_UP_BANNER[lang] || SIGN_UP_BANNER.en).body}{' '}
            <Link to="/otp?next=/collection" className="underline text-brass">
              {(SIGN_UP_BANNER[lang] || SIGN_UP_BANNER.en).cta}
            </Link>
          </span>
          <button onClick={() => setBannerDismissed(true)} aria-label={DISMISS_LABELS[lang] || DISMISS_LABELS.en}>
            <X className="w-4 h-4 text-ivory/60" />
          </button>
        </div>
      )}

      <form
        onSubmit={handleSend}
        className="flex-shrink-0 px-3 py-3 flex gap-2 items-end border-t border-brass/25 bg-ink/95"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            lang === 'mn' ? 'Асуултаа бичнэ үү…' : lang === 'en' ? 'Ask me anything…' : '向我提问…'
          }
          className="flex-1 bg-transparent font-prose text-base text-ivory outline-none px-3 py-2 rounded-full border border-brass/35"
          disabled={busy}
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="w-11 h-11 rounded-full flex items-center justify-center disabled:opacity-40 bg-brass text-ink"
          aria-label="Илгээх"
        >
          <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}

function MessageBubble({ message, voiceIdForLang }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`rounded-2xl px-4 py-2.5 max-w-[80%] font-prose text-base leading-relaxed whitespace-pre-wrap text-ivory border ${
          isUser ? 'bg-brass/15 border-brass/35' : 'bg-ink/80 border-brass/15'
        }`}
      >
        {message.text}
        {!isUser && (
          <button
            className="ml-2 inline-flex align-middle opacity-70 hover:opacity-100"
            aria-label="Дуугаар сонсох"
            onClick={() => speakClient(message.text, message.lang, voiceIdForLang?.(message.lang))}
          >
            <Volume2 className="w-4 h-4 text-brass" />
          </button>
        )}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="rounded-2xl px-4 py-3 flex gap-1.5 bg-ink/80 border border-brass/15">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-brass"
            style={{ animation: `typeBounce 1.2s ${i * 0.18}s infinite` }}
          />
        ))}
      </div>
      <style>{`
        @keyframes typeBounce { 0%,100% { transform: translateY(0); opacity:.4 } 50% { transform: translateY(-4px); opacity:1 } }
      `}</style>
    </div>
  );
}

async function speakClient(text, lang, voiceId) {
  try {
    const { supabase } = await import('@/lib/supabase');
    const body = { text, lang };
    if (voiceId) body.voice_id = voiceId;
    const { data, error } = await supabase.functions.invoke('speak', { body });
    if (!error && data?.ok && data.url) {
      const audio = new Audio(data.url);
      audio.play().catch(() => speakWithWebSpeech(text, lang));
      return;
    }
  } catch { /* fall through */ }
  speakWithWebSpeech(text, lang);
}

function speakWithWebSpeech(text, lang) {
  if (!('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = { mn: 'mn-MN', en: 'en-US', cn: 'zh-CN' }[lang] ?? 'mn-MN';
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}
