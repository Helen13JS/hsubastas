import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { createMarketplaceService, marketplaceError, whatsappLink, awardSummary } from "../modules/auctions/marketplaceService.js";
import { createBidService } from "../modules/bidding/bidService.js";
import { awardAndContact } from "../modules/bidding/awardFlow.js";
import Dialog from "./Dialog.jsx";
import SpecificationsLink from "./SpecificationsLink.jsx";
import WhatsAppLink from './WhatsAppLink.jsx';
import CommercialClosePanel from './CommercialClosePanel.jsx';
const service = createMarketplaceService(), bids = createBidService();
const money = new Intl.NumberFormat("es-BO", { style: "currency", currency: "BOB", minimumFractionDigits: 2 });
const date = new Intl.DateTimeFormat("es-BO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/La_Paz" });
function contact(phone, title, summary) {
  try {
    return whatsappLink(phone, title, summary);
  } catch {
    return null;
  }
}
function OfferHistory({awarded,count,children}){
  return awarded?<details className="bid-history"><summary>Ver historial de ofertas ({count})</summary>{children}</details>:<>{children}</>;
}
function AuctionDetail({ initial, demo = false, onClose, onUpdated, openAuth }) {
  const { user } = useAuth();
  const [auction, setAuction] = useState(initial), [offers, setOffers] = useState([]), [buyerPhone, setBuyerPhone] = useState(null), [verified, setVerified] = useState(false), [offersLoaded, setOffersLoaded] = useState(false);
  const [message, setMessage] = useState(""), [failed, setFailed] = useState(false), [busy, setBusy] = useState(false), [pending, setPending] = useState(null);
  const [closure,setClosure]=useState(null),[closureError,setClosureError]=useState('');
  const mounted = useRef(true), revision = useRef(0), identity = useRef(user?.id);
  identity.current = user?.id;
  const load = useCallback(async () => {
    if (demo) return;
    const version = ++revision.current, id = user?.id;
    const valid = () => mounted.current && version === revision.current && identity.current === id;
    try {
      const fresh = await service.getAuction(initial.id);
      if (!valid()) return;
      setAuction(fresh);
      setVerified(true);
      if (!id) {
        setOffers([]);
        setBuyerPhone(null);
        setOffersLoaded(false);
        setClosure(null);setClosureError('');
        return;
      }
      const [list, phone,close] = await Promise.allSettled([bids.list(initial.id), service.getContact(initial.id),fresh.awarded_bid_id?service.getClosure(initial.id):Promise.resolve(null)]);
      if (!valid()) return;
      if (list.status === "fulfilled") {
        setOffers(list.value);
        setOffersLoaded(true);
      } else {
        setOffersLoaded(false);
        setFailed(true);
        setMessage(marketplaceError(list.reason));
      }
      setBuyerPhone(phone.status === "fulfilled" ? phone.value : null);
      setClosure(close.status==='fulfilled'?close.value:null);
      setClosureError(close.status==='rejected'&&close.reason?.message!=='CLOSE_ACCESS_DENIED'?'No se pudo consultar el cierre comercial. Comprueba que commercial-close.sql esté aplicado y vuelve a intentar.':'');
    } catch (error) {
      if (valid()) {
        setVerified(false);
        setOffersLoaded(false);
        setOffers([]);
        setBuyerPhone(null);
        setClosure(null);
        setFailed(true);
        setMessage(marketplaceError(error));
      }
    }
  }, [initial.id, user?.id, demo]);
  useEffect(() => {
    mounted.current = true;
    setOffers([]);
    setBuyerPhone(null);
    setClosure(null);setClosureError('');
    setOffersLoaded(false);
    setVerified(false);
    setPending(null);
    setMessage("");
    void load();
    let stop = () => {
    }, timer;
    let active = true;
    if (user && !demo) void bids.watch(initial.id, () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (active) void load();
      }, 150);
    }).then((cleanup) => {
      if (active) stop = cleanup;
      else cleanup();
    }).catch(() => {
    });
    const interval = setInterval(() => {
      if (!document.hidden) void load();
    }, 15e3);
    const visible = () => {
      if (!document.hidden) void load();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      active = false;
      mounted.current = false;
      revision.current++;
      stop();
      clearTimeout(timer);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [load]);
  const owner = Boolean(user && user.id === auction.buyer_id), closed = auction.status !== "active" || new Date(auction.ends_at) <= /* @__PURE__ */ new Date();
  const best = offers[0]?.offered_amount ?? auction.max_budget;
  const buyerUrl = user && !owner && verified ? contact(buyerPhone,auction.title) : null;
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget, id = user?.id;
    setBusy(true);
    setMessage("");
    try {
      await bids.submit(auction.id, new FormData(form).get("amount"));
      if (!mounted.current || identity.current !== id) return;
      form.reset();
      await load();
      setFailed(false);
      setMessage("Tu oferta se registr\xF3 correctamente.");
    } catch (error) {
      if (mounted.current && identity.current === id) {
        await load();
        setFailed(true);
        setMessage(marketplaceError(error));
      }
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  async function award(bid) {
    if (busy) return;
    const id = user?.id;
    setBusy(true);
    setMessage("");
    try {
      const response = await awardAndContact({ service: bids, auction, bid, openWindow: (...args) => window.open(...args), isCurrent: () => mounted.current && identity.current === id });
      if (response.stale) return;
      setPending(null);
      await load();
      setFailed(false);
      setMessage(`Adjudicaci\xF3n registrada. ${response.opened ? "Se abri\xF3 WhatsApp del proveedor." : "Puedes usar el enlace de WhatsApp de la oferta si tiene un n\xFAmero registrado."}`);
      onUpdated?.();
    } catch (error) {
      if (mounted.current && identity.current === id) {
        await load();
        setFailed(true);
        setMessage(marketplaceError(error));
      }
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  return <Dialog title={auction.title} onClose={onClose} className="market-detail" titleId="auction-detail-title">
    <p className="market-help">{auction.description}</p><dl className="detail-facts"><dt>Presupuesto máximo</dt><dd>{money.format(auction.max_budget)}</dd><dt>Ubicación</dt><dd>{auction.city}, Bolivia</dd><dt>Cierre (Bolivia)</dt><dd>{date.format(new Date(auction.ends_at))}</dd><dt>Estado</dt><dd>{auction.awarded_bid_id ? "Adjudicada" : closed ? "Plazo finalizado / cerrada" : "Activa"}</dd></dl><SpecificationsLink auction={auction} />
    {user&&verified&&auction.awarded_bid_id&&<><CommercialClosePanel key={auction.awarded_bid_id} auction={auction} closure={closure}/>{closureError&&<p className="market-status" data-error="true" role="status">{closureError}</p>}</>}
    <OfferHistory awarded={Boolean(auction.awarded_bid_id)} count={offers.length}><section className="bid-section"><div className="bid-section-heading"><h3>Ofertas a la baja</h3>{user&&!demo&&<span className="offers-count">{offers.length} {offers.length===1?'oferta':'ofertas'}</span>}</div>{demo ? <p className="notice">Ejemplo ilustrativo. Las ofertas requieren una subasta real.</p> : !user ? <><p>Inicia sesión para ver ofertas y contactos.</p><button className="button button-dark" onClick={() => {
    onClose();
    openAuth("login");
  }}>Iniciar sesión</button></> : <>
      <p className="market-help">{auction.awarded_bid_id ? "Oferta ganadora registrada. Las pujas est\xE1n cerradas." : owner ? "Compara las ofertas. Puedes adjudicar la propuesta que mejor responda a tus necesidades." : closed ? "El requerimiento no admite m\xE1s ofertas." : `Tu oferta debe mejorar ${money.format(best)}.`}</p>
      <ol className="bid-list">{offers.map((bid, index) => {
    const winner = auction.awarded_bid_id === bid.id, url = owner ? contact(bid.whatsapp_phone, auction.title, winner ? awardSummary(auction, bid) : null) : null;
    return <li key={bid.id} className={winner ? "winning-offer" : ""}>
      <div className="offer-summary">
        <div className="offer-identity"><span className="offer-badge">{winner?'✓ Oferta adjudicada':index===0?'Mejor precio':`Oferta ${index+1}`}</span><strong className="offer-provider">{bid.provider_name||'Proveedor'}</strong><time dateTime={bid.created_at}>{date.format(new Date(bid.created_at))}</time></div>
        <div className="offer-price-contact"><strong className="offer-price">{money.format(bid.offered_amount)}</strong>{url&&<WhatsAppLink href={url} label={`Contactar a ${bid.provider_name||'este proveedor'} por WhatsApp`}/>}</div>
      </div>
      {owner&&!url&&<small className="offer-no-contact">Sin WhatsApp registrado.</small>}
      {owner && verified && !auction.awarded_bid_id && auction.status === 'active' && <div className="offer-actions">
        {pending===bid.id&&!busy&&<p className="award-confirmation">Confirmar {money.format(bid.offered_amount)} cerrará las pujas.</p>}
        <button disabled={busy} className="button button-dark" onClick={()=>pending===bid.id?award(bid):setPending(bid.id)}>{busy&&pending===bid.id?'Adjudicando…':pending===bid.id?'Confirmar adjudicación':'Adjudicar esta oferta'}</button>
        {pending===bid.id&&!busy&&<button className="text-link" onClick={()=>setPending(null)}>Cancelar</button>}
      </div>}
    </li>;
  })}{offersLoaded && !offers.length && <li>Todavía no hay ofertas.</li>}</ol>
      {verified && offersLoaded && !owner && !closed && <form className="market-form bid-entry" onSubmit={submit}><h4>Presenta tu oferta</h4><div className="bid-entry-row"><label>Importe en bolivianos<input name="amount" type="number" placeholder="0.00" min="0.01" max={Math.max(0, Number(best) - 0.01).toFixed(2)} step="0.01" required disabled={busy} /></label><button className="button button-dark" disabled={busy || Number(best) <= 0.01}>{busy?'Enviando…':'Enviar oferta ↘'}</button></div><small>Se usará el WhatsApp que hayas guardado en Mi cuenta.</small></form>}
    </>}</section></OfferHistory>{message && <p className="market-status" data-error={failed} role="status">{message}</p>}
    {buyerUrl&&!closure&&<div className="detail-contact-bar"><div><strong>¿Tienes alguna consulta?</strong><p>Contacta directamente al comprador.</p></div><WhatsAppLink href={buyerUrl} label="Contactar al comprador por WhatsApp"/></div>}
  </Dialog>;
}
export {
  AuctionDetail as default
};
