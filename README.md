# Site LAN R.A.G.E 2 — ragelan.rushxp.re

Design : maquette « design_handoff_site_rage_lan_2 » (Archivo condensé, JetBrains Mono, orange #f7941d, boutons en parallélogramme). Images optimisées dans `public/assets/da/`.

Paiement : au lieu des Stripe Payment Links proposés dans la maquette, le site utilise Stripe Checkout via son propre serveur. Ça permet de contrôler les places restantes en direct, d'imposer 5 / 3 joueurs sans remplaçant, de vérifier l'âge (autorisation parentale, accompagnateur des moins de 16 ans) et d'attribuer les Menus Best Of aux 30 premiers payés.

Site officiel et inscriptions de la RAGE LAN 2026 (RushXP). Node.js 18 ou plus, **aucune dépendance à installer**.

## Ce que fait le site

- Page d'accueil : compte à rebours, les 4 compétitions avec les **places restantes en temps réel**, Joueurs libres, cash prize, programme, infos pratiques, règles pour les mineurs, live Twitch, partenaires, FAQ.
- **Inscription** (`/inscription.html`) :
  - Valorant : 5 joueurs exactement (pas de remplaçant). Rocket League : 3 joueurs exactement. FC 27 FUT et Joueurs libres : en solo.
  - Le capitaine paie pour toute l'équipe, par carte via **Stripe**.
  - **Mineurs (moins de 18 ans le 21/11)** : engagement obligatoire à présenter l'autorisation parentale signée (PDF téléchargeable).
  - **Moins de 16 ans** : nom, lien et téléphone de l'adulte accompagnateur obligatoires.
  - Une place est réservée 30 minutes pendant le paiement ; l'inscription n'est validée qu'une fois le paiement confirmé par Stripe.
  - Les **30 premiers joueurs payés** reçoivent automatiquement le Menu Best Of (compteur affiché sur le site).
  - Ouverture automatique le **9 novembre 2026 à 0h**, fermeture le **18 novembre 2026 à minuit** (heure de La Réunion).
- **Règlements** (`/reglements/…`) en page web et en PDF (`/docs/`).
- **Admin** (`/admin.html`, protégé par mot de passe) : inscriptions, statut de paiement, Menus Best Of, autorisations parentales reçues (à cocher le jour J), accompagnateurs des moins de 16 ans, annulation, **export CSV** (Excel).

## Mise en ligne

1. Héberger le dossier sur un serveur qui fait tourner Node.js (Render, Railway, Fly.io, un VPS OVH…) et faire pointer `ragelan.rushxp.re` dessus (HTTPS obligatoire pour Stripe).
2. Définir les variables d'environnement :

| Variable | Valeur |
|---|---|
| `BASE_URL` | `https://ragelan.rushxp.re` |
| `ADMIN_PASSWORD` | un mot de passe long, à garder secret |
| `STRIPE_SECRET_KEY` | clé secrète Stripe (`sk_live_…`, ou `sk_test_…` pour tester) |
| `STRIPE_WEBHOOK_SECRET` | secret du webhook Stripe (`whsec_…`, voir ci-dessous) |
| `PORT` | fourni par l'hébergeur en général (3000 par défaut) |

Facultatif : `DATA_DIR` (dossier de stockage des inscriptions, à placer hors du dossier de l'application sur Hostinger), `OPEN_AT` et `CLOSE_AT` (dates ISO) pour changer l'ouverture ou la fermeture.

➡️ Mise en ligne sur Hostinger : voir `MISE_EN_LIGNE_HOSTINGER.md`.

3. Lancer : `npm start` (ou `node server.js`).

**Important :** les inscriptions sont enregistrées dans `data/inscriptions.json`. Ce dossier doit être **persistant** (disque conservé entre les redémarrages : sur Render/Railway/Fly, ajouter un volume monté sur `data/`). Sauvegarde-le régulièrement, ou fais un export CSV depuis l'admin.

## Configuration Stripe

1. Dashboard Stripe → Développeurs → Clés API : copier la clé secrète dans `STRIPE_SECRET_KEY`.
2. Dashboard Stripe → Développeurs → Webhooks → Ajouter un endpoint :
   - URL : `https://ragelan.rushxp.re/api/stripe/webhook`
   - Événements : `checkout.session.completed` et `checkout.session.expired`
   - Copier le « secret de signature » dans `STRIPE_WEBHOOK_SECRET`.
3. Dans Stripe → Paramètres → E-mails clients, activer l'envoi des reçus de paiement : chaque capitaine / joueur reçoit ainsi sa confirmation par e-mail.
4. Faire un essai complet en mode test (`sk_test_…`, carte `4242 4242 4242 4242`) avant de passer en `sk_live_…`.

Remboursement d'une inscription : le faire dans Stripe, puis cliquer « Annuler » dans l'admin pour libérer la place.

## Tester en local

```bash
MOCK_PAYMENT=1 OPEN_AT=2026-11-01T00:00:00+04:00 ADMIN_PASSWORD=test node server.js
```

Puis ouvrir http://localhost:3000. `MOCK_PAYMENT=1` simule le paiement (uniquement si aucune clé Stripe n'est définie) : **ne jamais l'utiliser en ligne**.

## À compléter

- `public/mentions-legales.html` et `public/confidentialite.html` : directeur·rice de la publication, e-mail de contact, hébergeur (repérés par « [À compléter] »).
- Logo MILS E-Sport à ajouter sur la carte FC 27 si souhaité (`public/assets/logos/`).

## Modifier les règlements

Le texte des règlements est dans `docs-src/reglements.py`. Après modification :

```bash
python3 docs-src/reglements.py
```

Puis régénérer les PDF (Chrome / Playwright, impression A4 de `docs-src/print/*.html` vers `public/docs/`). La fiche d'autorisation parentale est `docs-src/autorisation.html` → `public/docs/Autorisation_parentale_RAGE_LAN_2026.pdf`.
