import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import QRCode from "react-qr-code";
import { Gift, Dices, Plus, Trophy, Download, Copy, Check, X, Sparkles, RefreshCw, Trash2, Zap, Search } from "lucide-react";
import { Card, PageTitle } from "../../components/ui";
import { promotionsService } from "../../services/promotions.service.js";
import { adminService } from "../../services/admin.service.js";

const P = "#E8A045"; const PL = "#FEF6EC"; const DARK = "#1E2E28"; const BG = "#F8F5EF";
const BORDER = "#E4DFD8"; const MUTED = "#9BA89F"; const GREEN = "#1D9E75";
const FONT = "'Avenir Next','Avenir','Century Gothic',sans-serif";
const SITE = "https://tabliereci.net";

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const fadeUp  = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

export default function CadeauxJeux() {
  const [tab, setTab]           = useState("jeux"); // jeux | cadeau
  const [campaigns, setCampaigns] = useState([]);
  const [restos, setRestos]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showNew, setShowNew]   = useState(false);
  const [winners, setWinners]   = useState(null); // { campaign, list }
  const [msg, setMsg]           = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    // Les deux chargements sont indépendants : un échec de l'un ne doit pas vider l'autre.
    const [camp, resto] = await Promise.allSettled([
      promotionsService.listCampaigns(),
      adminService.listRestaurants({ limit: 2000, sort: "name" }),
    ]);
    if (camp.status === "fulfilled") setCampaigns(camp.value?.campaigns || []);
    if (resto.status === "fulfilled") setRestos((resto.value?.data || []).map(x => ({ id: x.id, name: x.name })));
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const runDraw = async (c) => {
    if (!window.confirm(`Lancer le tirage pour « ${c.name} » ? ${c.eligible_count} inscrit(s) éligible(s).`)) return;
    setMsg("");
    try {
      const res = await promotionsService.draw(c.id);
      setMsg(res?.message || "Tirage effectué.");
      load();
    } catch (e) { setMsg(e.response?.data?.message || "Tirage impossible."); }
  };
  const openWinners = async (c) => {
    try { const { winners: list } = await promotionsService.winners(c.id); setWinners({ campaign: c, list: list || [] }); }
    catch (_) {}
  };
  const runDelete = async (c) => {
    if (!window.confirm(`Supprimer le jeu « ${c.name} » ? Les bons déjà distribués seront aussi supprimés.`)) return;
    setMsg("");
    try { await promotionsService.deleteCampaign(c.id); setMsg("Jeu supprimé."); load(); }
    catch (e) { setMsg(e.response?.data?.message || "Suppression impossible."); }
  };

  return (
    <motion.div variants={stagger} initial="hidden" animate="show">
      <motion.div variants={fadeUp}>
        <PageTitle title="Cadeaux & Jeux" subtitle="Tirages au sort et cadeaux ciblés" />
      </motion.div>

      {msg && (
        <motion.div variants={fadeUp} style={{ background: "#e1f5ee", color: "#0f7a56", border: "1px solid #b7e6d5",
          borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 14 }}>{msg}</motion.div>
      )}

      <motion.div variants={fadeUp} style={{ display: "flex", gap: 6, background: "#F0EDE6", borderRadius: 11, padding: 4, marginBottom: 16, maxWidth: 420 }}>
        {[["jeux", "Jeux (tirages)", Dices], ["cadeau", "Cadeau ciblé", Gift]].map(([k, lab, Icon]) => (
          <button key={k} onClick={() => setTab(k)}
            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 0",
              borderRadius: 8, border: "none", cursor: "pointer", fontFamily: FONT, fontSize: 13, fontWeight: tab === k ? 700 : 500,
              background: tab === k ? "white" : "transparent", color: tab === k ? DARK : MUTED,
              boxShadow: tab === k ? "0 1px 3px rgba(0,0,0,.08)" : "none" }}>
            <Icon size={15} /> {lab}
          </button>
        ))}
      </motion.div>

      {tab === "jeux" && (
        <motion.div variants={fadeUp}>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
            <button onClick={() => setShowNew(true)}
              style={{ display: "flex", alignItems: "center", gap: 6, background: P, color: "#1A1000", border: "none",
                borderRadius: 9, padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>
              <Plus size={15} /> Nouveau jeu
            </button>
          </div>
          {loading ? (
            <div style={{ textAlign: "center", padding: 40, color: MUTED }}>Chargement…</div>
          ) : campaigns.filter(c => c.type === "lottery").length === 0 ? (
            <Card><div style={{ textAlign: "center", padding: 40, color: MUTED }}>
              <Dices size={34} style={{ opacity: 0.3, marginBottom: 10 }} /><div>Aucun jeu pour l'instant.</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Créez un tirage au sort et collez le QR devant le restaurant.</div>
            </div></Card>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))", gap: 14 }}>
              {campaigns.filter(c => c.type === "lottery").map(c => (
                <CampaignCard key={c.id} c={c} onDraw={() => runDraw(c)} onWinners={() => openWinners(c)} onDelete={() => runDelete(c)} />
              ))}
            </div>
          )}
        </motion.div>
      )}

      {tab === "cadeau" && (
        <motion.div variants={fadeUp}>
          <GiftForm restos={restos} onDone={(m) => { setMsg(m); }} />
        </motion.div>
      )}

      {showNew && <NewCampaign restos={restos} onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); load(); }} />}
      {winners && <WinnersModal data={winners} onClose={() => setWinners(null)} />}
    </motion.div>
  );
}

function CampaignCard({ c, onDraw, onWinners, onDelete }) {
  const [copied, setCopied] = useState(false);
  const isAuto = c.draw_mode === "auto";
  const qrRef = useRef(null);
  const url = `${SITE}/inscription?ref=${c.ref_code}`;
  const copy = () => { navigator.clipboard?.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  const downloadQR = () => {
    const svg = qrRef.current?.querySelector("svg"); if (!svg) return;
    const data = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([data], { type: "image/svg+xml" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `qr-${c.ref_code}.svg`; document.body.appendChild(a); a.click(); a.remove();
  };
  const target = c.winners_count;
  // Tirage terminé si la campagne est marquée « tirée » OU l'objectif est atteint
  // (une campagne « tirée » avec moins d'éligibles que prévu ne doit pas rester cliquable).
  const done = c.status === "drawn" || c.winners_issued >= target;
  return (
    <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 14, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: DARK }}>{c.name}</div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {isAuto && (
            <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10.5, fontWeight: 700, padding: "3px 8px", borderRadius: 20, background: "#EEF2FF", color: "#4F5BD5" }}>
              <Zap size={10} /> Auto
            </span>
          )}
          <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 20,
            background: c.status === "drawn" ? "#e1f5ee" : PL, color: c.status === "drawn" ? GREEN : "#C47D1A" }}>
            {c.status === "drawn" ? "Tiré" : "Ouvert"}
          </span>
          <button onClick={onDelete} title="Supprimer le jeu"
            style={{ border: "none", background: "transparent", cursor: "pointer", padding: 2, display: "flex" }}>
            <Trash2 size={14} color="#dc2626" />
          </button>
        </div>
      </div>
      <div style={{ fontSize: 12.5, color: MUTED, marginBottom: 2 }}>{c.restaurant_name}</div>
      <div style={{ fontSize: 13, color: DARK, marginBottom: 12 }}><Sparkles size={12} color={P} /> {c.reward_label}</div>

      <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
        <div ref={qrRef} style={{ background: "white", padding: 6, border: `1px solid ${BORDER}`, borderRadius: 8 }}>
          <QRCode value={url} size={92} fgColor="#1E2E28" />
        </div>
        <div style={{ flex: 1, fontSize: 12, color: MUTED, display: "flex", flexDirection: "column", justifyContent: "center", gap: 6 }}>
          <div><strong style={{ color: DARK, fontSize: 17 }}>{c.eligible_count}</strong> inscrit(s) via le QR</div>
          <div><strong style={{ color: DARK }}>{c.winners_issued}</strong>/{target} gagnant(s) · <strong style={{ color: DARK }}>{c.used_count}</strong> utilisé(s)</div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={copy} style={miniBtn}>{copied ? <Check size={12} /> : <Copy size={12} />} Lien</button>
            <button onClick={downloadQR} style={miniBtn}><Download size={12} /> QR</button>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        {isAuto ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 0", borderRadius: 9,
            background: "#EEF2FF", color: "#4F5BD5", fontSize: 12.5, fontWeight: 700 }}>
            <Zap size={14} /> Tirage automatique
          </div>
        ) : (
          <button onClick={onDraw} disabled={done}
            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 0", borderRadius: 9, border: "none",
              background: done ? "#E4DFD8" : P, color: done ? MUTED : "#1A1000",
              fontSize: 13, fontWeight: 700, cursor: done ? "default" : "pointer", fontFamily: FONT }}>
            <Dices size={15} /> {done ? "Tirage effectué" : "Lancer le tirage"}
          </button>
        )}
        <button onClick={onWinners}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 9, border: `1px solid ${BORDER}`,
            background: "white", color: DARK, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>
          <Trophy size={14} /> Gagnants
        </button>
      </div>
    </div>
  );
}

function NewCampaign({ restos, onClose, onCreated }) {
  const [f, setF] = useState({ restaurant_id: "", name: "", reward_label: "", winners_count: 50, voucher_expires_days: 30, draw_mode: "manual" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const submit = async () => {
    setErr("");
    if (!f.restaurant_id) return setErr("Choisissez un restaurant.");
    if (f.name.trim().length < 2) return setErr("Nom du jeu requis.");
    if (f.reward_label.trim().length < 2) return setErr("Décrivez la récompense.");
    setBusy(true);
    try { await promotionsService.createCampaign({ ...f, type: "lottery" }); onCreated(); }
    catch (e) { setErr(e.response?.data?.message || "Création impossible."); setBusy(false); }
  };
  return (
    <Overlay onClose={onClose} title="Nouveau jeu (tirage au sort)">
      {err && <ErrBox>{err}</ErrBox>}
      <Field label="Restaurant">
        <select value={f.restaurant_id} onChange={e => set("restaurant_id", e.target.value)} style={inp}>
          <option value="">Choisir…</option>
          {restos.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </Field>
      <Field label="Nom du jeu"><input value={f.name} onChange={e => set("name", e.target.value)} placeholder="Ex : Jeu Pain Bro" style={inp} /></Field>
      <Field label="Récompense (article offert)"><input value={f.reward_label} onChange={e => set("reward_label", e.target.value)} placeholder="Ex : 1 pain au chocolat offert" style={inp} /></Field>
      <div style={{ display: "flex", gap: 10 }}>
        <Field label="Nombre de gagnants" style={{ flex: 1 }}>
          <input type="number" min="1" value={f.winners_count} onChange={e => set("winners_count", e.target.value)} style={inp} />
        </Field>
        <Field label="Validité du bon (jours)" style={{ flex: 1 }}>
          <input type="number" min="1" value={f.voucher_expires_days} onChange={e => set("voucher_expires_days", e.target.value)} style={inp} />
        </Field>
      </div>
      <Field label="Mode de tirage">
        <div style={{ display: "flex", gap: 8 }}>
          {[["manual", "Manuel", "Vous lancez le tirage quand vous voulez"], ["auto", "Automatique", "Gagnants tirés à l'inscription (max 4 par 10, aléatoire)"]].map(([k, lab, desc]) => (
            <button key={k} type="button" onClick={() => set("draw_mode", k)}
              style={{ flex: 1, textAlign: "left", padding: "10px 12px", borderRadius: 10, cursor: "pointer", fontFamily: FONT,
                border: `1.5px solid ${f.draw_mode === k ? P : BORDER}`, background: f.draw_mode === k ? PL : "white" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: f.draw_mode === k ? "#C47D1A" : DARK }}>{lab}</div>
              <div style={{ fontSize: 11, color: MUTED, marginTop: 2, lineHeight: 1.3 }}>{desc}</div>
            </button>
          ))}
        </div>
      </Field>
      <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>
        Un QR sera généré. Les gens qui s'inscrivent via ce QR entrent dans le tirage.
      </div>
      <ModalActions onClose={onClose} onSubmit={submit} busy={busy} submitLabel="Créer le jeu" />
    </Overlay>
  );
}

function GiftForm({ restos, onDone }) {
  const [f, setF] = useState({ restaurant_id: "", reward_label: "", voucher_expires_days: 30 });
  const [client, setClient] = useState(null);   // client sélectionné { id, full_name, phone, resa_count }
  const [search, setSearch] = useState("");
  const [clients, setClients] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  // Liste des clients (triés par réservations) — au montage et à chaque recherche.
  useEffect(() => {
    let alive = true;
    const t = setTimeout(() => {
      promotionsService.listClients(search).then(d => { if (alive) setClients(d?.clients || []); }).catch(() => {});
    }, 250);
    return () => { alive = false; clearTimeout(t); };
  }, [search]);

  const submit = async () => {
    setErr(""); setOkMsg("");
    if (!f.restaurant_id) return setErr("Choisissez un restaurant.");
    if (!client) return setErr("Choisissez un client dans la liste.");
    if (f.reward_label.trim().length < 2) return setErr("Décrivez le cadeau.");
    setBusy(true);
    try {
      const res = await promotionsService.createGift({ ...f, user_id: client.id });
      setOkMsg(`Cadeau envoyé à ${res?.user?.full_name || client.full_name} (code ${res?.voucher?.code}).`);
      setF({ ...f, reward_label: "" }); setClient(null); setSearch("");
      onDone?.("Cadeau envoyé.");
    } catch (e) { setErr(e.response?.data?.message || "Envoi impossible."); }
    setBusy(false);
  };

  return (
    <Card>
      <div style={{ fontSize: 15, fontWeight: 800, color: DARK, marginBottom: 4 }}>Offrir un cadeau à un client</div>
      <div style={{ fontSize: 13, color: MUTED, marginBottom: 14 }}>Choisissez un client (les plus fidèles apparaissent en premier). Il reçoit un bon avec un code à présenter au restaurant.</div>
      {err && <ErrBox>{err}</ErrBox>}
      {okMsg && <div style={{ background: "#e1f5ee", color: "#0f7a56", borderRadius: 8, padding: "9px 12px", fontSize: 13, marginBottom: 12 }}>{okMsg}</div>}
      <div style={{ maxWidth: 480 }}>
        <Field label="Restaurant">
          <select value={f.restaurant_id} onChange={e => set("restaurant_id", e.target.value)} style={inp}>
            <option value="">Choisir…</option>
            {restos.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </Field>

        <Field label="Client">
          {client ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", border: `1.5px solid ${P}`, background: PL, borderRadius: 9, padding: "10px 12px" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: DARK }}>{client.full_name}</div>
                <div style={{ fontSize: 11.5, color: MUTED }}>{client.phone || client.email || ""} · {client.resa_count} réservation(s)</div>
              </div>
              <button onClick={() => setClient(null)} style={{ border: "none", background: "transparent", cursor: "pointer" }}><X size={16} color={MUTED} /></button>
            </div>
          ) : (
            <>
              <div style={{ position: "relative" }}>
                <Search size={14} color={MUTED} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)" }} />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un client (nom, numéro…)"
                  style={{ ...inp, paddingLeft: 34 }} />
              </div>
              <div style={{ border: `1px solid ${BORDER}`, borderRadius: 9, marginTop: 6, maxHeight: 220, overflowY: "auto", background: "white" }}>
                {clients.length === 0 ? (
                  <div style={{ padding: 14, fontSize: 12.5, color: MUTED, textAlign: "center" }}>Aucun client trouvé.</div>
                ) : clients.map(cl => (
                  <button key={cl.id} onClick={() => setClient(cl)}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "9px 12px",
                      border: "none", borderBottom: `1px solid ${BG}`, background: "white", cursor: "pointer", textAlign: "left", fontFamily: FONT }}>
                    <div>
                      <div style={{ fontSize: 13, color: DARK, fontWeight: 500 }}>{cl.full_name}</div>
                      <div style={{ fontSize: 11, color: MUTED }}>{cl.phone || cl.email || ""}</div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: cl.resa_count > 0 ? "#C47D1A" : MUTED, background: cl.resa_count > 0 ? PL : BG, padding: "2px 8px", borderRadius: 20 }}>
                      {cl.resa_count} résa
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </Field>

        <Field label="Cadeau"><input value={f.reward_label} onChange={e => set("reward_label", e.target.value)} placeholder="Ex : 1 boisson offerte" style={inp} /></Field>
        <Field label="Validité (jours)"><input type="number" min="1" value={f.voucher_expires_days} onChange={e => set("voucher_expires_days", e.target.value)} style={{ ...inp, maxWidth: 140 }} /></Field>
        <button onClick={submit} disabled={busy}
          style={{ marginTop: 6, background: P, color: "#1A1000", border: "none", borderRadius: 9, padding: "11px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>
          {busy ? "Envoi…" : "Envoyer le cadeau"}
        </button>
      </div>
    </Card>
  );
}

function WinnersModal({ data, onClose }) {
  const { campaign, list } = data;
  return (
    <Overlay onClose={onClose} title={`Gagnants — ${campaign.name}`} wide>
      {list.length === 0 ? (
        <div style={{ textAlign: "center", padding: 30, color: MUTED }}>Aucun gagnant encore. Lancez le tirage.</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr style={{ textAlign: "left", color: MUTED, fontSize: 11 }}>
              <th style={th}>Client</th><th style={th}>Téléphone</th><th style={th}>Code</th><th style={th}>Statut</th>
            </tr></thead>
            <tbody>
              {list.map((w, i) => (
                <tr key={i} style={{ borderTop: `1px solid ${BG}` }}>
                  <td style={td}>{w.full_name}</td>
                  <td style={td}>{w.phone || "—"}</td>
                  <td style={{ ...td, fontFamily: "monospace", fontWeight: 700, color: P }}>{w.code}</td>
                  <td style={td}>{w.status === "used" ? <span style={{ color: GREEN, fontWeight: 700 }}>Utilisé</span> : w.status === "expired" ? "Expiré" : "Actif"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Overlay>
  );
}

// ── petits composants ────────────────────────────────────────────────────────
function Overlay({ title, children, onClose, wide }) {
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", zIndex: 50 }} />
      <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, pointerEvents: "none" }}>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          style={{ background: "white", borderRadius: 16, padding: 22, width: "100%", maxWidth: wide ? 620 : 460,
            maxHeight: "88vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,.2)", pointerEvents: "auto", fontFamily: FONT }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: DARK }}>{title}</div>
            <button onClick={onClose} style={{ border: "none", background: "transparent", cursor: "pointer" }}><X size={18} color={MUTED} /></button>
          </div>
          {children}
        </motion.div>
      </div>
    </>
  );
}
function Field({ label, children, style }) {
  return (
    <div style={{ marginBottom: 12, ...style }}>
      <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}
function ErrBox({ children }) {
  return <div style={{ background: "#faece7", color: "#993C1D", borderRadius: 8, padding: "9px 12px", fontSize: 13, marginBottom: 12 }}>{children}</div>;
}
function ModalActions({ onClose, onSubmit, busy, submitLabel }) {
  return (
    <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
      <button onClick={onClose} style={{ flex: 1, border: `1px solid ${BORDER}`, background: "white", borderRadius: 9, padding: "11px 0", fontSize: 13, color: MUTED, cursor: "pointer", fontFamily: FONT }}>Annuler</button>
      <button onClick={onSubmit} disabled={busy} style={{ flex: 2, border: "none", borderRadius: 9, padding: "11px 0", background: P, color: "#1A1000", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>{busy ? "…" : submitLabel}</button>
    </div>
  );
}

const inp = { width: "100%", border: `1px solid ${BORDER}`, borderRadius: 9, padding: "10px 12px", fontSize: 13, outline: "none", boxSizing: "border-box", background: BG, color: DARK, fontFamily: FONT };
const miniBtn = { display: "flex", alignItems: "center", gap: 4, border: `1px solid ${BORDER}`, background: "white", borderRadius: 7, padding: "5px 9px", fontSize: 11.5, color: DARK, cursor: "pointer", fontFamily: FONT };
const th = { padding: "6px 8px", fontWeight: 600, whiteSpace: "nowrap" };
const td = { padding: "8px", color: "#333", whiteSpace: "nowrap" };
