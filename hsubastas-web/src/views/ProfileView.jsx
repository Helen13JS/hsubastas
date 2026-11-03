import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { authErrorMessage } from "../modules/auth/authService.js";
function ProfileView({ openAuth }) {
  const { user, session, profile, loading, error, service, refresh, signOut } = useAuth();
  const [phone, setPhone] = useState(profile?.whatsapp_phone || ""), [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [failed, setFailed] = useState(false);
  const currentUser = useRef(user?.id);
  currentUser.current = user?.id;
  useEffect(() => {
    setPhone(profile?.whatsapp_phone || "");
  }, [profile?.whatsapp_phone, user?.id]);
  useEffect(() => {
    currentUser.current = user?.id;
    setMessage("");
    return () => {
      currentUser.current = null;
    };
  }, [user?.id]);
  if (loading) return <p className="container section" role="status">Restaurando tu sesión…</p>;
  if (!user) return <section className="container section access-gate"><p className="eyebrow">PERFIL CORPORATIVO</p><h1>Tu espacio en HSubastas</h1><p>Inicia sesión para consultar tu perfil y administrar tu contacto.</p><button className="button button-dark" onClick={() => openAuth("login")}>Iniciar sesión</button></section>;
  async function save(event) {
    event.preventDefault();
    if (busy) return;
    const id = user.id;
    setBusy(true);
    setFailed(false);
    setMessage("");
    try {
      await service.updateWhatsApp(phone);
      if (currentUser.current !== id) return;
      await refresh(session);
      if (currentUser.current === id) setMessage("WhatsApp actualizado correctamente.");
    } catch (failure) {
      if (currentUser.current === id) {
        setFailed(true);
        setMessage(authErrorMessage(failure));
      }
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    try {
      await signOut();
    } catch (failure) {
      setFailed(true);
      setMessage(authErrorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  return <section className="container section"><div className="view-heading"><div><p className="eyebrow">MI CUENTA</p><h1>Perfil corporativo</h1><p>Una cuenta para comprar y proveer en Bolivia.</p></div><a href="#/subastas?mine=1" className="button button-outline">Ver mi actividad ↗</a></div>
    <div className="profile-grid"><article className="portal-panel"><h2>Información de tu cuenta</h2><dl className="profile-facts"><dt>Nombre</dt><dd>{profile?.name || "Perfil pendiente"}</dd><dt>Correo</dt><dd>{user.email}</dd><dt>Participación</dt><dd>Comprador y proveedor</dd><dt>Verificación empresarial</dt><dd><span className="status-badge">Sin verificación empresarial</span></dd></dl><p className="market-help">El registro de la cuenta no acredita la verificación de una empresa.</p>{error && <p className="market-status" data-error="true">{error}</p>}<div className="profile-actions"><button className="text-link" disabled={busy} onClick={() => refresh(session)}>Actualizar perfil ↻</button><button className="button button-outline" disabled={busy} onClick={logout}>Cerrar sesión</button></div></article>
    <article className="portal-panel"><h2>WhatsApp de contacto</h2><form className="market-form" onSubmit={save}><label>Celular boliviano<input type="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+591 71234567" maxLength={24} disabled={busy || !profile} /></label><small>Al guardarlo aceptas compartirlo con los compradores de tus ofertas. Déjalo vacío para retirarlo.</small><button className="button button-dark" disabled={busy || !profile}>{busy ? "Guardando\u2026" : "Guardar WhatsApp"}</button></form>{message && <p className="market-status" data-error={failed} role="status">{message}</p>}</article></div>
  </section>;
}
export {
  ProfileView as default
};
