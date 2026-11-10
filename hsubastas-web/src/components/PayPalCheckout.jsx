import React, { useCallback, useEffect, useRef, useState } from 'react';
import { PayPalScriptProvider, PayPalButtons, usePayPalScriptReducer } from '@paypal/react-paypal-js';
import { createPaymentService, paymentError } from '../modules/payments/paymentService.js';
import PaymentMethods from './PaymentMethods.jsx';
const service = createPaymentService();
const clientId = (import.meta.env?.VITE_PAYPAL_CLIENT_ID || '').trim();
function OfficialButtons({ quote, auctionId, update, report }) {
  const [{ isPending, isRejected }] = usePayPalScriptReducer();
  return <>
    {isPending && <p role="status">Cargando conexión segura con PayPal…</p>}
    {isRejected && <p role="alert">No se pudo cargar PayPal. Revisa la conexión y vuelve a abrir este detalle.</p>}
    <PayPalButtons style={{ color: 'blue', shape: 'rect', layout: 'vertical', label: 'pay' }}
      forceReRender={[auctionId, quote.amount, quote.currency]}
      createOrder={async () => {
        try {
          const result = await service.request('create', auctionId);
          update(result);
          if (!result.orderId || result.status === 'COMPLETED') throw new Error('PAYMENT_UNCONFIRMED');
          return result.orderId;
        } catch (error) { report(paymentError(error)); throw error; }
      }}
      onApprove={async ({ orderID }, actions) => {
        try { update(await service.request('capture', auctionId, orderID)); }
        catch (error) {
          if (error.message === 'INSTRUMENT_DECLINED') return actions.restart();
          report(paymentError(error)); throw error;
        }
      }}
      onCancel={() => report('Cerraste PayPal. Puedes actualizar el estado del pago antes de continuar.')}
      onError={() => report('PayPal no pudo completar el proceso. Actualiza el estado antes de volver a pagar.')} />
  </>;
}
export default function PayPalCheckout({ auctionId, disabled = false, onUpdated }) {
  const [quote, setQuote] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const active = useRef(true), revision = useRef(0);
  const notify = useRef(onUpdated); notify.current = onUpdated;
  const load = useCallback(async () => {
    const version = ++revision.current;
    setBusy(true); setError('');
    try {
      const result = await service.request('quote', auctionId);
      if (active.current && version === revision.current) { setQuote(result); notify.current?.(); }
    } catch (failure) { if (active.current && version === revision.current) setError(paymentError(failure)); }
    finally { if (active.current && version === revision.current) setBusy(false); }
  }, [auctionId]);
  useEffect(() => {
    active.current = true; setQuote(null); void load();
    const timer = setInterval(() => { if (!document.hidden) void load(); }, 30000);
    return () => { active.current = false; revision.current++; clearInterval(timer); };
  }, [load]);
  const update = result => { if (active.current) { revision.current++; setQuote(result); setError(''); setBusy(false); notify.current?.(); } };
  const report = message => { if (active.current) setError(message); };
  const configured = clientId && quote?.clientId === clientId;
  const completed = quote?.status === 'COMPLETED';
  const canCheckout = !disabled && quote?.canPay && ['UNPAID','CREATED'].includes(quote.status) && quote.orderStatus !== 'APPROVED';
  return <section className="paypal-checkout rounded-2xl border p-5" aria-labelledby="paypal-title">
    <div className="flex flex-wrap items-center justify-between gap-2"><h4 id="paypal-title" className="paypal-wordmark">PayPal</h4>{quote && <span className="status-badge">{quote.environment === 'live' ? 'Pago real' : 'Sandbox · cuenta de prueba'}</span>}</div>
    <p>Pago del servicio de plataforma HSubastas. El pago al proveedor se coordina por separado.</p>
    {quote && <p className="text-lg font-semibold">Tarifa de servicio: {quote.amount} {quote.currency}</p>}
    {quote?.commissionPercent === 3 && <p>Comisión del 3%: {Number(quote.commissionBOB).toFixed(2)} BOB sobre {Number(quote.awardAmountBOB).toFixed(2)} BOB adjudicados. Cambio comercial: {quote.exchangeRate} BOB por USD.</p>}
    {quote?.orderId && quote.commissionPercent == null && <small>Operación anterior: se conserva su importe reservado.</small>}
    <PaymentMethods />
    {completed ? <div className="payment-confirmed" role="status"><strong>Pago confirmado por PayPal</strong><p>Referencia: {quote.captureId}</p>{quote.environment === 'sandbox' && <small>Transacción Sandbox: no representa un cobro Live.</small>}</div> : <>
      {quote?.status === 'PENDING' && <p role="status">PayPal está revisando el pago. Aún no figura como completado.</p>}
      {['REFUNDED','REVERSED','DENIED'].includes(quote?.status) && <p role="status">Estado de la transacción: {quote.status}. Contacta con soporte.</p>}
      {quote && !quote.canPay && <p>El comprador gestiona el pago del servicio. Aquí puedes consultar su estado.</p>}
      {canCheckout && configured && <PayPalScriptProvider options={{ clientId, currency: quote.currency, intent: 'capture', components: 'buttons' }}><OfficialButtons quote={quote} auctionId={auctionId} update={update} report={report}/></PayPalScriptProvider>}
      {!disabled && quote?.canPay && quote.orderStatus === 'APPROVED' && quote.status === 'CREATED' && <button type="button" className="paypal-pay-button" disabled={busy} onClick={async () => {
        setBusy(true); try { update(await service.request('capture', auctionId, quote.orderId)); } catch (failure) { report(paymentError(failure)); } finally { if (active.current) setBusy(false); }
      }}>Confirmar pago aprobado en PayPal</button>}
      {canCheckout && !configured && <p role="status">{clientId ? paymentError(new Error('CLIENT_ID_MISMATCH')) : 'PayPal pendiente de habilitación.'}</p>}
    </>}
    {error && <p className="market-status error" role="alert">{error}</p>}
    <button type="button" className="text-button" disabled={busy} onClick={load}>{busy ? 'Consultando…' : 'Actualizar estado del pago'}</button>
    <p className="paypal-security">Conexión HTTPS/TLS con PayPal. Tus datos de pago se introducen en PayPal, no en HSubastas.</p>
  </section>;
}
