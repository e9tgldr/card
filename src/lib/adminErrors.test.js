import { describe, it, expect } from 'vitest';
import { adminErrorText } from './adminErrors';

describe('adminErrorText', () => {
  it('returns a Mongolian fallback for null / undefined', () => {
    expect(adminErrorText(null)).toBe('Алдаа');
    expect(adminErrorText(undefined)).toBe('Алдаа');
  });

  it('translates exact known reason strings', () => {
    expect(adminErrorText('forbidden')).toBe('Та энэ үйлдлийг хийх эрхгүй байна');
    expect(adminErrorText('unauthenticated')).toBe('Нэвтэрсэн байх шаардлагатай');
    expect(adminErrorText('not_found')).toBe('Олдсонгүй');
    expect(adminErrorText('rate_limited')).toBe('Хэтэрхий олон хүсэлт. Хэсэг хүлээгээд дахин оролдоно уу.');
  });

  it('translates known reasons embedded in wrapped messages', () => {
    expect(adminErrorText('duplicate key value violates unique constraint "access_codes_pkey"'))
      .toBe('Аль хэдийн бүртгэлтэй');
  });

  it('passes through unknown raw strings unchanged so debugging detail is preserved', () => {
    expect(adminErrorText('unexpected backend hiccup')).toBe('unexpected backend hiccup');
  });

  it('extracts message from Error instances', () => {
    const e = new Error('forbidden');
    expect(adminErrorText(e)).toBe('Та энэ үйлдлийг хийх эрхгүй байна');
  });

  it('falls back to the raw message for Error instances with unknown messages', () => {
    const e = new Error('something else broke');
    expect(adminErrorText(e)).toBe('something else broke');
  });

  it('handles Error instances with empty messages', () => {
    const e = new Error('');
    expect(adminErrorText(e)).toBe('Алдаа');
  });
});
