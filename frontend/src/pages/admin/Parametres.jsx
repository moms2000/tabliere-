import { useState } from "react";
import { motion } from "framer-motion";
import { Settings, Bell, Globe, Lock, MessageSquare, Coins } from "lucide-react";
import { Card, SectionHeader, PageTitle, Btn, Toggle } from "../../components/ui";

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const fadeUp  = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.28 } } };

function Row({ label, desc, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "12px 0", borderBottom: "0.5px solid #f8f8f8" }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
        {desc && <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>{desc}</div>}
      </div>
      <div style={{ flexShrink: 0, marginLeft: 16 }}>{children}</div>
    </div>
  );
}

export default function Parametres() {
  const [notifRes,  setNotifRes]  = useState(true);
  const [notifAbo,  setNotifAbo]  = useState(true);
  const [notifPay,  setNotifPay]  = useState(false);
  const [maint,     setMaint]     = useState(false);
  const [inscription, setInscription] = useState(true);
  const [whatsapp,  setWhatsapp]  = useState(true);
  const [commission, setCommission] = useState("5");
  const [frGratuit,  setFrGratuit]  = useState("5");
  const [frStandard, setFrStandard] = useState("25000");
  const [frPremium,  setFrPremium]  = useState("60000");

  const inputStyle = {
    height: 32, border: "0.5px solid #eee", borderRadius: 8, padding: "0 10px",
    fontSize: 13, outline: "none", color: "#333", width: 160
  };

  return (
    <motion.div variants={stagger} initial="hidden" animate="show">
      <motion.div variants={fadeUp}>
        <PageTitle title="Paramètres" subtitle="Configuration globale de la plateforme" />
      </motion.div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>

        {/* Notifications */}
        <motion.div variants={fadeUp}>
          <Card>
            <SectionHeader title="Notifications" icon={Bell} />
            <Row label="Alertes réservations" desc="Notification à chaque nouvelle réservation">
              <Toggle value={notifRes} onChange={setNotifRes} />
            </Row>
            <Row label="Nouveaux abonnements" desc="Alerte lors d'un paiement d'abonnement">
              <Toggle value={notifAbo} onChange={setNotifAbo} />
            </Row>
            <Row label="Erreurs de paiement" desc="Notification en cas d'échec transaction">
              <Toggle value={notifPay} onChange={setNotifPay} />
            </Row>
            <Row label="WhatsApp Business" desc="Canal principal de communication clients">
              <Toggle value={whatsapp} onChange={setWhatsapp} />
            </Row>
          </Card>
        </motion.div>

        {/* Plateforme */}
        <motion.div variants={fadeUp}>
          <Card>
            <SectionHeader title="Plateforme" icon={Globe} />
            <Row label="Mode maintenance" desc="Désactive l'accès public temporairement">
              <Toggle value={maint} onChange={setMaint} />
            </Row>
            <Row label="Inscriptions ouvertes" desc="Autoriser de nouveaux restaurants">
              <Toggle value={inscription} onChange={setInscription} />
            </Row>
            <Row label="Commission plateforme (%)" desc="% prélevé sur chaque réservation payante">
              <input value={commission} onChange={e => setCommission(e.target.value)}
                type="number" min="0" max="30" style={{ ...inputStyle, width: 80 }} />
            </Row>
          </Card>
        </motion.div>

        {/* Tarifs abonnements */}
        <motion.div variants={fadeUp}>
          <Card>
            <SectionHeader title="Tarifs des abonnements" icon={Coins} />
            <Row label="Plan Gratuit (F/mois)" desc="0 = offert">
              <input value={frGratuit} onChange={e => setFrGratuit(e.target.value)}
                type="number" style={{ ...inputStyle, width: 120 }} />
            </Row>
            <Row label="Plan Standard (F/mois)">
              <input value={frStandard} onChange={e => setFrStandard(e.target.value)}
                type="number" style={{ ...inputStyle, width: 120 }} />
            </Row>
            <Row label="Plan Premium (F/mois)">
              <input value={frPremium} onChange={e => setFrPremium(e.target.value)}
                type="number" style={{ ...inputStyle, width: 120 }} />
            </Row>
            <div style={{ marginTop: 14 }}>
              <Btn variant="primary">Enregistrer les tarifs</Btn>
            </div>
          </Card>
        </motion.div>

        {/* Sécurité */}
        <motion.div variants={fadeUp}>
          <Card>
            <SectionHeader title="Sécurité & Accès" icon={Lock} />
            <Row label="Double authentification" desc="2FA pour les super admins">
              <Toggle value={true} onChange={() => {}} />
            </Row>
            <Row label="Durée de session" desc="Déconnexion automatique (heures)">
              <select style={{ ...inputStyle, width: 100 }}>
                <option>4h</option>
                <option>8h</option>
                <option>24h</option>
              </select>
            </Row>
            <Row label="Changer mot de passe admin">
              <Btn variant="default" icon={Lock}>Modifier</Btn>
            </Row>
            <Row label="Exporter les logs">
              <Btn variant="default">Télécharger (.csv)</Btn>
            </Row>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}
