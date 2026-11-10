import test from 'node:test';
import assert from 'node:assert/strict';
import { createQRService, validatePaymentFile, validateReference } from './qrService.js';
function fixture({ failure } = {}) {
  const calls = [];
  const storage = {
    async upload(path, file, options) { calls.push({ operation: 'upload', path, options }); return {}; },
    async createSignedUrl(path, seconds, options) { calls.push({ operation: 'signed', path, seconds, options }); return { data: { signedUrl: 'https://storage.test/private' } }; }
  };
  const client = { storage: { from(bucket) { assert.equal(bucket, 'qr-payment-assets'); return storage; } },
    async rpc(name, params) { calls.push({ operation: 'rpc', name, params }); return failure ? { error: failure } : { data: 'payment-1' }; } };
  return { service: createQRService(async () => client), calls };
}
test('QR: restringe archivo bancario a imagen y comprobante a imagen/PDF de hasta 5 MB', () => {
  assert.equal(validatePaymentFile({ type: 'image/png', size: 1024 }, true), 'png');
  assert.equal(validatePaymentFile({ type: 'application/pdf', size: 1024 }), 'pdf');
  for (const file of [{ type: 'image/svg+xml', size: 20 }, { type: 'text/html', size: 20 }, { type: 'image/png', size: 0 }, { type: 'image/jpeg', size: 5242881 }]) assert.throws(() => validatePaymentFile(file));
  assert.throws(() => validatePaymentFile({ type: 'application/pdf', size: 10 }, true));
});
test('QR: referencia vacía o inválida no intenta subir comprobante ni enviar RPC', async () => {
  const { service, calls } = fixture();
  assert.equal(validateReference('  BANCO-1234  '), 'BANCO-1234');
  await assert.rejects(service.report('payment-1', '123', { type: 'image/png', size: 12 }), /INVALID_REFERENCE/);
  assert.equal(calls.length, 0);
});
test('QR: reportar sube comprobante privado sin permitir sobreescritura ni enviar éxito/importe', async () => {
  const { service, calls } = fixture();
  await service.report('payment-1', ' BANCO-1234 ', { type: 'image/png', size: 1024 });
  assert.equal(calls[0].operation, 'upload'); assert.match(calls[0].path, /^receipts\/payment-1\/[a-f0-9-]+\.png$/);
  assert.equal(calls[0].options.upsert, false);
  assert.deepEqual(calls[1], { operation: 'rpc', name: 'report_qr_payment', params: {
    p_payment_id: 'payment-1', p_reference: 'BANCO-1234', p_receipt_path: calls[0].path
  } });
  assert.ok(!JSON.stringify(calls[1]).includes('COMPLETED'));
});
test('QR: cotización y reserva se determinan en servidor, no se envían precio ni payer_id', async () => {
  const { service, calls } = fixture();
  await service.checkout('auction'); await service.open('auction'); await service.status('auction');
  assert.deepEqual(calls.map(item => [item.name, item.params]), [
    ['get_qr_checkout', { p_auction_id: 'auction' }], ['open_qr_payment', { p_auction_id: 'auction' }], ['get_commercial_payment_status', { p_auction_id: 'auction' }]
  ]);
});
test('QR: el servidor rechaza revisiones sin administración y el error se conserva', async () => {
  const { service } = fixture({ failure: new Error('ADMIN_REQUIRED') });
  await assert.rejects(service.review('payment', true, 'BANK-123', 'Verificado contra extracto'), /ADMIN_REQUIRED/);
});
test('QR: configura activo privado, conserva el QR anterior al no elegir archivo nuevo y usa enlace temporal', async () => {
  const { service, calls } = fixture();
  await service.configure({ recipient: ' Empresa ', imagePath: 'codes/original.png', enabled: true });
  assert.deepEqual(calls[0].params, { p_recipient: 'Empresa', p_amount: null, p_image_path: 'codes/original.png', p_enabled: true });
  assert.equal(await service.asset('receipts/payment/private.pdf', true), 'https://storage.test/private');
  assert.deepEqual(calls[1], { operation: 'signed', path: 'receipts/payment/private.pdf', seconds: 300, options: { download: true } });
});
