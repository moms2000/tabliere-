import { useEffect } from "react";

const SITE = "TablièreCI";
const DEFAULT_DESC = "Réservez les meilleures tables d'Abidjan et de Côte d'Ivoire — confirmation immédiate, annulation gratuite.";

/**
 * usePageMeta(title, description)
 * Met à jour document.title et les balises meta description / og:*.
 */
export function usePageMeta(title, description = DEFAULT_DESC) {
  useEffect(() => {
    const full = title ? `${title} — ${SITE}` : SITE;
    document.title = full;

    const setMeta = (name, content, attr = "name") => {
      let el = document.querySelector(`meta[${attr}="${name}"]`);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, name);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };

    setMeta("description",       description);
    setMeta("og:title",          full,        "property");
    setMeta("og:description",    description, "property");
    setMeta("og:site_name",      SITE,        "property");
    setMeta("og:type",           "website",   "property");

    return () => {
      // Restore default on unmount
      document.title = SITE;
    };
  }, [title, description]);
}
