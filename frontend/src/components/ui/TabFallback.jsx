// État de contenu d'un onglet : soit « Chargement… », soit une erreur claire avec
// bouton « Réessayer ». Remplace les spinners « Chargement… » qui restaient
// bloqués à l'infini quand une requête échouait en silence (l'état restait null).
const FONT = "'Avenir Next', 'Avenir', 'Century Gothic', sans-serif";

export default function TabFallback({ error, onRetry, label = "Chargement…" }) {
  if (!error) {
    return (
      <div style={{ textAlign: "center", padding: "40px 0", color: "#9BA89F", fontFamily: FONT }}>
        {label}
      </div>
    );
  }
  return (
    <div style={{ textAlign: "center", padding: "36px 0", fontFamily: FONT }}>
      <div style={{ fontSize: 14, color: "#993C1D", marginBottom: 12, lineHeight: 1.5 }}>
        Impossible de charger les données.<br />Vérifiez votre connexion.
      </div>
      <button onClick={onRetry}
        style={{ border: "none", background: "#E8A045", color: "#1A1000", borderRadius: 9,
          padding: "9px 22px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>
        Réessayer
      </button>
    </div>
  );
}
