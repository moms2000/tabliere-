#!/bin/bash
# Construit le bundle Android signe de TablièreCI, pret a envoyer sur Google Play.
# Tes mots de passe sont saisis de facon masquee et ne sont jamais enregistres.
set -e
cd "$(dirname "$0")/android"

export JAVA_HOME="/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
export ANDROID_HOME="/opt/homebrew/share/android-commandlinetools"
export PATH="$JAVA_HOME/bin:$PATH"

echo "============================================"
echo "  TablièreCI - Construction du fichier signe"
echo "============================================"
echo "Tes mots de passe ne s'affichent pas a l'ecran et ne sont pas sauvegardes."
echo

read -r -p "1) Glisse ton fichier .jks ici puis appuie sur Entree : " KS
KS=$(echo "$KS" | sed "s/^ *//; s/ *$//; s/^'//; s/'$//")
KS="${KS/#\~/$HOME}"
if [ ! -f "$KS" ]; then
  echo "Fichier introuvable : $KS"
  exit 1
fi

read -r -p "2) Nom de l'alias de la cle : " ALIAS
read -r -s -p "3) Mot de passe du keystore : " KSPW; echo
read -r -s -p "4) Mot de passe de la cle (Entree si identique) : " KEYPW; echo
[ -z "$KEYPW" ] && KEYPW="$KSPW"

export TABLIERE_KEYSTORE="$KS"
export TABLIERE_KEYSTORE_PASSWORD="$KSPW"
export TABLIERE_KEY_ALIAS="$ALIAS"
export TABLIERE_KEY_PASSWORD="$KEYPW"

echo
echo "Nettoyage des doublons iCloud eventuels..."
find . \( -name "* 2" -o -name "* 2.*" \) -print0 2>/dev/null | xargs -0 rm -rf 2>/dev/null || true
./gradlew clean --no-daemon -q

echo "Construction en cours (cela peut prendre une a deux minutes)..."
./gradlew :app:bundleRelease --no-daemon

AAB="$(pwd)/app/build/outputs/bundle/release/app-release.aab"
echo
if [ -f "$AAB" ]; then
  echo "TERMINE."
  echo "Fichier a envoyer sur Google Play (Production > Nouvelle release) :"
  echo "$AAB"
else
  echo "Le fichier n'a pas ete produit. Verifie l'alias et les mots de passe."
  exit 1
fi
