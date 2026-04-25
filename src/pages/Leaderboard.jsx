import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useLang } from '@/lib/i18n';
import { useAuth } from '@/lib/AuthContext';
import { fetchLeaderboard, fetchMyLeaderboardRank } from '@/lib/gameApi';
import { AsyncStatus, Skeleton, EmptyState } from '@/lib/feedback';
import Fleuron from '@/components/ornaments/Fleuron';
import CodexRule from '@/components/ornaments/CodexRule';

export default function Leaderboard() {
  const { t, lang } = useLang();
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.id;

  const [tab, setTab] = useState('weekly');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [myRank, setMyRank] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setMyRank(null);
    fetchLeaderboard(tab, 20)
      .then(async (data) => {
        if (cancelled) return;
        setRows(data);
        setLoading(false);
        const top20 = data.slice(0, 20);
        const myRow = data.find((r) => r.user_id === userId);
        const visible = top20.some((r) => r.user_id === userId);
        if (myRow && !visible) {
          try {
            const rank = await fetchMyLeaderboardRank(tab, myRow.total_points);
            if (!cancelled) setMyRank(rank);
          } catch { /* fine, just don't show context line */ }
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setRows([]);
          setLoading(false);
          setError(err);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [tab, userId]);

  const myRow = rows.find((r) => r.user_id === userId);
  const topRows = rows.slice(0, 20);
  const myRankVisible = myRow && topRows.some((r) => r.user_id === userId);

  return (
    <div className="min-h-screen bg-ink contour-bg">
      <div className="max-w-[50rem] mx-auto px-5 md:px-8 pt-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 font-meta text-[10px] tracking-[0.3em] uppercase text-brass/75 hover:text-ivory"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> {lang === 'en' ? 'Back' : 'Буцах'}
        </button>
      </div>

      <div className="max-w-[50rem] mx-auto px-5 md:px-8 pt-8 pb-6 text-center space-y-3">
        <CodexRule
          caption={lang === 'en' ? 'CODEX · LEADERBOARD' : 'КОДЕКС · ТЭРГҮҮЛЭГЧИД'}
          fleuronSize={20}
        />
        <h1
          className="display-title text-[clamp(2rem,5vw,3rem)] text-ivory"
          style={{ fontVariationSettings: '"opsz" 96, "SOFT" 70' }}
        >
          {t('leaderboard.title')}
        </h1>
      </div>

      <div className="max-w-[50rem] mx-auto px-5 md:px-8 pb-4 flex items-center justify-center gap-2">
        {[
          { key: 'weekly', label: t('leaderboard.tab.weekly') },
          { key: 'all_time', label: t('leaderboard.tab.all') },
        ].map((tDef) => (
          <button
            key={tDef.key}
            onClick={() => setTab(tDef.key)}
            className={`px-4 py-2 font-meta text-[10px] tracking-[0.28em] uppercase border ${
              tab === tDef.key
                ? 'border-brass text-ivory'
                : 'border-brass/30 text-brass/70 hover:text-ivory'
            }`}
          >
            {tDef.label}
          </button>
        ))}
      </div>

      <div className="max-w-[50rem] mx-auto px-5 md:px-8 pb-16">
        <AsyncStatus
          loading={loading}
          error={error}
          empty={!loading && rows.length === 0}
          loadingFallback={<Skeleton.Grid count={20} variant="row" className="px-1" />}
          emptyFallback={
            <EmptyState
              icon={<Fleuron size={36} className="opacity-60" />}
              title="empty.leaderboard.title"
              description="empty.leaderboard.description"
            />
          }
        >
          <table className="w-full text-ivory">
            <thead>
              <tr className="font-meta text-[9.5px] uppercase tracking-[0.28em] text-brass/70 border-b border-brass/30">
                <th className="text-left py-3 pl-3 w-10">{t('leaderboard.col.rank')}</th>
                <th className="text-left py-3">{t('leaderboard.col.user')}</th>
                <th className="text-right py-3 hidden sm:table-cell">
                  {t('leaderboard.col.games')}
                </th>
                <th className="text-right py-3">{t('leaderboard.col.points')}</th>
                <th className="text-right py-3 pr-3">{t('leaderboard.col.acc')}</th>
              </tr>
            </thead>
            <tbody>
              {topRows.map((r, i) => (
                <tr
                  key={r.user_id}
                  className={`border-b border-brass/10 ${r.user_id === userId ? 'bg-brass/5' : ''}`}
                >
                  <td className="py-3 pl-3 font-meta text-[11px] text-brass">{i + 1}</td>
                  <td className="py-3 font-display">{r.username}</td>
                  <td className="py-3 text-right hidden sm:table-cell font-meta text-[12px] text-ivory/70">
                    {r.games_played}
                  </td>
                  <td className="py-3 text-right font-display">{r.total_points}</td>
                  <td className="py-3 pr-3 text-right font-meta text-[12px] text-ivory/70">
                    {r.accuracy_pct}%
                  </td>
                </tr>
              ))}
              {myRow && !myRankVisible && (
                <tr className="border-t-2 border-brass/30 bg-brass/5">
                  <td className="py-3 pl-3 font-meta text-[11px] text-brass">{myRank?.rank ?? '…'}</td>
                  <td className="py-3 font-display">
                    {myRow.username}{' '}
                    <span className="text-brass/60 text-[10px] ml-1">
                      {t('leaderboard.yourRank')}
                    </span>
                  </td>
                  <td className="py-3 text-right hidden sm:table-cell font-meta text-[12px] text-ivory/70">
                    {myRow.games_played}
                  </td>
                  <td className="py-3 text-right font-display">{myRow.total_points}</td>
                  <td className="py-3 pr-3 text-right font-meta text-[12px] text-ivory/70">
                    {myRow.accuracy_pct}%
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {myRow && !myRankVisible && myRank && (
            <p className="mt-4 text-center font-prose italic text-ivory/60 text-sm">
              {t('leaderboard.contextLine')
                .replace('${rank}', String(myRank.rank))
                .replace('${total}', String(myRank.total))}
            </p>
          )}
        </AsyncStatus>
      </div>
    </div>
  );
}
