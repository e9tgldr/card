function toMs(value) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  return new Date(value).getTime();
}

export function msElapsed(arrival, sent) {
  const diff = toMs(arrival) - toMs(sent);
  return diff < 0 ? 0 : diff;
}

export function isWithinDeadline({ sentAt, timerS, arrival, graceMs = 500 }) {
  const limit = toMs(sentAt) + timerS * 1000 + graceMs;
  return toMs(arrival) <= limit;
}
