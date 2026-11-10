import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createQRService, qrError } from '../modules/payments/qrService.js';
import PayPalCheckout from './PayPalCheckout.jsx';
import QRCheckout from './QRCheckout.jsx';
const service = createQRService();
export default function CommercialPayments({ auctionId }) {
  const [summary, setSummary] = useState(null), [error, setError] = useState(''), [method, setMethod] = useState('paypal');
  const active = useRef(true), revision = useRef(0);
  const refresh = useCallback(async () => {
    const version = ++revision.current;
    try { const value = await service.status(auctionId); if (active.current && version === revision.current) { setSummary(value); setError(''); } }
    catch (failure) { if (active.current && version === revision.current) { setSummary(null); setError(qrError(failure)); } }
  }, [auctionId]);
  useEffect(() => {
    active.current = true; void refresh();
    const timer = setInterval(() => { if (!document.hidden) void refresh(); }, 15000);
    return () => { active.current = false; revision.current++; clearInterval(timer); };
  }, [refresh]);
  useEffect(() => { if (summary?.lockedMethod) setMethod(summary.lockedMethod); }, [summary?.lockedMethod]);
  const paid = summary?.status === 'PAID';
  return <section className="commercial-payments mt-6" aria-label="Pagos del servicio de plataforma">
    <div className="transaction-summary rounded-xl border p-4" role="status"><strong>{paid ? 'Servicio de plataforma pagado' : summary?.status === 'PENDING' ? 'Operación de pago pendiente' : summary ? 'Servicio pendiente de pago' : 'Consultando estado transaccional…'}</strong>
      <p>HSubastas cobra al comprador el 3% del importe adjudicado. El pago al proveedor se coordina por separado.</p>
      {summary?.sandboxStatus === 'COMPLETED' && <small>Hay una prueba PayPal Sandbox confirmada; no acredita un pago real.</small>}
      {summary?.needsReview && <p>Se detectaron pagos por ambos métodos. Contacta con administración para conciliarlos.</p>}
    </div>
    {error && <p role="alert" className="market-status error">{error} <button type="button" className="text-link" onClick={refresh}>Reintentar consulta</button></p>}
    <div className="payment-method-selector flex flex-wrap gap-3 mt-4" role="group" aria-label="Método de pago">
      <button type="button" className={`button ${method === 'paypal' ? 'button-dark' : 'button-outline'}`} aria-pressed={method === 'paypal'} disabled={summary?.lockedMethod === 'qr'} onClick={() => setMethod('paypal')}>PayPal oficial</button>
      <button type="button" className={`button ${method === 'qr' ? 'button-dark' : 'button-outline'}`} aria-pressed={method === 'qr'} disabled={summary?.lockedMethod === 'paypal'} onClick={() => setMethod('qr')}>QR nacional · BOB</button>
    </div>
    {summary?.lockedMethod && !paid && <p className="market-help">Continúa con el método iniciado. No realices otro pago mientras se verifica esta operación.</p>}
    {method === 'paypal' ? <PayPalCheckout key={auctionId} auctionId={auctionId} disabled={!summary || paid || summary.lockedMethod === 'qr'} onUpdated={refresh}/> : <QRCheckout key={auctionId} auctionId={auctionId} disabled={!summary || paid || summary.lockedMethod === 'paypal'} onUpdated={refresh}/>}
  </section>;
}
