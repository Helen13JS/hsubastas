import React, { useState } from 'react';
import { awardSummary, whatsappLink } from '../modules/auctions/marketplaceService.js';
import SocialIcon from './SocialIcon.jsx';
import CommercialPayments from './CommercialPayments.jsx';
import ChatPanel from './ChatPanel.jsx';

export default function CommercialClosePanel({ auction, closure }) {
  const [chat, setChat] = useState(false);
  if (auction.status !== 'closed' || !auction.awarded_bid_id || !closure || closure.winning_bid_id !== auction.awarded_bid_id ||
    !['buyer','winner'].includes(closure.viewer_role) || !closure.provider_name?.trim() || !Number.isFinite(Number(closure.amount)) || Number(closure.amount) <= 0) return null;
  const money = new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB', minimumFractionDigits: 2 });
  const summary = awardSummary(auction, { id: closure.winning_bid_id, provider_name: closure.provider_name, offered_amount: closure.amount });
  const url = whatsappLink('59168647272', auction.title, `Hola HSubastas, quisiera coordinar el cierre comercial y la entrega de esta adjudicación.\n\n${summary}`);
  return <section className="commercial-close" aria-labelledby="commercial-close-title">
    <div className="close-heading"><span className="status-badge">✓ Subasta adjudicada</span><h3 id="commercial-close-title">Cierre Comercial</h3><p>La oferta ganadora está registrada. Coordina los siguientes pasos con tu contraparte o el equipo de HSubastas.</p></div>
    <div className="close-award"><div><span>Proveedor ganador</span><strong>{closure.provider_name}</strong></div><div><span>Importe adjudicado</span><strong>{money.format(closure.amount)}</strong></div></div>
    <div className="close-coordination close-coordination-corporate"><div><h4>Coordinación comercial directa</h4><p>HSubastas · +591 68647272</p></div><a href={url} target="_blank" rel="noopener noreferrer" className="close-whatsapp-cta"><SocialIcon channel="whatsapp"/><span>Iniciar conversación / Coordinar entrega</span></a></div>
    <CommercialPayments key={auction.id} auctionId={auction.id}/>
    <div className="commercial-negotiation"><button type="button" className="button button-dark" aria-expanded={chat} aria-controls="negotiation-chat" onClick={() => setChat(value => !value)}>{chat ? 'Ocultar conversación privada' : 'Conversar con comprador / proveedor ganador'}</button>
      {chat && <div id="negotiation-chat" className="mt-4"><ChatPanel key={auction.id} auctionId={auction.id} title="Negociación y coordinación de entrega"/></div>}
    </div>
  </section>;
}
