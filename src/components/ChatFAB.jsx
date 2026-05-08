import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, X, Send, Trash2, Download, Mic, MicOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { base44 } from '@/api/base44Client';
import { FIGURES } from '@/lib/figuresData';
import { useLang } from '@/lib/i18n';
import { motion, AnimatePresence } from 'framer-motion';
import { useConfirm } from '@/components/ui/use-confirm';

const QUICK_PROMPTS_MN = [
  'Чингис Хааны тухай ярина уу',
  'Монголын хамгийн агуу хатад хэн бэ?',
  'Сүбээдэй жанжны ялалтууд',
  'Монголын эзэнт гүрэн хэрхэн байгуулагдсан бэ?',
  'Занабазарын бүтээлүүдийн тухай',
  'Монголын ардчилсан хувьсгалын тухай',
];

const QUICK_PROMPTS_EN = [
  'Tell me about Genghis Khan',
  'Who was the greatest Khatun of Mongolia?',
  'Subutai’s victories',
  'How was the Mongol Empire founded?',
  'About Zanabazar’s works',
  'The Mongolian Democratic Revolution',
];

function formatMarkdown(text) {
  let html = text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^### (.+)$/gm, '<h4 class="font-cinzel text-gold text-sm font-bold mt-3 mb-1">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 class="font-cinzel text-gold font-bold mt-3 mb-1">$1</h3>')
    .replace(/^# (.+)$/gm, '<h2 class="font-cinzel text-gold text-lg font-bold mt-3 mb-1">$1</h2>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 text-sm">• $1</li>')
    .replace(/\n/g, '<br/>');
  return html;
}

function extractMentionedFigures(text) {
  return FIGURES.filter(f => text.includes(f.name));
}

export default function ChatFAB({ initialQuestion, onOpenModal }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [listening, setListening] = useState(false);
  const { lang } = useLang();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const QUICK_PROMPTS = lang === 'en' ? QUICK_PROMPTS_EN : QUICK_PROMPTS_MN;
  const scrollRef = useRef(null);
  const textareaRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    if (initialQuestion) {
      setOpen(true);
      setInput(initialQuestion);
    }
  }, [initialQuestion]);

  useEffect(() => {
    if (scrollRef.current) {
      const el = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (el) el.scrollTop = el.scrollHeight;
    }
  }, [messages, loading]);

  const sendMessage = useCallback(async (text) => {
    const userMsg = { role: 'user', content: text || input };
    if (!userMsg.content.trim()) return;

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    const systemPrompt = lang === 'en'
      ? `You are "The Mongol Chronicle" — an AI expert on Mongolian history. You know all 52 historical figures in the collection. Reply in English. Mention the figure's full name in your answer. Keep responses short, specific, and interesting.`
      : `Та бол "Монголын Хроник" — Монголын түүхийн мэргэжилтэн AI туслах. Та Монголын 52 түүхэн зүтгэлтний тухай бүх мэдлэгтэй. Монгол хэлээр хариулна уу. Хариултдаа тухайн зүтгэлтний нэрийг бүтнээр нь дурдана уу. Богино, тодорхой, сонирхолтой хариулт өгнө үү.`;

    const apiMessages = newMessages.map(m => ({ role: m.role, content: m.content }));

    try {
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `System: ${systemPrompt}\n\nUser: ${userMsg.content}`,
        response_json_schema: {
          type: 'object',
          properties: {
            answer: { type: 'string', description: 'The answer in Mongolian' },
            followups: { type: 'array', items: { type: 'string' }, description: '2-3 follow-up questions in Mongolian' }
          }
        }
      });

      const aiMsg = {
        role: 'assistant',
        content: response.answer || response,
        followups: response.followups || [],
        figures: extractMentionedFigures(response.answer || (typeof response === 'string' ? response : '')),
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Уучлаарай, алдаа гарлаа. Дахин оролдоно уу.',
        followups: [],
        figures: [],
      }]);
    }
    setLoading(false);
  }, [input, messages]);

  const clearChat = async () => {
    if (messages.length === 0) return;
    const ok = await confirm({
      title: 'Чатыг цэвэрлэх үү?',
      confirmLabel: 'Цэвэрлэх',
      danger: true,
    });
    if (ok) setMessages([]);
  };

  const exportChat = (format) => {
    const text = messages.map(m => `${m.role === 'user' ? 'Та' : 'Хроник'}: ${m.content}`).join('\n\n');
    if (format === 'copy') {
      navigator.clipboard.writeText(text);
      return;
    }
    const blob = new Blob([format === 'json' ? JSON.stringify(messages, null, 2) : text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mhpc-chat.${format === 'json' ? 'json' : format === 'md' ? 'md' : 'txt'}`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExport(false);
  };

  const toggleVoice = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) return;
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SR();
    recognition.lang = 'mn-MN';
    recognition.continuous = false;
    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setInput(prev => prev + transcript);
      setListening(false);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  };

  return (
    <>
      {/* FAB */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-40 w-16 h-16 rounded-full bg-crimson hover:bg-crimson/90 text-white shadow-xl shadow-crimson/30 flex items-center justify-center transition-colors"
      >
        {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </motion.button>

      {/* Chat Window */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-24 right-6 z-40 w-[min(440px,calc(100vw-48px))] h-[min(640px,calc(100vh-140px))] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border bg-card">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-crimson/20 flex items-center justify-center glow-pulse">
                  <span className="text-lg">🏇</span>
                </div>
                <div>
                  <h3 className="font-cinzel text-sm font-bold text-foreground">{lang === 'en' ? 'The Mongol Chronicle' : 'Монголын Хроник'}</h3>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-xs text-muted-foreground font-body">{lang === 'en' ? 'Online' : 'Идэвхтэй'}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowExport(!showExport)}>
                  <Download className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={clearChat}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Export Panel */}
            <AnimatePresence>
              {showExport && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="border-b border-border overflow-hidden"
                >
                  <div className="p-3 flex flex-wrap gap-2">
                    {[['txt', 'TXT'], ['md', 'MD'], ['json', 'JSON'], ['copy', 'Хуулах']].map(([f, l]) => (
                      <Button key={f} variant="outline" size="sm" onClick={() => exportChat(f)} className="text-xs font-body">
                        {l}
                      </Button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Messages */}
            <ScrollArea ref={scrollRef} className="flex-1 p-4">
              {messages.length === 0 ? (
                <div className="space-y-6 py-8">
                  <div className="text-center space-y-3">
                    <span className="text-4xl">🏇</span>
                    <h3 className="font-cinzel text-lg font-bold text-foreground">{lang === 'en' ? 'The Mongol Chronicle' : 'Монголын Хроник'}</h3>
                    <p className="text-sm text-muted-foreground font-body">
                      {lang === 'en' ? 'Ask me about the 52 figures in the collection' : 'Монголын 52 түүхэн зүтгэлтний тухай асуугаарай'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {QUICK_PROMPTS.map((p, i) => (
                      <button
                        key={i}
                        onClick={() => sendMessage(p)}
                        className="px-3 py-2 rounded-full bg-muted hover:bg-muted/80 text-xs font-body text-foreground transition-colors"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((msg, i) => (
                    <div key={i}>
                      <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                            msg.role === 'user'
                              ? 'bg-crimson text-white'
                              : 'bg-muted border-l-2 border-gold'
                          }`}
                        >
                          {msg.role === 'assistant' ? (
                            <div
                              className="text-sm font-body text-foreground [&_strong]:text-gold [&_em]:text-crimson"
                              dangerouslySetInnerHTML={{ __html: formatMarkdown(msg.content) }}
                            />
                          ) : (
                            <p className="text-sm font-body">{msg.content}</p>
                          )}
                          <div className="text-[10px] mt-1 opacity-50">
                            {new Date().toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>

                      {/* Mentioned figures */}
                      {msg.figures?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2 ml-2">
                          {msg.figures.map(f => (
                            <button
                              key={f.fig_id}
                              onClick={() => onOpenModal(f)}
                              className="flex items-center gap-1 px-2 py-1 rounded-full bg-card border border-border text-xs font-body hover:border-gold transition-colors"
                            >
                              <span>{f.ico}</span>
                              <span className="text-foreground">{f.name}</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Follow-ups */}
                      {msg.followups?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2 ml-2">
                          {msg.followups.map((q, qi) => (
                            <button
                              key={qi}
                              onClick={() => sendMessage(q)}
                              className="px-2.5 py-1 rounded-full bg-crimson/10 border border-crimson/20 text-xs font-body text-foreground hover:bg-crimson/20 transition-colors"
                            >
                              {q}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Typing indicator */}
                  {loading && (
                    <div className="flex justify-start">
                      <div className="bg-muted rounded-2xl px-4 py-3 flex items-center gap-2">
                        <div className="flex gap-1">
                          <div className="typing-dot w-2 h-2 rounded-full bg-gold" />
                          <div className="typing-dot w-2 h-2 rounded-full bg-gold" />
                          <div className="typing-dot w-2 h-2 rounded-full bg-gold" />
                        </div>
                        <span className="text-xs text-muted-foreground font-body">{lang === 'en' ? 'Thinking…' : 'Бодож байна…'}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>

            {/* Input */}
            <div className="p-3 border-t border-border bg-card">
              <div className="flex items-end gap-2">
                <div className="flex-1 relative">
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => {
                      setInput(e.target.value);
                      e.target.style.height = 'auto';
                      e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder={lang === 'en' ? 'Type your question…' : 'Асуултаа бичнэ үү...'}
                    className="w-full bg-muted rounded-xl px-4 py-2.5 text-sm font-body text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-crimson/50"
                    rows={1}
                    disabled={loading}
                  />
                  <span className="absolute bottom-1 right-2 text-[10px] text-muted-foreground">{input.length}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-10 w-10 ${listening ? 'text-crimson bg-crimson/10' : ''}`}
                  onClick={toggleVoice}
                >
                  {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </Button>
                <Button
                  size="icon"
                  className="h-10 w-10 bg-crimson hover:bg-crimson/90 text-white"
                  onClick={() => sendMessage()}
                  disabled={loading || !input.trim()}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {confirmDialog}
    </>
  );
}