import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const P = "#E8A045"; const DARK = "#1E2E28"; const MUTED = "#9BA89F";
const FONT = "'Avenir Next','Avenir','Century Gothic',sans-serif";

export default function MentionsLegales() {
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
          Mentions Légales
        </h1>
        <p style={{ color: MUTED, fontSize: 13, marginBottom: 36 }}>Dernière mise à jour : 1er janvier 2026</p>

        {[
          {
            title: "Éditeur du site",
            content: `Raison sociale : TablièreCI\nForme juridique : SARL (Société à Responsabilité Limitée)\nCapital social : [À compléter lors de l'immatriculation]\nSiège social : Abidjan, Plateau, Côte d'Ivoire\nRCCM : [À compléter lors de l'immatriculation]\nNuméro fiscal : [À compléter]\nDirecteur de la publication : Mohamed Coulibaly\nTéléphone : +225 07 00 00 00 00\nE-mail : contact@tabliereci.com`
          },
          {
            title: "Hébergement",
            content: `Le site TablièreCI est hébergé par :\n\nRender Services, Inc.\n525 Brannan Street, Suite 300\nSan Francisco, CA 94107, États-Unis\nSite web : render.com\n\nLe frontend est déployé sur :\nVercel Inc.\n340 Pine Street, 5th Floor\nSan Francisco, CA 94104, États-Unis\nSite web : vercel.com`
          },
          {
            title: "Propriété intellectuelle",
            content: `L'ensemble des contenus présents sur tabliereci.com (textes, images, graphismes, logo, icônes, sons, logiciels) est la propriété exclusive de TablièreCI ou de ses partenaires, et est protégé par les lois ivoiriennes et internationales relatives à la propriété intellectuelle.\n\nToute reproduction, représentation, modification, publication, adaptation ou exploitation, totale ou partielle, des éléments du site, quel que soit le moyen ou le procédé utilisé, est interdite, sauf autorisation écrite préalable de TablièreCI.\n\nToute exploitation non autorisée du site ou de son contenu sera considérée comme constitutive d'une contrefaçon et poursuivie conformément aux dispositions légales en vigueur en Côte d'Ivoire.`
          },
          {
            title: "Données personnelles",
            content: `TablièreCI collecte et traite des données à caractère personnel dans le cadre de la fourniture de ses services. Ces traitements sont effectués conformément à notre Politique de Confidentialité, accessible depuis le pied de page du site.\n\nConformément à la réglementation en vigueur, notamment la loi ivoirienne n° 2013-450 du 19 juin 2013 relative à la protection des données à caractère personnel, vous disposez de droits sur vos données (accès, rectification, effacement, portabilité, opposition).\n\nResponsable du traitement : TablièreCI\nContact DPO : privacy@tabliereci.com\n\nAutorité de contrôle compétente : ARTCI (Autorité de Régulation des Télécommunications de Côte d'Ivoire)`
          },
          {
            title: "Cookies",
            content: `Le site TablièreCI utilise des cookies pour :\n\n• Assurer le bon fonctionnement du service (cookies essentiels)\n• Mémoriser vos préférences de langue et de session\n• Analyser l'utilisation du site (cookies analytiques anonymisés)\n\nVous pouvez configurer votre navigateur pour refuser les cookies. Certaines fonctionnalités du site pourraient alors être dégradées. Pour plus d'informations, consultez notre Politique de Confidentialité.`
          },
          {
            title: "Liens hypertextes",
            content: `TablièreCI peut contenir des liens vers des sites tiers (restaurants partenaires, prestataires de paiement, réseaux sociaux). Ces liens sont fournis à titre informatif uniquement. TablièreCI n'exerce aucun contrôle sur le contenu de ces sites et décline toute responsabilité quant à leur contenu, leur disponibilité ou les pratiques de confidentialité de ces tiers.\n\nLa création de liens hypertextes pointant vers le site tabliereci.com est soumise à l'accord préalable écrit de TablièreCI.`
          },
          {
            title: "Limitation de responsabilité",
            content: `TablièreCI s'efforce d'assurer l'exactitude et la mise à jour des informations publiées sur ce site. Cependant, TablièreCI ne peut garantir l'exactitude, la complétude ou l'actualité des informations diffusées.\n\nTablièreCI décline toute responsabilité pour :\n• Les interruptions temporaires d'accès au site dues à des opérations de maintenance\n• Les dommages directs ou indirects résultant de l'utilisation ou de l'impossibilité d'utiliser le site\n• Les éventuels virus ou programmes malveillants provenant de sites tiers\n\nL'utilisateur est seul responsable de l'utilisation qu'il fait du site et de ses contenus.`
          },
          {
            title: "Droit applicable et juridiction compétente",
            content: `Les présentes mentions légales sont soumises au droit de la République de Côte d'Ivoire. En cas de litige relatif à l'utilisation du site tabliereci.com, les tribunaux d'Abidjan seront seuls compétents.\n\nPour toute question relative aux présentes mentions légales :\nE-mail : legal@tabliereci.com\nAdresse : TablièreCI, Abidjan Plateau, Côte d'Ivoire`
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
