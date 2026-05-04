import { useEffect, useState } from "react";

/** Animate from 0 to target with ease-out cubic over `duration` ms. */
export function useCountUp(target: number, duration = 1200): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    function tick(now: number) {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(target * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}
