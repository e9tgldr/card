import React from 'react';

export default function GoldDivider() {
  return (
    <div className="flex items-center justify-center py-2">
      <div className="h-px flex-1 max-w-xs" style={{ background: 'linear-gradient(to right, transparent, #c9a84c33, #c9a84c, #c9a84c33, transparent)' }} />
    </div>
  );
}
