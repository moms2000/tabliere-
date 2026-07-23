// Polyfill AbortController (utilisé par axios) pour les navigateurs anciens
// (ex. WebView des bornes Sunmi) qui ne l'ont pas nativement. Doit être importé
// AVANT axios / tout code réseau.
import "abortcontroller-polyfill/dist/abortcontroller-polyfill-only";
import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";

import { AuthProvider }     from "./context/AuthContext.jsx";
import MobileBottomNav     from "./components/mobile/MobileBottomNav.jsx";
import NotificationPrompt  from "./components/NotificationPrompt.jsx";
import { LanguageProvider } from "./context/LanguageContext.jsx";
import { ToastProvider }    from "./components/ui/Toast.jsx";
import MaintenanceGate      from "./components/MaintenanceGate.jsx";
import ProtectedRoute       from "./components/auth/ProtectedRoute.jsx";
import LogoSplash           from "./components/LogoSplash.jsx";

// ── Lazy imports : chaque page est chargée à la demande ──────────────────────
const AdminLayout       = lazy(() => import("./components/layout/AdminLayout"));
const AdminOverview     = lazy(() => import("./pages/admin/AdminOverview"));
const Restaurateurs     = lazy(() => import("./pages/admin/Restaurateurs"));
const Utilisateurs      = lazy(() => import("./pages/admin/Utilisateurs"));
const Reservations      = lazy(() => import("./pages/admin/Reservations"));
const Contacts          = lazy(() => import("./pages/admin/Contacts"));
const Finances          = lazy(() => import("./pages/admin/Finances"));
const Systeme           = lazy(() => import("./pages/admin/Systeme"));
const Parametres        = lazy(() => import("./pages/admin/Parametres"));
const QRThemes          = lazy(() => import("./pages/admin/QRThemes"));
const CodesRestaurateurs = lazy(() => import("./pages/admin/CodesRestaurateurs"));
const SiteParametres     = lazy(() => import("./pages/admin/SiteParametres"));

const RestaurantLayout  = lazy(() => import("./components/layout/RestaurantLayout"));
const RestDashboard     = lazy(() => import("./pages/restaurant/RestDashboard"));
const RestMenu          = lazy(() => import("./pages/restaurant/RestMenu"));
const RestReservations  = lazy(() => import("./pages/restaurant/RestReservations"));
const RestPlanSalle     = lazy(() => import("./pages/restaurant/RestPlanSalle"));
const RestProfil        = lazy(() => import("./pages/restaurant/RestProfil"));
const RestCommandes     = lazy(() => import("./pages/restaurant/RestCommandes"));
const RestPOS           = lazy(() => import("./pages/restaurant/RestPOS"));
const RestInstants      = lazy(() => import("./pages/restaurant/RestInstants"));
const RestClients       = lazy(() => import("./pages/restaurant/RestClients"));
const RestStaff         = lazy(() => import("./pages/restaurant/RestStaff"));
const RestRecus         = lazy(() => import("./pages/restaurant/RestRecus"));

const EventLayout       = lazy(() => import("./components/layout/EventLayout"));
const EventList         = lazy(() => import("./pages/event/EventList"));
const EventEditor       = lazy(() => import("./pages/event/EventEditor"));
const CodesOrganisateurs = lazy(() => import("./pages/admin/CodesOrganisateurs"));
const AdminAnalytics    = lazy(() => import("./pages/admin/Analytics"));
const Evenements        = lazy(() => import("./pages/public/Evenements"));
const EventDetail       = lazy(() => import("./pages/public/EventDetail"));
const EventOrder        = lazy(() => import("./pages/public/EventOrder"));
const EventTicket       = lazy(() => import("./pages/public/EventTicket"));
const StaffConsole      = lazy(() => import("./pages/public/StaffConsole"));

const ClientMenu        = lazy(() => import("./pages/client/ClientMenu"));
const Profil            = lazy(() => import("./pages/client/Profil"));

// Pages publiques — préchargées car critiques au premier chargement
import Home             from "./pages/public/Home";
const ConnexionAdmin   = lazy(() => import("./pages/public/ConnexionAdmin"));
import Connexion        from "./pages/public/Connexion";
const Inscription      = lazy(() => import("./pages/public/Inscription"));
const RestaurantDetail = lazy(() => import("./pages/public/RestaurantDetail"));
const Confidentialite  = lazy(() => import("./pages/public/Confidentialite"));
const VerifyEmail       = lazy(() => import("./pages/public/VerifyEmail"));
const MotDePasseOublie  = lazy(() => import("./pages/public/MotDePasseOublie"));
const ResetPassword     = lazy(() => import("./pages/public/ResetPassword"));
const CGU              = lazy(() => import("./pages/public/CGU"));
import NotFound         from "./pages/public/NotFound";

// ── Fallback de chargement ────────────────────────────────────────────────────
function PageLoader() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
      height: "100vh", background: "#F8F5EF" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 36, height: 36, border: "3px solid #E4DFD8",
          borderTopColor: "#E8A045", borderRadius: "50%",
          animation: "spin 0.7s linear infinite", margin: "0 auto 12px" }} />
        <div style={{ fontSize: 13, color: "#9BA89F", fontFamily: "'Avenir Next', sans-serif" }}>
          Chargement…
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── ErrorBoundary ─────────────────────────────────────────────────────────────
// Détecte les erreurs de chargement de chunk périmé (fréquentes après un
// déploiement : Vercel a supprimé l'ancien fichier .js hashé → renvoie
// index.html en text/html → « not a valid JavaScript MIME type »). Dans ce cas
// on recharge automatiquement UNE fois pour récupérer la version fraîche, au
// lieu d'afficher une erreur technique. Pour toute autre erreur, on montre un
// écran propre et rassurant (jamais la stack trace côté client).
const CHUNK_ERR = /Loading chunk|dynamically imported module|valid JavaScript MIME type|Importing a module script failed|Failed to fetch|ChunkLoadError|error loading dynamically/i;

class ErrorBoundary extends React.Component {
  state = { error: null, reloading: false };
  static getDerivedStateFromError(e) { return { error: e }; }
  componentDidCatch(error) {
    const blob = `${error?.name || ""} ${error?.message || ""} ${error?.stack || ""}`;
    if (CHUNK_ERR.test(blob)) {
      // Garde anti-boucle : une seule tentative de rechargement par tranche de 20s.
      const KEY = "tci_chunk_reload_at";
      const last = +(sessionStorage.getItem(KEY) || 0);
      if (Date.now() - last > 20000) {
        try { sessionStorage.setItem(KEY, String(Date.now())); } catch (_) {}
        this.setState({ reloading: true });
        window.location.reload();
        return;
      }
    }
    // Log pour le debug (console uniquement, jamais affiché au client)
    console.error("ErrorBoundary:", error);
  }
  render() {
    const { error, reloading } = this.state;
    if (!error) return this.props.children;

    const wrap = {
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "#F8F5EF", fontFamily: "'Avenir Next','Avenir','Century Gothic',sans-serif",
      padding: 24, textAlign: "center",
    };

    // Rechargement en cours (chunk périmé) : petit loader discret, pas d'erreur.
    if (reloading) {
      return (
        <div style={wrap}>
          <div>
            <div style={{ width: 36, height: 36, border: "3px solid #E4DFD8",
              borderTopColor: "#E8A045", borderRadius: "50%",
              animation: "spin 0.7s linear infinite", margin: "0 auto 14px" }} />
            <div style={{ fontSize: 14, color: "#6B7A70" }}>Mise à jour de l'application…</div>
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      );
    }

    // Écran d'erreur propre (aucune donnée technique visible).
    return (
      <div style={wrap}>
        <div style={{ maxWidth: 380 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: "#E8A045",
            color: "white", fontSize: 26, fontWeight: 700, display: "flex", alignItems: "center",
            justifyContent: "center", margin: "0 auto 18px" }}>T</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#1E2E28", marginBottom: 8 }}>
            Oups, un petit souci
          </div>
          <div style={{ fontSize: 14, color: "#6B7A70", lineHeight: 1.55, marginBottom: 22 }}>
            L'application a rencontré un problème d'affichage. Rechargez la page,
            tout devrait rentrer dans l'ordre.
          </div>
          <button onClick={() => window.location.reload()}
            style={{ padding: "11px 26px", background: "#E8A045", color: "white", border: "none",
              borderRadius: 10, cursor: "pointer", fontSize: 14, fontWeight: 600 }}>
            Recharger la page
          </button>
          {/* Détail technique (aide au diagnostic sur appareils spécifiques) */}
          {error?.message && (
            <div style={{ marginTop: 18, fontSize: 11, color: "#B91C1C", fontFamily: "monospace",
              wordBreak: "break-word", background: "#FEF2F2", border: "1px solid #FECACA",
              borderRadius: 8, padding: "8px 10px", textAlign: "left" }}>
              {String(error.name || "Error")}: {String(error.message || "").slice(0, 400)}
            </div>
          )}
        </div>
      </div>
    );
  }
}

// ── MobileBottomNav wrapper ───────────────────────────────────────────────────
// Uniquement visible sur mobile ET hors des espaces admin/restaurant
import { useLocation } from "react-router-dom";

function AppWithNav({ children }) {
  const [isMobile, setIsMobile] = React.useState(() => window.innerWidth < 768);
  const location = useLocation();

  React.useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);

  // Ne pas afficher la bottom nav sur admin, restaurant, menu QR, connexion
  const hideBottomNav =
    location.pathname.startsWith("/admin") ||
    location.pathname.startsWith("/restaurant") ||
    location.pathname.startsWith("/event") ||
    location.pathname.startsWith("/evenement/") ||
    location.pathname.startsWith("/staff") ||
    location.pathname.startsWith("/menu/") ||
    location.pathname.startsWith("/connexion") ||
    location.pathname.startsWith("/inscription") ||
    location.pathname.startsWith("/verify-email") ||
    location.pathname.startsWith("/mot-de-passe") ||
    location.pathname.startsWith("/reset-password");

  return (
    <>
      {children}
      {isMobile && !hideBottomNav && <MobileBottomNav />}
      <NotificationPrompt />
    </>
  );
}

// ── Désactivation du Service Worker ──────────────────────────────────────────
// Le SW causait des erreurs "text/html is not a valid JavaScript MIME type"
// après chaque déploiement : d'anciens chunks JS en cache disparaissaient de
// Vercel → 404 HTML servi comme JS. On désenregistre tout SW existant et on
// purge ses caches pour nettoyer les utilisateurs déjà affectés.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then((regs) => regs.forEach((reg) => reg.unregister()))
    .catch(() => {});
  if (window.caches) {
    caches.keys()
      .then((keys) => keys.forEach((k) => caches.delete(k)))
      .catch(() => {});
  }
}

// Rafraîchissement automatique quand une nouvelle version est déployée
import("./utils/versionCheck.js").then((m) => m.startVersionWatch()).catch(() => {});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <LogoSplash />
      <BrowserRouter>
        <LanguageProvider>
          <ToastProvider>
            <AuthProvider>
              <MaintenanceGate>
              <Suspense fallback={<PageLoader />}>
              <AppWithNav>
                <Routes>
                  {/* ── Pages publiques ─────────────────────────────────── */}
                  <Route path="/"                  element={<Home />} />
                  <Route path="/connexion"         element={<Connexion />} />
                  <Route path="/connexion/admin"   element={<ConnexionAdmin />} />
                  <Route path="/inscription"       element={<Inscription />} />
                  <Route path="/restaurants/:slug" element={<RestaurantDetail />} />
                  <Route path="/evenements"          element={<Evenements />} />
                  <Route path="/evenement/:slug"     element={<EventDetail />} />
                  <Route path="/evenement/:slug/carte" element={<EventOrder />} />
                  <Route path="/billet/:ref"         element={<EventTicket />} />
                  <Route path="/staff"               element={<StaffConsole />} />
                  <Route path="/verify-email"         element={<VerifyEmail />} />
                  <Route path="/mot-de-passe-oublie" element={<MotDePasseOublie />} />
                  <Route path="/reset-password"       element={<ResetPassword />} />
                  <Route path="/confidentialite"   element={<Confidentialite />} />
                  <Route path="/cgu"               element={<CGU />} />
                  {/* Mentions légales retirées pour le lancement */}

                  {/* ── Client — profil personnel (clients uniquement, pas admin ni restaurateur) ── */}
                  <Route path="/profil" element={
                    <ProtectedRoute roles={["client"]}>
                      <Profil />
                    </ProtectedRoute>
                  } />

                  {/* ── Admin ────────────────────────────────────────────── */}
                  <Route path="/admin" element={
                    <ProtectedRoute roles="admin"><AdminLayout /></ProtectedRoute>
                  }>
                    <Route index              element={<AdminOverview />} />
                    <Route path="analytics"     element={<AdminAnalytics />} />
                    <Route path="restaurateurs" element={<Restaurateurs />} />
                    <Route path="utilisateurs"  element={<Utilisateurs />} />
                    <Route path="reservations"  element={<Reservations />} />
                    <Route path="base-donnees"  element={<Contacts />} />
                    {/* Paiements retirés du lancement (soumission App/Play Store) :
                        route Finances désactivée, réactivable plus tard. */}
                    <Route path="systeme"       element={<Systeme />} />
                    <Route path="parametres"    element={<Parametres />} />
                    <Route path="qr-themes"     element={<QRThemes />} />
              <Route path="codes"         element={<CodesRestaurateurs />} />
                    <Route path="codes-organisateurs" element={<CodesOrganisateurs />} />
                    <Route path="site"          element={<SiteParametres />} />
                  </Route>

                  {/* ── Restaurateur ─────────────────────────────────────── */}
                  <Route path="/restaurant" element={
                    <ProtectedRoute roles="restaurateur"><RestaurantLayout /></ProtectedRoute>
                  }>
                    <Route index               element={<RestDashboard />} />
                    <Route path="menu"         element={<RestMenu />} />
                    <Route path="instants"     element={<RestInstants />} />
                    <Route path="reservations" element={<RestReservations />} />
                    <Route path="clients"      element={<RestClients />} />
                    <Route path="plan"         element={<RestPlanSalle />} />
                    <Route path="profil"       element={<RestProfil />} />
                    <Route path="commandes"    element={<RestCommandes />} />
                    <Route path="pos"          element={<RestPOS />} />
                    <Route path="recus"        element={<RestRecus />} />
                    <Route path="equipe"       element={<RestStaff />} />
                  </Route>

                  {/* ── Organisateur (Événements) ────────────────────────── */}
                  <Route path="/event" element={
                    <ProtectedRoute roles="organisateur"><EventLayout /></ProtectedRoute>
                  }>
                    <Route index        element={<EventList />} />
                    <Route path=":id"   element={<EventEditor />} />
                  </Route>

                  {/* ── QR Menu client ─────────────────────────────────── */}
                  <Route path="/menu/:slug" element={<ClientMenu />} />

                  <Route path="*" element={<NotFound />} />
                </Routes>
              </AppWithNav>
              </Suspense>
              </MaintenanceGate>
            </AuthProvider>
          </ToastProvider>
        </LanguageProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
