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

// Alarme forte à deux tons, RÉPÉTÉE pendant ~10 s → impossible de la manquer même
// dans un environnement bruyant. Un garde empêche d'empiler deux alarmes.
const ALARM_MS = 10000;
let alarmUntil = 0;

export function playOrderAlarm() {
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") c.resume().catch(() => {});
  const now = Date.now();
  if (now < alarmUntil) return; // déjà en cours → ne pas empiler
  alarmUntil = now + ALARM_MS;

  const t0 = c.currentTime;
  const vol = 0.85; // fort
  const beep = (freq, start, dur) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "triangle"; // plus puissant qu'une sinusoïde, moins agressif qu'un carré
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t0 + start);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + start + 0.015);
    gain.gain.setValueAtTime(vol, t0 + start + dur - 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + start + dur);
    osc.connect(gain); gain.connect(c.destination);
    osc.start(t0 + start);
    osc.stop(t0 + start + dur + 0.03);
  };
  // Motif « bi-bip » répété toutes les 0,9 s pendant 10 s
  const PERIOD = 0.9;
  const reps = Math.ceil(ALARM_MS / 1000 / PERIOD);
  for (let i = 0; i < reps; i++) {
    const base = i * PERIOD;
    beep(988, base, 0.22);        // Si5
    beep(1319, base + 0.26, 0.30); // Mi6
  }
}

// Débloque l'audio dès la 1re interaction de la page (filet de sécurité global)
if (typeof window !== "undefined") {
  const once = () => { unlockAudio(); window.removeEventListener("pointerdown", once); window.removeEventListener("keydown", once); };
  window.addEventListener("pointerdown", once, { once: true });
  window.addEventListener("keydown", once, { once: true });
}
