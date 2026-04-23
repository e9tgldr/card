import { useEffect, useRef, useState } from 'react';

export default function RoundCountdown({ startTs, onComplete }) {
  const [label, setLabel] = useState('3');
  const firedRef = useRef(false);

  useEffect(() => {
    firedRef.current = false;
    const startMs = new Date(startTs).getTime();

    function tick() {
      const elapsed = Date.now() - startMs;
      if (elapsed < 1000) setLabel('3');
      else if (elapsed < 2000) setLabel('2');
      else if (elapsed < 3000) setLabel('1');
      else {
        setLabel('GO');
        if (!firedRef.current) {
          firedRef.current = true;
          onComplete?.();
        }
      }
    }

    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [startTs, onComplete]);

  return (
    <div className="flex items-center justify-center py-8">
      <span
        data-testid="countdown"
        className="font-display text-ivory text-[clamp(3rem,10vw,8rem)]"
      >
        {label}
      </span>
    </div>
  );
}
