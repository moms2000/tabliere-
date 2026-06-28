import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Settings, Bell, Globe, Lock, Coins, Check, AlertTriangle, Eye, EyeOff } from "lucide-react";
import { Card, SectionHeader, PageTitle, Btn, Toggle } from "../../components/ui";
import { adminService } from "../../services/admin.service.js";

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

function Toast({ msg, type = "success" }) {
  return msg ? (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      style={{ padding: "9px 14px", borderRadius: 8, fontSize: 12, marginBottom: 12,
        background: type === "success" ? "#f0f6f2" : "#faece7",
        color:      type === "success" ? "#1D9E75"  : "#993C1D",
        border: `0.5px solid ${type === "success" ? "#1D9E7555" : "#993C1D44"}` }}>
      {type === "success" ? "✓ " : "⚠ "}{msg}
    </motion.div>
  ) : null;
}

const inputStyle = {
  height: 34, border: "0.5px solid #eee", borderRadius: 8, padding: "0 10px",
  fontSize: 13, outline: "none", color: "#333", background: "#f8f5ef",
};

export default function Parametres() {
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [toast,    setToast]    = useState(null);

  // Notifications
  const [notifRes,  setNotifRes]  = useState(true);
  const [notifAbo,  setNotifAbo]  = useState(true);
  const [notifPay,  setNotifPay]  = useState(false);
  const [whatsapp,  setWhatsapp]  = useState(true);

  // Plateforme
  const [maint,       setMaint]       = useState(false);
  const [inscription, setInscription] = useState(true);
  const [commission,  setCommission]  = useState("5");

  // Tarifs
  const [frGratuit,   setFrGratuit]   = useState("0");
  const [frStandard,  setFrStandard]  = useState("25000");
  const [frPremium,   setFrPremium]   = useState("60000");

  // Sécurité
  const [sessionDur,  setSessionDur]  = useState("4");
  const [curPwd,      setCurPwd]      = useState("");
  const [newPwd,      setNewPwd]      = useState("");
  const [showPwd,     setShowPwd]     = useState(false);
  const [pwdMsg,      setPwdMsg]      = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Charger les paramètres depuis l'API
  useEffect(() => {
    adminService.getSettings()
      .then(s => {
        setNotifRes (s.notif_reservations === "true");
        setNotifAbo (s.notif_abonnements  === "true");
        setNotifPay (s.notif_paiements    === "true");
        setWhatsapp (s.notif_whatsapp     === "true");
        setMaint      (s.maintenance_mode   === "true");
        setInscription(s.inscriptions_open  === "true");
        setCommission (s.commission_pct);
        setFrGratuit  (s.price_gratuit);
        setFrStandard (s.price_standard);
        setFrPremium  (s.price_premium);
        setSessionDur (s.session_duration_h);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Sauvegarder un groupe de paramètres
  const saveGroup = async (settings) => {
    setSaving(true);
    try {
      await adminService.updateSettings(settings);
      showToast("Paramètres enregistrés");
    } catch (e) {
      showToast(e.response?.data?.message || "Erreur lors de la sauvegarde", "error");
    }
    setSaving(false);
  };

  // Toggle auto-save
  const toggleAndSave = (setter, key) => async (val) => {
    setter(val);
    try {
      await adminService.updateSettings({ [key]: String(val) });
      showToast(`${key.replace(/_/g, " ")} mis à jour`);
    } catch (e) {
      showToast("Erreur de sauvegarde", "error");
    }
  };

  // Changer mot de passe
  const changePassword = async () => {
    if (!curPwd || !newPwd) { setPwdMsg({ msg: "Remplissez les deux champs", type: "error" }); return; }
    if (newPwd.length < 8)  { setPwdMsg({ msg: "Minimum 8 caractères", type: "error" }); return; }
    try {
      await adminService.changePassword(curPwd, newPwd);
      setCurPwd(""); setNewPwd("");
      setPwdMsg({ msg: "Mot de passe modifié avec succès", type: "success" });
      setTimeout(() => setPwdMsg(null), 4000);
    } catch (e) {
      setPwdMsg({ msg: e.response?.data?.message || "Erreur", type: "error" });
    }
  };

  // Exporter les logs
  const exportLogs = async () => {
    try { await adminService.exportCSV("reservations"); showToast("Export téléchargé"); }
    catch (e) { showToast("Erreur d'export", "error"); }
  };

  if (loading) return (
    <div style={{ textAlign: "center", padding: "60px 0", color: "#aaa", fontSize: 13 }}>Chargement des paramètres…</div>
  );

  return (
    <motion.div variants={stagger} initial="hidden" animate="show">
      <motion.div variants={fadeUp}>
        <PageTitle title="Paramètres" subtitle="Configuration globale de la plateforme" />
      </motion.div>

      {toast && <motion.div variants={fadeUp}><Toast msg={toast.msg} type={toast.type} /></motion.div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 14 }}>

        {/* ── Notifications ── */}
        <motion.div variants={fadeUp}>
          <Card>
            <SectionHeader title="Notifications" icon={Bell} />
            <Row label="Alertes réservations" desc="Notification à chaque nouvelle réservation">
              <Toggle value={notifRes} onChange={toggleAndSave(setNotifRes, "notif_reservations")} />
            </Row>
            <Row label="Nouveaux abonnements" desc="Alerte lors d'un paiement d'abonnement">
              <Toggle value={notifAbo} onChange={toggleAndSave(setNotifAbo, "notif_abonnements")} />
            </Row>
            <Row label="Erreurs de paiement" desc="Notification en cas d'échec transaction">
              <Toggle value={notifPay} onChange={toggleAndSave(setNotifPay, "notif_paiements")} />
            </Row>
            <Row label="WhatsApp Business" desc="Canal principal de communication clients">
              <Toggle value={whatsapp} onChange={toggleAndSave(setWhatsapp, "notif_whatsapp")} />
            </Row>
          </Card>
        </motion.div>

        {/* ── Plateforme ── */}
        <motion.div variants={fadeUp}>
          <Card>
            <SectionHeader title="Plateforme" icon={Globe} />
            <Row label="Mode maintenance" desc="Désactive l'accès public temporairement">
              <Toggle value={maint} onChange={v => {
                setMaint(v);
                if (v && !window.confirm("Activer le mode maintenance ? Les utilisateurs ne pourront plus accéder au site.")) {
                  setMaint(false); return;
                }
                toggleAndSave(setMaint, "maintenance_mode")(v);
              }} />
            </Row>
            {maint && (
              <div style={{ padding: "8px 12px", background: "#faeeda", borderRadius: 8,
                fontSize: 12, color: "#854F0B", marginBottom: 8, display: "flex", gap: 6, alignItems: "center" }}>
                <AlertTriangle size={13} /> Le site est en maintenance — les clients ne peuvent pas accéder
              </div>
            )}
            <Row label="Inscriptions ouvertes" desc="Autoriser de nouveaux restaurants">
              <Toggle value={inscription} onChange={toggleAndSave(setInscription, "inscriptions_open")} />
            </Row>
            <Row label="Commission plateforme (%)" desc="% prélevé sur chaque réservation payante">
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input value={commission} onChange={e => setCommission(e.target.value)}
                  type="number" min="0" max="30" style={{ ...inputStyle, width: 70 }} />
                <Btn variant="primary" style={{ fontSize: 11, padding: "4px 10px" }}
                  onClick={() => saveGroup({ commission_pct: commission })}>
                  {saving ? "…" : <Check size={13} />}
                </Btn>
              </div>
            </Row>
          </Card>
        </motion.div>

        {/* ── Tarifs abonnements ── */}
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
              <Btn variant="primary" disabled={saving}
                onClick={() => saveGroup({ price_gratuit: frGratuit, price_standard: frStandard, price_premium: frPremium })}>
                {saving ? "Enregistrement…" : "Enregistrer les tarifs"}
              </Btn>
            </div>
          </Card>
        </motion.div>

        {/* ── Sécurité & Accès ── */}
        <motion.div variants={fadeUp}>
          <Card>
            <SectionHeader title="Sécurité & Accès" icon={Lock} />
            <Row label="Durée de session" desc="Déconnexion automatique (heures)">
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <select value={sessionDur} onChange={e => setSessionDur(e.target.value)}
                  style={{ ...inputStyle, width: 90, cursor: "pointer" }}>
                  {["1","2","4","8","12","24"].map(h => (
                    <option key={h} value={h}>{h}h</option>
                  ))}
                </select>
                <Btn variant="primary" style={{ fontSize: 11, padding: "4px 10px" }}
                  onClick={() => saveGroup({ session_duration_h: sessionDur })}>
                  <Check size={13} />
                </Btn>
              </div>
            </Row>

            {/* Changer mot de passe */}
            <div style={{ paddingTop: 12, borderTop: "0.5px solid #f8f8f8", marginTop: 4 }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>Changer le mot de passe admin</div>
              {pwdMsg && <Toast msg={pwdMsg.msg} type={pwdMsg.type} />}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPwd ? "text" : "password"}
                    value={curPwd} onChange={e => setCurPwd(e.target.value)}
                    placeholder="Mot de passe actuel"
                    style={{ ...inputStyle, width: "100%", paddingRight: 36, boxSizing: "border-box" }} />
                </div>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPwd ? "text" : "password"}
                    value={newPwd} onChange={e => setNewPwd(e.target.value)}
                    placeholder="Nouveau mot de passe (min. 8 caractères)"
                    style={{ ...inputStyle, width: "100%", paddingRight: 36, boxSizing: "border-box" }} />
                  <button onClick={() => setShowPwd(p => !p)}
                    style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                      border: "none", background: "transparent", cursor: "pointer", color: "#aaa" }}>
                    {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <Btn variant="primary" onClick={changePassword} style={{ alignSelf: "flex-start" }}>
                  <Lock size={13} /> Mettre à jour
                </Btn>
              </div>
            </div>

            {/* Export logs */}
            <div style={{ paddingTop: 12, borderTop: "0.5px solid #f8f8f8", marginTop: 8 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>Exporter les données</div>
                  <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>Télécharger réservations en CSV</div>
                </div>
                <Btn variant="default" onClick={exportLogs}>Télécharger</Btn>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}
