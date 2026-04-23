/**
 * Pick the next host: oldest-joined present participant, optionally excluding
 * a given user_id (the departing host).
 */
export function pickNextHost({ participants, present, excludeUserId = null }) {
  const eligible = participants
    .filter((p) => present[p.user_id] && p.user_id !== excludeUserId)
    .sort((a, b) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime());
  return eligible.length > 0 ? eligible[0].user_id : null;
}
