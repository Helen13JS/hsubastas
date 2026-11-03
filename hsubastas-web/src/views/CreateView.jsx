import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { categories, createMarketplaceService, marketplaceError } from "../modules/auctions/marketplaceService.js";
import { attachSpecifications } from "../modules/auctions/specifications.js";
const service = createMarketplaceService();
function CreateView({ openAuth, navigate }) {
  const { user, loading } = useAuth();
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const current = useRef(user?.id);
  current.current = user?.id;
  useEffect(() => () => {
    current.current = null;
  }, []);
  if (loading) return <p className="container section" role="status">Restaurando tu sesión…</p>;
  if (!user) return <section className="container section access-gate"><p className="eyebrow">PUBLICAR REQUERIMIENTO</p><h1>Tu próxima adquisición empieza aquí.</h1><p>Inicia sesión para publicar y recibir ofertas a la baja.</p><button className="button button-dark" onClick={() => openAuth("login")}>Iniciar sesión para publicar</button></section>;
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const values = Object.fromEntries(new FormData(event.currentTarget)), id = user.id;
    setBusy(true);
    setMessage("");
    try {
      const auctionId = await service.publish(values);
      if (current.current === id) navigate(`/subastas?auction=${encodeURIComponent(auctionId)}&mine=1`);
    } catch (error) {
      if (current.current === id) setMessage(marketplaceError(error));
    } finally {
      setBusy(false);
    }
  }
  function preview(event) {
    const form = event.currentTarget.form;
    if (!form.reportValidity()) return;
    const values = Object.fromEntries(new FormData(form));
    try {
      const date = /* @__PURE__ */ new Date(`${values.ends_at}:00-04:00`);
      if (!Number.isFinite(date.getTime())) throw new Error("INVALID_DEADLINE");
      const link = document.createElement("a");
      attachSpecifications(link, { ...values, id: "Borrador sin publicar", ends_at: date.toISOString() });
      link.click();
    } catch (error) {
      setMessage(marketplaceError(error));
    }
  }
  return <section className="container section"><div className="view-heading"><div><p className="eyebrow">NUEVA OPORTUNIDAD COMERCIAL</p><h1>Publicar requerimiento</h1><p>Define las condiciones. Los proveedores compiten por ofrecerte una mejor opción.</p></div><a href="#/subastas" className="text-link">Explorar subastas →</a></div><div className="create-grid"><form className="market-form portal-panel" onSubmit={submit} aria-busy={busy}><fieldset disabled={busy}>
    <label>Título del lote<input name="title" maxLength={160} placeholder="Lote de 50 escritorios metálicos y sillas ejecutivas" required /></label><label>Descripción y especificaciones<textarea name="description" rows={5} maxLength={5e3} required /></label><div className="market-form-row"><label>Categoría<select name="category" required><option value="">Selecciona una categoría</option>{categories.map((item) => <option key={item}>{item}</option>)}</select></label><label>Ciudad<input name="city" maxLength={100} required /></label></div><div className="market-form-row"><label>Presupuesto máximo (BOB)<input name="max_budget" type="number" min="0.01" step="0.01" max="999999999999.99" required /></label><label>Cierre (hora de Bolivia, UTC−4)<input name="ends_at" type="datetime-local" required /></label></div><label>WhatsApp del comprador (opcional)<input name="phone" type="tel" autoComplete="tel" placeholder="+591 71234567" maxLength={24} /></label><small>Al incluirlo, aceptas compartirlo con los usuarios identificados que consulten este requerimiento.</small><div className="form-actions"><button className="button button-dark" type="submit">{busy ? "Publicando\u2026" : "Publicar requerimiento"}</button><button className="button button-outline" type="button" onClick={preview}>Vista previa del PDF ↓</button></div></fieldset>{message && <p className="market-status" data-error="true" role="status">{message}</p>}</form><aside className="portal-panel create-guide"><span className="eyebrow">UNA BUENA COMPRA EMPIEZA POR UN BUEN REQUERIMIENTO</span><h2>Ayuda a los proveedores a cotizar mejor.</h2><p>Detalla cantidades, materiales, entrega y garantía. Un presupuesto y plazo claros facilitan propuestas comparables.</p><p>La ficha PDF se genera con la información de tu requerimiento.</p></aside></div></section>;
}
export {
  CreateView as default
};
