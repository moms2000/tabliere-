# Activation du code WhatsApp (OTP) - TablièreCI

Checklist pour créer et faire approuver le template WhatsApp qui envoie le code de
vérification à l'inscription et au mot de passe oublié.

Tant que ce n'est pas fait, le code tourne en mode simulation (le code s'affiche
à l'écran hors production, jamais en production).

Contraintes imposées par le code (à respecter exactement) :
- Nom du template : `tabliereci_otp` (minuscules, underscores)
- Langue : Français (`fr`)
- Catégorie : Authentication
- Un paramètre dans le corps : le code
- Un bouton "Copier le code"

---

## Étape 1 - Prérequis (comptes)

- [ ] Un compte Meta Business (business.facebook.com)
- [ ] Une application dans Meta for Developers (developers.facebook.com) avec le
      produit "WhatsApp" ajouté
- [ ] Un numéro de téléphone dédié à l'API WhatsApp Business. Ce numéro ne doit
      PAS être déjà utilisé dans l'application WhatsApp classique. C'est le numéro
      expéditeur qui enverra les codes.
- [ ] Une méthode de paiement ajoutée au compte WhatsApp Business (les messages
      d'authentification sont facturés par pays ; en Côte d'Ivoire le tarif est bas
      mais non nul).

## Étape 2 - Créer le template

- [ ] Aller dans WhatsApp Manager > Message templates > Create template
- [ ] Catégorie : **Authentication**
- [ ] Nom : **tabliereci_otp** (exactement, sinon l'envoi échoue)
- [ ] Langue : **Français**
- [ ] Type de code : **Copy code** (bouton "Copier le code")
      Ne pas choisir "One-tap autofill" : cela demande la signature de l'app
      Android, inutile ici.
- [ ] Options facultatives : cocher l'avertissement d'expiration ("Ce code expire
      dans 10 minutes") pour coller à la durée réelle du code (10 min).
- [ ] Le texte du corps est imposé par Meta pour cette catégorie (quelque chose
      comme "{{1}} est votre code de vérification"). C'est normal, on ne peut pas
      le personnaliser librement.
- [ ] Soumettre pour validation.

L'approbation d'un template d'authentification est en général rapide (quelques
minutes à quelques heures). Aucune image ni texte marketing n'est autorisé dans
cette catégorie.

## Étape 3 - Récupérer les deux identifiants

Deux valeurs sont nécessaires. Ne me les envoie pas en clair : mets-les
directement dans le fichier d'environnement (voir étape 4).

- [ ] **WHATSAPP_PHONE_ID** : l'identifiant du numéro expéditeur.
      Dans Meta for Developers > WhatsApp > API Setup, c'est le "Phone number ID"
      (un nombre, à ne pas confondre avec le numéro de téléphone lui-même).
- [ ] **WHATSAPP_TOKEN** : un jeton d'accès permanent.
      Le jeton affiché par défaut dans "API Setup" est temporaire (24h). Pour la
      production il faut un jeton permanent :
      1. Meta Business > Paramètres > Utilisateurs > Utilisateurs système
      2. Créer un utilisateur système, rôle Admin
      3. Lui donner l'accès à l'app WhatsApp
      4. Générer un jeton avec les permissions `whatsapp_business_messaging` et
         `whatsapp_business_management`
      5. Choisir "N'expire jamais"

## Étape 4 - Configurer sur Render

- [ ] Dans le service backend sur Render > Environment, ajouter :
      - `WHATSAPP_PHONE_ID` = (le Phone number ID)
      - `WHATSAPP_TOKEN` = (le jeton permanent)
- [ ] Sauvegarder et laisser Render redéployer.

Dès que `WHATSAPP_TOKEN` est présent, le mode simulation se coupe tout seul et les
vrais messages partent. Aucun changement de code nécessaire.

## Étape 5 - Vérifier

- [ ] Faire une vraie inscription avec un numéro WhatsApp actif.
- [ ] Confirmer la réception du code sur WhatsApp.
- [ ] Vérifier que la saisie du code crée bien le compte.

En cas d'échec d'envoi, l'erreur est journalisée côté serveur (message
"Échec envoi OTP") sans bloquer l'utilisateur. Les causes fréquentes : template
pas encore approuvé, nom ou langue du template différents, jeton expiré, ou
numéro expéditeur non vérifié.

---

## Note technique

Le service d'envoi ([backend/src/services/whatsapp.service.js](../backend/src/services/whatsapp.service.js),
fonction `sendOtpCode`) envoie le code à la fois dans le corps du message et dans
le bouton "Copier le code". Si tu préfères finalement un template sans bouton (ou
avec un autre type de bouton), dis-le moi et j'adapte le code en conséquence.
