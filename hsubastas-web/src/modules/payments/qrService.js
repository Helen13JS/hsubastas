import { getSupabaseClient } from '../../js/supabaseClient.js';
const bucket = 'qr-payment-assets';
const extensions = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'application/pdf': 'pdf' };
export function validatePaymentFile(file, code = false) {
  if (!file || !extensions[file.type] || (code && file.type === 'application/pdf') || file.size <= 0 || file.size > 5 * 1024 * 1024) throw new Error('INVALID_PAYMENT_FILE');
  return extensions[file.type];
}
export function validateReference(value) {
  const reference = String(value || '').trim();
  if (reference.length < 6 || reference.length > 100) throw new Error('INVALID_REFERENCE');
  return reference;
}
export function qrError(error) {
  return ({ QR_NOT_CONFIGURED: 'Los pagos QR aún no están habilitados por administración.',
    COMMISSION_TOO_SMALL: 'El 3% redondeado de esta adjudicación es inferior al importe mínimo procesable.',
    ADMIN_REQUIRED: 'Solo administración puede revisar pagos o configurar el QR.',
    PAYMENT_METHOD_LOCKED: 'Ya existe una operación con otro método. Consulta su estado antes de pagar.',
    BUYER_PAYMENT_ONLY: 'El comprador gestiona el pago del servicio.',
    QR_NOT_REPORTABLE: 'Esta operación ya fue reportada. Actualiza su estado.',
    QR_NOT_REVIEWABLE: 'Otro administrador ya revisó esta operación. Actualiza la lista.',
    INVALID_REFERENCE: 'Ingresa la referencia bancaria de entre 6 y 100 caracteres.',
    INVALID_PAYMENT_FILE: 'Usa PNG, JPG, WebP o un comprobante PDF de hasta 5 MB. El QR debe ser una imagen.',
    RECEIPT_REQUIRED: 'Adjunta el comprobante de la transferencia.',
    INVALID_QR_SETTINGS: 'Revisa el beneficiario y el QR bancario. La comisión se calcula automáticamente.',
    REVIEW_NOTE_REQUIRED: 'Describe la verificación o el motivo de rechazo (10–1000 caracteres).',
    CLOSE_ACCESS_DENIED: 'No tienes acceso al cierre de esta subasta.'
  })[error?.message] || (error?.code === '23505' ? 'Esa referencia bancaria ya fue utilizada. Revisa el abono antes de continuar.' : 'No se pudo actualizar el pago QR. Revisa tu conexión y vuelve a consultar el estado.');
}
export function createQRService(getClient = getSupabaseClient) {
  async function client() { const result = await getClient(); if (!result) throw new Error('AUTH_REQUIRED'); return result; }
  async function rpc(name, params) { const { data, error } = await (await client()).rpc(name, params); if (error) throw error; return data; }
  async function upload(file, prefix, code) {
    const extension = validatePaymentFile(file, code);
    const path = `${prefix}/${globalThis.crypto.randomUUID()}.${extension}`;
    const { error } = await (await client()).storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw error; return path;
  }
  return {
    status: id => rpc('get_commercial_payment_status', { p_auction_id: id }),
    checkout: id => rpc('get_qr_checkout', { p_auction_id: id }),
    open: id => rpc('open_qr_payment', { p_auction_id: id }),
    async report(id, reference, file) {
      const normalized = validateReference(reference);
      const path = await upload(file, `receipts/${id}`, false);
      return rpc('report_qr_payment', { p_payment_id: id, p_reference: normalized, p_receipt_path: path });
    },
    async asset(path, download = false) {
      const { data, error } = await (await client()).storage.from(bucket).createSignedUrl(path, 300, { download });
      if (error) throw error; return data.signedUrl;
    },
    isAdmin: () => rpc('is_platform_admin'),
    admin: () => rpc('admin_qr_payments'),
    async configure({ recipient, file, imagePath, enabled }) {
      const path = file?.size ? await upload(file, 'codes', true) : imagePath;
      return rpc('configure_qr_payment', { p_recipient: recipient.trim(), p_amount: null, p_image_path: path || null, p_enabled: enabled });
    },
    review: (id, approve, bankReference, note) => rpc('review_qr_payment', {
      p_payment_id: id, p_approve: approve, p_bank_reference: bankReference.trim(), p_note: note.trim()
    })
  };
}
