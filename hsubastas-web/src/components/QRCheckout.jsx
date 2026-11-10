import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createQRService, qrError } from '../modules/payments/qrService.js';
const service = createQRService();
export const qrStatusLabel = status => ({ AWAITING_PAYMENT: 'Pendiente de transferencia', UNDER_REVIEW: 'Comprobante en revisión', COMPLETED: 'Pago QR confirmado', REJECTED: 'Comprobante rechazado' })[status] || 'Sin operación';
export default function QRCheckout({ auctionId, onUpdated = () => {}, disabled = false }) {
  const [checkout, setCheckout] = useState(null), [image, setImage] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const active = useRef(true), revision = useRef(0);
  const load = useCallback(async () => {
    const version = ++revision.current;
    try {
      const result = await service.checkout(auctionId);
      const url = result.payment?.image_path ? await service.asset(result.payment.image_path) : '';
      if (active.current && revision.current === version) { setCheckout(result); setImage(url); setError(''); }
    } catch (failure) { if (active.current && revision.current === version) setError(qrError(failure)); }
  }, [auctionId]);
  useEffect(() => {
    active.current = true; setCheckout(null); setImage(''); void load();
    const timer = setInterval(() => { if (!document.hidden) void load(); }, 15000);
    return () => { active.current = false; revision.current++; clearInterval(timer); };
  }, [load]);
  async function act(operation) {
    if (busy) return; setBusy(true); setError(''); revision.current++;
    try { await operation(); if (active.current) { await load(); onUpdated(); } }
    catch (failure) { if (active.current) setError(qrError(failure)); }
    finally { if (active.current) setBusy(false); }
  }
  const payment = checkout?.payment, payable = checkout?.canPay && !disabled;
  const quote = payment || checkout?.quote;
  return <section className="qr-checkout portal-panel mt-5" aria-labelledby="qr-checkout-title">
    <div className="flex flex-wrap items-center justify-between gap-2"><h4 id="qr-checkout-title">Pago QR nacional</h4><span className="status-badge">BOB · verificación bancaria</span></div>
    <p>Paga el servicio de HSubastas desde tu aplicación bancaria. El pago al proveedor se coordina por separado.</p>
    {!checkout && !error && <p role="status">Consultando disponibilidad…</p>}
    {checkout && !checkout.configured && !payment && <p>QR pendiente de habilitación por administración.</p>}
    {quote && <div className="qr-payment-facts"><span>Beneficiario: <strong>{quote.recipient}</strong></span><span>Tarifa del servicio: <strong>{Number(quote.amount).toFixed(2)} BOB</strong></span></div>}
    {quote?.commission_percent === 3 && <p>Comisión del 3% sobre {Number(quote.award_amount_bob).toFixed(2)} BOB adjudicados, calculada por HSubastas.</p>}
    {payment && payment.commission_percent == null && <small>Operación anterior: se conserva su importe reservado.</small>}
    {payment && <p role="status" className={payment.status === 'COMPLETED' ? 'payment-confirmed' : 'market-status'}>{qrStatusLabel(payment.status)}{payment.verification_reference && <small className="block">Referencia verificada: {payment.verification_reference}</small>}</p>}
    {payment?.status === 'COMPLETED' && <p>El abono fue verificado y registrado en HSubastas.</p>}
    {payment?.status === 'UNDER_REVIEW' && <p>Tu comprobante fue enviado. Administración contrastará el abono antes de confirmar el pago. No pagues nuevamente.</p>}
    {payment?.status === 'REJECTED' && <p>Motivo: {payment.review_note}. Contacta con soporte para revisar el abono antes de intentar nuevamente.</p>}
    {image && payable && payment?.status === 'AWAITING_PAYMENT' && <><img className="bank-qr-image" src={image} alt={`QR bancario de ${payment.recipient} para pagar ${Number(payment.amount).toFixed(2)} BOB`} referrerPolicy="no-referrer"/><p>Verifica en tu banco el beneficiario y el importe exacto antes de confirmar la transferencia. Incluye la referencia HSubastas {payment.id} en el concepto si tu banco lo permite.</p></>}
    {payable && checkout?.configured && (!payment || payment.status === 'REJECTED') && <button type="button" className="button button-dark" disabled={busy} onClick={() => act(() => service.open(auctionId))}>{payment ? 'Reabrir operación QR' : 'Iniciar pago por QR'}</button>}
    {payable && payment?.status === 'AWAITING_PAYMENT' && <form className="market-form" onSubmit={event => {
      event.preventDefault(); const form = event.currentTarget, data = new FormData(form);
      void act(() => service.report(payment.id, data.get('reference'), data.get('receipt')));
    }}><label>Referencia de tu transferencia<input name="reference" minLength={6} maxLength={100} required disabled={busy}/></label><label>Comprobante bancario (hasta 5 MB)<input name="receipt" type="file" accept="image/png,image/jpeg,image/webp,application/pdf" required disabled={busy}/></label><button className="button button-dark" disabled={busy}>{busy ? 'Enviando…' : 'Enviar comprobante a revisión'}</button><small>Enviar el comprobante no confirma automáticamente el pago.</small></form>}
    {checkout && !checkout.canPay && <p>El comprador realiza el pago. Puedes consultar aquí su estado.</p>}
    {disabled && payment?.status !== 'COMPLETED' && <p>Consulta el resumen transaccional antes de iniciar o reportar otro pago.</p>}
    {error && <p className="market-status error" role="alert">{error}</p>}
    <button type="button" className="text-link mt-4" disabled={busy} onClick={() => { void act(async () => {}); }}>Actualizar estado QR</button>
  </section>;
}
