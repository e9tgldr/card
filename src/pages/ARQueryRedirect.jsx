import { Navigate, useSearchParams } from 'react-router-dom';
import { resolveCardParam } from '@/lib/figureSlugs';
import MultiTargetARView from '@/pages/MultiTargetARView';

export default function ARQueryRedirect() {
  const [params] = useSearchParams();
  const raw = params.get('card');
  if (raw == null) return <MultiTargetARView />;
  const figId = resolveCardParam(raw);
  if (!figId) return <Navigate to="/" replace />;
  return <Navigate to={`/ar/${figId}`} replace />;
}
