"""Génère les règlements RAGE LAN 2026 : pages du site (public/reglements/*.html) et versions imprimables (docs-src/print/*.html)."""
import html, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_WEB = os.path.join(ROOT, 'public', 'reglements')
OUT_PRINT = os.path.join(ROOT, 'docs-src', 'print')
os.makedirs(OUT_WEB, exist_ok=True)
os.makedirs(OUT_PRINT, exist_ok=True)

LIEU = 'Complexe Sportif de Saint-Paul, La Réunion'
DATES = 'Samedi 21 novembre 2026, 13h → dimanche 22 novembre 2026, 16h'
INSCR = ("Les inscriptions se font en ligne sur ragelan.rushxp.re, du 9 novembre 2026 au 18 novembre 2026 à minuit "
         "(heure de La Réunion), dans la limite des places disponibles. L'inscription n'est validée qu'après le paiement "
         "en ligne (Stripe) de l'intégralité des frais d'inscription.")
MINEURS = [
    ("Mineurs", "Tout participant âgé de moins de 18 ans au 21 novembre 2026 doit présenter à l'accueil, le jour de l'événement, "
     "la fiche d'autorisation parentale RAGE LAN 2026 remplie et signée par son représentant légal (téléchargeable sur ragelan.rushxp.re). "
     "Sans cette autorisation, l'accès à la compétition ne pourra pas être accordé."),
    ("Moins de 16 ans", "Tout participant âgé de moins de 16 ans au 21 novembre 2026 doit en outre être accompagné d'un adulte, "
     "présent sur place pendant toute la durée de sa présence à l'événement. L'identité de cet adulte est déclarée lors de l'inscription "
     "et sur la fiche d'autorisation parentale."),
]
PRESENCE = ("Présence", "Chaque joueur doit être présent 10 minutes avant le début de son match. Toute absence de plus de 10 minutes "
            "après l'heure prévue entraîne un forfait. Les horaires des matchs sont communiqués aux inscrits avant l'événement.")

def common_tail(start, prize_text, image_extra=''):
    n = start
    arts = []
    arts.append((f"ARTICLE {n} — COMPORTEMENT ET FAIR-PLAY", [
        ("Respect", "Respect mutuel entre joueurs, arbitres, bénévoles et public à tout moment."),
        ("Sont proscrits", "Tout comportement injurieux, discriminatoire, violent ou perturbateur envers un autre participant, un membre de l'organisation ou le public."),
        ("Consignes", "Les participants s'engagent à respecter les consignes de l'équipe d'encadrement RushXP pendant tout l'événement, ainsi que le règlement intérieur du Complexe Sportif de Saint-Paul."),
    ])); n += 1
    arts.append((f"ARTICLE {n} — SANCTIONS", "En cas de non-respect du présent règlement, RushXP se réserve le droit d'appliquer, selon la gravité des faits : "
        "un avertissement oral ; la perte d'une manche ou d'un match ; la disqualification pour le match en cours ou pour l'ensemble de la compétition ; "
        "l'exclusion immédiate de l'événement, sans remboursement des frais d'inscription ni attribution de dotation.")); n += 1
    arts.append((f"ARTICLE {n} — CAS PARTICULIERS ET FORCE MAJEURE", "RushXP se réserve le droit d'adapter, de suspendre ou de modifier le format de la compétition "
        "(nombre de matchs, horaires, paramètres de jeu) en cas de contrainte technique ou d'organisation, afin d'assurer le bon déroulement de l'événement. "
        "Les participants sont informés de toute modification par l'arbitre en charge.")); n += 1
    arts.append((f"ARTICLE {n} — DOTATIONS", prize_text + " Les modalités de remise des dotations sont communiquées par RushXP aux gagnants.")); n += 1
    arts.append((f"ARTICLE {n} — DROIT À L'IMAGE", "L'événement fait l'objet d'une captation photo et vidéo et d'une diffusion en direct sur twitch.tv/rushxptv, "
        "à des fins de communication pour RushXP et ses partenaires (réseaux sociaux, supports de communication). La participation vaut acceptation de cette captation, "
        "sauf opposition expresse signalée à l'équipe RushXP avant le début de l'événement. Pour les mineurs, le choix est indiqué sur l'autorisation parentale." + image_extra)); n += 1
    arts.append((f"ARTICLE {n} — DONNÉES PERSONNELLES", "Les données collectées lors de l'inscription sont utilisées par RushXP uniquement pour l'organisation de la RAGE LAN 2026 "
        "(gestion des inscriptions, des paiements, des équipes et de la sécurité des participants). Le paiement est traité par Stripe ; RushXP n'a pas accès aux données bancaires. "
        "Voir la politique de confidentialité sur ragelan.rushxp.re.")); n += 1
    arts.append((f"ARTICLE {n} — ACCEPTATION DU RÈGLEMENT", "L'inscription implique l'acceptation pleine et entière du présent règlement par chaque joueur inscrit "
        "ainsi que, le cas échéant, par son représentant légal. Pour une équipe, le capitaine accepte le règlement au nom de tous ses joueurs.")); n += 1
    arts.append((f"ARTICLE {n} — CONTACT", "Pour toute question : Discord RushXP (discord.gg/VMUXA2z5Y9) ou l'équipe RushXP sur place pendant l'événement."))
    return arts

BYOC = lambda equip: ("MATÉRIEL", [
    ("Configuration BYOC", f"La compétition se joue en configuration BYOC (Bring Your Own Computer) : chaque joueur apporte son propre matériel — {equip}."),
    ("Mis à disposition", "RushXP fournit l'emplacement (table, chaise), l'alimentation électrique et la connexion réseau nécessaires au bon déroulement des matchs."),
    ("Installation", "Chaque joueur est responsable de l'installation, du bon fonctionnement, des mises à jour du jeu et de la configuration de son matériel avant le début de son match. "
     "Aucun délai supplémentaire n'est accordé pour un problème de matériel personnel, hors panne du réseau fourni par RushXP."),
    ("Responsabilité", "RushXP ne pourra être tenu responsable de la perte, du vol ou de la détérioration du matériel personnel apporté par les joueurs. "
     "Chaque participant reste responsable de la surveillance de ses effets personnels."),
])

DOUBLE_ELIM = [
    ("Principe", "Une équipe qui perd un premier match de phase finale est envoyée dans le bracket des perdants (loser bracket) ; une deuxième défaite l'élimine de la compétition."),
    ("Grande finale", "La grande finale oppose le vainqueur du bracket des gagnants (invaincu) au vainqueur du bracket des perdants. "
     "Si l'équipe issue du bracket des perdants remporte la grande finale, une seconde finale (bracket reset) est disputée pour désigner l'équipe championne."),
]

def tournament(slug, title, color, info_rows, arts):
    return dict(slug=slug, title=title, color=color, info=info_rows, arts=arts)

T = []

# ---------- VALORANT ----------
arts = [
    ("ARTICLE 1 — PRÉSENTATION", "Dans le cadre de la RAGE LAN 2026, RushXP organise un tournoi Valorant en équipes de 5 joueurs (5v5). "
     "Le présent règlement définit les conditions de participation, le format de compétition et les règles de conduite applicables à l'ensemble des participants."),
    ("ARTICLE 2 — ORGANISATEUR", "Le tournoi est organisé par RushXP, avec le soutien de ses partenaires Orange, McDonald's et la Ville de Saint-Paul. "
     "L'équipe RushXP assure l'encadrement, l'arbitrage et l'animation de l'événement."),
    ("ARTICLE 3 — CONDITIONS DE PARTICIPATION", [
        ("Places disponibles", "8 équipes de 5 joueurs, soit 40 joueurs au maximum."),
        ("Composition", "Chaque équipe est composée d'exactement 5 joueurs. Aucun remplaçant n'est autorisé. La composition déclarée à l'inscription est définitive."),
        ("Inscription", INSCR + " Le capitaine inscrit l'équipe et règle les frais pour l'ensemble des joueurs."),
        ("Frais d'inscription", "25 € par joueur, soit 125 € par équipe."),
        *MINEURS, PRESENCE,
    ]),
    ("ARTICLE 4 — FORMAT DE LA COMPÉTITION", [
        ("Déroulement", "Le tournoi se déroule sur deux jours, le samedi 21 et le dimanche 22 novembre 2026."),
        ("Phase de groupes", "Les équipes sont réparties en groupes. La composition des groupes, le nombre d'équipes qualifiées pour la phase finale et l'ordre des matchs sont communiqués par l'organisation avant le début du tournoi."),
        ("Phase finale", "Les équipes qualifiées s'affrontent dans un arbre à double élimination."),
        *DOUBLE_ELIM,
        ("Format des matchs", "Tous les matchs se jouent en BO3 : la première équipe à remporter 2 cartes gagne le match."),
        ("Cartes", "Le pool de cartes et la procédure de choix des cartes (bans / picks) sont communiqués par l'arbitre avant le début du tournoi."),
    ]),
    ("ARTICLE 5 — RÈGLES DE JEU SPÉCIFIQUES", [
        ("Paramètres", "Les parties se jouent en partie personnalisée, en mode tournoi, avec les paramètres fixés par l'arbitre RushXP et communiqués aux équipes avant chaque match."),
        ("Comptes", "Chaque joueur utilise son propre compte Riot, correspondant au Riot ID déclaré à l'inscription. Toute utilisation d'un autre compte entraîne la disqualification de l'équipe."),
        ("Triche", "Aucun logiciel de triche, macro ou script n'est autorisé. Le système anti-triche du jeu doit rester actif."),
        ("Exploits", "L'utilisation de bugs du jeu pour obtenir un avantage est interdite."),
        ("Pause technique", "En cas de problème technique, une pause peut être demandée à l'arbitre, qui décide de sa durée et de la reprise de la partie."),
        ("Déconnexion", "En cas de déconnexion, la partie est mise en pause dès que possible. Si le joueur ne peut pas revenir, l'arbitre décide de la suite à donner."),
        ("Litige", "La décision de l'arbitre RushXP présent sur place est finale et sans appel pour toute situation non prévue par le présent règlement."),
    ]),
    ("ARTICLE 6 — " + BYOC("PC, écran, clavier, souris et casque")[0], BYOC("PC, écran, clavier, souris et casque")[1]),
] + common_tail(7, "Cash prize total de 1 000 € : 600 € pour l'équipe classée première et 400 € pour l'équipe classée deuxième, à répartir entre les 5 joueurs de l'équipe.")
T.append(tournament('valorant', 'VALORANT — 5V5', '#FF4655', [
    ('Format', 'Équipes de 5 joueurs (5v5) — 8 équipes, pas de remplaçant'),
    ('Phases', 'Phase de groupes puis double élimination — matchs en BO3'),
    ('Jours', 'Samedi 21 et dimanche 22 novembre 2026'),
    ('Tarif', "25 € par joueur (125 € par équipe)"),
    ('Cash prize', '1 000 € — 1er : 600 € · 2e : 400 €'),
], arts))

# ---------- ROCKET LEAGUE ----------
arts = [
    ("ARTICLE 1 — PRÉSENTATION", "Dans le cadre de la RAGE LAN 2026, RushXP organise un tournoi Rocket League en équipes de 3 joueurs (3v3). "
     "Le présent règlement définit les conditions de participation, le format de compétition et les règles de conduite applicables à l'ensemble des participants."),
    ("ARTICLE 2 — ORGANISATEUR", "Le tournoi est organisé par RushXP, avec le soutien de ses partenaires Orange, McDonald's et la Ville de Saint-Paul. "
     "L'équipe RushXP assure l'encadrement, l'arbitrage et l'animation de l'événement."),
    ("ARTICLE 3 — CONDITIONS DE PARTICIPATION", [
        ("Places disponibles", "8 équipes de 3 joueurs, soit 24 joueurs au maximum."),
        ("Composition", "Chaque équipe est composée d'exactement 3 joueurs. Aucun remplaçant n'est autorisé. La composition déclarée à l'inscription est définitive."),
        ("Inscription", INSCR + " Le capitaine inscrit l'équipe et règle les frais pour l'ensemble des joueurs."),
        ("Frais d'inscription", "20 € par joueur, soit 60 € par équipe."),
        *MINEURS, PRESENCE,
    ]),
    ("ARTICLE 4 — FORMAT DE LA COMPÉTITION", [
        ("Déroulement", "Le tournoi se déroule le samedi 21 novembre 2026."),
        ("Phase de groupes", "Les équipes sont réparties en groupes. La composition des groupes, le nombre d'équipes qualifiées pour la phase finale et l'ordre des matchs sont communiqués par l'organisation avant le début du tournoi."),
        ("Phase finale", "Les équipes qualifiées s'affrontent dans un arbre à double élimination."),
        *DOUBLE_ELIM,
        ("Format des matchs", "Tous les matchs se jouent en BO5 : la première équipe à remporter 3 parties gagne le match."),
    ]),
    ("ARTICLE 5 — RÈGLES DE JEU SPÉCIFIQUES", [
        ("Paramètres", "Les parties se jouent en match privé 3v3, avec l'arène et les paramètres fixés par l'arbitre RushXP et communiqués aux équipes avant chaque match."),
        ("Comptes", "Chaque joueur utilise son propre compte, correspondant à l'identifiant déclaré à l'inscription. Toute utilisation d'un autre compte entraîne la disqualification de l'équipe."),
        ("Triche", "Aucun logiciel de triche, macro ou script n'est autorisé."),
        ("Exploits", "L'utilisation de bugs du jeu pour obtenir un avantage est interdite."),
        ("Déconnexion", "Si un joueur se déconnecte avant le premier but d'une partie, celle-ci est relancée. Au-delà, l'arbitre décide de la suite à donner."),
        ("Litige", "La décision de l'arbitre RushXP présent sur place est finale et sans appel pour toute situation non prévue par le présent règlement."),
    ]),
    ("ARTICLE 6 — " + BYOC("PC ou console, écran, manette ou clavier/souris et casque")[0], BYOC("PC ou console, écran, manette ou clavier/souris et casque")[1]),
] + common_tail(7, "Cash prize total de 600 € : 400 € pour l'équipe classée première et 200 € pour l'équipe classée deuxième, à répartir entre les 3 joueurs de l'équipe.")
T.append(tournament('rocketleague', 'ROCKET LEAGUE — 3V3', '#1E8BFF', [
    ('Format', 'Équipes de 3 joueurs (3v3) — 8 équipes, pas de remplaçant'),
    ('Phases', 'Phase de groupes puis double élimination — matchs en BO5'),
    ('Jour', 'Samedi 21 novembre 2026'),
    ('Tarif', '20 € par joueur (60 € par équipe)'),
    ('Cash prize', '600 € — 1er : 400 € · 2e : 200 €'),
], arts))

# ---------- FC 27 FUT ----------
arts = [
    ("ARTICLE 1 — PRÉSENTATION", "Dans le cadre de la RAGE LAN 2026, un tournoi EA Sports FC 27 en mode Ultimate Team (FUT), en solo (1v1), est organisé. "
     "Le présent règlement définit les conditions de participation, le format de compétition et les règles de conduite applicables à l'ensemble des participants."),
    ("ARTICLE 2 — ORGANISATEUR", "Le tournoi est organisé par MILS E-Sport dans le cadre de la RAGE LAN 2026 de RushXP, avec le soutien des partenaires Orange, McDonald's et la Ville de Saint-Paul. "
     "Les équipes de MILS E-Sport et de RushXP assurent l'encadrement et l'arbitrage du tournoi."),
    ("ARTICLE 3 — CONDITIONS DE PARTICIPATION", [
        ("Places disponibles", "24 joueurs au maximum."),
        ("Inscription", INSCR),
        ("Frais d'inscription", "20 € par joueur."),
        *MINEURS, PRESENCE,
    ]),
    ("ARTICLE 4 — FORMAT DE LA COMPÉTITION", [
        ("Déroulement", "Le tournoi se déroule le dimanche 22 novembre 2026."),
        ("Mode de jeu", "Solo (1v1), mode Ultimate Team (FUT) : chaque joueur utilise son propre club FUT."),
        ("Phase de groupes", "Les joueurs sont répartis en groupes. La composition des groupes, le nombre de qualifiés pour la phase finale et l'ordre des matchs sont communiqués par l'organisation avant le début du tournoi."),
        ("Phase finale", "Les joueurs qualifiés s'affrontent dans un arbre à élimination directe : une défaite élimine le joueur de la compétition."),
        ("Format des matchs", "Le format des matchs (nombre de manches) et les règles de départage sont communiqués par l'arbitre avant le début du tournoi."),
    ]),
    ("ARTICLE 5 — RÈGLES DE JEU SPÉCIFIQUES", [
        ("Paramètres", "Les paramètres de match (durée des mi-temps, règles propres au mode FUT, restrictions éventuelles d'équipe) sont fixés par l'arbitre et communiqués aux joueurs avant le début du tournoi."),
        ("Compte", "Chaque joueur utilise son propre compte, correspondant à l'EA ID déclaré à l'inscription."),
        ("Triche", "Aucun logiciel de triche, macro ou exploit n'est autorisé."),
        ("Exploits", "L'utilisation de bugs du jeu pour obtenir un avantage est interdite."),
        ("Déconnexion", "Si un joueur se déconnecte avant le début d'un match, celui-ci est relancé. Si la déconnexion survient pendant le match, l'arbitre décide de la suite à donner."),
        ("Litige", "La décision de l'arbitre présent sur place est finale et sans appel pour toute situation non prévue par le présent règlement."),
    ]),
    ("ARTICLE 6 — " + BYOC("console, écran, manette et casque")[0], BYOC("console, écran, manette et casque")[1]),
] + common_tail(7, "Cash prize total de 200 € : 150 € pour le joueur classé premier et 50 € pour le joueur classé deuxième.")
T.append(tournament('fc27', 'EA SPORTS FC 27 FUT — SOLO', '#00C853', [
    ('Format', 'Solo (1v1), mode Ultimate Team (FUT) — 24 joueurs'),
    ('Organisation', 'MILS E-Sport, dans le cadre de la RAGE LAN 2026 de RushXP'),
    ('Phases', 'Phase de groupes puis élimination directe'),
    ('Jour', 'Dimanche 22 novembre 2026'),
    ('Tarif', '20 € par joueur'),
    ('Cash prize', '200 € — 1er : 150 € · 2e : 50 €'),
], arts))

# ---------- JOUEURS LIBRES ----------
arts = [
    ("ARTICLE 1 — PRÉSENTATION", "Dans le cadre de la RAGE LAN 2026, RushXP propose une formule « Joueurs libres » : mini-tournois, tournois surprises et jeu libre, "
     "pendant les deux jours de l'événement. Le présent règlement définit les conditions de participation, le fonctionnement du classement et les règles de conduite applicables."),
    ("ARTICLE 2 — ORGANISATEUR", "La formule Joueurs libres est organisée par RushXP, avec le soutien de ses partenaires Orange, McDonald's et la Ville de Saint-Paul. "
     "L'équipe RushXP assure l'encadrement, l'arbitrage et l'animation."),
    ("ARTICLE 3 — CONDITIONS DE PARTICIPATION", [
        ("Places disponibles", "40 joueurs au maximum."),
        ("Inscription", INSCR),
        ("Frais d'inscription", "20 € par joueur, pour les deux jours."),
        *MINEURS,
    ]),
    ("ARTICLE 4 — FONCTIONNEMENT", [
        ("Jours", "Samedi 21 et dimanche 22 novembre 2026, pendant les horaires d'ouverture de l'événement."),
        ("Mini-tournois", "Plusieurs mini-tournois sont organisés pendant les deux jours, notamment sur Fall Guys, League of Legends, Call of Duty: Warzone et Overwatch (liste non exhaustive). "
         "Le jeu, le format, l'horaire et le nombre de places de chaque mini-tournoi sont annoncés sur place et sur le Discord RushXP."),
        ("Tournois surprises", "Des tournois surprises peuvent être lancés à tout moment pendant l'événement. Ils sont annoncés sur place et sur le Discord RushXP."),
        ("Participation", "La participation à chaque mini-tournoi ou tournoi surprise se fait sur inscription auprès de l'équipe RushXP sur place, dans la limite des places de chaque tournoi."),
        ("Jeu libre", "En dehors des tournois, les joueurs libres peuvent jouer librement, seuls ou avec leurs amis, sur le jeu de leur choix, dans le respect du présent règlement et des consignes de l'organisation."),
    ]),
    ("ARTICLE 5 — CLASSEMENT ET TITRE DE CHAMPION", [
        ("Points", "Chaque mini-tournoi et tournoi surprise rapporte des points selon le classement obtenu. Le barème de points est annoncé avant chaque tournoi."),
        ("Classement général", "Un classement général cumule les points obtenus par chaque joueur libre sur l'ensemble des tournois des deux jours. Il est mis à jour régulièrement pendant l'événement."),
        ("Champion", "À la fin de l'événement, le joueur qui totalise le plus de points est sacré champion des Joueurs libres de la RAGE LAN 2026."),
        ("Égalité", "En cas d'égalité de points, la méthode de départage est annoncée par l'organisation avant la fin de l'événement."),
    ]),
    ("ARTICLE 6 — RÈGLES DE JEU", [
        ("Triche", "Aucun logiciel de triche, macro ou exploit n'est autorisé, en tournoi comme en jeu libre."),
        ("Comptes", "Chaque joueur utilise ses propres comptes de jeu."),
        ("Litige", "La décision de l'arbitre RushXP présent sur place est finale et sans appel pour toute situation non prévue par le présent règlement."),
    ]),
    ("ARTICLE 7 — " + BYOC("PC ou console, écran, périphériques et casque")[0], BYOC("PC ou console, écran, périphériques et casque")[1]),
] + common_tail(8, "Le champion des Joueurs libres (1er du classement général) remporte un cash prize de 200 €. Des bons McDonald's sont également à gagner lors des mini-tournois ; "
                  "les récompenses de chaque mini-tournoi sont annoncées à son lancement.")
T.append(tournament('libres', 'JOUEURS LIBRES — MINI-TOURNOIS & JEU LIBRE', '#FF8A1F', [
    ('Format', 'Solo — 40 places — mini-tournois, tournois surprises et jeu libre'),
    ('Jeux', 'Fall Guys, League of Legends, Call of Duty: Warzone, Overwatch… et des surprises'),
    ('Jours', 'Samedi 21 et dimanche 22 novembre 2026'),
    ('Tarif', '20 € par joueur'),
    ('Récompenses', '200 € au champion (classement cumulé) · bons McDo à gagner pendant les mini-tournois'),
], arts))

# ---------- Rendu ----------
e = html.escape

def body(t):
    rows = [('Événement', 'RAGE LAN 2026'), ('Organisateur', 'RushXP' if t['slug'] != 'fc27' else 'MILS E-Sport · RushXP'),
            ('Dates de l\'événement', DATES), ('Lieu', LIEU)] + t['info'] + [('Inscriptions', "ragelan.rushxp.re · jusqu'au 18 novembre 2026 à minuit")]
    out = ['<table>' + ''.join(f'<tr><td>{e(k)}</td><td>{e(v)}</td></tr>' for k, v in rows) + '</table>']
    for title, content in t['arts']:
        out.append(f'<h2>{e(title)}</h2>')
        if isinstance(content, str):
            out.append(f'<p>{e(content)}</p>')
        else:
            out.append('<ul>' + ''.join(f'<li><b>{e(k)} :</b> {e(v)}</li>' for k, v in content) + '</ul>')
    return '\n'.join(out)


for t in T:
    nav = ''.join(f'<a class="btn small{"" if x["slug"] == t["slug"] else " ghost"}" href="{x["slug"]}.html">{e(x["title"].split(" — ")[0].replace("EA SPORTS ", ""))}</a>' for x in T)
    web = f'''<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Règlement {e(t["title"])} — RAGE LAN 2026</title>
<meta name="description" content="Règlement officiel du tournoi {e(t["title"])} de la RAGE LAN 2026.">
<link rel="icon" href="../assets/logos/rushxp.png">
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="../css/style.css"></head><body>
<nav class="nav"><div class="container"><a class="logo" href="../index.html"><img src="../assets/logos/ragelan.png" alt="RAGE LAN 2026"></a>
<a class="btn" href="../inscription.html?c={t["slug"]}" style="margin-left:auto">Je m'inscris</a></div></nav>
<main class="container rules" style="padding-bottom:60px">
<div class="page-head"><div class="kicker">RÈGLEMENT OFFICIEL · RAGE LAN 2026</div><h1 style="font-size:clamp(34px,6vw,56px)"><span style="color:{t["color"]}">{e(t["title"])}</span></h1></div>
<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:22px">{nav}</div>
<p><a href="../docs/Reglement_{t["slug"]}_RAGE_LAN_2026.pdf" download>Télécharger ce règlement en PDF</a></p>
{body(t)}
</main>
<footer class="site"><div class="container"><div><img src="../assets/logos/rushxp.png" alt="RushXP"></div>
<div class="legal"><a href="../index.html">Accueil</a> · <a href="../mentions-legales.html">Mentions légales</a> · <a href="../confidentialite.html">Confidentialité</a></div></div></footer>
</body></html>'''
    open(os.path.join(OUT_WEB, f'{t["slug"]}.html'), 'w').write(web)

    printable = f'''<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Règlement {e(t["title"])}</title>
<style>
@page {{ size: A4; margin: 16mm 16mm 16mm; }}
body {{ font-family: Arial, Helvetica, sans-serif; font-size: 10pt; color: #111; line-height: 1.45; }}
header {{ display: flex; align-items: center; gap: 14px; border-bottom: 3px solid {t["color"]}; padding-bottom: 8px; margin-bottom: 12px; }}
header img {{ height: 50px; }} header .t {{ flex: 1; }}
h1 {{ font-size: 15pt; margin: 0; }} .sub {{ color: #555; font-size: 9pt; }}
table {{ width: 100%; border-collapse: collapse; font-size: 9.5pt; margin-bottom: 8px; }}
td {{ border: 1px solid #ccc; padding: 4px 7px; vertical-align: top; }} td:first-child {{ width: 28%; background: #f4f4f4; font-weight: bold; }}
h2 {{ font-size: 10.5pt; background: #111; color: #fff; padding: 4px 8px; margin: 14px 0 6px; letter-spacing: .5px; page-break-after: avoid; }}
ul {{ margin: 4px 0; padding-left: 18px; }} li {{ margin: 3px 0; }} p {{ margin: 4px 0; }}
</style></head><body>
<header><img src="../../public/assets/logos/rushxp.png"><div class="t"><h1>RÈGLEMENT — {e(t["title"])}</h1><div class="sub">RAGE LAN 2026 · 21 & 22 novembre 2026 · {e(LIEU)}</div></div>
<img src="../../public/assets/logos/ragelan.png" style="height:56px"></header>
{body(t)}
</body></html>'''
    open(os.path.join(OUT_PRINT, f'{t["slug"]}.html'), 'w').write(printable)
print('ok', [t['slug'] for t in T])
