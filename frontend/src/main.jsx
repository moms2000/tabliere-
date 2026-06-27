import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

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
        </div>
      );
    }
    return this.props.children;
  }
}
import NotFound from "./pages/public/NotFound.jsx";
import "./index.css";

import { AuthProvider }     from "./context/AuthContext.jsx";
import { LanguageProvider } from "./context/LanguageContext.jsx";
import { ToastProvider }    from "./components/ui/Toast.jsx";
import ProtectedRoute       from "./components/auth/ProtectedRoute.jsx";

import AdminLayout   from "./components/layout/AdminLayout";
import AdminOverview from "./pages/admin/AdminOverview";
import Restaurateurs from "./pages/admin/Restaurateurs";
import Utilisateurs  from "./pages/admin/Utilisateurs";
import Reservations  from "./pages/admin/Reservations";
import Finances      from "./pages/admin/Finances";
import Systeme       from "./pages/admin/Systeme";
import Parametres    from "./pages/admin/Parametres";
import QRThemes      from "./pages/admin/QRThemes";

import RestaurantLayout from "./components/layout/RestaurantLayout";
import RestDashboard    from "./pages/restaurant/RestDashboard";
import RestMenu         from "./pages/restaurant/RestMenu";
import RestReservations from "./pages/restaurant/RestReservations";
import RestPlanSalle    from "./pages/restaurant/RestPlanSalle";
import RestProfil       from "./pages/restaurant/RestProfil";
import RestCommandes    from "./pages/restaurant/RestCommandes";

import ClientMenu       from "./pages/client/ClientMenu";
import Profil           from "./pages/client/Profil";
import Home             from "./pages/public/Home";
import Connexion        from "./pages/public/Connexion";
import Inscription      from "./pages/public/Inscription";
import RestaurantDetail from "./pages/public/RestaurantDetail";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
    <BrowserRouter>
      <LanguageProvider>
        <ToastProvider>
        <AuthProvider>
          <Routes>
            {/* ── Pages publiques ─────────────────────────────────────────── */}
            <Route path="/"                  element={<Home />} />
            <Route path="/connexion"         element={<Connexion />} />
            <Route path="/inscription"       element={<Inscription />} />
            <Route path="/restaurants/:slug" element={<RestaurantDetail />} />

            {/* ── Client — espace personnel ────────────────────────────────── */}
            <Route path="/profil" element={
              <ProtectedRoute roles={["client","restaurateur","admin"]}>
                <Profil />
              </ProtectedRoute>
            } />

            {/* ── Admin ────────────────────────────────────────────────────── */}
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
            </Route>

            {/* ── Restaurateur ─────────────────────────────────────────────── */}
            <Route path="/restaurant" element={
              <ProtectedRoute roles="restaurateur"><RestaurantLayout /></ProtectedRoute>
            }>
              <Route index               element={<RestDashboard />} />
              <Route path="menu"         element={<RestMenu />} />
              <Route path="reservations" element={<RestReservations />} />
              <Route path="plan"         element={<RestPlanSalle />} />
              <Route path="profil"       element={<RestProfil />} />
              <Route path="commandes"    element={<RestCommandes />} />
            </Route>

            {/* ── Client — accès via QR (public) ───────────────────────────── */}
            <Route path="/menu/:slug" element={<ClientMenu />} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
        </ToastProvider>
      </LanguageProvider>
    </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
