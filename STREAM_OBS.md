# Habillage Twitch RAGE LAN 2026 — mode d'emploi OBS

## Les pages
- **Overlay** (à mettre dans OBS) : `https://ragelan.rushxp.re/stream/overlay.html`
- **Panneau de contrôle** (sur un PC ou une tablette de la régie) : `https://ragelan.rushxp.re/stream/controle.html` (mot de passe admin), aussi accessible via le bouton « Stream » de l'admin.

## Installation dans OBS
1. Dans chaque scène OBS, ajouter une source **Navigateur** :
   - URL : `https://ragelan.rushxp.re/stream/overlay.html`
   - Largeur **1920**, hauteur **1080**
   - Cocher « Actualiser le navigateur quand la scène devient active »
2. Placer cette source **au-dessus** de la capture du jeu.
3. Option : une scène OBS par écran, en forçant la scène dans l'URL :
   - `overlay.html?scene=match` (score + bandeau partenaires, fond transparent)
   - `overlay.html?scene=starting` (« Le live commence bientôt » + compte à rebours + « À suivre »)
   - `overlay.html?scene=pause`
   - `overlay.html?scene=end`
   - `overlay.html?scene=board` (classement / tableau du tournoi en plein écran)
   Sans `?scene=`, l'overlay suit la scène choisie dans le panneau de contrôle.

## Pendant le live (panneau de contrôle)
- **Scène** : Match / Début bientôt / Pause / Fin du live.
- **Match** : jeu (le logo et la couleur changent), phase (Groupe A, Grande finale…), format BO, noms des équipes, score avec les boutons + / −, « Inverser » quand les équipes changent de côté.
- **Position du score** : en haut, en bas, ou masqué (utile si le score du jeu est déjà affiché au même endroit).
- **Message** : texte du bandeau défilant en bas pendant les matchs, et sous-titre des écrans plein écran.
- **Compte à rebours** : heure de reprise affichée sur les écrans « Début bientôt » / « Pause ».
- **À suivre** : un match par ligne (5 maximum).
- L'overlay se met à jour tout seul en 1 à 2 secondes.

## Nouveautés : tournois et photos de fond
- **Charger un match du tournoi** : dans « Depuis la gestion des tournois », choisis le match puis « Charger dans l'overlay ». Les noms, les logos des équipes, la phase (ex. « Winner · tour 2 ») et le format (BO) sont remplis tout seuls, scores à 0.
- **« À suivre » automatique** : le bouton remplit la liste avec les prochains matchs du tournoi ; clique ensuite « Mettre à jour l'overlay ».
- **Scène « Classement / tableau »** : affiche en plein écran, pour le jeu choisi dans « Match », les poules (avec logos) ou le tableau final (Winner / Loser bracket pour la double élimination), et pour TFT le classement + les lobbies de la manche en cours. Tout se met à jour seul toutes les 5 secondes et s'ajuste à l'écran.
- **Photo de fond** des écrans Début bientôt / Pause / Fin / Classement : clique sur une photo proposée ou importe la tienne (PNG, JPG ou WebP, 5 Mo max, réduite automatiquement). Les photos importées sont gardées ; la croix les retire seulement de la liste.

## Mise à jour : compte à rebours, aperçu et raccourcis
- **Compte à rebours en durée** : boutons 2, 5, 10, 15, 20, 30, 45 min et 1 h, ou « Autre durée » en minutes. Le chrono démarre au clic. +1 min, +5 min, −1 min et « Arrêter » ajustent en direct. L'ancienne option « jusqu'à une heure précise » existe toujours, à part.
- Sur l'overlay : « REPRISE DANS » (ou « DÉBUT DANS ») au-dessus du chrono, au format 10:00 sous une heure et 1:30:00 au-delà ; à zéro, « ON REPREND ! » s'affiche pendant 2 minutes.
- **Aperçu en direct** de l'overlay en haut du panneau de contrôle.
- **Messages rapides** : un clic pour afficher un message prêt (pause repas, Discord, partenaires…).
- **Raccourcis clavier** (hors des champs de saisie) : 1 à 5 pour les scènes, A/Q pour le score A, P/M pour le score B.
- Changement de scène en fondu ; score jusqu'à 20 (BO longs).

## Séries BO3 / BO5 (maps ou parties)

Dès que le format est BO3 ou plus, l'overlay affiche sous le score :
- des barres par équipe (maps / parties gagnées sur le nombre nécessaire) et « BO5 · premier à 3 » ;
- une case par map (Valorant) ou partie (autres jeux) : logo du gagnant et score, la map en cours en rouge « live », les suivantes grisées (« si besoin »).

Dans **Contrôle → Série BO3 / BO5** :
- saisir le nom de la map (Valorant ; rempli tout seul avec le ban de maps si le match vient de la gestion des tournois) puis Entrée ;
- suivre le score de la map en cours avec les boutons +/− ou les touches A/Q (équipe A) et P/M (équipe B) ;
- cliquer « Map gagnée par … » : le score de la série, les barres et les cases se mettent à jour ;
- « Annuler la dernière » en cas d'erreur, « Recommencer la série » pour repartir de zéro.
Charger un match depuis la gestion des tournois remet la série à zéro. En BO1, l'affichage ne change pas.
