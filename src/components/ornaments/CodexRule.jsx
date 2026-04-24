import { memo } from 'react';
import Fleuron from './Fleuron';

/**
 * CodexRule — editorial section divider: hairline + centred fleuron + hairline.
 * Optional caption renders above the rule as a small-caps label.
 */
function CodexRule({ caption, fleuronSize = 22, className = '' }) {
  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      {caption && (
        <span className="codex-caption">{caption}</span>
      )}
      <div className="flex items-center gap-4 w-full max-w-xl">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-brass/50 to-brass/50" />
        <Fleuron size={fleuronSize} />
        <div className="flex-1 h-px bg-gradient-to-l from-transparent via-brass/50 to-brass/50" />
      </div>
    </div>
  );
}

export default memo(CodexRule);
