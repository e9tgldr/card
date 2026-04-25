import { useLang, STRINGS } from '@/lib/i18n';

function resolve(t, input) {
  if (!input) return null;
  if (typeof input !== 'string') return input;
  if (STRINGS[input]) return t(input);
  return input;
}

export function EmptyState({ icon, title, description, action, className = '' }) {
  const { t } = useLang();
  const titleText = resolve(t, title);
  const descText = resolve(t, description);
  return (
    <div className={`text-center py-12 px-6 space-y-3 ${className}`}>
      {icon && <div className="flex justify-center">{icon}</div>}
      {titleText && (
        <p className="font-display text-base text-ivory">{titleText}</p>
      )}
      {descText && (
        <p className="font-prose italic text-ivory/70 max-w-md mx-auto">{descText}</p>
      )}
      {action && <div className="pt-2 flex justify-center">{action}</div>}
    </div>
  );
}
