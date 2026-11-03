import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { hasSupabaseConfig } from "../js/supabaseClient.js";
import { listActiveAuctions, listMyAuctions, watchAuctions, getAuctionErrorMessage } from "../modules/auctions/auctionService.js";
import { createMarketplaceService, categories, marketplaceError } from "../modules/auctions/marketplaceService.js";
import { demoAuctions } from "../modules/auctions/demoAuctions.js";
import { countdown } from "../modules/auctions/specifications.js";
import SpecificationsLink from "../components/SpecificationsLink.jsx";
import AuctionDetail from "../components/AuctionDetail.jsx";
const service = createMarketplaceService(), demo = !hasSupabaseConfig();
const money = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function AuctionsView({ openAuth, navigate, query }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]), [mine, setMine] = useState(query.get("mine") === "1"), [search, setSearch] = useState(""), [category, setCategory] = useState(""), [message, setMessage] = useState(""), [loading, setLoading] = useState(true), [live, setLive] = useState(false), [selected, setSelected] = useState(null), [now, setNow] = useState(Date.now());
  const revision = useRef(0), requestedId = query.get("auction");
  useEffect(() => setMine(query.get("mine") === "1"), [query.toString()]);
  const reload = useCallback(async () => {
    const version = ++revision.current;
    setLoading(true);
    try {
      const data = demo ? mine ? [] : demoAuctions : mine ? await listMyAuctions() : await listActiveAuctions();
      if (version === revision.current) {
        setItems(data);
        setMessage("");
      }
    } catch (error) {
      if (version === revision.current) {
        setItems([]);
        setMessage(getAuctionErrorMessage(error));
      }
    } finally {
      if (version === revision.current) setLoading(false);
    }
  }, [mine, user?.id]);
  useEffect(() => {
    setItems([]);
    setSelected(null);
    void reload();
    let alive = true, stop = () => {
    };
    if (!demo) void watchAuctions(() => {
      if (alive) void reload();
    }, (status) => {
      if (alive) setLive(status === "SUBSCRIBED");
    }).then((cleanup) => {
      if (alive) stop = cleanup;
      else cleanup();
    }).catch(() => {
    });
    const poll = setInterval(() => {
      if (!document.hidden) void reload();
    }, 3e4), clock = setInterval(() => {
      if (!document.hidden) setNow(Date.now());
    }, 1e3);
    const visible = () => {
      if (!document.hidden) {
        setNow(Date.now());
        void reload();
      }
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      alive = false;
      revision.current++;
      stop();
      clearInterval(poll);
      clearInterval(clock);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [reload]);
  useEffect(() => {
    if (!requestedId) return;
    let active = true;
    if (demo) {
      setSelected(demoAuctions.find((item) => item.id === requestedId) || null);
      return;
    }
    void service.getAuction(requestedId).then((data) => {
      if (active) setSelected(data);
    }).catch((error) => {
      if (active) setMessage(marketplaceError(error));
    });
    return () => {
      active = false;
    };
  }, [requestedId, user?.id]);
  const filtered = items.filter((item) => (mine || new Date(item.ends_at).getTime() > now) && (!category || item.category === category) && `${item.title} ${item.city} ${item.description}`.toLocaleLowerCase("es").includes(search.toLocaleLowerCase("es")));
  return <section className="container section"><div className="view-heading"><div><p className="eyebrow">PORTAL DE OPORTUNIDADES</p><h1>Explorar subastas inversas</h1><p>Requerimientos corporativos. Presupuestos claros. Ofertas a la baja.</p></div><a className="button button-dark" href="#/publicar">Publicar requerimiento +</a></div>
    <div className="catalog-toolbar"><div className="search-box"><label className="sr-only" htmlFor="portal-search">Buscar requerimientos</label><input id="portal-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por requerimiento, descripción o ciudad" /></div><label className="category-label">Categoría<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">Todas las categorías</option>{categories.map((item) => <option key={item}>{item}</option>)}</select></label></div>
    <div className="catalog-tabs" role="group" aria-label="Tipo de catálogo"><button className="text-link" aria-pressed={!mine} onClick={() => navigate("/subastas")}>Subastas activas</button><button className="text-link" aria-pressed={mine} onClick={() => navigate("/subastas?mine=1")}>Mi actividad</button><span className="connection">{demo ? "Vista de demostraci\xF3n" : live ? "\u25CF Actualizaciones en vivo" : "Actualizaci\xF3n peri\xF3dica"}</span></div>
    {mine && !user && !demo ? <div className="access-gate portal-panel"><p>Inicia sesión para ver tus requerimientos y ofertas.</p><button className="button button-dark" onClick={() => openAuth("login")}>Iniciar sesión</button></div> : <><div className="catalog-meta"><p role="status">{message || `${filtered.length} requerimientos ${demo ? "de ejemplo" : "disponibles"} \xB7 BOB`}</p><button className="text-link" disabled={loading} onClick={reload}>Actualizar ↻</button></div><div className="auction-grid" aria-busy={loading}>{filtered.map((item) => <article className="auction-card" key={item.id}><div className="card-art services"><span className="card-category">{item.category}</span><span className="art-symbol" aria-hidden="true">↘</span>{demo && <span className="demo-tag">EJEMPLO ILUSTRATIVO</span>}</div><div className="card-body"><p className="card-location">◎ {item.city}, Bolivia</p><h3>{item.title}</h3><p className="card-description">{item.description}</p><span className="budget-label">Presupuesto Máximo Base</span><strong className="card-budget">{money.format(item.max_budget)} BOB</strong><SpecificationsLink auction={item} /><div className="card-bottom"><span className="deadline">{item.awarded_bid_id ? "\u2713 Adjudicada" : item.status !== "active" ? "Cerrada" : new Date(item.ends_at).getTime() <= now ? "Plazo finalizado" : countdown(item.ends_at, now)}</span><button className="text-link" onClick={() => setSelected(item)} aria-label={`Ver requerimiento: ${item.title}`}>Ver requerimiento ↗</button></div></div></article>)}</div>{!filtered.length && <p className="empty-state">{loading ? "Cargando requerimientos\u2026" : message ? "No se pudo consultar el cat\xE1logo." : mine ? "Todav\xEDa no tienes requerimientos ni ofertas." : "No hay subastas que coincidan con tu b\xFAsqueda."}</p>}</>}
    {selected && <AuctionDetail key={`${selected.id}-${user?.id || "public"}`} initial={selected} demo={demo} openAuth={openAuth} onUpdated={reload} onClose={() => {
    setSelected(null);
    if (requestedId) navigate(mine ? "/subastas?mine=1" : "/subastas");
  }} />}
  </section>;
}
export {
  AuctionsView as default
};
