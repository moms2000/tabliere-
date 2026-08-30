import { useRef, useEffect } from "react";

/**
 * Saisie d'un code OTP à 6 chiffres — 6 cases, auto-avance, collage, retour arrière.
 * Props :
 *   value    : chaîne courante (ex "1234")
 *   onChange : (nouvelleValeur) => void  — toujours ≤ 6 chiffres
 *   onComplete : (code) => void          — appelé dès que 6 chiffres sont saisis
 *   disabled : bool
 *   accent   : couleur d'accent (bordure focus)
 */
export default function OtpInput({ value = "", onChange, onComplete, disabled = false, accent = "#E8A045" }) {
  const refs = useRef([]);
  const digits = value.split("").slice(0, 6);
  while (digits.length < 6) digits.push("");

  // Focus automatique sur la première case au montage, et à chaque fois que le
  // code est vidé (ex : après un code incorrect) pour permettre de retaper direct.
  useEffect(() => { if (value === "") refs.current[0]?.focus(); }, [value]);

  const emit = (next) => {
    const clean = next.replace(/\D/g, "").slice(0, 6);
    onChange(clean);
    if (clean.length === 6) onComplete?.(clean);
  };

  const handleChange = (i, raw) => {
    const d = raw.replace(/\D/g, "");
    if (!d) return;
    // Si l'utilisateur colle plusieurs chiffres dans une case, on remplit à partir d'ici.
    const arr = digits.slice();
    if (d.length > 1) {
      const pasted = d.split("");
      for (let k = 0; k < pasted.length && i + k < 6; k++) arr[i + k] = pasted[k];
      emit(arr.join(""));
      refs.current[Math.min(i + d.length, 5)]?.focus();
      return;
    }
    arr[i] = d;
    emit(arr.join(""));
    if (i < 5) refs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i, e) => {
    if (e.key === "Backspace") {
      const arr = digits.slice();
      if (arr[i]) { arr[i] = ""; emit(arr.join("")); }
      else if (i > 0) { refs.current[i - 1]?.focus(); arr[i - 1] = ""; emit(arr.join("")); }
    } else if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
    else if (e.key === "ArrowRight" && i < 5) refs.current[i + 1]?.focus();
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const d = (e.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, 6);
    if (d) { emit(d); refs.current[Math.min(d.length, 5)]?.focus(); }
  };

  return (
    <div style={{ display: "flex", gap: 8, justifyContent: "center" }} onPaste={handlePaste}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={el => (refs.current[i] = el)}
          value={d}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
          onFocus={e => e.target.select()}
          disabled={disabled}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={6}
          aria-label={`Chiffre ${i + 1}`}
          style={{
            width: 44, height: 54, textAlign: "center", fontSize: 22, fontWeight: 700,
            color: "#1E2E28", border: `1.5px solid ${d ? accent : "#E4DFD8"}`,
            borderRadius: 11, background: disabled ? "#F0EDE6" : "#F8F5EF",
            outline: "none", fontFamily: "inherit", transition: "border-color .15s",
            caretColor: accent,
          }}
          onFocusCapture={e => (e.target.style.borderColor = accent)}
        />
      ))}
    </div>
  );
}
