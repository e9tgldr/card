export default function Standings({ standings, mode = 'in_round', currentUserId = null }) {
  return (
    <ol className="space-y-2 w-full">
      {standings.map((row, i) => {
        const isMe = row.user_id === currentUserId;
        return (
          <li
            key={row.user_id}
            data-testid="standings-row"
            data-me={String(isMe)}
            className={`flex items-center justify-between px-3 py-2 border ${
              isMe ? 'border-brass bg-brass/5' : 'border-brass/30'
            }`}
          >
            <span className="flex items-center gap-3">
              <span className="font-meta text-[10px] tracking-[0.3em] text-brass/70">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="font-display text-ivory text-sm">{row.username}</span>
              {mode === 'final' && i === 0 && (
                <span className="ml-1 text-brass text-xs" aria-label="MVP">★</span>
              )}
            </span>
            <span className="font-display text-ivory">{row.correct}</span>
          </li>
        );
      })}
    </ol>
  );
}
