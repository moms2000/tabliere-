import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Plug, KeyRound, Copy, Check, AlertTriangle, RefreshCw, Webhook, ShieldCheck } from "lucide-react";
import { Card, SectionHeader } from "../../components/ui";
import { integrationService } from "../../services/integration.service.js";

const P      = "#E8A045";
const DARK   = "#1E2E28";
const BG     = "#F8F5EF";
const BORDER = "#E4DFD8";
const MUTED  = "#9BA89F";
const FONT   = "'Avenir Next', 'Avenir', 'Century Gothic', 'Trebuchet MS', -apple-system, sans-serif";
const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.28 } } };

const mono = { fontFamily: "monospace", fontSize: 12.5 };

function CopyBtn({ value, label = "Copier" }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1600); } catch {}
  };
  return (
    <button type="button" onClick={copy}
      style={{ display: "inline-flex", alignItems: "center", gap: 6,
        background: done ? "#E8F5EE" : DARK, color: done ? "#1D9E75" : "white",
        border: "none", borderRadius: 9, padding: "8px 14px", fontSize: 12.5, fontWeight: 600,
        cursor: "pointer", fontFamily: FONT, whiteSpace: "nowrap" }}>
      {done ? <Check size={14} /> : <Copy size={14} />} {done ? "Copié" : label}
    </button>
  );
}

const STATUS_LABEL = (s) => {
  if (!s) return { txt: "Aucun envoi", color: MUTED };
  if (s.startsWith("ok")) return { txt: "Dernier envoi réussi", color: "#1D9E75" };
  return { txt: `Dernier envoi en échec (${s})`, color: "#C0392B" };
};

// Message d'erreur lisible : d'abord le message renvoyé par le backend (ex.
// « Action réservée au titulaire du compte »), sinon un indice de réveil à froid
// (timeout / pas de réponse = serveur Render en train de démarrer), sinon un repli.
const errMsg = (e, fallback) =>
  e?.response?.data?.message
  || ((e?.code === "ECONNABORTED" || !e?.response)
      ? "Le serveur met du temps à répondre (réveil en cours). Réessayez dans quelques secondes."
      : fallback);

export default function IntegrationCaisse({ restaurantId = null, admin = false }) {
  const [cfg, setCfg]         = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy]       = useState(false);
  const [newKey, setNewKey]   = useState("");     // clé complète affichée UNE fois
  const [url, setUrl]         = useState("");
  const [msg, setMsg]         = useState("");
  const [err, setErr]         = useState("");

  const load = async () => {
    try {
      const c = await integrationService.get(restaurantId);
      setCfg(c);
      setUrl(c.webhook_url || "");
    } catch (e) { setErr(errMsg(e, "Impossible de charger la configuration.")); }
    finally { setLoading(false); }
  };
  useEffect(() => { setLoading(true); setNewKey(""); load(); /* eslint-disable-next-line */ }, [restaurantId]);

  const genKey = async () => {
    if (cfg?.has_key && !window.confirm(
      "Générer une nouvelle clé RÉVOQUE immédiatement l'ancienne. La caisse cessera de fonctionner tant que la nouvelle clé n'est pas en place. Continuer ?")) return;
    setBusy(true); setErr(""); setMsg("");
    try {
      const r = await integrationService.generateKey(restaurantId);
      setNewKey(r.api_key);
      setMsg("Clé générée. Copiez-la maintenant, elle ne sera plus affichée.");
      await load();
    } catch (e) { setErr(errMsg(e, "Échec de la génération de la clé.")); }
    finally { setBusy(false); }
  };

  const saveUrl = async () => {
    const u = url.trim();
    if (u && !/^https:\/\/.+/i.test(u)) { setErr("L'URL du webhook doit commencer par https://"); return; }
    setBusy(true); setErr(""); setMsg("");
    try {
      await integrationService.update({ webhook_url: u || null }, restaurantId);
      setMsg("Adresse du webhook enregistrée.");
      await load();
    } catch (e) { setErr(errMsg(e, "Échec de l'enregistrement.")); }
    finally { setBusy(false); }
  };

  const toggleActive = async () => {
    setBusy(true); setErr(""); setMsg("");
    try {
      await integrationService.update({ is_active: !cfg.is_active }, restaurantId);
      await load();
    } catch (e) { setErr(errMsg(e, "Échec de la mise à jour.")); }
    finally { setBusy(false); }
  };

  if (loading) return null;

  const st = STATUS_LABEL(cfg?.last_delivery_status);
  const box = { background: BG, border: `0.5px solid ${BORDER}`, borderRadius: 9, padding: "10px 12px", wordBreak: "break-all" };
  const lbl = { fontSize: 12, fontWeight: 700, color: DARK, margin: "0 0 6px" };

  return (
    <motion.div variants={fadeUp}>
      <Card>
        <SectionHeader title={admin ? "Intégration à la caisse" : "Intégration à votre caisse"} icon={Plug} />
        <div style={{ fontSize: 12, color: "#888", marginBottom: 16, lineHeight: 1.55 }}>
          {admin
            ? "Vous configurez l'intégration de CE restaurant à sa place (onboarding/dépannage). La clé complète ne s'affiche qu'une seule fois, à la génération : notez-la et transmettez-la de façon sécurisée."
            : "Envoyez automatiquement chaque commande et chaque encaissement vers votre logiciel de caisse. Chaque événement porte un identifiant unique pour éviter tout double comptage. La facture officielle reste éditée par votre caisse : TablièreCI ne fait que transmettre l'information."}
        </div>

        {err && <div style={{ background: "#FDECEA", color: "#C0392B", borderRadius: 9, padding: "9px 12px", fontSize: 12.5, marginBottom: 12 }}>{err}</div>}
        {msg && <div style={{ background: "#E8F5EE", color: "#1D9E75", borderRadius: 9, padding: "9px 12px", fontSize: 12.5, marginBottom: 12 }}>{msg}</div>}

        {/* ── Clé API ─────────────────────────────────────────────── */}
        <div style={{ marginBottom: 18 }}>
          <p style={lbl}><KeyRound size={13} style={{ verticalAlign: -2, marginRight: 5 }} />Clé API</p>
          {newKey ? (
            <div style={{ ...box, background: "#FEF6EC", border: `1px solid ${P}`, marginBottom: 8 }}>
              <div style={{ fontSize: 11.5, color: "#C47D1A", fontWeight: 700, marginBottom: 6,
                display: "flex", alignItems: "center", gap: 5 }}>
                <AlertTriangle size={13} /> À copier maintenant, elle ne sera plus jamais affichée
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <code style={{ ...mono, flex: 1, minWidth: 200, color: DARK }}>{newKey}</code>
                <CopyBtn value={newKey} />
              </div>
            </div>
          ) : cfg?.has_key ? (
            <div style={{ ...box, marginBottom: 8, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <code style={{ ...mono, flex: 1, minWidth: 160, color: MUTED }}>{cfg.api_key_prefix}••••••••••••••••</code>
              <span style={{ fontSize: 11.5, color: MUTED }}>Clé active (masquée)</span>
            </div>
          ) : (
            <div style={{ fontSize: 12.5, color: MUTED, marginBottom: 8 }}>Aucune clé générée pour l'instant.</div>
          )}
          <button type="button" onClick={genKey} disabled={busy}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, background: DARK, color: "white",
              border: "none", borderRadius: 9, padding: "9px 15px", fontSize: 12.5, fontWeight: 600,
              cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1, fontFamily: FONT }}>
            <RefreshCw size={14} /> {cfg?.has_key ? "Régénérer la clé" : "Générer la clé API"}
          </button>
        </div>

        {/* ── Webhook ─────────────────────────────────────────────── */}
        <div style={{ marginBottom: 18 }}>
          <p style={lbl}><Webhook size={13} style={{ verticalAlign: -2, marginRight: 5 }} />Adresse de réception (webhook)</p>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 8, lineHeight: 1.5 }}>
            L'adresse HTTPS de votre caisse où nous enverrons les événements en temps réel.
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://votre-caisse.example/webhook"
              style={{ ...box, ...mono, flex: 1, minWidth: 220, outline: "none", color: DARK, fontFamily: "monospace" }} />
            <button type="button" onClick={saveUrl} disabled={busy}
              style={{ background: P, color: "white", border: "none", borderRadius: 9, padding: "10px 16px",
                fontSize: 12.5, fontWeight: 600, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1, fontFamily: FONT }}>
              Enregistrer
            </button>
          </div>
          {cfg?.webhook_secret && (
            <div style={{ marginTop: 10 }}>
              <p style={{ ...lbl, marginBottom: 4 }}><ShieldCheck size={13} style={{ verticalAlign: -2, marginRight: 5 }} />Secret de signature</p>
              <div style={{ fontSize: 12, color: "#888", marginBottom: 6, lineHeight: 1.5 }}>
                Vérifiez chaque message : l'en-tête <code style={mono}>X-Tabliere-Signature</code> vaut
                <code style={mono}> sha256=HMAC(secret, corps)</code>. Rejetez tout message dont la signature ne correspond pas.
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <code style={{ ...box, ...mono, flex: 1, minWidth: 200, color: DARK }}>{cfg.webhook_secret}</code>
                <CopyBtn value={cfg.webhook_secret} />
              </div>
            </div>
          )}
          {/* Statut d'envoi + activation */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: st.color, fontWeight: 600 }}>
              <span style={{ width: 8, height: 8, borderRadius: 99, background: st.color, display: "inline-block" }} />
              {st.txt}
            </span>
            <button type="button" onClick={toggleActive} disabled={busy || !cfg}
              style={{ marginLeft: "auto", background: cfg?.is_active ? "#E8F5EE" : "#FDECEA",
                color: cfg?.is_active ? "#1D9E75" : "#C0392B", border: "none", borderRadius: 9,
                padding: "8px 14px", fontSize: 12.5, fontWeight: 600, cursor: busy ? "default" : "pointer", fontFamily: FONT }}>
              {cfg?.is_active ? "Intégration active — désactiver" : "Intégration en pause — activer"}
            </button>
          </div>
        </div>

        {/* ── Documentation compacte ──────────────────────────────── */}
        <details>
          <summary style={{ fontSize: 12.5, fontWeight: 700, color: DARK, cursor: "pointer" }}>
            Détails techniques pour votre prestataire
          </summary>
          <div style={{ fontSize: 12, color: "#555", lineHeight: 1.7, marginTop: 10 }}>
            <p style={{ margin: "0 0 6px", fontWeight: 700 }}>Événements envoyés (POST vers votre webhook) :</p>
            <ul style={{ margin: "0 0 10px", paddingLeft: 18 }}>
              <li><code style={mono}>order.created</code> — nouvelle commande (QR client ou serveur)</li>
              <li><code style={mono}>order.updated</code> — statut modifié (servi, annulé…) ou articles modifiés</li>
              <li><code style={mono}>payment.recorded</code> — encaissement (espèces, mobile money, carte)</li>
              <li><code style={mono}>session.closed</code> — table clôturée (addition fermée)</li>
            </ul>
            <p style={{ margin: "0 0 6px" }}>
              Corps : <code style={mono}>{"{ id, event, sent_at, data }"}</code>. Le champ
              <code style={mono}> data.ref</code> est l'<b>identifiant unique</b> : ignorez tout
              <code style={mono}> ref</code> déjà reçu (idempotence, aucun double comptage).
            </p>
            <p style={{ margin: "0 0 6px", fontWeight: 700 }}>Récupération à la demande (avec la clé API) :</p>
            <ul style={{ margin: "0 0 10px", paddingLeft: 18 }}>
              <li><code style={mono}>GET /api/v1/integration/orders?since=ISO</code></li>
              <li><code style={mono}>GET /api/v1/integration/payments?since=ISO</code></li>
            </ul>
            <p style={{ margin: 0 }}>
              Authentification : en-tête <code style={mono}>X-Api-Key: VOTRE_CLÉ</code>
              (ou <code style={mono}>Authorization: Bearer VOTRE_CLÉ</code>).
            </p>
          </div>
        </details>
      </Card>
    </motion.div>
  );
}
