import { Skeleton } from './Skeleton';
import { EmptyState } from './EmptyState';
import { useLang } from '@/lib/i18n';

function DefaultErrorFallback({ retry }) {
  const { t } = useLang();
  return (
    <EmptyState
      title="empty.error.title"
      description="empty.error.description"
      action={
        retry ? (
          <button
            onClick={retry}
            className="font-meta text-[10px] tracking-[0.3em] uppercase text-brass hover:text-ivory"
          >
            {t('toast.generic.retry')}
          </button>
        ) : null
      }
    />
  );
}

export function AsyncStatus({
  loading,
  error,
  empty,
  retry,
  loadingFallback,
  errorFallback,
  emptyFallback,
  children,
}) {
  if (loading) return loadingFallback ?? <Skeleton.Card />;
  if (error) return errorFallback ?? <DefaultErrorFallback retry={retry} />;
  if (empty) return emptyFallback ?? <EmptyState title="empty.generic.title" description="empty.generic.description" />;
  return children;
}
