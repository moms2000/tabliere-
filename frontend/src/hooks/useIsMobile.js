import { useEffect, useState } from "react";

/**
 * useIsMobile — vrai si la largeur d'écran est < breakpoint (768px par défaut).
 * Sert à adapter les grilles/tableaux des espaces restaurateur & admin au
 * mobile et à la tablette (portrait).
 */
export function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(
    () => (typeof window !== "undefined" ? window.innerWidth < breakpoint : false)
  );

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener("resize", onResize);
    onResize();
    return () => window.removeEventListener("resize", onResize);
  }, [breakpoint]);

  return isMobile;
}

export default useIsMobile;
