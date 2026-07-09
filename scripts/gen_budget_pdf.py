# -*- coding: utf-8 -*-
"""Génère le PDF du budget d'infrastructure TablièreCI."""
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable,
)

# ── Couleurs de marque TablièreCI ──────────────────────────────────────────
ORANGE   = colors.HexColor("#E8A045")
ORANGE_L = colors.HexColor("#FEF6EC")
DARK     = colors.HexColor("#1E2E28")
GREEN    = colors.HexColor("#3D6B55")
GREEN_L  = colors.HexColor("#E8F5EE")
BG       = colors.HexColor("#F8F5EF")
BORDER   = colors.HexColor("#E4DFD8")
MUTED    = colors.HexColor("#6B7770")
RED_L    = colors.HexColor("#FEF2F2")
RED      = colors.HexColor("#C0392B")

OUT = "/Users/yiriba/Desktop/TabliereCI-Budget-Infrastructure.pdf"

styles = getSampleStyleSheet()

def S(name, **kw):
    base = kw.pop("parent", styles["Normal"])
    return ParagraphStyle(name, parent=base, **kw)

st_title   = S("t", fontName="Helvetica-Bold", fontSize=22, textColor=DARK, leading=26, spaceAfter=2)
st_sub     = S("s", fontName="Helvetica", fontSize=10.5, textColor=MUTED, leading=14, spaceAfter=2)
st_h2      = S("h2", fontName="Helvetica-Bold", fontSize=13.5, textColor=DARK, leading=17, spaceBefore=14, spaceAfter=6)
st_body    = S("b", fontName="Helvetica", fontSize=9.5, textColor=DARK, leading=14, spaceAfter=4)
st_small   = S("sm", fontName="Helvetica", fontSize=8.5, textColor=MUTED, leading=12)
st_note    = S("n", fontName="Helvetica", fontSize=9, textColor=DARK, leading=13)
st_cellL   = S("cl", fontName="Helvetica", fontSize=8.3, textColor=DARK, leading=11)
st_cellLb  = S("clb", fontName="Helvetica-Bold", fontSize=8.3, textColor=DARK, leading=11)
st_cellH   = S("ch", fontName="Helvetica-Bold", fontSize=8.3, textColor=colors.white, leading=11)

def p(txt, s=st_cellL):
    return Paragraph(txt, s)

def money(txt):
    return Paragraph(txt, st_cellLb)

doc = SimpleDocTemplate(
    OUT, pagesize=A4,
    leftMargin=16*mm, rightMargin=16*mm, topMargin=15*mm, bottomMargin=15*mm,
    title="TablièreCI — Budget Infrastructure", author="TablièreCI",
)

flow = []

# ── En-tête ────────────────────────────────────────────────────────────────
header = Table([[
    Paragraph("TablièreCI", S("logo", fontName="Helvetica-Bold", fontSize=17, textColor=colors.white, leading=20)),
    Paragraph("Budget d'infrastructure &amp; charges<br/>Estimation avant lancement", S("hr", fontName="Helvetica", fontSize=9, textColor=ORANGE_L, leading=12, alignment=2)),
]], colWidths=[70*mm, 108*mm])
header.setStyle(TableStyle([
    ("BACKGROUND", (0,0), (-1,-1), DARK),
    ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
    ("LEFTPADDING", (0,0), (-1,-1), 14),
    ("RIGHTPADDING", (0,0), (-1,-1), 14),
    ("TOPPADDING", (0,0), (-1,-1), 12),
    ("BOTTOMPADDING", (0,0), (-1,-1), 12),
    ("LINEBELOW", (0,0), (-1,-1), 3, ORANGE),
]))
flow.append(header)
flow.append(Spacer(1, 8))

flow.append(Paragraph(
    "Détail complet des dépendances, services, hébergement, domaine et frais associés au bon "
    "fonctionnement du site <b>tabliereci.net</b>. Stack vérifiée directement dans le code du projet "
    "(render.yaml, env.js, package.json).", st_body))

note = Table([[Paragraph(
    "<b>Base de conversion :</b> 1 USD &#8776; 600 FCFA. Les prix des fournisseurs evoluent : a revérifier "
    "sur chaque site avant paiement. Document d'estimation d'infrastructure — ne constitue pas un conseil financier.",
    st_small)]], colWidths=[178*mm])
note.setStyle(TableStyle([
    ("BACKGROUND", (0,0), (-1,-1), ORANGE_L),
    ("BOX", (0,0), (-1,-1), 0.5, ORANGE),
    ("LEFTPADDING", (0,0), (-1,-1), 10), ("RIGHTPADDING", (0,0), (-1,-1), 10),
    ("TOPPADDING", (0,0), (-1,-1), 7), ("BOTTOMPADDING", (0,0), (-1,-1), 7),
]))
flow.append(Spacer(1, 6))
flow.append(note)

def section_title(txt):
    return Paragraph(txt, st_h2)

def make_table(header_row, rows, col_widths, header_bg=DARK, zebra=True):
    data = [[Paragraph(h, st_cellH) for h in header_row]] + rows
    t = Table(data, colWidths=col_widths, repeatRows=1)
    style = [
        ("BACKGROUND", (0,0), (-1,0), header_bg),
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
        ("LEFTPADDING", (0,0), (-1,-1), 7), ("RIGHTPADDING", (0,0), (-1,-1), 7),
        ("TOPPADDING", (0,0), (-1,-1), 5), ("BOTTOMPADDING", (0,0), (-1,-1), 5),
        ("LINEBELOW", (0,0), (-1,-1), 0.4, BORDER),
        ("BOX", (0,0), (-1,-1), 0.6, BORDER),
    ]
    if zebra:
        for i in range(1, len(data)):
            if i % 2 == 0:
                style.append(("BACKGROUND", (0,i), (-1,i), BG))
    t.setStyle(TableStyle(style))
    return t

# ── Section 1 : coûts fixes obligatoires ───────────────────────────────────
flow.append(section_title("1. Charges FIXES obligatoires (récurrentes)"))
rows1 = [
    [p("<b>Domaine</b> tabliereci.net"), p("Adresse du site"), p("Registrar (Namecheap / Cloudflare)"), money("~10 000–13 000 FCFA/an")],
    [p("<b>Render — Web Service</b>"), p("Backend API (Node/Express)"), p("Starter (déjà en place)"), money("~4 200 FCFA/mois<br/>($7)")],
    [p("<b>Render — PostgreSQL</b>"), p("Base de données"), p("Basic (le gratuit expire à 30 j)"), money("~4 200–11 400 FCFA/mois<br/>($7–19)")],
    [p("<b>Vercel</b>"), p("Hébergement frontend"), p("Hobby (gratuit)*"), money("0")],
    [p("<b>Upstash Redis</b>"), p("File de notifications (BullMQ)"), p("Free tier (10k cmd/jour)"), money("0")],
    [p("<b>SendGrid</b>"), p("Emails (vérif, reset, confirmations)"), p("Free (100 emails/jour)"), money("0")],
    [p("<b>SSL / HTTPS</b>"), p("Certificats sécurité"), p("Inclus (Vercel + Render)"), money("0")],
    [p("<b>GitHub</b>"), p("Hébergement du code"), p("Gratuit (dépôt privé)"), money("0")],
    [p("<b>Dépendances npm</b>"), p("React, Express, pg, Vite, etc."), p("Open source"), money("0")],
]
flow.append(make_table(
    ["Service", "Rôle", "Plan au lancement", "Coût"],
    rows1, [42*mm, 46*mm, 46*mm, 44*mm]))

synth1 = Table([[Paragraph(
    "<b>Minimum vital au lancement : ~8 400–15 600 FCFA/mois</b> ($14–26) + ~12 000 FCFA/an de domaine.<br/>"
    "Soit environ <b>110 000 à 200 000 FCFA la première année.</b>", st_note)]], colWidths=[178*mm])
synth1.setStyle(TableStyle([
    ("BACKGROUND", (0,0), (-1,-1), GREEN_L),
    ("BOX", (0,0), (-1,-1), 0.6, GREEN),
    ("LEFTPADDING", (0,0), (-1,-1), 10), ("RIGHTPADDING", (0,0), (-1,-1), 10),
    ("TOPPADDING", (0,0), (-1,-1), 7), ("BOTTOMPADDING", (0,0), (-1,-1), 7),
]))
flow.append(Spacer(1, 5))
flow.append(synth1)
flow.append(Spacer(1, 3))
flow.append(Paragraph(
    "* <b>Vercel Hobby</b> est gratuit mais réservé au non-commercial dans les CGU. Un SaaS payant devrait passer "
    "<b>Pro à $20/mois</b> (~12 000 FCFA) pour être en règle — possible de démarrer en Hobby et migrer ensuite.",
    st_small))

# ── Section 2 : coûts variables ────────────────────────────────────────────
flow.append(section_title("2. Charges VARIABLES (à l'usage — selon le volume)"))
rows2 = [
    [p("<b>WhatsApp Business API</b> (Meta)"), p("Par conversation / message"), money("Templates utilitaires souvent gratuits (fenêtre 24 h) ; sinon ~15–40 FCFA/conversation + éventuel BSP (Twilio/360dialog)")],
    [p("<b>Orange Money CI</b>"), p("Commission par transaction"), money("~1,5–2,5 % du montant")],
    [p("<b>MTN MoMo</b>"), p("Commission par transaction"), money("~1,5–2,5 %")],
    [p("<b>Wave</b>"), p("Commission par transaction"), money("~1 % (le moins cher en CI)")],
    [p("<b>Stripe</b> (cartes internationales)"), p("Par transaction"), money("2,9 % + ~180 FCFA / transaction")],
]
flow.append(make_table(
    ["Service", "Modèle", "Coût"],
    rows2, [54*mm, 44*mm, 80*mm], header_bg=GREEN))

warn = Table([[Paragraph(
    "<b>Attention :</b> les agrégateurs Mobile Money (Orange / MTN / Wave) exigent généralement un "
    "<b>compte marchand</b> et parfois le passage par un <b>PSP</b> (CinetPay, PayDunya, Semoa) qui prend "
    "sa propre commission. C'est le poste à négocier le plus sérieusement : il grignote le revenu à chaque "
    "réservation payante.", st_note)]], colWidths=[178*mm])
warn.setStyle(TableStyle([
    ("BACKGROUND", (0,0), (-1,-1), RED_L),
    ("BOX", (0,0), (-1,-1), 0.6, RED),
    ("LEFTPADDING", (0,0), (-1,-1), 10), ("RIGHTPADDING", (0,0), (-1,-1), 10),
    ("TOPPADDING", (0,0), (-1,-1), 7), ("BOTTOMPADDING", (0,0), (-1,-1), 7),
]))
flow.append(Spacer(1, 5))
flow.append(warn)

# ── Section 3 : montée en charge ───────────────────────────────────────────
flow.append(section_title("3. Montée en charge (croissance vers 1M d'utilisateurs)"))
rows3 = [
    [p("<b>~1 000–5 000</b> users actifs"), p("Render Standard ($25) + Postgres plus gros + Vercel Pro ($20)"), money("~30 000 FCFA/mois<br/>($50)")],
    [p("<b>~10 000–50 000</b> users"), p("Render Pro ($85) ou scaling horizontal, Postgres 4–8 Go, Upstash payant (~$10), SendGrid Essentials ($20)"), money("~90 000–120 000 FCFA/mois<br/>($150–200)")],
    [p("<b>Vers 1M</b> users (pic)"), p("Backend multi-instances + load balancer, Postgres haute dispo + réplicas, Redis dédié, CDN, SendGrid Pro, monitoring"), money("500 000–1 500 000+ FCFA/mois<br/>(très variable)")],
]
flow.append(make_table(
    ["Palier", "Ce qui change", "Coût mensuel estimé"],
    rows3, [40*mm, 90*mm, 48*mm], header_bg=ORANGE, ))

# ── Section 4 : options recommandées ───────────────────────────────────────
flow.append(section_title("4. Options recommandées (utiles, non obligatoires)"))
rows4 = [
    [p("<b>UptimeRobot</b>"), p("Empêche le cold start de Render (backend qui s'endort)"), money("Gratuit")],
    [p("<b>Sauvegardes DB</b>"), p("Récupération en cas d'incident"), money("Incluses (Render Postgres payant)")],
    [p("<b>Sentry</b>"), p("Suivi automatique des erreurs en prod"), money("Free tier au début")],
    [p("<b>Cloudflare</b>"), p("DNS / CDN / anti-DDoS"), money("Gratuit")],
    [p("<b>Email pro</b> (contact@tabliereci.net)"), p("Boîte mail professionnelle"), money("Zoho gratuit ou Google Workspace ~$6/mois")],
]
flow.append(make_table(
    ["Service", "Utilité", "Coût"],
    rows4, [50*mm, 78*mm, 50*mm], header_bg=GREEN))

# ── Synthèse + actions ─────────────────────────────────────────────────────
flow.append(section_title("Synthèse pour le lancement"))
for b in [
    "Budget de démarrage réaliste : <b>~10 000–16 000 FCFA/mois</b> ($17–26) + le domaine annuel.",
    "Les dépendances npm et le SSL ne coûtent rien.",
    "Le vrai poste variable = les <b>commissions de paiement</b> (1–2,5 % par transaction) et <b>WhatsApp</b>.",
    "Possibilité de tout démarrer sur les tiers gratuits (Vercel Hobby, Upstash Free, SendGrid Free) et de ne payer que Render (backend + DB) + le domaine.",
]:
    flow.append(Paragraph("&bull;&nbsp; " + b, st_body))

flow.append(section_title("2 points d'action détectés dans le code"))
act = Table([
    [Paragraph("1", S("num", fontName="Helvetica-Bold", fontSize=12, textColor=colors.white, alignment=TA_CENTER)),
     Paragraph("<b>render.yaml fixe JWT_EXPIRES_IN : 15m</b> — le correctif anti-déconnexion (2 h) ne s'appliquera "
               "pas tant que cette valeur n'est pas changée à <b>2h</b> dans le dashboard Render ou le render.yaml.", st_note)],
    [Paragraph("2", S("num2", fontName="Helvetica-Bold", fontSize=12, textColor=colors.white, alignment=TA_CENTER)),
     Paragraph("<b>Render Postgres gratuit expire (~30 jours)</b> — prévoir le plan <b>Basic</b> dès maintenant "
               "pour ne pas perdre la base en pleine exploitation.", st_note)],
], colWidths=[10*mm, 168*mm])
act.setStyle(TableStyle([
    ("BACKGROUND", (0,0), (0,-1), ORANGE),
    ("BACKGROUND", (1,0), (1,-1), ORANGE_L),
    ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
    ("BOX", (0,0), (-1,-1), 0.6, ORANGE),
    ("INNERGRID", (0,0), (-1,-1), 0.6, colors.white),
    ("LEFTPADDING", (0,0), (-1,-1), 8), ("RIGHTPADDING", (0,0), (-1,-1), 8),
    ("TOPPADDING", (0,0), (-1,-1), 8), ("BOTTOMPADDING", (0,0), (-1,-1), 8),
]))
flow.append(act)

flow.append(Spacer(1, 10))
flow.append(HRFlowable(width="100%", thickness=0.5, color=BORDER))
flow.append(Paragraph(
    "TablièreCI — SaaS de réservation restaurant (Côte d'Ivoire) &nbsp;|&nbsp; tabliereci.net &nbsp;|&nbsp; "
    "Document d'estimation, prix indicatifs susceptibles d'évoluer.", st_small))

doc.build(flow)
print("PDF généré :", OUT)
