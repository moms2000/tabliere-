import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./index.css";

import { AuthProvider } from "./context/AuthContext.jsx";
import ProtectedRoute  from "./components/auth/ProtectedRoute.jsx";

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

import ClientMenu       from "./pages/client/ClientMenu";
import Home             from "./pages/public/Home";
import Connexion        from "./pages/public/Connexion";
import Inscription      from "./pages/public/Inscription";
import RestaurantDetail from "./pages/public/RestaurantDetail";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* ── Pages publiques ─────────────────────────────────────────── */}
          <Route path="/"                element={<Home />} />
          <Route path="/connexion"       element={<Connexion />} />
          <Route path="/inscription"     element={<Inscription />} />
          <Route path="/restaurants/:slug" element={<RestaurantDetail />} />

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
          </Route>

          {/* ── Client — accès via QR (public) ───────────────────────────── */}
          <Route path="/menu/:slug" element={<ClientMenu />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
