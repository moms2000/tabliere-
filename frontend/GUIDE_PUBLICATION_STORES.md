# 📱 Guide de publication — TablièreCI (App Store + Play Store)

Le projet est déjà **emballé avec Capacitor** : les dossiers `ios/` et `android/`
sont générés, les icônes et écrans de lancement sont créés, et l'app appelle le
backend de production (`.env.production`).

- **App ID** : `net.tabliereci.app`
- **Nom** : TablièreCI
- **Catégorie conseillée** : Food & Drink / Alimentation
- **URL politique de confidentialité** : https://tabliereci.net/confidentialite

> À chaque modification du site : `npm run build` puis `npx cap sync`, puis
> reconstruire dans Xcode / Android Studio.

---

## 🍎 1. APP STORE (iOS) — priorité

### Prérequis (une seule fois)
1. **Xcode complet** (App Store, gratuit) — pas seulement les Command Line Tools.
2. Pointer les outils vers Xcode :
   ```bash
   sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
   ```
3. **CocoaPods** :
   ```bash
   brew install cocoapods    # ou : sudo gem install cocoapods
   ```
4. **Compte Apple Developer** — 99 $/an : https://developer.apple.com/programs/

### Build & ouverture
```bash
cd frontend
npm run build
npx cap sync ios       # installe les pods (nécessite CocoaPods)
npx cap open ios       # ouvre le projet dans Xcode
```

### Dans Xcode
1. Sélectionner le projet **App** → onglet **Signing & Capabilities**.
2. **Team** : choisir ton compte Apple Developer (signature automatique).
3. Vérifier le **Bundle Identifier** = `net.tabliereci.app`.
4. Onglet **General** : Version `1.0`, Build `1`, orientations (Portrait).
5. Brancher un iPhone ou choisir « Any iOS Device (arm64) ».
6. Menu **Product → Archive** → attendre la fin.
7. **Distribute App → App Store Connect → Upload**.

### Dans App Store Connect (https://appstoreconnect.apple.com)
1. **Mes apps → +** → Nouvelle app (nom, langue FR, bundle `net.tabliereci.app`).
2. Remplir la fiche : description, mots-clés, **captures d'écran** (obligatoires :
   6,7" et 6,5" — fais-les depuis le simulateur ou ton iPhone).
3. **URL de confidentialité** : `https://tabliereci.net/confidentialite`.
4. **App Privacy** : données collectées = nom, e-mail, téléphone, usage.
   → **Aucune donnée de paiement** (on a retiré les paiements).
5. Classement d'âge : 4+.
6. Sélectionner le build uploadé → **Soumettre pour examen**.

### ⚠️ Règle 4.2 d'Apple (« minimum functionality »)
Apple refuse les simples « sites en wrapper ». Notre app a un vrai comportement
natif (splash, barre de statut, coquille hors-ligne, réservation, carte, favoris,
profil). Si jamais elle est refusée, la parade est d'ajouter les **notifications
push** natives (`@capacitor/push-notifications`) — dis-le-moi, je l'intègre.

---

## 🤖 2. PLAY STORE (Android)

### Prérequis (une seule fois)
1. **Android Studio** : https://developer.android.com/studio (inclut le SDK + JDK).
2. **Compte Google Play Console** — 25 $ une seule fois : https://play.google.com/console

### Build & ouverture
```bash
cd frontend
npm run build
npx cap sync android
npx cap open android     # ouvre le projet dans Android Studio
```

### Générer l'app signée (AAB)
1. Dans Android Studio : **Build → Generate Signed Bundle / APK → Android App Bundle**.
2. **Create new…** keystore (garde bien le fichier `.jks` et les mots de passe —
   ils sont indispensables pour toutes les mises à jour futures).
3. Variante **release** → génère le fichier `.aab`.

### Dans Play Console
1. **Créer une application** (nom, FR, gratuite).
2. **Fiche du store** : description, icône, **captures d'écran** (téléphone), bannière.
3. **Politique de confidentialité** : `https://tabliereci.net/confidentialite`.
4. **Sécurité des données** : nom, e-mail, téléphone (aucun paiement).
5. **Classification du contenu** : questionnaire → tous publics.
6. **Production → Créer une release** → uploader le `.aab` → examiner → déployer.

> Alternative encore plus rapide pour Android : **PWABuilder.com** (entre
> `https://tabliereci.net`, il génère un package TWA signé). Mais Capacitor
> (ci-dessus) donne une vraie app native, cohérente avec iOS.

---

## 🔁 Mettre à jour l'app après une modif du site
```bash
cd frontend
npm run build
npx cap sync            # copie le nouveau web + met à jour les plugins
# puis : Archive (Xcode) / Generate Signed Bundle (Android Studio) → ré-uploader
```
Incrémente à chaque fois **Build** (iOS) et **versionCode** (Android).

---

## 📝 Éléments de fiche prêts à l'emploi

- **Nom** : TablièreCI
- **Sous-titre** : Réservez les meilleures tables de Côte d'Ivoire
- **Description courte** : Trouvez et réservez une table dans les meilleurs
  restaurants d'Abidjan et de Côte d'Ivoire — confirmation immédiate, zéro frais.
- **Mots-clés** : restaurant, réservation, table, Abidjan, Côte d'Ivoire, resto,
  gastronomie, dîner, menu, QR
- **Confidentialité** : https://tabliereci.net/confidentialite
