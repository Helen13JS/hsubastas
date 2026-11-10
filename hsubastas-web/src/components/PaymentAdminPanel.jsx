import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { createQRService, qrError } from '../modules/payments/qrService.js';
const service = createQRService();
function ReceiptLink({ path }) {
  const [url, setURL] = useState(''), [error, setError] = useState('');
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  return <div><button type="button" className="text-link" onClick={async () => {
    try { const link = await service.asset(path, true); if (alive.current) { setURL(link); setError(''); } }
    catch (failure) { if (alive.current) setError(qrError(failure)); }
  }}>Preparar enlace de comprobante</button>{url && <p><a className="text-link" href={url} target="_blank" rel="noopener noreferrer">Descargar comprobante (enlace válido 5 minutos)</a></p>}{error && <p role="alert">{error}</p>}</div>;
}
function ReviewPayment({ payment, onUpdated }) {
  const [verified, setVerified] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  return <article className="qr-review-card rounded-xl border p-4"><h3>Subasta {payment.auction_id}</h3>
    <p><strong>{Number(payment.amount).toFixed(2)} BOB</strong> · {payment.recipient}</p><p>Referencia reportada por el comprador: {payment.payer_reference}</p><ReceiptLink path={payment.receipt_path}/>
    <form className="market-form" onSubmit={async event => {
      event.preventDefault(); if (busy) return;
      const approve = event.nativeEvent.submitter?.value === 'approve';
      if (approve && !verified) return;
      const data = new FormData(event.currentTarget); setBusy(true); setError('');
      try { await service.review(payment.id, approve, String(data.get('bankReference') || ''), String(data.get('note') || '')); if (active.current) await onUpdated(); }
      catch (failure) { if (active.current) setError(qrError(failure)); }
      finally { if (active.current) setBusy(false); }
    }}>
      <label>Referencia del abono verificado en el banco<input name="bankReference" maxLength={100} disabled={busy} placeholder="Referencia bancaria real"/></label>
      <label>Detalle de verificación o motivo de rechazo<textarea name="note" minLength={10} maxLength={1000} required disabled={busy} rows={2}/></label>
      <label className="qr-confirm-check"><input type="checkbox" checked={verified} onChange={event => setVerified(event.target.checked)} disabled={busy}/>He contrastado beneficiario, importe, referencia y abono efectivo en el banco.</label>
      <div className="flex flex-wrap gap-3"><button type="submit" value="approve" className="button button-dark" disabled={busy || !verified}>Confirmar abono y registrar pago</button><button type="submit" value="reject" className="button button-outline" disabled={busy}>Rechazar comprobante</button></div>
    </form>{error && <p role="alert" className="market-status error">{error}</p>}
  </article>;
}
export default function PaymentAdminPanel() {
  const { user } = useAuth();
  const [admin, setAdmin] = useState(false), [data, setData] = useState(null), [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  const active = useRef(true), revision = useRef(0);
  const load = useCallback(async () => {
    const version = ++revision.current;
    try { const value = await service.admin(); if (active.current && revision.current === version) { setData(value); setError(''); } }
    catch (failure) { if (active.current && revision.current === version) setError(qrError(failure)); }
  }, []);
  useEffect(() => {
    active.current = true; let current = true; setAdmin(false); setData(null);
    if (user) void service.isAdmin().then(value => { if (current) { setAdmin(value === true); if (value === true) void load(); } }).catch(() => {});
    return () => { current = false; active.current = false; revision.current++; };
  }, [user?.id, load]);
  useEffect(() => { if (!admin) return; const timer = setInterval(() => { if (!document.hidden) void load(); }, 15000); return () => clearInterval(timer); }, [admin, load]);
  if (!admin) return null;
  return <section className="portal-panel mt-6" aria-labelledby="qr-admin-title"><h2 id="qr-admin-title">Administración de pagos QR</h2><p>Usa el QR original emitido por el banco para la cuenta de HSubastas. Confirma pagos solo después de contrastar el abono.</p>
    <details><summary>Configurar beneficiario y QR bancario</summary><p>Comisión automática del 3% del importe adjudicado. Usa un QR sin importe fijo que permita pagar la comisión exacta en BOB.</p>{data && <form key={data.settings?.updated_at || 'new'} className="market-form mt-4" onSubmit={async event => {
      event.preventDefault(); if (busy) return;
      const fields = new FormData(event.currentTarget); setBusy(true); setError(''); setMessage('');
      try {
        await service.configure({ recipient: String(fields.get('recipient')), file: fields.get('code'), imagePath: data.settings?.image_path, enabled: fields.get('enabled') === 'on' });
        if (active.current) { setMessage('Configuración QR guardada. Las operaciones iniciadas conservan su tarifa y QR.'); await load(); }
      } catch (failure) { if (active.current) setError(qrError(failure)); }
      finally { if (active.current) setBusy(false); }
    }}><label>Beneficiario de la cuenta bancaria<input name="recipient" defaultValue={data.settings?.recipient || ''} required minLength={2} maxLength={160} disabled={busy}/></label><label>QR bancario original (PNG, JPG o WebP · máximo 5 MB)<input name="code" type="file" accept="image/png,image/jpeg,image/webp" required={!data.settings?.image_path} disabled={busy}/></label><small>El QR debe permitir introducir el importe exacto de la comisión y seguir vigente.</small><label className="qr-confirm-check"><input name="enabled" type="checkbox" defaultChecked={data.settings?.enabled || false} disabled={busy}/>Habilitar pagos QR</label><button type="submit" className="button button-dark" disabled={busy}>Guardar configuración QR</button></form>}</details>
    {message && <p role="status" className="market-status">{message}</p>}{error && <p role="alert" className="market-status error">{error}</p>}
    <div className="flex items-center justify-between gap-3 mt-6"><h3>Comprobantes por verificar</h3><button type="button" className="text-link" onClick={load}>Actualizar</button></div>
    {data?.pending.length === 0 && <p>No hay comprobantes pendientes.</p>}
    <div className="grid gap-5">{data?.pending.map(payment => <ReviewPayment key={payment.id} payment={payment} onUpdated={load}/>)}</div>
  </section>;
}
