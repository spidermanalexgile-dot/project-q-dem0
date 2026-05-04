import { useEffect, useRef, useState } from "react";

/** Fade + translate up the first time the element scrolls into view. */
export function useFadeUpOnView<T extends HTMLElement = HTMLDivElement>(
  options: { rootMargin?: string; threshold?: number } = {}
) {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setVisible(true);
            obs.disconnect();
            return;
          }
        }
      },
      { rootMargin: options.rootMargin ?? "0px 0px -10% 0px", threshold: options.threshold ?? 0.05 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [options.rootMargin, options.threshold]);

  const style = {
    opacity: visible ? 1 : 0,
    transform: visible ? "translateY(0)" : "translateY(16px)",
    transition: "opacity 480ms ease-out, transform 480ms ease-out",
  } as const;

  return { ref, style, visible };
}
