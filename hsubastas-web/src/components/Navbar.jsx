import React from "react";
import { useAuth } from "../context/AuthContext.jsx";
function Navbar({ route, openAuth, notifications, notificationError }) {
  const { user, profile, loading } = useAuth();
  const links = [["/inicio", "Inicio"], ["/subastas", "Explorar Subastas"], ["/como-funciona", "C\xF3mo Funciona"], ["/publicar", "Publicar Requerimiento"]];
  return <header className="portal-header"><div className="portal-nav container">
    <a href="#/inicio" className="brand" aria-label="HSubastas, inicio"><span className="brand-icon" aria-hidden="true">h<span>↘</span></span>HSubastas<span className="brand-dot">.</span></a>
    <nav className="portal-menu" aria-label="Navegación principal">{links.map(([path, label]) => <a key={path} href={`#${path}`} aria-current={route === path ? "page" : void 0}>{label}</a>)}</nav>
    <div className="portal-user">{user ? <>
      <details className="notifications"><summary aria-label="Notificaciones y actividad reciente"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>{notifications.length > 0 && <span className="notification-count">{notifications.length}</span>}</summary><div className="notification-panel"><strong>Actividad reciente</strong>{notificationError ? <p role="status">No se pudo consultar tu actividad.</p> : notifications.length ? notifications.map((item) => <a key={item.id} href={`#/subastas?auction=${encodeURIComponent(item.id)}&mine=1`}>{item.title}<small>{item.awarded_bid_id ? "Oferta adjudicada" : "Plazo de ofertas finalizado"}</small></a>) : <p>Sin adjudicaciones o vencimientos recientes.</p>}<a href="#/subastas?mine=1">Ver mi actividad →</a></div></details>
      <a className="profile-link" href="#/perfil" aria-current={route === "/perfil" ? "page" : void 0}><span className="profile-avatar" aria-hidden="true">{(profile?.name || "U").slice(0, 1).toUpperCase()}</span><span><strong>{profile?.name || "Mi cuenta"}</strong><small>Cuenta registrada</small></span></a>
    </> : <><button type="button" className="text-link" disabled={loading} onClick={() => openAuth("login")}>{loading ? "Conectando\u2026" : "Iniciar sesi\xF3n"}</button><button type="button" className="button button-dark" disabled={loading} onClick={() => openAuth("register")}>Registrarse</button></>}</div>
  </div></header>;
}
export {
  Navbar as default
};
