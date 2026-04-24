import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, RefreshCw, Trophy, Loader2, Lightbulb, BookMarked } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { useCollection } from '@/hooks/useCollection';
import { ERAS, getEra } from '@/lib/figuresData';
import { useLang, figureName } from '@/lib/i18n';

function generateQuestionsFromFigure(figure, lang = 'mn') {
  const name = (lang === 'en' ? figureName(figure, 'en') : figure.name);
  const isEn = lang === 'en';
  const questions = [];

  // Years question — birth year
  if (figure.yrs) {
    const match = figure.yrs.match(/(\d{3,4})/);
    if (match) {
      const born = match[1];
      const birthYear = parseInt(born);
      const wrongs = [birthYear - 17, birthYear + 23, birthYear - 38].map(y => `${y}`);
      questions.push({
        q: isEn ? `In what year was ${name} born?` : `${name} хэдэн онд төрсөн бэ?`,
        correct: born,
        options: shuffle([born, ...wrongs.slice(0, 3)]),
      });
    }
  }

  // Years question — death year
  if (figure.yrs) {
    const matches = figure.yrs.match(/(\d{3,4}).+?(\d{3,4})/);
    if (matches) {
      const died = matches[2];
      const diedYear = parseInt(died);
      const wrongs = [diedYear - 13, diedYear + 19, diedYear + 45].map(y => `${y}`);
      questions.push({
        q: isEn ? `In what year did ${name} die?` : `${name} хэдэн онд нас барсан бэ?`,
        correct: died,
        options: shuffle([died, ...wrongs.slice(0, 3)]),
      });
    }
  }

  // Role question — only in MN mode (role decoys are Mongolian prose)
  if (!isEn && figure.role) {
    const allRoles = ['Их хаан', 'Цэргийн жанжин', 'Гэгээн лам', 'Хатан хаан', 'Судлаач', 'Уран бүтээлч', 'Яруу найрагч', 'Дайчин', 'Төрийн зүтгэлтэн', 'Сансрын нисгэгч'];
    const wrongRoles = allRoles.filter(r => !figure.role.includes(r)).slice(0, 3);
    if (wrongRoles.length >= 3) {
      questions.push({
        q: `${name}-ын гол цол, хэргэм юу вэ?`,
        correct: figure.role,
        options: shuffle([figure.role, ...wrongRoles]),
      });
    }
  }

  // Achievement question — MN only (source data is Mongolian prose)
  if (!isEn && figure.achs?.length >= 1) {
    const correctAch = figure.achs[Math.floor(Math.random() * figure.achs.length)];
    const wrongAchs = [
      'Их Хурал байгуулсан',
      'Шинэ бичиг үсэг зохиосон',
      'Европт дипломат харилцаа тогтоосон',
      'Шинжлэх ухааны академи үүсгэсэн',
      'Жорлогийн зурхай зохиосон',
      'Буддын шинэ шашин байгуулсан',
    ].filter(a => !figure.achs.includes(a));
    if (wrongAchs.length >= 3) {
      questions.push({
        q: `${name}-ын алдарт гавьяануудын нэг аль нь вэ?`,
        correct: correctAch,
        options: shuffle([correctAch, ...shuffle(wrongAchs).slice(0, 3)]),
      });
    }
  }

  // Category question
  const CAT_MN = { khans: 'Хаад', queens: 'Хатад', warriors: 'Дайчид', political: 'Төрийн зүтгэлтнүүд', cultural: 'Соёлын зүтгэлтнүүд' };
  const CAT_EN = { khans: 'Khans', queens: 'Khatuns', warriors: 'Warriors', political: 'Ministers', cultural: 'Sages' };
  const catMap = isEn ? CAT_EN : CAT_MN;
  const correctCat = catMap[figure.cat];
  if (correctCat) {
    const wrongCats = Object.values(catMap).filter(c => c !== correctCat);
    questions.push({
      q: isEn ? `Which category does ${name} belong to?` : `${name} аль ангилалд хамаардаг вэ?`,
      correct: correctCat,
      options: shuffle([correctCat, ...wrongCats.slice(0, 3)]),
    });
  }

  // Era question
  const eraKey = getEra(figure);
  if (eraKey && ERAS[eraKey]) {
    const eraLabelKey = isEn ? 'label_en' : 'label';
    const correctEra = ERAS[eraKey][eraLabelKey] || ERAS[eraKey].label;
    const wrongEras = Object.entries(ERAS)
      .filter(([k]) => k !== eraKey)
      .map(([, e]) => e[eraLabelKey] || e.label);
    questions.push({
      q: isEn ? `Which era does ${name} belong to?` : `${name} аль бүлэгт (эрин үе) хамаардаг вэ?`,
      correct: correctEra,
      options: shuffle([correctEra, ...shuffle(wrongEras).slice(0, 3)]),
    });
  }

  // Fact — MN only (facts are Mongolian prose)
  if (!isEn && figure.fact && figure.fact.length > 15) {
    const lies = [
      'Тэрээр хүүхэд насандаа 7 хэл сурсан гэдэг.',
      'Түүний дүрс Монголын 1 төгрөгний мөнгөн дэвсгэртэд хэвлэгдсэн.',
      'Тэрээр 50 гаруй жил тасралтгүй унтаагүй амьдарсан гэгддэг.',
      'Намтраа өөрийн гараар бичиж үлдээсэн байдаг.',
    ];
    questions.push({
      q: `${name}-ын тухай дараахаас АЛЬ нь үнэн вэ?`,
      correct: figure.fact,
      options: shuffle([figure.fact, ...shuffle(lies).slice(0, 3)]),
    });
  }

  // Quote-attribution — MN only (quotes are in Mongolian)
  if (!isEn && figure.quote && figure.qattr && figure.quote.length > 10) {
    const decoys = ['Сүбээдэй', 'Өгөдэй Хаан', 'Елүй Чуцай', 'Бөртэ Үжин', 'Хубилай Хаан', 'Д. Сүхбаатар']
      .filter(n => n !== figure.qattr);
    questions.push({
      q: `"${figure.quote.slice(0, 80)}${figure.quote.length > 80 ? '...' : ''}" — хэний үг вэ?`,
      correct: figure.qattr,
      options: shuffle([figure.qattr, ...shuffle(decoys).slice(0, 3)]),
    });
  }

  // Pick 5 randomly from the candidate pool (was 4)
  return shuffle(questions).slice(0, Math.min(5, questions.length));
}

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

const SCORE_MSG = [
  { min: 4, emoji: '🏆', msg: 'Гайхалтай! Та жинхэнэ мэдлэгтэй!',    msg_en: 'Outstanding! You truly know the Codex.' },
  { min: 3, emoji: '⭐', msg: 'Сайн байна! Мэдлэг бий.',              msg_en: 'Well done! Solid knowledge.' },
  { min: 2, emoji: '📚', msg: 'Дунд зэрэг. Дахин судлаарай!',         msg_en: 'Fair. Study a little more, then return!' },
  { min: 0, emoji: '💪', msg: 'Дахин оролдоод, илүү сайн болно!',     msg_en: 'Try again — you’ll do better next time.' },
];

export default function FigureQuiz({ figure }) {
  const navigate = useNavigate();
  const { hasCard, earnCard } = useCollection();
  const { lang } = useLang();
  const [questions, setQuestions] = useState(() => generateQuestionsFromFigure(figure, lang));
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMode, setAiMode] = useState(false);
  const [cardEarned, setCardEarned] = useState(false);

  const loadAiQuiz = useCallback(async () => {
    setAiLoading(true);
    try {
      const prompt = `
Та "${figure.name}" (${figure.yrs}, ${figure.role}) тухай 4 сонголттой 4 асуулт гарга.
Намтар: ${figure.bio?.slice(0, 300)}
Гавьяа: ${figure.achs?.slice(0, 2).join(', ')}
Баримт: ${figure.fact || ''}

JSON форматаар буцаа:
{
  "questions": [
    { "q": "Асуулт текст", "correct": "Зөв хариулт", "options": ["А", "Б", "В", "Г"] }
  ]
}
options массив дотор correct хариулт байх ёстой. Бусад 3 нь буруу хариулт байна.
Монгол хэлээр бич.
      `.trim();

      const res = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            questions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  q: { type: 'string' },
                  correct: { type: 'string' },
                  options: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
        },
      });

      if (res?.questions?.length > 0) {
        setQuestions(res.questions);
        setAiMode(true);
        resetQuiz(res.questions);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setAiLoading(false);
    }
  }, [figure]);

  const resetQuiz = (qs) => {
    const newQs = qs || generateQuestionsFromFigure(figure, lang);
    setQuestions(newQs);
    setCurrent(0);
    setSelected(null);
    setScore(0);
    setDone(false);
    setAiMode(false);
  };

  const handleAnswer = (opt) => {
    if (selected !== null) return;
    setSelected(opt);
    if (opt === questions[current].correct) setScore(s => s + 1);
  };

  const handleNext = async () => {
    if (current + 1 >= questions.length) {
      const finalScore = score + (selected === questions[current].correct ? 1 : 0);
      setDone(true);
      // Award card at 4+ correct out of 5 (≥80%). 3+ threshold for legacy 4-question quizzes.
      const pass = questions.length >= 5 ? finalScore >= 4 : finalScore >= 3;
      if (pass && !hasCard(figure.fig_id)) {
        const earned = await earnCard(figure.fig_id);
        if (earned) setCardEarned(true);
      }
    } else {
      setCurrent(c => c + 1);
      setSelected(null);
    }
  };

  const scoreMsg = SCORE_MSG.find(s => score >= s.min);

  if (questions.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground font-body text-sm">
        {lang === 'en' ? 'Not enough data to generate questions.' : 'Асуулт үүсгэх хангалттай мэдээлэл алга.'}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-cinzel text-sm font-semibold text-gold tracking-wider">
            {lang === 'en' ? 'KNOWLEDGE CHECK' : 'МЭДЛЭГ ШАЛГАХ'}
          </h2>
          <p className="text-xs text-muted-foreground font-body mt-0.5">
            {lang === 'en'
              ? `How well do you know ${figureName(figure, 'en')}?`
              : `${figure.name}-ын тухай та хэр мэдэх вэ?`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => loadAiQuiz()}
            disabled={aiLoading}
            className="text-xs gap-1.5 border-gold/40 text-gold hover:bg-gold/10"
          >
            {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lightbulb className="w-3.5 h-3.5" />}
            {lang === 'en' ? 'AI Questions' : 'AI Асуулт'}
          </Button>
          {!done && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => resetQuiz()}
              className="text-xs gap-1.5 text-muted-foreground"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              {lang === 'en' ? 'Refresh' : 'Шинэчлэх'}
            </Button>
          )}
        </div>
      </div>

      {aiMode && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gold/10 border border-gold/20">
          <Lightbulb className="w-3.5 h-3.5 text-gold flex-shrink-0" />
          <span className="text-xs text-gold font-body">
            {lang === 'en' ? 'AI-generated questions' : 'AI-ийн үүсгэсэн асуултууд'}
          </span>
        </div>
      )}

      <AnimatePresence mode="wait">
        {!done ? (
          <motion.div
            key={current}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.25 }}
            className="space-y-5"
          >
            {/* Progress */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-crimson to-gold rounded-full transition-all duration-500"
                  style={{ width: `${((current) / questions.length) * 100}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground font-body whitespace-nowrap">{current + 1} / {questions.length}</span>
            </div>

            {/* Question */}
            <div className="p-5 rounded-2xl bg-muted/30 border border-border">
              <p className="font-body text-base font-semibold text-foreground leading-relaxed">
                {questions[current].q}
              </p>
            </div>

            {/* Options */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {questions[current].options.map((opt, i) => {
                const isCorrect = opt === questions[current].correct;
                const isSelected = selected === opt;
                let style = 'border-border bg-muted/30 hover:border-gold/40 hover:bg-muted/60 text-foreground';
                if (selected !== null) {
                  if (isCorrect) style = 'border-green-500/70 bg-green-500/10 text-green-400';
                  else if (isSelected) style = 'border-red-500/70 bg-red-500/10 text-red-400';
                  else style = 'border-border bg-muted/20 text-muted-foreground opacity-60';
                }

                return (
                  <button
                    key={i}
                    onClick={() => handleAnswer(opt)}
                    disabled={selected !== null}
                    className={`flex items-center gap-3 p-4 rounded-xl border text-left text-sm font-body transition-all ${style}`}
                  >
                    <span className="w-6 h-6 rounded-full border border-current flex items-center justify-center text-xs font-bold flex-shrink-0 opacity-70">
                      {['А', 'Б', 'В', 'Г'][i]}
                    </span>
                    <span className="leading-snug">{opt}</span>
                    {selected !== null && isCorrect && <CheckCircle2 className="w-4 h-4 text-green-500 ml-auto flex-shrink-0" />}
                    {selected !== null && isSelected && !isCorrect && <XCircle className="w-4 h-4 text-red-500 ml-auto flex-shrink-0" />}
                  </button>
                );
              })}
            </div>

            {/* Feedback + next */}
            {selected !== null && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between gap-4"
              >
                <p className={`text-sm font-body font-medium ${selected === questions[current].correct ? 'text-green-400' : 'text-red-400'}`}>
                  {selected === questions[current].correct
                    ? (lang === 'en' ? '✅ Correct!' : '✅ Зөв хариуллаа!')
                    : (lang === 'en'
                        ? `❌ Answer: "${questions[current].correct}"`
                        : `❌ Зөв хариулт: "${questions[current].correct}"`)}
                </p>
                <Button
                  size="sm"
                  onClick={handleNext}
                  className="bg-crimson hover:bg-crimson/90 text-white font-body shrink-0"
                >
                  {current + 1 >= questions.length
                    ? (lang === 'en' ? 'Finish' : 'Дүгнэлт')
                    : (lang === 'en' ? 'Next →' : 'Дараах →')}
                </Button>
              </motion.div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="result"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-6 py-4"
          >
            <div className="text-6xl">{scoreMsg?.emoji}</div>
            <div>
              <p className="font-cinzel text-3xl font-bold text-foreground">{score} / {questions.length}</p>
              <p className="text-muted-foreground font-body text-sm mt-1">
                {lang === 'en' ? 'Score' : 'Оноо'}
              </p>
            </div>
            <div className="flex justify-center gap-2">
              {questions.map((_, i) => (
                <div
                  key={i}
                  className={`w-3 h-3 rounded-full ${i < score ? 'bg-gold' : 'bg-muted'}`}
                />
              ))}
            </div>
            <div className="rounded-2xl bg-muted/30 border border-border p-5">
              <div className="flex items-center gap-2 justify-center mb-1">
                <Trophy className="w-4 h-4 text-gold" />
                <span className="font-cinzel text-sm font-semibold text-gold">
                  {lang === 'en' ? 'VERDICT' : 'ҮНЭЛГЭЭ'}
                </span>
              </div>
              <p className="font-body text-sm text-foreground">
                {lang === 'en' ? (scoreMsg?.msg_en || scoreMsg?.msg) : scoreMsg?.msg}
              </p>
            </div>

            {/* Card earned notification */}
            {cardEarned && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-2xl border-2 border-gold bg-gold/10 p-4 space-y-2"
              >
                <p className="font-cinzel text-sm font-bold text-gold text-center">
                  {lang === 'en' ? '🎴 CARD COLLECTED!' : '🎴 ХӨЗӨР ЦУГЛАСАН!'}
                </p>
                <p className="text-xs text-muted-foreground font-body text-center">
                  {lang === 'en' ? (
                    <><strong className="text-foreground">{figureName(figure, 'en')}</strong>’s card has been added to your collection.</>
                  ) : (
                    <><strong className="text-foreground">{figure.name}</strong>-ын хөзөр таны цуглуулганд нэмэгдлээ!</>
                  )}
                </p>
                <button
                  onClick={() => navigate('/collection')}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-gold text-background text-xs font-cinzel font-bold transition-all hover:bg-gold/90"
                >
                  <BookMarked className="w-3.5 h-3.5" />
                  {lang === 'en' ? 'View collection' : 'Цуглуулга харах'}
                </button>
              </motion.div>
            )}

            {hasCard(figure.fig_id) && !cardEarned && (
              <div className="rounded-xl border border-gold/30 bg-gold/5 px-4 py-2.5 flex items-center gap-2">
                <span className="text-base">🎴</span>
                <p className="text-xs text-gold font-body">
                  {lang === 'en' ? 'This card is already in your collection' : 'Энэ хөзөр таны цуглуулганд байгаа'}
                </p>
                <button onClick={() => navigate('/collection')} className="ml-auto text-[10px] text-gold/70 hover:text-gold underline font-body">
                  {lang === 'en' ? 'View' : 'Харах'}
                </button>
              </div>
            )}

            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={() => resetQuiz()} className="font-body gap-2">
                <RefreshCw className="w-4 h-4" />
                {lang === 'en' ? 'Try again' : 'Дахин оролдох'}
              </Button>
              <Button
                onClick={() => loadAiQuiz()}
                disabled={aiLoading}
                className="bg-gold text-background hover:bg-gold/90 font-body gap-2"
              >
                {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lightbulb className="w-4 h-4" />}
                {lang === 'en' ? 'AI Questions' : 'AI Асуулт'}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}