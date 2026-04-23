import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLang } from '@/lib/i18n';
import { useAuth } from '@/lib/AuthContext';
import { useLiveRoom } from '@/hooks/useLiveRoom';
import { joinRoom } from '@/lib/liveRoomApi';
import LiveRoomLobby from '@/pages/LiveRoomLobby';
import LiveRoomGame from '@/pages/LiveRoomGame';
import Fleuron from '@/components/ornaments/Fleuron';

export default function LiveRoom() {
  const { code } = useParams();
  const { t } = useLang();
  const { user } = useAuth();
  const navigate = useNavigate();
  const room = useLiveRoom({ joinCode: code });
  const sessionId = room.session?.id;

  useEffect(() => {
    if (room.loading || !room.session || !sessionId) return;
    const alreadyIn = room.participants.some((p) => p.user_id === user?.id);
    if (!alreadyIn && room.session.status === 'open') {
      joinRoom(sessionId).catch(() => { /* surface via next snapshot */ });
    }
  }, [room.loading, room.session, room.participants, user?.id, sessionId]);

  if (room.loading) {
    return <div className="min-h-screen bg-ink flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-muted-foreground/20 border-t-crimson rounded-full animate-spin" />
    </div>;
  }

  if (room.error || !room.session) {
    return <Shell><p className="font-prose italic text-ivory/70">{t('duel.notFound')}</p></Shell>;
  }

  switch (room.session.status) {
    case 'open':
      return <LiveRoomLobby room={room} sessionId={sessionId} currentUserId={user?.id} />;
    case 'in_progress':
      return <LiveRoomGame room={room} sessionId={sessionId} currentUserId={user?.id} />;
    case 'complete':
      return <LiveRoomGame room={room} sessionId={sessionId} currentUserId={user?.id} showResults />;
    case 'abandoned':
      return <Shell><p className="font-prose italic text-ivory/70">{t('live.abandoned')}</p></Shell>;
    default:
      return <Shell><p>unknown state</p></Shell>;
  }
}

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-ink contour-bg flex items-center justify-center px-6 text-center">
      <div className="max-w-xl space-y-5">
        <Fleuron size={48} className="mx-auto opacity-80" />
        {children}
      </div>
    </div>
  );
}
