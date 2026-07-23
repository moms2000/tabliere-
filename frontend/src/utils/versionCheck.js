// Rafraîchissement automatique : détecte qu'une nouvelle version du site a été
// déployée (le fichier d'entrée change de nom) et recharge l'app, sans que
// l'utilisateur ait à vider le cache. Non intrusif : ne recharge qu'à un moment
// sûr (quand l'app revient au premier plan, ou si elle est en arrière-plan).

const ENTRY_RE = /assets\/index-[A-Za-z0-9_]+\.js/;

function currentEntry() {
  const src = [...document.querySelectorAll("script[src]")]
    .map((s) => s.getAttribute("src") || "")
    .find((u) => ENTRY_RE.test(u));
  const m = src && src.match(ENTRY_RE);
  return m ? m[0] : null;
}

async function latestEntry() {
  const res = await fetch(`/index.html?_=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) return null;
  const html = await res.text();
  const m = html.match(ENTRY_RE);
  return m ? m[0] : null;
}

export function startVersionWatch() {
  const current = currentEntry();
  if (!current) return; // dev ou structure inattendue → on ne fait rien
  let reloading = false;
  let pending = false; // nouvelle version détectée mais on attend un moment sûr

  const reload = () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  };

  const check = async () => {
    try {
      const latest = await latestEntry();
      if (!latest || latest === current) return;
      // Nouvelle version dispo. Si l'app est visible et utilisée, on attend le
      // prochain retour au premier plan pour ne pas couper une saisie ; si elle
      // est en arrière-plan, on recharge tout de suite.
      if (document.hidden) reload();
      else pending = true;
    } catch (_) {}
  };

  // Au retour au premier plan : si une nouvelle version attend, on recharge.
  const onVisible = () => {
    if (document.hidden) return;
    if (pending) return reload();
    check();
  };
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("focus", onVisible);

  // Vérification périodique (toutes les 3 min).
  setInterval(check, 3 * 60 * 1000);
  // Et une première vérification peu après le démarrage.
  setTimeout(check, 15 * 1000);
}
