// Loader léger pour le contenu d'un onglet (pas plein écran, contrairement au
// PageLoader global). Sert de fallback à une Suspense LOCALE autour de l'Outlet :
// pendant le chargement du chunk d'un onglet, seule la zone de contenu affiche ce
// loader — la mise en page (barre latérale, en-tête) reste montée. Cela évite le
// démontage/remontage complet qui interrompait l'animation d'entrée et laissait
// l'onglet figé en blanc (opacity 0).
export default function TabLoader() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
      minHeight: 260, width: "100%" }}>
      <div style={{ width: 30, height: 30, border: "3px solid #E4DFD8",
        borderTopColor: "#E8A045", borderRadius: "50%", animation: "tabspin 0.7s linear infinite" }} />
      <style>{`@keyframes tabspin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
