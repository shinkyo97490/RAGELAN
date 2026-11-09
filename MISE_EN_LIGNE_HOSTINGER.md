# Mise en ligne sur Hostinger — ragelan.rushxp.re

## 0. Prérequis
- Un forfait Hostinger qui accepte les applications Node.js : **Business** (hébergement web) ou **Cloud** (Startup, Professional, Enterprise…). Les forfaits Single / Premium ne suffisent pas.
- Un compte Stripe actif.

## 1. Créer l'application Node.js
1. hPanel → **Sites web** → **Ajouter un site web** → **Application Web Node.js**.
2. Choisir **Importer des fichiers** et envoyer `ragelan-site.zip` (ou connecter un dépôt GitHub).
3. Réglages de build :
   - Version de Node.js : **22.x** (18 minimum)
   - Commande d'installation : laisser vide (aucune dépendance)
   - Commande de démarrage : `npm start`
   - Fichier d'entrée : `server.js`
4. Domaine : choisir **ragelan.rushxp.re**. Si `rushxp.re` est géré ailleurs que chez Hostinger, ajouter chez ce gestionnaire l'enregistrement DNS indiqué par Hostinger pour le sous-domaine `ragelan`.
5. Vérifier que le **SSL (HTTPS)** est actif sur ragelan.rushxp.re (obligatoire pour Stripe).

## 2. Variables d'environnement
Tableau de bord de l'application Node.js → **Variables d'environnement** → Ajouter :

| Clé | Valeur |
|---|---|
| `BASE_URL` | `https://ragelan.rushxp.re` |
| `ADMIN_PASSWORD` | un mot de passe long et secret |
| `STRIPE_SECRET_KEY` | `sk_test_…` pour l'essai, puis `sk_live_…` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` (étape 3) |
| `DATA_DIR` | facultatif : par défaut `~/ragelan-data` (dossier personnel du compte, conservé entre les déploiements) |
| `SMTP_HOST` | `smtp.hostinger.com` (e-mails envoyés depuis contact@rushxp.re) |
| `SMTP_PORT` | `465` |
| `SMTP_USER` | `contact@rushxp.re` |
| `SMTP_PASS` | le mot de passe de la boîte contact@rushxp.re |

Ne pas définir `PORT` ni `MOCK_PAYMENT` : Hostinger fournit le port lui-même. Hostinger redéploie l'application après l'ajout des variables.

## 3. Stripe
1. Stripe → Développeurs → **Webhooks** → Ajouter un endpoint :
   - URL : `https://ragelan.rushxp.re/api/stripe/webhook`
   - Événements : `checkout.session.completed` et `checkout.session.expired`
2. Copier le secret de signature (`whsec_…`) dans `STRIPE_WEBHOOK_SECRET`.
3. Stripe → Paramètres → E-mails clients : activer les **reçus de paiement**.

## 4. Tester AVANT le 9 novembre
Les inscriptions s'ouvrent automatiquement le 9 novembre à 0h. Pour tester avant :
1. Ajouter temporairement `OPEN_AT` = `2026-11-01T00:00:00+04:00`.
2. Faire une inscription Joueurs libres avec la carte de test Stripe `4242 4242 4242 4242` (date future, CVC au choix).
3. Vérifier : retour sur la page « Inscription confirmée », l'inscription apparaît « Payée » dans `/admin.html`, le compteur Best Of passe à 29.
4. **Test de conservation des données** : redéployer l'application, puis vérifier dans l'admin que l'inscription test est toujours là. Si elle a disparu, `DATA_DIR` est mal placé : contacter le support Hostinger pour connaître un dossier persistant.
5. Dans l'admin, **annuler** l'inscription test, puis supprimer `OPEN_AT`, passer la clé Stripe en `sk_live_…` et refaire le webhook en mode live (nouveau `whsec_…`).

## 5. Pendant les inscriptions (9 → 18 novembre)
- **Ne pas redéployer** l'application sans avoir téléchargé une sauvegarde (bouton **Sauvegarde** dans l'admin).
- Télécharger une sauvegarde et un **Export CSV** chaque soir.
- Remboursement : le faire dans Stripe, puis « Annuler » dans l'admin pour libérer la place.
