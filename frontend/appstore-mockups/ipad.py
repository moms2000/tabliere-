#!/usr/bin/env python3
# Génère 1 maquette App Store iPad 12,9" (2048 x 2732) pour TablièreCI
import json, pathlib

BASE = pathlib.Path(__file__).parent
IMG = {}
for line in (BASE / "_imgs.jsonl").read_text().splitlines():
    IMG.update(json.loads(line))

AMBER = "#E8A045"; DARK = "#1E2E28"; CREAM = "#F8F5EF"
FONT = "'Avenir Next','Avenir','Segoe UI',system-ui,sans-serif"

def ic(path, sw=2, stroke="currentColor"):
    return f'<svg viewBox="0 0 24 24" fill="none" stroke="{stroke}" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round">{path}</svg>'
I_HOME = ic('<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>')
I_SEARCH = ic('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/>')
I_GIFT = ic('<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M4 12v9h16v-9"/><path d="M12 8S10.5 3 8 4.5 9.5 8 12 8ZM12 8s1.5-5 4-3.5S14.5 8 12 8Z"/>')
I_CAL = ic('<rect x="3" y="4.5" width="18" height="17" rx="2.5"/><path d="M3 9h18M8 2.5v4M16 2.5v4"/>')
I_USER = ic('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>')
I_STAR = '<svg viewBox="0 0 24 24" fill="%s" stroke="none"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 18.9 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z"/></svg>' % AMBER
I_HEART = '<svg viewBox="0 0 24 24" fill="%s" stroke="none"><path d="M12 21S3.5 14.6 3.5 8.9A4.9 4.9 0 0 1 12 6a4.9 4.9 0 0 1 8.5 2.9C20.5 14.6 12 21 12 21Z"/></svg>' % AMBER
I_PIN = ic('<path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/>')
def stars(): return "".join(f'<span class="st">{I_STAR}</span>' for _ in range(5))

def rcard(img, nom, cuis, note, avis, lieu, prix):
    return f'''<div class="rcard">
      <div class="rimg" style="background-image:url({IMG[img]})"><div class="fav">{I_HEART}</div></div>
      <div class="rbody">
        <div class="rtop"><div class="rname">{nom}</div><div class="rprice">{prix}</div></div>
        <div class="rmeta">{stars()}<span class="rnote">{note}</span><span class="ravis">({avis})</span></div>
        <div class="rsub">{cuis} · <span class="rpin">{I_PIN}</span>{lieu}</div>
      </div></div>'''

tabs = [("Accueil",I_HOME,1),("Recherche",I_SEARCH,0),("Récompenses",I_GIFT,0),("Réservations",I_CAL,0),("Profil",I_USER,0)]
tabbar = '<div class="tabbar">' + "".join(
    f'<div class="tab{" on" if on else ""}"><span class="ti">{icn}</span><span class="tl">{lbl}</span></div>'
    for lbl,icn,on in tabs) + '</div>'

HTML = f'''<!doctype html><html><head><meta charset="utf-8"><style>
*{{margin:0;padding:0;box-sizing:border-box;-webkit-font-smoothing:antialiased}}
html,body{{width:2048px;height:2732px;font-family:{FONT}}}
.canvas{{width:2048px;height:2732px;overflow:hidden;background:linear-gradient(160deg,{CREAM} 0%,#efe7d8 100%);
  display:flex;flex-direction:column;align-items:center}}
.headline{{text-align:center;padding:130px 120px 0;color:{DARK}}}
.headline h1{{font-size:104px;line-height:1.06;font-weight:800;letter-spacing:-2px}}
.headline .accent{{color:{AMBER}}}
.headline p{{font-size:48px;margin-top:30px;font-weight:500;opacity:.72}}
.pad{{margin-top:80px;width:1640px;height:2050px;border-radius:70px;background:#0c0c0c;padding:26px;
  box-shadow:0 70px 140px -40px rgba(0,0,0,.45),0 0 0 2px rgba(0,0,0,.2)}}
.screen{{width:100%;height:100%;border-radius:46px;background:{CREAM};overflow:hidden;position:relative;display:flex;flex-direction:column}}
.statusbar{{display:flex;justify-content:space-between;align-items:center;padding:30px 60px 0;font-weight:700;font-size:32px;color:{DARK}}}
.sb-right{{display:flex;gap:16px}}
.home-h{{padding:26px 60px 6px;display:flex;justify-content:space-between;align-items:center}}
.brand{{font-size:56px;font-weight:800;color:{DARK};letter-spacing:-1px}}.brand span{{color:{AMBER}}}
.avatar{{width:82px;height:82px;border-radius:50%;background:linear-gradient(135deg,{AMBER},#D4842B);display:flex;align-items:center;justify-content:center;color:#fff;font-size:38px;font-weight:800}}
.searchb{{margin:8px 60px;background:#fff;border:1px solid #ece7de;border-radius:30px;padding:34px 40px;display:flex;align-items:center;gap:22px;color:#9a948a;font-size:36px;font-weight:500;box-shadow:0 8px 20px -12px rgba(0,0,0,.15)}}
.searchb svg{{width:46px;height:46px;stroke:{AMBER}}}
.chips{{display:flex;gap:22px;padding:24px 60px}}
.chip{{background:#fff;border:1px solid #ece7de;border-radius:26px;padding:22px 40px;font-size:34px;font-weight:600;color:#5c574f}}
.chip.on{{background:{DARK};color:#fff;border-color:{DARK}}}
.grid{{flex:1;padding:14px 60px 220px;display:grid;grid-template-columns:1fr 1fr;gap:44px;align-content:start}}
.rcard{{background:#fff;border-radius:40px;overflow:hidden;box-shadow:0 22px 46px -26px rgba(0,0,0,.28)}}
.rimg{{height:400px;background-size:cover;background-position:center;position:relative}}
.fav{{position:absolute;top:28px;right:28px;background:#fff;width:80px;height:80px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 16px -6px rgba(0,0,0,.3)}}
.fav svg{{width:44px;height:44px}}
.rbody{{padding:34px 38px 38px}}
.rtop{{display:flex;justify-content:space-between;align-items:baseline}}
.rname{{font-size:48px;font-weight:800;color:{DARK};letter-spacing:-.5px}}
.rprice{{font-size:36px;font-weight:700;color:{AMBER}}}
.rmeta{{display:flex;align-items:center;gap:12px;margin-top:18px}}
.st svg{{width:34px;height:34px}}
.rnote{{font-size:36px;font-weight:800;color:{DARK};margin-left:8px}}
.ravis{{font-size:32px;color:#9a948a}}
.rsub{{font-size:34px;color:#6b665d;margin-top:16px;display:flex;align-items:center;gap:6px}}
.rpin svg{{width:36px;height:36px;stroke:#b6b1a8;vertical-align:-6px}}
.tabbar{{position:absolute;bottom:0;left:0;right:0;height:200px;background:#fff;border-top:1px solid #ececec;display:flex;justify-content:center;gap:130px;align-items:flex-start;padding-top:30px}}
.tab{{display:flex;flex-direction:column;align-items:center;gap:14px;color:#b6b1a8}}
.tab .ti svg{{width:52px;height:52px}}.tab .tl{{font-size:28px;font-weight:600}}
.tab.on{{color:{DARK}}}.tab.on .ti svg{{stroke:{AMBER}}}
</style></head><body><div class="canvas">
  <div class="headline"><h1>Réservez les meilleures <span class="accent">tables</span><br>de Côte d'Ivoire</h1>
  <p>Découvrez, comparez et réservez en quelques secondes.</p></div>
  <div class="pad"><div class="screen">
    <div class="statusbar"><div>9:41</div><div class="sb-right">
      <svg viewBox="0 0 24 18" width="30" height="22" fill="none" stroke="{DARK}" stroke-width="1.6"><path d="M2 9a13 13 0 0 1 20 0"/><path d="M6 12.5a8 8 0 0 1 12 0"/><circle cx="12" cy="16" r="1.4" fill="{DARK}"/></svg>
      <svg viewBox="0 0 26 14" width="34" height="18" fill="none"><rect x="1" y="1" width="21" height="12" rx="3" stroke="{DARK}" stroke-width="1.4"/><rect x="3" y="3" width="15" height="8" rx="1.5" fill="{DARK}"/></svg>
    </div></div>
    <div class="home-h"><div class="brand">Tablière<span>CI</span></div><div class="avatar">AK</div></div>
    <div class="searchb">{I_SEARCH}<span>Rechercher un restaurant, une ville…</span></div>
    <div class="chips"><div class="chip on">Tout</div><div class="chip">Gastronomie</div><div class="chip">Grillades</div><div class="chip">Fruits de mer</div><div class="chip">Lounge</div></div>
    <div class="grid">
      {rcard("chic","L'Ivoire d'Or","Gastronomie française","4,9","328","Cocody","€€€€")}
      {rcard("grill","Le Palmier Royal","Grillades ivoiriennes","4,8","512","Zone 4","€€€")}
      {rcard("seafood","Le Comptoir Lagunaire","Fruits de mer","4,7","206","Marcory","€€€")}
      {rcard("sushi","Table Ébène","Cuisine japonaise","4,8","174","Plateau","€€€€")}
    </div>
    {tabbar}
  </div></div>
</div></body></html>'''

(BASE / "ipad.html").write_text(HTML)
print("OK - ipad.html généré")
