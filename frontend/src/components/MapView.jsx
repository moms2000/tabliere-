import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const P = "#E8A045";

// Coordonnées approximatives des communes/quartiers d'Abidjan + grandes villes CI.
// Permet de placer les restaurants sur la carte sans coordonnées précises en base.
const COMMUNE_COORDS = {
  cocody: [5.359, -3.996], "deux plateaux": [5.383, -3.998], riviera: [5.360, -3.960],
  angre: [5.398, -3.985], plateau: [5.324, -4.020], marcory: [5.300, -3.986],
  "zone 4": [5.290, -3.995], treichville: [5.293, -4.010], yopougon: [5.345, -4.070],
  adjame: [5.360, -4.030], koumassi: [5.295, -3.955], "port-bouet": [5.255, -3.930],
  "port bouet": [5.255, -3.930], abobo: [5.418, -4.020], attecoube: [5.345, -4.030],
  bingerville: [5.355, -3.888], "grand-bassam": [5.211, -3.738], abidjan: [5.345, -4.020],
  bouake: [7.690, -5.030], yamoussoukro: [6.827, -5.289], "san pedro": [4.748, -6.636],
  daloa: [6.877, -6.450], korhogo: [9.458, -5.629], man: [7.412, -7.554],
};
const DEFAULT_CENTER = [5.345, -4.010]; // Abidjan

const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

function coordsFor(r, i) {
  if (r.latitude && r.longitude) return [Number(r.latitude), Number(r.longitude)];
  const q = norm(r.quartier), v = norm(r.ville);
  let base = COMMUNE_COORDS[q];
  if (!base) {
    const key = Object.keys(COMMUNE_COORDS).find((k) => q && (q.includes(k) || k.includes(q)));
    base = key ? COMMUNE_COORDS[key] : (COMMUNE_COORDS[v] || DEFAULT_CENTER);
  }
  // décalage déterministe pour éviter la superposition des pins d'une même commune
  const jx = ((i * 37) % 24 - 12) / 1000;
  const jy = ((i * 53) % 24 - 12) / 1000;
  return [base[0] + jx, base[1] + jy];
}

export default function MapView({ restaurants, onSelect, height = "100%" }) {
  const elRef  = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    if (!elRef.current || mapRef.current) return;
    const map = L.map(elRef.current, { center: DEFAULT_CENTER, zoom: 12, scrollWheelZoom: false });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap", maxZoom: 18,
    }).addTo(map);
    mapRef.current = map;
    // Corrige la taille si le conteneur vient d'apparaître
    setTimeout(() => map.invalidateSize(), 120);
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const markers = [];
    (restaurants || []).forEach((r, i) => {
      const [lat, lng] = coordsFor(r, i);
      const icon = L.divIcon({
        className: "tci-pin",
        html: `<div style="background:${P};border:2px solid #fff;border-radius:50% 50% 50% 0;
          transform:rotate(-45deg);width:26px;height:26px;box-shadow:0 2px 6px rgba(0,0,0,.35)"></div>`,
        iconSize: [26, 26], iconAnchor: [13, 26],
      });
      const m = L.marker([lat, lng], { icon, title: r.name }).addTo(map);
      m.bindTooltip(r.name, { direction: "top", offset: [0, -24] });
      m.on("click", () => onSelect && onSelect(r));
      markers.push(m);
    });
    if (markers.length) {
      try { map.fitBounds(L.featureGroup(markers).getBounds().pad(0.25)); } catch (_) {}
    }
    return () => markers.forEach((m) => map.removeLayer(m));
  }, [restaurants, onSelect]);

  return <div ref={elRef} style={{ width: "100%", height, borderRadius: 12, overflow: "hidden", zIndex: 0 }} />;
}
