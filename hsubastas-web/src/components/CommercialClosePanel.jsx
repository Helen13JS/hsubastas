import React,{useState} from 'react';
import {awardSummary,whatsappLink} from '../modules/auctions/marketplaceService.js';
import WhatsAppLink from './WhatsAppLink.jsx';

export default function CommercialClosePanel({auction,closure}){
  const [simulated,setSimulated]=useState(false);
  if(!auction.awarded_bid_id||!closure||closure.winning_bid_id!==auction.awarded_bid_id||!['buyer','winner'].includes(closure.viewer_role))return null;
  const money=new Intl.NumberFormat('es-BO',{style:'currency',currency:'BOB',minimumFractionDigits:2});
  const counterpart=closure.viewer_role==='buyer'?closure.provider_name:closure.buyer_name;
  let url=null;
  try{url=whatsappLink(closure.counterpart_phone,auction.title,awardSummary(auction,{id:closure.winning_bid_id,provider_name:closure.provider_name,offered_amount:closure.amount}));}catch{/* Contacto ausente o inválido. */}
  function simulate(event){event.preventDefault();setSimulated(true);}
  return <section className="commercial-close" aria-labelledby="commercial-close-title">
    <div className="close-heading"><span className="status-badge">✓ Subasta adjudicada</span><h3 id="commercial-close-title">Cierre comercial</h3><p>La oferta ganadora está registrada. Coordina los siguientes pasos con tu contraparte.</p></div>
    <div className="close-award"><div><span>Proveedor ganador</span><strong>{closure.provider_name}</strong></div><div><span>Importe adjudicado</span><strong>{money.format(closure.amount)}</strong></div></div>
    <div className="close-coordination"><div><h4>Coordinar entrega</h4><p>{counterpart}</p>{url?<a href={url} target="_blank" rel="noopener noreferrer" className="text-link">Iniciar conversación / Coordinar entrega ↗</a>:<small>La contraparte no tiene un WhatsApp registrado.</small>}</div>{url&&<WhatsAppLink href={url} label={`Coordinar entrega con ${counterpart} por WhatsApp`}/>}</div>
    <section className="paypal-demo" aria-labelledby="paypal-demo-title"><div className="paypal-demo-heading"><strong id="paypal-demo-title" className="paypal-wordmark">PayPal</strong><span>Simulación</span></div><p>Pago de comisiones o servicios de HSubastas</p><form className="market-form" onSubmit={simulate}><div className="market-form-row"><label>Concepto<select defaultValue="commission" onChange={()=>setSimulated(false)}><option value="commission">Comisión de plataforma</option><option value="service">Servicio de plataforma</option></select></label><label>Importe de ejemplo (USD)<input type="number" min="0.01" step="0.01" max="10000" defaultValue="10.00" required onChange={()=>setSimulated(false)}/></label></div><button type="submit" className="paypal-demo-button">Simular pago con PayPal</button></form><p className="paypal-security"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>SSL/TLS · Referencia visual de cifrado para la demostración</p><small>Demostración educativa. El importe no representa una tarifa real; no se solicitan credenciales ni datos bancarios y no se realizan cobros.</small>{simulated&&<p className="market-status" role="status">Simulación completada. No se realizó ningún cobro ni se registró un pago real.</p>}</section>
  </section>;
}
