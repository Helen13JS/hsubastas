import React,{useState} from 'react';
import {awardSummary,whatsappLink} from '../modules/auctions/marketplaceService.js';
import SocialIcon from './SocialIcon.jsx';
import PaymentMethods from './PaymentMethods.jsx';

export default function CommercialClosePanel({auction,closure}){
  const [simulated,setSimulated]=useState(false);
  if(auction.status!=='closed'||!auction.awarded_bid_id||!closure||closure.winning_bid_id!==auction.awarded_bid_id||!['buyer','winner'].includes(closure.viewer_role)||!closure.provider_name?.trim()||!Number.isFinite(Number(closure.amount))||Number(closure.amount)<=0)return null;
  const money=new Intl.NumberFormat('es-BO',{style:'currency',currency:'BOB',minimumFractionDigits:2});
  const summary=awardSummary(auction,{id:closure.winning_bid_id,provider_name:closure.provider_name,offered_amount:closure.amount});
  const url=whatsappLink('59168647272',auction.title,`Hola HSubastas, quisiera coordinar el cierre comercial y la entrega de esta adjudicación.\n\n${summary}`);
  function simulate(event){event.preventDefault();setSimulated(true);}
  return <section className="commercial-close" aria-labelledby="commercial-close-title">
    <div className="close-heading"><span className="status-badge">✓ Subasta adjudicada</span><h3 id="commercial-close-title">Cierre Comercial</h3><p>La oferta ganadora está registrada. Coordina los siguientes pasos con el canal corporativo de HSubastas.</p></div>
    <div className="close-award"><div><span>Proveedor ganador</span><strong>{closure.provider_name}</strong></div><div><span>Importe adjudicado</span><strong>{money.format(closure.amount)}</strong></div></div>
    <div className="close-coordination close-coordination-corporate"><div><h4>Coordinación comercial directa</h4><p>HSubastas · +591 68647272</p></div><a href={url} target="_blank" rel="noopener noreferrer" className="close-whatsapp-cta"><SocialIcon channel="whatsapp"/><span>Iniciar conversación / Coordinar entrega</span></a></div>
    <section className="paypal-demo" aria-labelledby="paypal-demo-title"><div className="paypal-demo-heading"><strong id="paypal-demo-title" className="paypal-wordmark">PayPal</strong></div><p>Pago de comisiones o servicios de HSubastas</p><PaymentMethods/><form className="market-form" onSubmit={simulate}><div className="market-form-row"><label>Concepto<select defaultValue="commission" onChange={()=>setSimulated(false)}><option value="commission">Comisión de plataforma</option><option value="service">Servicio de plataforma</option></select></label><label>Importe de ejemplo (USD)<input type="number" min="0.01" step="0.01" max="10000" defaultValue="10.00" required onChange={()=>setSimulated(false)}/></label></div><button type="submit" className="paypal-demo-button">Simular pago con PayPal</button></form><p className="paypal-security"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>Referencia de seguridad: cifrado SSL 256-bit</p><small>La leyenda de cifrado es ilustrativa y no certifica esta conexión. El importe no representa una tarifa real; no se solicitan credenciales ni datos bancarios y no se realizan cobros.</small>{simulated&&<p className="market-status" role="status">Simulación completada. No se realizó ningún cobro ni se registró un pago real.</p>}</section>
  </section>;
}
