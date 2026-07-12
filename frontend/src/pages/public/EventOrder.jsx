import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Wine, Plus, Minus, ArrowLeft, Check, ShoppingCart } from "lucide-react";
import { eventsService, eventOpsService } from "../../services/events.service.js";

const P = "#E8A045", DARK = "#1E2E28", BG = "#F8F5EF", BORDER = "#E4DFD8", MUTED = "#9BA89F", GREEN = "#1D9E75";
const FONT = "'Avenir Next','Avenir','Century Gothic',sans-serif";
const fmt = (n) => Number(n || 0).toLocaleString("fr-FR") + " F";

export default function EventOrder() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const tableId = sp.get("table") || null;
  const tableLabel = sp.get("label") || null;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [nf, setNf] = useState(false);
  const [cart, setCart] = useState({});     // { bottleId: qty }
  const [guest, setGuest] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null);

  useEffect(() => {
    eventsService.cartePublic(slug)
      .then(setData).catch(() => setNf(true)).finally(() => setLoading(false));
  }, [slug]);

  const bottles = data?.bottles || [];
  const byCat = useMemo(() => {
    const m = {};
    bottles.forEach(b => { (m[b.category || "Autres"] ||= []).push(b); });
    return m;
  }, [bottles]);

  const inc = (id) => setCart(c => ({ ...c, [id]: (c[id] || 0) + 1 }));
  const dec = (id) => setCart(c => { const q = (c[id] || 0) - 1; const n = { ...c }; if (q <= 0) delete n[id]; else n[id] = q; return n; });

  const lines = bottles.filter(b => cart[b.id]).map(b => ({ ...b, qty: cart[b.id] }));
  const total = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const mode = data?.event?.ordering_mode || "per_order";

  const submit = async () => {
    if (!count) return;
    setSubmitting(true);
    try {
      const order = await eventOpsService.createOrder({
        slug, table_id: tableId || undefined, table_label: tableLabel || undefined,
        guest_name: guest || undefined, note: note || undefined,
        items: lines.map(l => ({ id: l.id, name: l.name, price: l.price, qty: l.qty })),
      });
      setDone(order.ref); setCart({}); setNote("");
    } catch (e) { alert(e.response?.data?.message || "Erreur lors de la commande"); }
    finally { setSubmitting(false); }
  };

  if (loading) return <Center>Chargement…</Center>;
  if (nf || !data) return <Center><Wine size={32} color={BORDER} /><div style={{ marginTop: 10 }}>Carte indisponible.</div><button onClick={() => navigate(`/evenement/${slug}`)} style={link}>Voir l'événement</button></Center>;

  if (done) return (
    <Center>
      <div style={{ width: 70, height: 70, borderRadius: "50%", background: "#F0F6F2", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
        <Check size={34} color={GREEN} />
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: DARK }}>Commande envoyée !</div>
      <div style={{ fontSize: 13.5, color: MUTED, marginTop: 6, maxWidth: 300 }}>
        Réf <strong>{done}</strong>. {mode === "tab" ? "Elle sera ajoutée à votre note (paiement en fin de soirée)." : "Un serveur vous l'apporte, paiement cash sur place."}
      </div>
      <button onClick={() => setDone(null)} style={{ ...primaryBtn, marginTop: 18 }}>Commander à nouveau</button>
    </Center>
  );

  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: FONT, paddingBottom: count ? 90 : 20 }}>
      <div style={{ background: DARK, padding: "calc(env(safe-area-inset-top,0px) + 16px) 18px 18px" }}>
        <button onClick={() => navigate(`/evenement/${slug}`)}
          style={{ display: "flex", alignItems: "center", gap: 6, border: "none", background: "transparent", color: "rgba(255,255,255,.6)", cursor: "pointer", fontSize: 13, marginBottom: 10, padding: 0, fontFamily: FONT }}>
          <ArrowLeft size={15} /> {data.event?.name}
        </button>
        <div style={{ fontSize: 22, fontWeight: 800, color: "white", display: "flex", alignItems: "center", gap: 8 }}>
          <Wine size={20} color={P} /> Carte des bouteilles
        </div>
        <div style={{ fontSize: 12.5, color: "rgba(255,255,255,.55)", marginTop: 4 }}>
          {tableLabel ? `Table : ${tableLabel} · ` : ""}Paiement cash sur place{mode === "tab" ? " (note en fin de soirée)" : ""}
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "16px" }}>
        {bottles.length === 0 ? (
          <div style={{ textAlign: "center", padding: "50px 0", color: MUTED }}>La carte n'est pas encore disponible.</div>
        ) : Object.entries(byCat).map(([cat, list]) => (
          <div key={cat} style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: P, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 8 }}>{cat}</div>
            <div style={{ display: "grid", gap: 8 }}>
              {list.map(b => (
                <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "white", border: `0.5px solid ${BORDER}`, borderRadius: 12, padding: "12px 14px" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: DARK }}>{b.name}</div>
                    {b.description && <div style={{ fontSize: 11.5, color: MUTED }}>{b.description}</div>}
                    <div style={{ fontSize: 13, fontWeight: 700, color: P, marginTop: 2 }}>{fmt(b.price)}</div>
                  </div>
                  {cart[b.id] ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <button onClick={() => dec(b.id)} style={qtyBtn}><Minus size={15} /></button>
                      <span style={{ fontSize: 15, fontWeight: 700, color: DARK, minWidth: 16, textAlign: "center" }}>{cart[b.id]}</span>
                      <button onClick={() => inc(b.id)} style={{ ...qtyBtn, background: P, color: "#1A1000", border: "none" }}><Plus size={15} /></button>
                    </div>
                  ) : (
                    <button onClick={() => inc(b.id)} style={{ ...qtyBtn, background: P, color: "#1A1000", border: "none", width: "auto", padding: "0 14px", fontWeight: 700, fontSize: 13 }}>Ajouter</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {count > 0 && (
          <div style={{ marginTop: 8 }}>
            <input value={guest} onChange={e => setGuest(e.target.value)} placeholder="Votre nom (optionnel)"
              style={inp} />
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="Note (optionnel)"
              style={{ ...inp, marginTop: 8 }} />
          </div>
        )}
      </div>

      {count > 0 && (
        <motion.div initial={{ y: 60 }} animate={{ y: 0 }}
          style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "white", borderTop: `0.5px solid ${BORDER}`,
            padding: "12px 16px calc(env(safe-area-inset-bottom,0px) + 12px)", zIndex: 50 }}>
          <div style={{ maxWidth: 640, margin: "0 auto", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: MUTED }}>{count} article{count > 1 ? "s" : ""}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: DARK }}>{fmt(total)}</div>
            </div>
            <button onClick={submit} disabled={submitting}
              style={{ ...primaryBtn, display: "flex", alignItems: "center", gap: 8 }}>
              <ShoppingCart size={17} /> {submitting ? "Envoi…" : "Commander"}
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

const Center = ({ children }) => (
  <div style={{ minHeight: "100vh", background: BG, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: MUTED, fontSize: 14, fontFamily: FONT, padding: 24, textAlign: "center" }}>{children}</div>
);
const qtyBtn = { width: 34, height: 34, borderRadius: 9, border: `1px solid ${BORDER}`, background: "white", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: DARK };
const inp = { width: "100%", border: `0.5px solid ${BORDER}`, borderRadius: 10, padding: "11px 13px", fontSize: 14, background: "white", outline: "none", fontFamily: FONT, boxSizing: "border-box", color: DARK };
const primaryBtn = { border: "none", borderRadius: 11, padding: "13px 22px", background: P, color: "#1A1000", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: FONT };
const link = { marginTop: 14, border: "none", background: "transparent", color: P, fontWeight: 600, cursor: "pointer", fontFamily: FONT, fontSize: 13 };
