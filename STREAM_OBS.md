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
   Sans `?scene=`, l'overlay suit la scène choisie dans le panneau de contrôle.

## Pendant le live (panneau de contrôle)
- **Scène** : Match / Début bientôt / Pause / Fin du live.
- **Match** : jeu (le logo et la couleur changent), phase (Groupe A, Grande finale…), format BO, noms des équipes, score avec les boutons + / −, « Inverser » quand les équipes changent de côté.
- **Position du score** : en haut, en bas, ou masqué (utile si le score du jeu est déjà affiché au même endroit).
- **Message** : texte du bandeau défilant en bas pendant les matchs, et sous-titre des écrans plein écran.
- **Compte à rebours** : heure de reprise affichée sur les écrans « Début bientôt » / « Pause ».
- **À suivre** : un match par ligne (5 maximum).
- L'overlay se met à jour tout seul en 1 à 2 secondes.
