#!/usr/bin/env python3
# Génère 5 maquettes App Store (1290x2796) pour TablièreCI
import json, os, pathlib

BASE = pathlib.Path(__file__).parent
IMG = {}
for line in (BASE / "_imgs.jsonl").read_text().splitlines():
    IMG.update(json.loads(line))

AMBER = "#E8A045"
AMBER_D = "#D4842B"
DARK = "#1E2E28"
CREAM = "#F8F5EF"
INK = "#1a1a1a"

FONT = "'Avenir Next','Avenir','Segoe UI',system-ui,sans-serif"

# ---- petites icônes SVG (style ligne) ----
def ic(path, fill="none", sw=2, stroke="currentColor"):
    return f'<svg viewBox="0 0 24 24" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round">{path}</svg>'

I_HOME = ic('<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>')
I_SEARCH = ic('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/>')
I_GIFT = ic('<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M4 12v9h16v-9"/><path d="M12 8S10.5 3 8 4.5 9.5 8 12 8ZM12 8s1.5-5 4-3.5S14.5 8 12 8Z"/>')
I_CAL = ic('<rect x="3" y="4.5" width="18" height="17" rx="2.5"/><path d="M3 9h18M8 2.5v4M16 2.5v4"/>')
I_USER = ic('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>')
I_STAR = '<svg viewBox="0 0 24 24" fill="%s" stroke="none"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 18.9 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z"/></svg>' % AMBER
I_PIN = ic('<path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/>', )
I_HEART = '<svg viewBox="0 0 24 24" fill="%s" stroke="none"><path d="M12 21S3.5 14.6 3.5 8.9A4.9 4.9 0 0 1 12 6a4.9 4.9 0 0 1 8.5 2.9C20.5 14.6 12 21 12 21Z"/></svg>' % AMBER
I_CLOCK = ic('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>')
I_CHECK = ic('<path d="M20 6 9 17l-5-5"/>', sw=2.5)

def stars(n=5):
    return "".join(f'<span class="st">{I_STAR}</span>' for _ in range(n))

def bottomnav(active):
    items = [("Accueil", I_HOME), ("Recherche", I_SEARCH), ("Récompenses", I_GIFT),
             ("Réservations", I_CAL), ("Profil", I_USER)]
    html = '<div class="tabbar">'
    for i,(lbl,icn) in enumerate(items):
        cls = "tab on" if i==active else "tab"
        html += f'<div class="{cls}"><span class="ti">{icn}</span><span class="tl">{lbl}</span></div>'
    html += '</div>'
    return html

def statusbar(dark=False):
    col = "#fff" if dark else DARK
    return f'''<div class="statusbar" style="color:{col}">
      <div class="sb-time">9:41</div>
      <div class="sb-right">
        <svg viewBox="0 0 20 20" width="18" height="14" fill="{col}"><rect x="1" y="9" width="3" height="6" rx="1"/><rect x="6" y="6" width="3" height="9" rx="1"/><rect x="11" y="3" width="3" height="12" rx="1"/><rect x="16" y="1" width="3" height="14" rx="1" opacity=".35"/></svg>
        <svg viewBox="0 0 24 18" width="20" height="15" fill="none" stroke="{col}" stroke-width="1.6"><path d="M2 9a13 13 0 0 1 20 0" stroke-linecap="round"/><path d="M6 12.5a8 8 0 0 1 12 0" stroke-linecap="round"/><circle cx="12" cy="16" r="1.4" fill="{col}" stroke="none"/></svg>
        <svg viewBox="0 0 26 14" width="24" height="13" fill="none"><rect x="1" y="1" width="21" height="12" rx="3" stroke="{col}" stroke-width="1.4"/><rect x="3" y="3" width="15" height="8" rx="1.5" fill="{col}"/><rect x="23" y="4.5" width="2" height="5" rx="1" fill="{col}"/></svg>
      </div>
    </div>'''

def phone(inner, dark_status=False):
    return f'''<div class="phone">
      <div class="screen">
        {statusbar(dark_status)}
        <div class="island"></div>
        {inner}
      </div>
    </div>'''

PAGE = '''<!doctype html><html><head><meta charset="utf-8"><style>
*{{margin:0;padding:0;box-sizing:border-box;-webkit-font-smoothing:antialiased}}
html,body{{width:1284px;height:2778px;font-family:{FONT}}}
.canvas{{width:1284px;height:2778px;position:relative;overflow:hidden;
  background:{bg};display:flex;flex-direction:column;align-items:center}}
.headline{{text-align:center;padding:150px 90px 0;color:{hl_col}}}
.headline h1{{font-size:82px;line-height:1.08;font-weight:800;letter-spacing:-1.5px}}
.headline .accent{{color:{AMBER}}}
.headline p{{font-size:40px;margin-top:26px;font-weight:500;opacity:.72}}
.phone{{margin-top:90px;width:980px;height:2020px;border-radius:96px;background:#0c0c0c;
  padding:20px;box-shadow:0 60px 120px -30px rgba(0,0,0,.45),0 0 0 2px rgba(0,0,0,.2);position:relative}}
.screen{{width:100%;height:100%;border-radius:78px;background:{CREAM};overflow:hidden;position:relative}}
.island{{position:absolute;top:26px;left:50%;transform:translateX(-50%);width:230px;height:60px;background:#000;border-radius:40px;z-index:9}}
.statusbar{{display:flex;justify-content:space-between;align-items:center;padding:34px 60px 0;font-weight:700;font-size:34px}}
.sb-right{{display:flex;align-items:center;gap:14px}}
.tabbar{{position:absolute;bottom:0;left:0;right:0;height:190px;background:#fff;border-top:1px solid #ececec;
  display:flex;justify-content:space-around;align-items:flex-start;padding-top:26px}}
.tab{{display:flex;flex-direction:column;align-items:center;gap:12px;color:#b6b1a8;width:150px}}
.tab .ti svg{{width:46px;height:46px}}
.tab .tl{{font-size:24px;font-weight:600}}
.tab.on{{color:{DARK}}}
.tab.on .ti svg{{stroke:{AMBER}}}
.tab.on .tl{{color:{DARK}}}
.st svg{{width:30px;height:30px}}
{extra}
</style></head><body><div class="canvas">
  <div class="headline"><h1>{h1}</h1><p>{sub}</p></div>
  {phone}
</div></body></html>'''

def build(name, bg, hl_col, h1, sub, inner, extra="", dark_status=False):
    html = PAGE.format(FONT=FONT, bg=bg, hl_col=hl_col, AMBER=AMBER, CREAM=CREAM, DARK=DARK,
                       h1=h1, sub=sub, phone=phone(inner, dark_status), extra=extra)
    (BASE / f"{name}.html").write_text(html)

# ============ SLIDE 1 — Découverte ============
def resto_card(img, nom, cuis, note, avis, lieu, prix):
    return f'''<div class="rcard">
      <div class="rimg" style="background-image:url({IMG[img]})"><div class="fav">{I_HEART}</div></div>
      <div class="rbody">
        <div class="rtop"><div class="rname">{nom}</div><div class="rprice">{prix}</div></div>
        <div class="rmeta">{stars()}<span class="rnote">{note}</span><span class="ravis">({avis})</span></div>
        <div class="rsub">{cuis} · <span class="rpin">{I_PIN}</span>{lieu}</div>
      </div></div>'''

s1_extra = '''
.home-h{padding:24px 44px 8px;display:flex;justify-content:space-between;align-items:center}
.brand{font-size:46px;font-weight:800;color:#1E2E28;letter-spacing:-1px}
.brand span{color:#E8A045}
.searchb{margin:12px 44px 6px;background:#fff;border:1px solid #ece7de;border-radius:26px;
  padding:30px 34px;display:flex;align-items:center;gap:20px;color:#9a948a;font-size:32px;font-weight:500;box-shadow:0 8px 20px -12px rgba(0,0,0,.15)}
.searchb svg{width:40px;height:40px;stroke:#E8A045}
.chips{display:flex;gap:18px;padding:20px 44px;overflow:hidden}
.chip{background:#fff;border:1px solid #ece7de;border-radius:22px;padding:18px 32px;font-size:30px;font-weight:600;color:#5c574f;white-space:nowrap}
.chip.on{background:#1E2E28;color:#fff;border-color:#1E2E28}
.rlist{padding:6px 44px 210px;display:flex;flex-direction:column;gap:34px}
.rcard{background:#fff;border-radius:34px;overflow:hidden;box-shadow:0 18px 40px -22px rgba(0,0,0,.28)}
.rimg{height:360px;background-size:cover;background-position:center;position:relative}
.fav{position:absolute;top:26px;right:26px;background:#fff;width:74px;height:74px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 16px -6px rgba(0,0,0,.3)}
.fav svg{width:40px;height:40px}
.rbody{padding:30px 34px 34px}
.rtop{display:flex;justify-content:space-between;align-items:baseline}
.rname{font-size:44px;font-weight:800;color:#1E2E28;letter-spacing:-.5px}
.rprice{font-size:34px;font-weight:700;color:#E8A045}
.rmeta{display:flex;align-items:center;gap:10px;margin-top:16px}
.rnote{font-size:32px;font-weight:800;color:#1E2E28;margin-left:8px}
.ravis{font-size:30px;color:#9a948a}
.rsub{font-size:32px;color:#6b665d;margin-top:14px;display:flex;align-items:center;gap:6px}
.rpin svg{width:34px;height:34px;stroke:#b6b1a8;vertical-align:-6px;margin-right:2px}
'''
s1_inner = f'''
<div class="home-h"><div class="brand">Tablière<span>CI</span></div></div>
<div class="searchb">{I_SEARCH}<span>Rechercher un restaurant, une ville…</span></div>
<div class="chips"><div class="chip on">Tout</div><div class="chip">Gastronomie</div><div class="chip">Grillades</div><div class="chip">Fruits de mer</div></div>
<div class="rlist">
  {resto_card("chic","L'Ivoire d'Or","Gastronomie · Cuisine française","4,9","328","Cocody","€€€€")}
  {resto_card("grill","Le Palmier Royal","Grillades · Cuisine ivoirienne","4,8","512","Zone 4","€€€")}
  {resto_card("seafood","Le Comptoir Lagunaire","Fruits de mer","4,7","206","Marcory","€€€")}
</div>
{bottomnav(0)}'''
build("slide1", f"linear-gradient(160deg,{CREAM} 0%,#efe7d8 100%)", DARK,
      'Les meilleures <span class="accent">tables</span><br>de Côte d\'Ivoire', "Découvrez, comparez, réservez.", s1_inner, s1_extra)

# ============ SLIDE 2 — Réservation ============
s2_extra = '''
.hero{height:620px;background-size:cover;background-position:center;position:relative}
.hero .back{position:absolute;top:120px;left:40px;width:78px;height:78px;border-radius:50%;background:rgba(255,255,255,.9);display:flex;align-items:center;justify-content:center}
.hero .back svg{width:40px;height:40px;stroke:#1E2E28}
.dsheet{margin-top:-70px;background:#F8F5EF;border-radius:56px 56px 0 0;position:relative;padding:52px 48px 210px}
.dname{font-size:58px;font-weight:800;color:#1E2E28;letter-spacing:-1px}
.dmeta{display:flex;align-items:center;gap:12px;margin-top:20px;font-size:32px;color:#6b665d}
.dmeta .rnote{font-weight:800;color:#1E2E28}
.sect{font-size:34px;font-weight:800;color:#1E2E28;margin:46px 0 24px}
.dates{display:flex;gap:18px}
.dbox{flex:1;background:#fff;border:1px solid #ece7de;border-radius:26px;padding:26px 0;text-align:center}
.dbox.on{background:#1E2E28;border-color:#1E2E28}
.dbox .dd{font-size:28px;color:#9a948a;font-weight:600}
.dbox .dn{font-size:44px;font-weight:800;color:#1E2E28;margin-top:8px}
.dbox.on .dd{color:#cfd8d3}.dbox.on .dn{color:#fff}
.party{display:flex;align-items:center;justify-content:space-between;background:#fff;border:1px solid #ece7de;border-radius:26px;padding:30px 40px;font-size:34px;font-weight:600;color:#1E2E28}
.party .pc{display:flex;align-items:center;gap:30px}
.pbtn{width:64px;height:64px;border-radius:50%;background:#f0eadf;color:#1E2E28;font-size:40px;font-weight:700;display:flex;align-items:center;justify-content:center}
.slots{display:flex;flex-wrap:wrap;gap:20px}
.slot{background:#fff;border:1px solid #ece7de;border-radius:22px;padding:24px 0;width:calc(33.33% - 14px);text-align:center;font-size:36px;font-weight:700;color:#1E2E28}
.slot.on{background:#E8A045;border-color:#E8A045;color:#fff;box-shadow:0 12px 26px -10px rgba(232,160,69,.7)}
.cta{margin-top:48px;background:#1E2E28;color:#fff;border-radius:30px;padding:40px;text-align:center;font-size:40px;font-weight:800;box-shadow:0 22px 44px -18px rgba(30,46,40,.7)}
'''
s2_inner = f'''
<div class="hero" style="background-image:url({IMG['plat']})"><div class="back">{ic('<path d="M15 5l-7 7 7 7"/>',stroke=DARK)}</div></div>
<div class="dsheet">
  <div class="dname">L'Ivoire d'Or</div>
  <div class="dmeta">{stars()}<span class="rnote">4,9</span><span>(328 avis)</span><span>· €€€€</span></div>
  <div class="sect">Date</div>
  <div class="dates">
    <div class="dbox"><div class="dd">JEU</div><div class="dn">17</div></div>
    <div class="dbox on"><div class="dd">VEN</div><div class="dn">18</div></div>
    <div class="dbox"><div class="dd">SAM</div><div class="dn">19</div></div>
    <div class="dbox"><div class="dd">DIM</div><div class="dn">20</div></div>
  </div>
  <div class="sect">Convives</div>
  <div class="party"><span>Nombre de personnes</span><div class="pc"><span class="pbtn">−</span><span>4</span><span class="pbtn">+</span></div></div>
  <div class="sect">Heure</div>
  <div class="slots">
    <div class="slot">19:00</div><div class="slot">19:30</div><div class="slot on">20:00</div>
    <div class="slot">20:30</div><div class="slot">21:00</div><div class="slot">21:30</div>
  </div>
  <div class="cta">Réserver pour 4 · Ven. 20:00</div>
</div>'''
build("slide2", f"linear-gradient(160deg,#1E2E28 0%,#16211d 100%)", "#fff",
      'Réservez en <span class="accent">quelques<br>secondes</span>', "Date, convives, horaire. C'est tout.", s2_inner, s2_extra, dark_status=False)

# ============ SLIDE 3 — Mes réservations ============
s3_extra = '''
.rh{padding:30px 48px 10px;font-size:52px;font-weight:800;color:#1E2E28;letter-spacing:-1px}
.segs{display:flex;gap:16px;padding:10px 48px 20px}
.seg{padding:20px 40px;border-radius:24px;font-size:32px;font-weight:700;background:#efe9df;color:#6b665d}
.seg.on{background:#1E2E28;color:#fff}
.blist{padding:8px 48px 210px;display:flex;flex-direction:column;gap:30px}
.bk{background:#fff;border-radius:34px;padding:0;overflow:hidden;box-shadow:0 16px 38px -24px rgba(0,0,0,.26);display:flex}
.bk .bim{width:230px;background-size:cover;background-position:center}
.bk .bin{flex:1;padding:34px 36px}
.bk .bn{font-size:42px;font-weight:800;color:#1E2E28}
.badge{display:inline-flex;align-items:center;gap:10px;font-size:26px;font-weight:700;padding:12px 22px;border-radius:20px;margin-top:6px}
.badge.ok{background:#e7f4ec;color:#1e7d4f}.badge.ok svg{width:28px;height:28px;stroke:#1e7d4f}
.badge.wait{background:#fdf3e3;color:#c07d1e}.badge.wait svg{width:28px;height:28px;stroke:#c07d1e}
.brow{display:flex;align-items:center;gap:14px;margin-top:22px;font-size:31px;color:#5c574f;font-weight:500}
.brow svg{width:34px;height:34px;stroke:#b6b1a8}
'''
def bk(img, nom, badge_cls, badge_txt, badge_ic, date, guests):
    return f'''<div class="bk"><div class="bim" style="background-image:url({IMG[img]})"></div>
      <div class="bin"><div class="bn">{nom}</div>
      <div class="badge {badge_cls}">{badge_ic}{badge_txt}</div>
      <div class="brow">{I_CAL}{date}</div>
      <div class="brow">{I_USER}{guests}</div></div></div>'''
s3_inner = f'''
<div class="rh">Mes réservations</div>
<div class="segs"><div class="seg on">À venir</div><div class="seg">Passées</div></div>
<div class="blist">
  {bk("chic","L'Ivoire d'Or","ok","Confirmée",I_CHECK,"Ven. 18 juil. · 20:00","4 personnes")}
  {bk("sushi","Table Ébène","wait","En attente",I_CLOCK,"Sam. 19 juil. · 21:00","2 personnes")}
  {bk("grill","Le Palmier Royal","ok","Confirmée",I_CHECK,"Dim. 20 juil. · 13:00","6 personnes")}
</div>
{bottomnav(3)}'''
build("slide3", f"linear-gradient(160deg,{CREAM} 0%,#efe7d8 100%)", DARK,
      'Toutes vos <span class="accent">réservations</span><br>au même endroit', "Suivez le statut en temps réel.", s3_inner, s3_extra)

# ============ SLIDE 4 — Carte ============
s4_extra = '''
.map{position:absolute;inset:0;background:#e7ece4}
.map .grid{position:absolute;inset:0;opacity:.5;
  background-image:linear-gradient(#d5ddd0 2px,transparent 2px),linear-gradient(90deg,#d5ddd0 2px,transparent 2px);background-size:150px 150px}
.road{position:absolute;background:#fff;border-radius:20px}
.pin{position:absolute;transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center}
.pin .pd{background:#1E2E28;color:#fff;padding:12px 22px;border-radius:22px;font-size:28px;font-weight:700;white-space:nowrap;box-shadow:0 8px 18px -6px rgba(0,0,0,.4)}
.pin.hot .pd{background:#E8A045}
.pin .tip{width:0;height:0;border-left:14px solid transparent;border-right:14px solid transparent;border-top:18px solid #1E2E28}
.pin.hot .tip{border-top-color:#E8A045}
.mcard{position:absolute;left:44px;right:44px;bottom:230px;background:#fff;border-radius:36px;padding:30px;display:flex;gap:28px;box-shadow:0 26px 50px -20px rgba(0,0,0,.4)}
.mcard .mim{width:200px;height:200px;border-radius:26px;background-size:cover;background-position:center}
.mcard .mn{font-size:44px;font-weight:800;color:#1E2E28}
.mcard .mmeta{display:flex;align-items:center;gap:10px;margin-top:14px}
.mcard .rnote{font-weight:800;color:#1E2E28;font-size:32px}
.mcard .msub{font-size:31px;color:#6b665d;margin-top:14px}
.mcard .mbtn{margin-top:22px;display:inline-block;background:#E8A045;color:#fff;font-size:30px;font-weight:800;padding:20px 38px;border-radius:22px}
'''
s4_inner = f'''
<div class="map">
  <div class="grid"></div>
  <div class="road" style="left:0;right:0;top:640px;height:26px"></div>
  <div class="road" style="left:0;right:0;top:1180px;height:26px;transform:rotate(-4deg)"></div>
  <div class="road" style="top:0;bottom:0;left:360px;width:26px"></div>
  <div class="road" style="top:0;bottom:0;left:720px;width:26px;transform:rotate(3deg)"></div>
  <div class="pin hot" style="left:52%;top:640px"><div class="pd">L'Ivoire d'Or · €€€€</div><div class="tip"></div></div>
  <div class="pin" style="left:26%;top:900px"><div class="pd">Table Ébène</div><div class="tip"></div></div>
  <div class="pin" style="left:72%;top:1020px"><div class="pd">Le Palmier Royal</div><div class="tip"></div></div>
  <div class="pin" style="left:40%;top:1280px"><div class="pd">Maison Baobab</div><div class="tip"></div></div>
  <div class="mcard">
    <div class="mim" style="background-image:url({IMG['chic']})"></div>
    <div><div class="mn">L'Ivoire d'Or</div>
    <div class="mmeta">{stars()}<span class="rnote">4,9</span></div>
    <div class="msub">Gastronomie française · Cocody</div>
    <div class="mbtn">Réserver</div></div>
  </div>
</div>
{bottomnav(1)}'''
build("slide4", f"linear-gradient(160deg,#1E2E28 0%,#16211d 100%)", "#fff",
      'Un restaurant <span class="accent">près<br>de chez vous</span>', "Explorez la carte, réservez sur place.", s4_inner, s4_extra)

# ============ SLIDE 5 — Favoris / Profil ============
s5_extra = '''
.ph{padding:40px 48px 10px;display:flex;align-items:center;gap:30px}
.av{width:150px;height:150px;border-radius:50%;background:linear-gradient(135deg,#E8A045,#D4842B);display:flex;align-items:center;justify-content:center;color:#fff;font-size:66px;font-weight:800}
.pn{font-size:50px;font-weight:800;color:#1E2E28}
.pe{font-size:32px;color:#8a857b;margin-top:8px}
.stats{display:flex;gap:22px;padding:28px 48px}
.stat{flex:1;background:#fff;border-radius:28px;padding:34px 0;text-align:center;box-shadow:0 14px 34px -22px rgba(0,0,0,.24)}
.stat .sv{font-size:56px;font-weight:800;color:#E8A045}
.stat .sl{font-size:28px;color:#6b665d;font-weight:600;margin-top:8px}
.fh{padding:28px 48px 16px;font-size:40px;font-weight:800;color:#1E2E28}
.fgrid{padding:0 48px 210px;display:grid;grid-template-columns:1fr 1fr;gap:28px}
.fc{background:#fff;border-radius:30px;overflow:hidden;box-shadow:0 14px 34px -22px rgba(0,0,0,.26)}
.fc .fi{height:230px;background-size:cover;background-position:center;position:relative}
.fc .fh2{position:absolute;top:20px;right:20px;background:#fff;width:64px;height:64px;border-radius:50%;display:flex;align-items:center;justify-content:center}
.fc .fh2 svg{width:36px;height:36px}
.fc .fb{padding:24px 26px}
.fc .fn{font-size:36px;font-weight:800;color:#1E2E28}
.fc .fm{display:flex;align-items:center;gap:8px;margin-top:12px;font-size:28px;color:#6b665d}
.fc .fm .rnote{font-weight:800;color:#1E2E28}
'''
def fcard(img,nom,note,cuis):
    return f'''<div class="fc"><div class="fi" style="background-image:url({IMG[img]})"><div class="fh2">{I_HEART}</div></div>
    <div class="fb"><div class="fn">{nom}</div><div class="fm"><span class="st">{I_STAR}</span><span class="rnote">{note}</span>· {cuis}</div></div></div>'''
s5_inner = f'''
<div class="ph"><div class="av">AK</div><div><div class="pn">Aya Koné</div><div class="pe">aya.kone@email.ci</div></div></div>
<div class="stats">
  <div class="stat"><div class="sv">12</div><div class="sl">Réservations</div></div>
  <div class="stat"><div class="sv">6</div><div class="sl">Favoris</div></div>
  <div class="stat"><div class="sv">340</div><div class="sl">Points</div></div>
</div>
<div class="fh">Mes favoris</div>
<div class="fgrid">
  {fcard("chic","L'Ivoire d'Or","4,9","Gastronomie")}
  {fcard("sushi","Table Ébène","4,8","Japonais")}
  {fcard("lounge","Le Jardin d'Akwaba","4,7","Lounge")}
  {fcard("healthy","Villa Émeraude","4,8","Healthy")}
</div>
{bottomnav(4)}'''
build("slide5", f"linear-gradient(160deg,{CREAM} 0%,#efe7d8 100%)", DARK,
      'Vos adresses <span class="accent">préférées</span><br>toujours à portée', "Enregistrez vos coups de cœur.", s5_inner, s5_extra)

print("OK - 5 slides générés")
