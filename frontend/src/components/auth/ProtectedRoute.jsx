import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";

/**
 * Protège une route — redirige vers /connexion si non connecté.
 * @param {string|string[]} roles - Rôle(s) autorisé(s). Omis = tout le monde connecté.
 */
export default function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Pendant le chargement initial, ne rien afficher
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-[#1D9E75] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    // Rediriger les routes admin vers la page d'auth admin (chemin secret)
    const dest = location.pathname.startsWith("/admin")
      ? "/connexion/admin"
      : "/connexion";
    return <Navigate to={dest} state={{ from: location }} replace />;
  }

  if (roles) {
    const allowed = Array.isArray(roles) ? roles : [roles];
    if (!allowed.includes(user.role)) {
      // Rediriger selon le rôle réel
      if (user.role === "admin")        return <Navigate to="/admin" replace />;
      if (user.role === "restaurateur") return <Navigate to="/restaurant" replace />;
      return <Navigate to="/" replace />;
    }
  }

  return children;
}
