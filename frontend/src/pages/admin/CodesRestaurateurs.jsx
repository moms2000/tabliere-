import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { KeyRound, Plus, Trash2, Copy, Check, RefreshCw } from "lucide-react";
import { Card, SectionHeader, PageTitle, Btn, Badge } from "../../components/ui";
import api from "../../services/api.js";

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const fadeUp  = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.28 } } };

const fmtDate = (d) => d ? new Date(d).toLocaleDateString("fr-FR", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" }) : "—";

export default function CodesRestaurateurs() {
  const [codes,     setCodes]     = useState([]);
  const [total,     setTotal]     = useState(0);
  const [loading,   setLoading]   = useState(true);
  const [genCount,  setGenCount]  = useState(1);
  const [genNotes,  setGenNotes]  = useState("");
  const [genExpiry, setGenExpiry] = useState(30);
  const [generating,setGenerating]= useState(false);
  const [filter,    setFilter]    = useState("all"); // all | used | unused
  const [copied,    setCopied]    = useState(null);

  const load = () => {
    setLoading(true);
    const params = {
      limit: 100,
      ...(filter === "used"   ? { used: true  } : {}),
      ...(filter === "unused" ? { used: false } : {}),
    };
    api.get("/admin/codes", { params })
      .then(r => {
        setCodes(r.data?.data || []);
        setTotal(r.data?.pagination?.total ?? r.data?.data?.length ?? 0);
      })
      .catch(err => {
        console.error("Erreur chargement codes", err?.response?.data || err.message);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filter]);

  const generate = async () => {
    setGenerating(true);
    try {
      const r = await api.post("/admin/codes/generate", {
        count: genCount,
        notes: genNotes || undefined,
        expires_days: genExpiry > 0 ? genExpiry : undefined,
      });
      const newCodes = r.data?.data?.codes || [];
      setCodes(prev => [...newCodes, ...prev]);
      setTotal(t => t + newCodes.length);
      setGenNotes("");
    } catch (e) {
      alert(e.response?.data?.message || "Erreur lors de la génération");
    }
    setGenerating(false);
  };

  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  const deleteCode = async (id) => {
    if (!window.confirm("Supprimer ce code ?")) return;
    try {
      await api.delete(`/admin/codes/${id}`);
      setCodes(prev => prev.filter(c => c.id !== id));
      setTotal(t => t - 1);
    } catch (e) { alert(e.response?.data?.message || "Erreur"); }
  };

  const unused = codes.filter(c => !c.is_used).length;
  const used   = codes.filter(c => c.is_used).length;

  return (
    <motion.div variants={stagger} initial="hidden" animate="show">
      <motion.div variants={fadeUp}>
        <PageTitle title="Codes Restaurateurs" subtitle="Générez des codes d'accès pour les restaurateurs" />
      </motion.div>

      {/* Stats */}
      <motion.div variants={fadeUp} style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        {[
          { label: "Total générés",  val: total,  color: "#1a1a1a" },
          { label: "Non utilisés",   val: unused, color: "#1D9E75" },
          { label: "Utilisés",       val: used,   color: "#E8A045" },
        ].map((s, i) => (
          <div key={i} style={{ flex: 1, minWidth: 120, background: "white", border: "0.5px solid #eee",
            borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, color: "#888" }}>{s.label}</span>
            <span style={{ fontSize: 20, fontWeight: 600, color: s.color }}>{s.val}</span>
          </div>
        ))}
      </motion.div>

      {/* Générateur */}
      <motion.div variants={fadeUp}>
        <Card style={{ marginBottom: 14 }}>
          <SectionHeader title="Générer des codes" icon={KeyRound} />
          <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 100px auto", gap: 10, alignItems: "end" }}>
            <div>
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#9BA89F",
                textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 6 }}>Quantité</label>
              <input type="number" min={1} max={50} value={genCount} onChange={e => setGenCount(+e.target.value)}
                style={{ width: "100%", border: "0.5px solid #E4DFD8", borderRadius: 8,
                  padding: "9px 10px", fontSize: 14, outline: "none", background: "#F8F5EF" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#9BA89F",
                textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 6 }}>Note interne (optionnel)</label>
              <input value={genNotes} onChange={e => setGenNotes(e.target.value)}
                placeholder="Ex: Partenariat Cocody Juin 2026"
                style={{ width: "100%", border: "0.5px solid #E4DFD8", borderRadius: 8,
                  padding: "9px 12px", fontSize: 13, outline: "none", background: "#F8F5EF" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#9BA89F",
                textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 6 }}>Expire (jours)</label>
              <input type="number" min={0} value={genExpiry} onChange={e => setGenExpiry(+e.target.value)}
                style={{ width: "100%", border: "0.5px solid #E4DFD8", borderRadius: 8,
                  padding: "9px 10px", fontSize: 14, outline: "none", background: "#F8F5EF" }} />
            </div>
            <motion.button whileTap={{ scale: 0.97 }} onClick={generate} disabled={generating}
              style={{ background: "#E8A045", color: "#1A1000", border: "none", borderRadius: 9,
                padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
              <Plus size={14} />
              {generating ? "Génération…" : `Générer ${genCount > 1 ? genCount + " codes" : "le code"}`}
            </motion.button>
          </div>

          <div style={{ marginTop: 12, padding: "10px 14px", background: "#FEF6EC",
            borderRadius: 8, fontSize: 12, color: "#C47D1A" }}>
            Les restaurateurs utiliseront ce code lors de leur inscription pour être automatiquement validés comme restaurateurs.
          </div>
        </Card>
      </motion.div>

      {/* Liste */}
      <motion.div variants={fadeUp}>
        <Card>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <SectionHeader title={`${total} code(s)`} icon={KeyRound} />
            <div style={{ display: "flex", gap: 6 }}>
              {["all","unused","used"].map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  style={{ fontSize: 11, padding: "4px 10px", borderRadius: 8, cursor: "pointer",
                    border: `0.5px solid ${filter === f ? "#E8A045" : "#eee"}`,
                    background: filter === f ? "#FEF6EC" : "white",
                    color: filter === f ? "#C47D1A" : "#888",
                    fontWeight: filter === f ? 600 : 400 }}>
                  {f === "all" ? "Tous" : f === "unused" ? "Disponibles" : "Utilisés"}
                </button>
              ))}
              <button onClick={load} style={{ border: "0.5px solid #eee", borderRadius: 8,
                background: "white", cursor: "pointer", padding: "4px 8px", display: "flex", alignItems: "center" }}>
                <RefreshCw size={13} color="#888" />
              </button>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: "30px 0", color: "#bbb" }}>Chargement…</div>
          ) : codes.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#bbb" }}>
              <KeyRound size={36} style={{ opacity: 0.2, marginBottom: 10 }} />
              <div>Aucun code. Générez vos premiers codes ci-dessus.</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {codes.map(c => (
                <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 14px", background: c.is_used ? "#fafafa" : "white",
                  borderRadius: 10, border: `0.5px solid ${c.is_used ? "#eee" : "#E4DFD8"}` }}>

                  {/* Code */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 16, fontWeight: 800, fontFamily: "monospace",
                        color: c.is_used ? "#bbb" : "#1E2E28", letterSpacing: "1px" }}>
                        {c.code}
                      </span>
                      <button onClick={() => copyCode(c.code)}
                        style={{ border: "none", background: "none", cursor: "pointer", padding: 2 }}>
                        {copied === c.code
                          ? <Check size={14} color="#1D9E75" />
                          : <Copy size={14} color="#bbb" />}
                      </button>
                      <Badge label={c.is_used ? "Utilisé" : "Disponible"}
                        variant={c.is_used ? "gray" : "green"} />
                    </div>
                    <div style={{ fontSize: 11, color: "#aaa", marginTop: 3 }}>
                      {c.notes && <span>{c.notes} · </span>}
                      Créé le {fmtDate(c.created_at)}
                      {c.expires_at && ` · Expire le ${fmtDate(c.expires_at)}`}
                      {c.is_used && c.used_by_name && ` · Utilisé par ${c.used_by_name} (${c.used_by_email})`}
                    </div>
                  </div>

                  {/* Actions */}
                  {!c.is_used && (
                    <button onClick={() => deleteCode(c.id)}
                      style={{ padding: "5px 8px", borderRadius: 6, border: "0.5px solid #fecaca",
                        background: "#fef2f2", cursor: "pointer", display: "flex", alignItems: "center" }}>
                      <Trash2 size={13} color="#dc2626" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </motion.div>
    </motion.div>
  );
}
