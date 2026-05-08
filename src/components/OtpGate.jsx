import { Navigate, useLocation } from 'react-router-dom';
import { currentSession } from '@/lib/authStore';

export default function OtpGate({ children }) {
  const location = useLocation();
  const session = currentSession();
  if (!session) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/otp?next=${next}`} replace />;
  }
  return children;
}
