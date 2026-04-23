import { describe, expect, test } from 'vitest';
import { tryAnswer } from '@/lib/figureResponder';

const chinggis = {
  fig_id: 1,
  name: 'Чингис Хаан',
  yrs: '1162–1227',
  role: 'Их Монгол Улсын Үндэслэгч',
  bio: 'Тэмүжин нэрээр төрсөн Чингис Хаан бол түүхэн дэх хамгийн агуу эзэн хаан юм.',
  achs: ['Монгол овгуудыг нэгтгэсэн', 'Их Монгол Улсыг байгуулсан'],
  fact: 'Чингис Хааны булш өнөөг хүртэл олдоогүй байна.',
  quote: 'Би бол тэнгэрийн шийтгэл.',
  qattr: 'Чингис Хаан',
};

describe('figureResponder.tryAnswer', () => {
  test('returns null for non-MN input', () => {
    expect(tryAnswer(chinggis, 'when were you born', 'en')).toBeNull();
    expect(tryAnswer(chinggis, '你好', 'cn')).toBeNull();
  });

  test('answers birth year in first person', () => {
    const out = tryAnswer(chinggis, 'Та хэзээ төрсөн бэ?', 'mn');
    expect(out).not.toBeNull();
    expect(out).toMatch(/1162/);
    expect(out).toMatch(/би|миний/i);
  });

  test('answers death year', () => {
    const out = tryAnswer(chinggis, 'Та хэзээ нас барсан бэ?', 'mn');
    expect(out).toMatch(/1227/);
  });

  test('lists achievements when asked', () => {
    const out = tryAnswer(chinggis, 'Та юу хийсэн бэ?', 'mn');
    expect(out).toMatch(/Монгол овгуудыг нэгтгэсэн/);
    expect(out).toMatch(/Их Монгол Улсыг байгуулсан/);
  });

  test('returns quote when asked about famous saying', () => {
    const out = tryAnswer(chinggis, 'Чиний нэрт үг юу вэ?', 'mn');
    expect(out).toMatch(/Би бол тэнгэрийн шийтгэл/);
  });

  test('returns bio for "who are you"', () => {
    const out = tryAnswer(chinggis, 'Чи хэн бэ?', 'mn');
    expect(out).toMatch(/Тэмүжин/);
  });

  test('returns fact when asked for a random fact', () => {
    const out = tryAnswer(chinggis, 'Сонирхолтой зүйл юу байдаг вэ?', 'mn');
    expect(out).toMatch(/булш/);
  });

  test('returns null when no intent matches', () => {
    const out = tryAnswer(chinggis, 'асдфгзхпэкуқ', 'mn');
    expect(out).toBeNull();
  });

  test('gracefully handles missing fields (e.g., no quote)', () => {
    const noQuote = { ...chinggis, quote: null, qattr: null };
    expect(tryAnswer(noQuote, 'Чиний нэрт үг юу вэ?', 'mn')).toBeNull();
  });
});
