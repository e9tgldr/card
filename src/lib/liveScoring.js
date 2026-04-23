/**
 * Compute final standings for a live room.
 *
 * @param {Array<{user_id: string, username: string, answers: Array<{correct: boolean, ms: number}>}>} participants
 * @returns {Array<{user_id, username, correct, total_ms}>}
 *   sorted by (correct desc, total_ms asc).
 */
export function computeStandings(participants) {
  return participants
    .map((p) => ({
      user_id: p.user_id,
      username: p.username,
      correct: p.answers.filter((a) => a.correct).length,
      total_ms: p.answers.reduce((sum, a) => sum + (a.ms ?? 0), 0),
    }))
    .sort((a, b) => {
      if (b.correct !== a.correct) return b.correct - a.correct;
      return a.total_ms - b.total_ms;
    });
}

export function pickMvp(standings) {
  return standings.length > 0 ? standings[0].user_id : null;
}
