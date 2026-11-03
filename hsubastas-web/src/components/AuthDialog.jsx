import React, { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { authErrorMessage } from "../modules/auth/authService.js";
import Dialog from "./Dialog.jsx";
function AuthDialog({ initialMode = "login", onClose }) {
  const { service, refresh } = useAuth();
  const [mode, setMode] = useState(initialMode), [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [error, setError] = useState(false);
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget, values = Object.fromEntries(new FormData(form));
    setBusy(true);
    setMessage("");
    setError(false);
    try {
      const data = mode === "register" ? await service.signUp(values) : await service.signIn(values);
      form.elements.password.value = "";
      if (data.session) {
        await refresh(data.session);
        onClose();
      } else {
        setMode("login");
        setMessage("Si el registro procede, recibir\xE1s un enlace de confirmaci\xF3n. Revisa tu correo y luego inicia sesi\xF3n.");
      }
    } catch (failure) {
      setError(true);
      setMessage(authErrorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  return <Dialog title={mode === "register" ? "Crea tu cuenta" : "Iniciar sesi\xF3n"} onClose={onClose} className="auth-modal">
    <p className="market-help">Una cuenta para publicar requerimientos y ofertar.</p>
    <div className="auth-tabs" role="group" aria-label="Tipo de acceso">{[["login", "Iniciar sesi\xF3n"], ["register", "Registrarse"]].map(([key, label]) => <button key={key} disabled={busy} aria-pressed={mode === key} onClick={() => {
    setMode(key);
    setMessage("");
  }}>{label}</button>)}</div>
    <form className="market-form" onSubmit={submit} aria-busy={busy}><fieldset disabled={busy}>
      {mode === "register" && <label>Nombre completo<input name="name" autoComplete="name" maxLength={100} required /></label>}
      <label>Correo electrónico<input name="email" type="email" autoComplete="email" required /></label>
      <label>Contraseña<input key={mode} name="password" type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} minLength={mode === "register" ? 8 : 1} required /></label>
      {mode === "register" && <small>Mínimo 8 caracteres. Es posible que debas confirmar tu correo.</small>}
      <button className="button button-dark" type="submit">{busy ? "Procesando\u2026" : mode === "register" ? "Registrarme" : "Iniciar sesi\xF3n"}</button>
    </fieldset></form>{message && <p className="market-status" data-error={error} role="status">{message}</p>}
  </Dialog>;
}
export {
  AuthDialog as default
};
