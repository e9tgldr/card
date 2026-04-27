import { describe, it, expect } from 'vitest';
import { STRINGS } from '@/lib/i18n';

describe('roster-gate i18n', () => {
  it('has bilingual error.roster_lookup_failed', () => {
    expect(STRINGS['error.roster_lookup_failed']).toBeDefined();
    expect(STRINGS['error.roster_lookup_failed'].mn).toMatch(/.+/);
    expect(STRINGS['error.roster_lookup_failed'].en).toMatch(/.+/);
  });
  it('has bilingual live.lobby.rosterFigures', () => {
    expect(STRINGS['live.lobby.rosterFigures']).toBeDefined();
  });
  it('has bilingual live.lobby.allFigures', () => {
    expect(STRINGS['live.lobby.allFigures']).toBeDefined();
  });
  it('has bilingual live.lobby.allFiguresHint', () => {
    expect(STRINGS['live.lobby.allFiguresHint']).toBeDefined();
  });
});
