import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";

import { AuthProvider }     from "./context/AuthContext.jsx";
import MobileBottomNav     from "./components/mobile/MobileBottomNav.jsx";
import { LanguageProvider } from "./context/LanguageContext.jsx";
import { ToastProvider }    from "./components/ui/Toast.jsx";
import ProtectedRoute       from "./components/auth/ProtectedRoute.jsx";

// ── Lazy imports : chaque page est chargée à la demande ──────────────────────
const AdminLayout       = lazy(() => import("./components/layout/AdminLayout"));
const AdminOverview     = lazy(() => import("./pages/admin/AdminOverview"));
const Restaurateurs     = lazy(() => import("./pages/admin/Restaurateurs"));
const Utilisateurs      = lazy(() => import("./pages/admin/Utilisateurs"));
const Reservations      = lazy(() => import("./pages/admin/Reservations"));
const Finances          = lazy(() => import("./pages/admin/Finances"));
const Systeme           = lazy(() => import("./pages/admin/Systeme"));
const Parametres        = lazy(() => import("./pages/admin/Parametres"));
const QRThemes          = lazy(() => import("./pages/admin/QRThemes"));
const CodesRestaurateurs = lazy(() => import("./pages/admin/CodesRestaurateurs"));

const RestaurantLayout  = lazy(() => import("./components/layout/RestaurantLayout"));
const RestDashboard     = lazy(() => import("./pages/restaurant/RestDashboard"));
const RestMenu          = lazy(() => import("./pages/restaurant/RestMenu"));
const RestReservations  = lazy(() => import("./pages/restaurant/RestReservations"));
const RestPlanSalle     = lazy(() => import("./pages/restaurant/RestPlanSalle"));
const RestProfil        = lazy(() => import("./pages/restaurant/RestProfil"));
const RestCommandes     = lazy(() => import("./pages/restaurant/RestCommandes"));
const RestPOS           = lazy(() => import("./pages/restaurant/RestPOS"));

const ClientMenu        = lazy(() => import("./pages/client/ClientMenu"));
const Profil            = lazy(() => import("./pages/client/Profil"));

// Pages publiques — préchargées car critiques au premier chargement
import Home             from "./pages/public/Home";
import Connexion        from "./pages/public/Connexion";
import Inscription      from "./pages/public/Inscription";
import RestaurantDetail from "./pages/public/RestaurantDetail";
const Confidentialite  = lazy(() => import("./pages/public/Confidentialite"));
const VerifyEmail       = lazy(() => import("./pages/public/VerifyEmail"));
const MotDePasseOublie  = lazy(() => import("./pages/public/MotDePasseOublie"));
const ResetPassword     = lazy(() => import("./pages/public/ResetPassword"));
const CGU              = lazy(() => import("./pages/public/CGU"));
const MentionsLegales  = lazy(() => import("./pages/public/MentionsLegales"));
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
class ErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, fontFamily: "monospace", color: "#DC2626" }}>
          <h2>Erreur de rendu</h2>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 13 }}>
            {this.state.error?.message}{"\n\n"}{this.state.error?.stack}
          </pre>
          <button onClick={() => window.location.reload()}
            style={{ marginTop: 16, padding: "8px 20px", background: "#E8A045",
              color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14 }}>
            Recharger
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── MobileBottomNav wrapper ───────────────────────────────────────────────────
function AppWithNav({ children }) {
  const [isMobile, setIsMobile] = React.useState(() => window.innerWidth < 768);
  React.useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return (
    <>
      {children}
      {isMobile && <MobileBottomNav />}
    </>
  );
}

// ── PWA Service Worker ────────────────────────────────────────────────────────
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js")
      .then(() => console.log("SW enregistré"))
      .catch(() => {});
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <LanguageProvider>
          <ToastProvider>
            <AuthProvider>
              <Suspense fallback={<PageLoader />}>
              <AppWithNav>
                <Routes>
                  {/* ── Pages publiques ─────────────────────────────────── */}
                  <Route path="/"                  element={<Home />} />
                  <Route path="/connexion"         element={<Connexion />} />
                  <Route path="/inscription"       element={<Inscription />} />
                  <Route path="/restaurants/:slug" element={<RestaurantDetail />} />
                  <Route path="/verify-email"         element={<VerifyEmail />} />
                  <Route path="/mot-de-passe-oublie" element={<MotDePasseOublie />} />
                  <Route path="/reset-password"       element={<ResetPassword />} />
                  <Route path="/confidentialite"   element={<Confidentialite />} />
                  <Route path="/cgu"               element={<CGU />} />
                  <Route path="/mentions-legales"  element={<MentionsLegales />} />

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
                    <Route path="restaurateurs" element={<Restaurateurs />} />
                    <Route path="utilisateurs"  element={<Utilisateurs />} />
                    <Route path="reservations"  element={<Reservations />} />
                    <Route path="finances"      element={<Finances />} />
                    <Route path="systeme"       element={<Systeme />} />
                    <Route path="parametres"    element={<Parametres />} />
                    <Route path="qr-themes"     element={<QRThemes />} />
              <Route path="codes"         element={<CodesRestaurateurs />} />
                  </Route>

                  {/* ── Restaurateur ─────────────────────────────────────── */}
                  <Route path="/restaurant" element={
                    <ProtectedRoute roles="restaurateur"><RestaurantLayout /></ProtectedRoute>
                  }>
                    <Route index               element={<RestDashboard />} />
                    <Route path="menu"         element={<RestMenu />} />
                    <Route path="reservations" element={<RestReservations />} />
                    <Route path="plan"         element={<RestPlanSalle />} />
                    <Route path="profil"       element={<RestProfil />} />
                    <Route path="commandes"    element={<RestCommandes />} />
                    <Route path="pos"          element={<RestPOS />} />
                  </Route>

                  {/* ── QR Menu client ─────────────────────────────────── */}
                  <Route path="/menu/:slug" element={<ClientMenu />} />

                  <Route path="*" element={<NotFound />} />
                </Routes>
              </AppWithNav>
              </Suspense>
            </AuthProvider>
          </ToastProvider>
        </LanguageProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
