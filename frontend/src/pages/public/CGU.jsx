import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const P = "#E8A045"; const DARK = "#1E2E28"; const MUTED = "#9BA89F";
const FONT = "'Avenir Next','Avenir','Century Gothic',sans-serif";

export default function CGU() {
  const navigate = useNavigate();
  return (
    <div style={{ fontFamily: FONT, background: "#F8F5EF", minHeight: "100vh" }}>
      <nav style={{ background: "white", borderBottom: "0.5px solid #E4DFD8",
        padding: "14px 24px", display: "flex", alignItems: "center", gap: 12,
        position: "sticky", top: 0, zIndex: 20 }}>
        <button onClick={() => navigate(-1)}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "none",
            border: "none", cursor: "pointer", color: MUTED, fontSize: 13 }}>
          <ArrowLeft size={15} /> Retour
        </button>
        <span style={{ fontSize: 15, fontWeight: 700, color: DARK }}>
          Tablière<span style={{ color: P }}>CI</span>
        </span>
      </nav>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "40px 24px 80px" }}>
        <h1 style={{ fontSize: 28, fontWeight: 300, color: DARK, marginBottom: 6 }}>
          Conditions Générales d'Utilisation
        </h1>
        <p style={{ color: MUTED, fontSize: 13, marginBottom: 36 }}>Dernière mise à jour : 1er janvier 2026</p>

        {[
          {
            title: "1. Présentation et acceptation",
            content: `TablièreCI est une plateforme de réservation de restaurants en ligne opérée par TablièreCI (ci-après « nous » ou « la Société »), dont le siège est à Abidjan, Côte d'Ivoire.\n\nEn accédant à notre plateforme et en créant un compte, vous acceptez les présentes Conditions Générales d'Utilisation (CGU) sans réserve. Si vous n'acceptez pas ces conditions, veuillez ne pas utiliser nos services.\n\nNous nous réservons le droit de modifier ces CGU à tout moment. Les modifications prennent effet dès leur publication. Votre utilisation continuée du service vaut acceptation des nouvelles conditions.`
          },
          {
            title: "2. Description du service",
            content: `TablièreCI permet à ses utilisateurs de :\n\n• Rechercher des restaurants en Côte d'Ivoire\n• Effectuer des réservations de tables en ligne\n• Consulter les menus via QR code\n• Passer des commandes depuis leur table\n• Gérer leurs réservations et leur historique\n\nLe service est accessible via le site web tabliereci.com. TablièreCI agit en qualité d'intermédiaire entre les clients et les restaurateurs partenaires.`
          },
          {
            title: "3. Inscription et compte utilisateur",
            content: `3.1. Pour utiliser les fonctionnalités de réservation, vous devez créer un compte en fournissant :\n• Un nom complet exact\n• Une adresse e-mail valide et accessible\n• Un numéro de téléphone WhatsApp actif\n• Un mot de passe d'au moins 8 caractères\n\n3.2. Vous êtes responsable de la confidentialité de vos identifiants. Toute activité réalisée depuis votre compte vous est imputable.\n\n3.3. Vous devez avoir au moins 18 ans pour créer un compte.\n\n3.4. Vous vous engagez à fournir des informations exactes et à les maintenir à jour.`
          },
          {
            title: "4. Réservations",
            content: `4.1. Processus de réservation\nUne réservation est effective après confirmation par le restaurateur. TablièreCI ne garantit pas la disponibilité des tables.\n\n4.2. Confirmation\nVous recevrez une confirmation par e-mail et/ou WhatsApp. Conservez votre numéro de référence.\n\n4.3. Annulation\nToute annulation doit être effectuée au moins 2 heures avant l'heure de réservation. En cas d'annulation tardive répétée, TablièreCI se réserve le droit de suspendre votre compte.\n\n4.4. No-show\nEn cas d'absence non signalée, le restaurateur peut vous déclarer en « no-show ». Au-delà de 2 no-shows, votre compte peut être restreint.\n\n4.5. Ponctualité\nNous recommandons d'arriver à l'heure. Passé 15 minutes de retard sans avertissement, le restaurateur peut disposer de votre table.`
          },
          {
            title: "5. Obligations des utilisateurs",
            content: `En utilisant TablièreCI, vous vous engagez à :\n\n• Ne pas effectuer de fausses réservations\n• Respecter le personnel et les locaux des établissements\n• Ne pas publier de contenus diffamatoires ou mensongers\n• Ne pas utiliser le service à des fins commerciales non autorisées\n• Ne pas tenter de contourner les mesures de sécurité\n• Respecter les droits de propriété intellectuelle\n\nTout manquement peut entraîner la suspension ou suppression de votre compte.`
          },
          {
            title: "6. Commandes via QR Code",
            content: `6.1. En scannant le QR code d'un restaurant, vous accédez à son menu numérique et pouvez passer une commande directement depuis votre table.\n\n6.2. En confirmant votre commande, vous vous engagez à :\n• Régler l'intégralité de la commande passée\n• Assumer l'entière responsabilité en cas d'erreur de saisie de votre part\n• Respecter les conditions de service du restaurant\n\n6.3. Toute commande confirmée est considérée comme ferme et définitive. Les annulations après confirmation sont à la discrétion du restaurateur.`
          },
          {
            title: "7. Paiements",
            content: `TablièreCI prend en charge les moyens de paiement suivants : Orange Money, MTN MoMo, Wave, cartes bancaires (via Stripe).\n\nLes prix affichés sont en Francs CFA (FCFA) et incluent toutes les taxes applicables. TablièreCI peut percevoir une commission sur certaines transactions au profit du maintien et développement de la plateforme.\n\nEn cas de litige de paiement, contactez-nous dans les 48 heures suivant la transaction.`
          },
          {
            title: "8. Programme de fidélité",
            content: `TablièreCI propose un programme de points de fidélité (Bronze, Argent, Or, Platinum). Les points sont crédités automatiquement après chaque réservation confirmée et honorée. TablièreCI se réserve le droit de modifier ou supprimer ce programme à tout moment avec un préavis de 30 jours.`
          },
          {
            title: "9. Propriété intellectuelle",
            content: `Tous les contenus présents sur TablièreCI (logo, textes, images, design, code source) sont la propriété exclusive de TablièreCI ou de ses partenaires. Toute reproduction, représentation ou utilisation non autorisée est strictement interdite et peut faire l'objet de poursuites judiciaires.`
          },
          {
            title: "10. Limitation de responsabilité",
            content: `TablièreCI agit en qualité d'intermédiaire technique. Nous ne saurions être tenus responsables :\n\n• De la qualité des prestations des restaurants partenaires\n• Des indisponibilités temporaires du service\n• Des pertes de données dues à des causes extérieures\n• Des dommages indirects résultant de l'utilisation du service\n\nNotre responsabilité maximale est limitée au montant des sommes versées par l'utilisateur au cours des 12 derniers mois.`
          },
          {
            title: "11. Résiliation",
            content: `Vous pouvez supprimer votre compte à tout moment depuis votre espace profil. La suppression entraîne l'anonymisation de vos données selon notre politique de confidentialité.\n\nTablièreCI peut suspendre ou supprimer votre compte en cas de violation des présentes CGU, avec ou sans préavis selon la gravité des faits.`
          },
          {
            title: "12. Droit applicable et litiges",
            content: `Les présentes CGU sont régies par le droit ivoirien. En cas de litige, les parties s'engagent à rechercher une solution amiable. À défaut, le litige sera soumis à la juridiction compétente d'Abidjan, Côte d'Ivoire.\n\nPour tout litige ou réclamation : contact@tabliereci.com ou +225 07 00 00 00 00.`
          },
        ].map((s, i) => (
          <section key={i} style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: DARK, marginBottom: 12 }}>{s.title}</h2>
            <div style={{ fontSize: 14, color: "#555", lineHeight: 1.8, whiteSpace: "pre-line" }}>{s.content}</div>
          </section>
        ))}
      </div>
    </div>
  );
}
