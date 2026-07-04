import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const P = "#E8A045"; const DARK = "#1E2E28"; const MUTED = "#9BA89F";
const FONT = "'Avenir Next','Avenir','Century Gothic',sans-serif";

export default function Confidentialite() {
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
          Politique de Confidentialité
        </h1>
        <p style={{ color: MUTED, fontSize: 13, marginBottom: 36 }}>Dernière mise à jour : 1er janvier 2026</p>

        {[
          {
            title: "1. Qui sommes-nous ?",
            content: `TablièreCI est une plateforme de réservation de restaurants en ligne opérant en Côte d'Ivoire. Notre siège social est situé à Abidjan, Côte d'Ivoire. Nous sommes responsables du traitement de vos données personnelles dans le cadre de l'utilisation de notre service.`
          },
          {
            title: "2. Données collectées",
            content: `Nous collectons les données suivantes :\n\n• Informations d'identification : nom complet, adresse e-mail, numéro de téléphone WhatsApp\n• Données de réservation : restaurant choisi, date, heure, nombre de convives, demandes spéciales\n• Données de navigation : adresse IP, type d'appareil, navigateur, pages visitées\n• Photo de profil (optionnelle)\n\nAucun paiement n'est traité sur la plateforme : nous ne collectons ni ne stockons de données bancaires.\n\nNous ne collectons pas de données sensibles (origines raciales, données biométriques, convictions religieuses).`
          },
          {
            title: "3. Pourquoi utilisons-nous vos données ?",
            content: `Vos données sont utilisées pour :\n\n• Créer et gérer votre compte TablièreCI\n• Traiter et confirmer vos réservations\n• Vous envoyer des confirmations et rappels par WhatsApp ou e-mail\n• Améliorer nos services et personnaliser votre expérience\n• Respecter nos obligations légales et réglementaires\n• Prévenir la fraude et sécuriser la plateforme\n• Vous envoyer des offres et nouveautés (avec votre consentement)`
          },
          {
            title: "4. Base légale du traitement",
            content: `Nos traitements sont fondés sur :\n\n• L'exécution du contrat (réservations, gestion de compte)\n• Notre intérêt légitime (amélioration des services, sécurité)\n• Votre consentement (communications marketing, photo de profil)\n• Obligations légales (conservation des données fiscales)`
          },
          {
            title: "5. Partage des données",
            content: `Nous ne vendons jamais vos données. Nous les partageons uniquement avec :\n\n• Les restaurateurs partenaires : pour traiter votre réservation (nom, téléphone, date, nombre de personnes)\n• Prestataire de messagerie : Meta (WhatsApp Business API) — pour les confirmations\n• Hébergeur : Render.com (États-Unis) — avec garanties contractuelles adéquates\n\nTout transfert hors de Côte d'Ivoire est effectué avec les garanties appropriées.`
          },
          {
            title: "6. Conservation des données",
            content: `• Données de compte : conservées tant que votre compte est actif + 3 ans après suppression\n• Données de réservation : 5 ans (obligations légales et comptables)\n• Données de navigation : 13 mois maximum\n\nAprès expiration, vos données sont supprimées ou anonymisées.`
          },
          {
            title: "7. Vos droits",
            content: `Conformément à la réglementation applicable, vous disposez des droits suivants :\n\n• Droit d'accès : obtenir une copie de vos données\n• Droit de rectification : corriger des données inexactes\n• Droit à l'effacement : supprimer votre compte et vos données\n• Droit d'opposition : vous opposer à certains traitements\n• Droit à la portabilité : recevoir vos données dans un format lisible\n• Droit de retrait du consentement : à tout moment\n\nPour exercer vos droits, contactez-nous : privacy@tabliereci.net`
          },
          {
            title: "8. Cookies",
            content: `Nous utilisons des cookies essentiels au fonctionnement du service (authentification, préférences de langue) et des cookies analytiques anonymisés pour améliorer nos services. Vous pouvez refuser les cookies non essentiels via les paramètres de votre navigateur.`
          },
          {
            title: "9. Sécurité",
            content: `Nous mettons en œuvre des mesures de sécurité appropriées :\n\n• Chiffrement des données en transit (HTTPS/TLS)\n• Mots de passe hachés (bcrypt)\n• Tokens JWT avec expiration courte\n• Limitation du nombre de tentatives de connexion\n• Accès restreint aux données personnelles\n\nEn cas de violation de données, nous vous notifierons dans les 72 heures si votre vie privée est susceptible d'être affectée.`
          },
          {
            title: "10. Contact",
            content: `Pour toute question relative à la protection de vos données :\n\nTablièreCI — Délégué à la protection des données\nE-mail : privacy@tabliereci.net\nAdresse : Abidjan, Côte d'Ivoire\nTéléphone : +225 07 00 00 00 00\n\nVous pouvez également adresser une réclamation auprès de l'Autorité de Régulation des Télécommunications de Côte d'Ivoire (ARTCI).`
          },
        ].map((s, i) => (
          <section key={i} style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: DARK, marginBottom: 12, fontFamily: FONT }}>{s.title}</h2>
            <div style={{ fontSize: 14, color: "#555", lineHeight: 1.8, whiteSpace: "pre-line" }}>{s.content}</div>
          </section>
        ))}
      </div>
    </div>
  );
}
