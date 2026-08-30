// Normalisation des numéros de téléphone au format international sans « + »
// (chiffres uniquement), indicatif Côte d'Ivoire (225) par défaut.
//
// Exemples :
//   "0700000000"        -> "2250700000000"   (local CI 10 chiffres)
//   "+225 07 00 00 00"  -> "2250700000000"
//   "2250700000000"     -> "2250700000000"   (déjà international)
export function normalizePhone(input) {
  if (input == null) return null;
  let d = String(input).replace(/[^\d]/g, "");
  if (!d) return null;
  d = d.replace(/^00/, "");                 // 00 international -> rien
  if (d.startsWith("225")) return d;        // déjà indicatif CI
  if (d.length === 10 && d.startsWith("0")) return "225" + d; // local CI
  if (d.length >= 8 && d.length <= 10) return "225" + d;      // local sans 0
  return d;                                  // autre indicatif déjà présent
}

// Numéro CI plausible : 225 + 10 chiffres commençant par 0 (numérotation 2021).
export function isValidPhone(normalized) {
  if (!normalized) return false;
  // On accepte tout international de 11 à 15 chiffres ; CI = 2250XXXXXXXXX (13).
  return /^\d{11,15}$/.test(normalized);
}
