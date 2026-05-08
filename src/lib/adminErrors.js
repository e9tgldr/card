// Translates raw edge-function `reason` strings and Error messages into
// Mongolian admin-friendly text. The admin panel is Mongolian-only so we
// don't route through the full i18n catalog — this is a small, focused map
// that stops mixed-language errors from leaking server detail to the UI.
//
// Unknown reasons fall through unchanged so debugging info isn't swallowed
// (raw text is still admin-only — never reaches public users).
const REASON_MAP = {
  unauthenticated:     'Нэвтэрсэн байх шаардлагатай',
  unauthorized:        'Нэвтэрсэн байх шаардлагатай',
  forbidden:           'Та энэ үйлдлийг хийх эрхгүй байна',
  not_found:           'Олдсонгүй',
  bad_request:         'Хүсэлтийн өгөгдөл буруу',
  bad_body:            'Хүсэлтийн өгөгдөл буруу',
  bad_status:          'Буруу төлөв',
  missing_id:          'ID шаардлагатай',
  method_not_allowed:  'Зөвшөөрөгдөөгүй арга',
  upload_failed:       'Файл байршуулах амжилтгүй',
  server:              'Серверийн алдаа',
  duplicate:           'Аль хэдийн бүртгэлтэй',
  rate_limited:        'Хэтэрхий олон хүсэлт. Хэсэг хүлээгээд дахин оролдоно уу.',
  bad_target_order:    'Картуудын дараалал буруу байна',
  no_pack:             'AR багц хуулагдаагүй байна. Эхлээд .mind файлаа хуулна уу.',
};

export function adminErrorText(input) {
  if (input == null) return 'Алдаа';
  const raw = input instanceof Error
    ? (input.message || 'Алдаа')
    : String(input);
  if (REASON_MAP[raw]) return REASON_MAP[raw];
  // Substring fallback so wrapped messages (e.g. Supabase's
  // "duplicate key value violates unique constraint ...") still resolve.
  for (const key of Object.keys(REASON_MAP)) {
    if (raw.includes(key)) return REASON_MAP[key];
  }
  return raw;
}
