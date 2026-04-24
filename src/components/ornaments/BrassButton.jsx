import { forwardRef } from 'react';
import CornerTicks from './CornerTicks';

/**
 * BrassButton — editorial CTA: rectangular brass-edged plate with mount corners.
 * No rounded SaaS pills.  Supports 'primary' (seal-filled) and 'ghost' (hairline) variants.
 */
const BrassButton = forwardRef(function BrassButton(
  { variant = 'primary', size = 'md', children, className = '', icon, trailingIcon, ...props },
  ref,
) {
  const sizing = {
    sm: 'px-4 py-2 text-[10px]',
    md: 'px-6 py-3 text-[11px]',
    lg: 'px-9 py-4 text-xs',
  }[size];

  const primary = variant === 'primary';
  const base =
    'relative inline-flex items-center justify-center gap-3 font-meta font-semibold tracking-[0.28em] uppercase select-none ' +
    'transition-all duration-300 group whitespace-nowrap';
  const styles = primary
    ? 'text-ivory bg-[linear-gradient(180deg,hsl(var(--seal)/0.92),hsl(var(--seal)/0.78))] hover:bg-[linear-gradient(180deg,hsl(var(--seal)/1),hsl(var(--seal)/0.88))] shadow-[0_1px_0_hsl(var(--brass)/0.65)_inset,0_12px_30px_-8px_hsl(var(--seal)/0.55)]'
    : 'text-ivory/90 hover:text-ivory bg-ink/0 hover:bg-brass/10';

  return (
    <button
      ref={ref}
      className={`${base} ${sizing} ${styles} ${className}`}
      {...props}
    >
      {/* hairline border + inner ticks */}
      <span
        aria-hidden
        className={`absolute inset-0 border ${primary ? 'border-brass/70' : 'border-brass/45'} group-hover:border-brass transition-colors`}
      />
      <CornerTicks size={8} inset={3} thickness={1} opacity={primary ? 0.95 : 0.7} />
      {icon && <span className="relative z-10 -ml-1">{icon}</span>}
      <span className="relative z-10">{children}</span>
      {trailingIcon && <span className="relative z-10 -mr-1">{trailingIcon}</span>}
    </button>
  );
});

export default BrassButton;
