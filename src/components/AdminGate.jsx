import { Navigate, useLocation } from 'react-router-dom';
import { currentSession } from '@/lib/authStore';

export default function AdminGate({ children }) {
  const location = useLocation();
  const session = currentSession();
  if (!session) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/otp?next=${next}`} replace />;
  }
  if (!session.is_admin) {
    return <Navigate to="/" replace />;
  }
  return children;
}
