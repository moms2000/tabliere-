import { useEffect, useRef, useState } from "react";

/**
 * Scanner QR par caméra (lazy-load html5-qrcode → aucun impact sur le bundle initial).
 * onScan(text) est appelé une seule fois au premier QR lu. onClose ferme l'overlay.
 */
let counter = 0;
export default function QrScanner({ onScan, onClose, title = "Scannez le QR de la réservation" }) {
  const [err, setErr] = useState("");
  const [ready, setReady] = useState(false);
  const idRef = useRef(`qr-reader-${++counter}`);
  const scannerRef = useRef(null);
  const doneRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;
        const scanner = new Html5Qrcode(idRef.current, { verbose: false });
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (text) => {
            if (doneRef.current) return;
            doneRef.current = true;
            onScan(text);
          },
          () => {} // erreurs de décodage par frame → ignorées
        );
        if (!cancelled) setReady(true);
      } catch (e) {
        if (!cancelled) setErr(e?.message || "Caméra indisponible. Autorisez l'accès à la caméra.");
      }
    })();
    return () => {
      cancelled = true;
      const s = scannerRef.current;
      if (s) { try { s.stop().then(() => s.clear()).catch(() => {}); } catch (_) {} }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 3000, background: "rgba(10,14,12,.92)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ color: "white", fontSize: 15, fontWeight: 600, marginBottom: 14, textAlign: "center",
        fontFamily: "'Avenir Next',sans-serif" }}>{title}</div>
      <div id={idRef.current} style={{ width: "100%", maxWidth: 320, borderRadius: 14, overflow: "hidden", background: "#000" }} />
      {!ready && !err && <div style={{ color: "rgba(255,255,255,.7)", fontSize: 13, marginTop: 14 }}>Ouverture de la caméra…</div>}
      {err && <div style={{ color: "#FCA5A5", fontSize: 13, marginTop: 14, maxWidth: 320, textAlign: "center" }}>{err}</div>}
      <button onClick={onClose}
        style={{ marginTop: 22, padding: "11px 26px", borderRadius: 12, border: "1.5px solid rgba(255,255,255,.35)",
          background: "transparent", color: "white", fontSize: 14, fontWeight: 600, cursor: "pointer",
          fontFamily: "'Avenir Next',sans-serif", touchAction: "manipulation" }}>
        Fermer
      </button>
    </div>
  );
}
