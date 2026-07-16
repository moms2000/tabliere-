/**
 * Alerte sonore pour les nouvelles commandes (bar / caisse / serveur).
 * Utilise l'API Web Audio → aucun fichier son à charger, fonctionne hors-ligne.
 * Les navigateurs mobiles exigent une 1re interaction utilisateur avant de jouer
 * du son : on « débloque » le contexte audio au 1er tap (unlockAudio).
 */
let ctx = null;
let unlocked = false;

function getCtx() {
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = AC ? new AC() : null;
  } catch { ctx = null; }
  return ctx;
}

// À appeler sur une interaction utilisateur (connexion staff, clic d'onglet…)
export function unlockAudio() {
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") c.resume().catch(() => {});
  unlocked = true;
}

export function audioUnlocked() { return unlocked; }

// Bip d'alerte à deux tons (montant) → attire l'attention sans être agressif
export function playOrderAlarm() {
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") c.resume().catch(() => {});
  const t0 = c.currentTime;
  const beep = (freq, start, dur, vol = 0.35) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t0 + start);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + start + dur);
    osc.connect(gain); gain.connect(c.destination);
    osc.start(t0 + start);
    osc.stop(t0 + start + dur + 0.03);
  };
  beep(880, 0, 0.18);      // La5
  beep(1174.7, 0.19, 0.26); // Ré6
}

// Débloque l'audio dès la 1re interaction de la page (filet de sécurité global)
if (typeof window !== "undefined") {
  const once = () => { unlockAudio(); window.removeEventListener("pointerdown", once); window.removeEventListener("keydown", once); };
  window.addEventListener("pointerdown", once, { once: true });
  window.addEventListener("keydown", once, { once: true });
}
