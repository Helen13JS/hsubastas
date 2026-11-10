import test from 'node:test';
import assert from 'node:assert/strict';
import { readPaymentConfig, verifyCapture, paymentAction, createPayPalAPI, commissionQuote } from '../../../supabase/functions/paypal-checkout/paymentCore.js';
import { createPaymentService } from './paymentService.js';
const config = { ...commissionQuote('3333.33','10'), environment: 'sandbox', currency: 'USD', clientId: 'public', secret: 'secret', base: 'https://api-m.sandbox.paypal.com' };
const auction = { id: 'auction', buyer_id: 'buyer', status: 'closed', awarded_bid_id: 'bid' };
const row = { id: 'payment', auction_id: 'auction', payer_id: 'buyer', environment: 'sandbox', amount: '10.00', currency: 'USD', status: 'CREATED', paypal_order_id: 'ORDER1' };
function order(status = 'COMPLETED', value = '10.00') { return { id: 'ORDER1', intent: 'CAPTURE', status,
  purchase_units: [{ reference_id: 'payment', custom_id: 'auction', payments: { captures: [{ id: 'CAPTURE1', status, amount: { currency_code: 'USD', value } }] } }] }; }
function fixture(initial = row) {
  let stored = initial ? { ...initial } : null; const calls = [];
  const repo = { async find() { return stored; }, async reserve(data) { stored ||= { ...data, id: 'payment', status: 'CREATED' }; return stored; },
    async attachOrder(id, orderId) { stored.paypal_order_id ||= orderId; return stored; }, async save(id, data) { stored = { ...stored, ...data }; return stored; } };
  const paypal = async (path, options) => {
    calls.push({ path, options });
    if (path === '/v2/checkout/orders') return { id: 'ORDER1' };
    if (path.startsWith('/v2/payments/')) return order().purchase_units[0].payments.captures[0];
    return order();
  };
  return { repo, paypal, calls, stored: () => stored };
}
test('no habilita pagos sin cambio comercial y credenciales de servidor; Sandbox predeterminado', () => {
  assert.throws(() => readPaymentConfig(() => ''), /PAYMENTS_NOT_CONFIGURED/);
  const env = { PAYPAL_CLIENT_ID: 'public', PAYPAL_CLIENT_SECRET: 'secret', PAYPAL_BOB_PER_USD: '10' };
  assert.equal(readPaymentConfig(key => env[key], '3333.33').environment, 'sandbox');
  for (const bad of ['0.00','NaN','1.1234567','-5.00','1e2']) assert.throws(() => readPaymentConfig(key => key === 'PAYPAL_BOB_PER_USD' ? bad : env[key], '3333.33'));
  assert.throws(() => readPaymentConfig(key => key === 'PAYPAL_ENVIRONMENT' ? 'typo' : env[key], '3333.33'));
});
test('comisión exacta del 3% sobre adjudicación, cambio 10 BOB/USD y redondeo comercial', () => {
  assert.deepEqual(commissionQuote('1000','10'), { amount: '3.00', commissionBOB: '30.00', awardAmountBOB: '1000.00', exchangeRate: 10, commissionPercent: 3 });
  assert.equal(commissionQuote('45000','10').amount, '135.00');
  assert.equal(commissionQuote('3333.33','10').commissionBOB, '100.00');
  assert.equal(commissionQuote('1.50','10').amount, '0.01');
  for (const invalid of ['0','NaN','-1','Infinity','1.001']) assert.throws(() => commissionQuote(invalid,'10'));
  assert.throws(() => commissionQuote('0.01','10'), /COMMISSION_TOO_SMALL/);
});
test('rechaza orden, referencia, moneda o importe ajenos; PENDING no es pagado', () => {
  assert.equal(verifyCapture(order('PENDING'), row).status, 'PENDING');
  assert.equal(verifyCapture(order(), row).status, 'COMPLETED');
  for (const invalid of [{ ...row, paypal_order_id: 'foreign' }, { ...row, id: 'other' }, { ...row, auction_id: 'other' }, { ...row, currency: 'BOB' }, { ...row, amount: '11.00' }]) {
    assert.throws(() => verifyCapture(order(), invalid), /PAYMENT_MISMATCH/);
  }
  const multiple = order(); multiple.purchase_units[0].payments.captures.push(multiple.purchase_units[0].payments.captures[0]);
  assert.throws(() => verifyCapture(multiple, row));
});
test('solo comprador puede crear/capturar y solo después de adjudicar', async () => {
  const f = fixture();
  for (const action of ['create','capture']) await assert.rejects(paymentAction({ ...f, config, auction, action, userId: 'winner' }), /BUYER_PAYMENT_ONLY/);
  await assert.rejects(paymentAction({ ...f, config, auction: { ...auction, status: 'active' }, action: 'create', userId: 'buyer' }), /AWARD_REQUIRED/);
  await assert.rejects(paymentAction({ ...f, config, auction, action: 'capture', orderId: 'FOREIGN', userId: 'buyer' }), /PAYMENT_MISMATCH/);
  assert.equal(f.calls.length, 0);
});
test('creación fija precio en servidor y conserva IDs de idempotencia', async () => {
  const f = fixture(null);
  await paymentAction({ ...f, config, auction, action: 'create', userId: 'buyer', amount: '0.01' });
  const create = f.calls.find(call => call.path === '/v2/checkout/orders');
  assert.equal(create.options.body.purchase_units[0].amount.value, '10.00');
  assert.equal(create.options.requestId, 'payment');
  assert.equal(f.stored().commission_percent, 3);
  assert.equal(f.stored().commission_bob, '100.00');
  assert.equal(f.stored().bob_per_usd, 10);
  await paymentAction({ ...f, config, auction, action: 'create', userId: 'buyer' });
  assert.equal(f.calls.filter(call => call.path === '/v2/checkout/orders').length, 1);
});
test('captura confirma en PayPal, persiste recibo y una repetición no vuelve a capturar', async () => {
  const f = fixture();
  const input = { ...f, config, auction, action: 'capture', orderId: 'ORDER1', userId: 'buyer' };
  assert.equal((await paymentAction(input)).status, 'COMPLETED');
  assert.equal(f.stored().paypal_capture_id, 'CAPTURE1');
  await paymentAction(input);
  const captures = f.calls.filter(call => call.path.endsWith('/capture'));
  assert.equal(captures.length, 1); assert.equal(captures[0].options.requestId, 'capture-payment');
});
test('recarga recupera captura; caída de red no marca pago completado', async () => {
  const f = fixture();
  assert.equal((await paymentAction({ ...f, config, auction, action: 'quote', userId: 'buyer' })).status, 'COMPLETED');
  const bad = fixture();
  await assert.rejects(paymentAction({ ...bad, config, auction, action: 'capture', userId: 'buyer', orderId: 'ORDER1', paypal: async () => { throw new Error('network'); } }));
  assert.equal(bad.stored().status, 'CREATED');
});
test('API usa OAuth y PayPal-Request-Id sin exponer secretos al cliente', async () => {
  const calls = [];
  const api = createPayPalAPI(config, async (url, options) => { calls.push({ url, options }); return { ok: true, async json() { return calls.length === 1 ? { access_token: 'token' } : { id: 'ORDER1' }; } }; });
  await api('/v2/checkout/orders', { method: 'POST', body: {}, requestId: 'stable' });
  assert.match(calls[0].url, /sandbox.paypal.com\/v1\/oauth2\/token/);
  assert.equal(calls[1].options.headers['PayPal-Request-Id'], 'stable');
  assert.equal(calls[1].options.headers.Authorization, 'Bearer token');
});
test('servicio cliente envía identificadores, nunca el precio ni secretos', async () => {
  let received;
  const service = createPaymentService(async () => ({ functions: { async invoke(name, options) { received = { name, ...options }; return { data: { status: 'PENDING' } }; } } }));
  assert.equal((await service.request('capture', 'auction', 'ORDER1')).status, 'PENDING');
  assert.deepEqual(received, { name: 'paypal-checkout', body: { action: 'capture', auction_id: 'auction', order_id: 'ORDER1' } });
});
test('una captura pendiente no confirma pago y se reconcilia después sin otro cargo', async () => {
  const f = fixture(); let status = 'PENDING', captures = 0;
  const paypal = async path => {
    if (path.endsWith('/capture')) captures++;
    return path.startsWith('/v2/payments/') ? order(status).purchase_units[0].payments.captures[0] : order(status);
  };
  const input = { ...f, paypal, config, auction, userId: 'buyer', orderId: 'ORDER1' };
  assert.equal((await paymentAction({ ...input, action: 'capture' })).status, 'PENDING');
  status = 'COMPLETED';
  assert.equal((await paymentAction({ ...input, action: 'quote' })).status, 'COMPLETED');
  assert.equal(captures, 1);
});
test('orden ya capturada recupera recibo y una devolución deja de figurar completada', async () => {
  const f = fixture(); let refunded = false;
  const paypal = async path => {
    if (path.endsWith('/capture')) throw new Error('ORDER_ALREADY_CAPTURED');
    if (path.startsWith('/v2/payments/')) return order(refunded ? 'REFUNDED' : 'COMPLETED').purchase_units[0].payments.captures[0];
    return order();
  };
  const input = { ...f, paypal, config, auction, userId: 'buyer', orderId: 'ORDER1' };
  assert.equal((await paymentAction({ ...input, action: 'capture' })).status, 'COMPLETED');
  refunded = true;
  assert.equal((await paymentAction({ ...input, action: 'quote' })).status, 'REFUNDED');
});
test('reserva concurrente conserva una orden y una modificación de tarifa no cambia el importe reservado', async () => {
  const f = fixture(null);
  const input = { ...f, config, auction, userId: 'buyer', action: 'create' };
  const results = await Promise.all([paymentAction(input), paymentAction(input)]);
  assert.equal(results[0].orderId, results[1].orderId);
  assert.ok(f.calls.filter(call => call.path === '/v2/checkout/orders').every(call => call.options.requestId === 'payment'));
  assert.equal((await paymentAction({ ...input, config: { ...config, amount: '99.00' } })).amount, '10.00');
});
test('API distingue rechazo de instrumento para reiniciar checkout con otro medio', async () => {
  let calls = 0;
  const api = createPayPalAPI(config, async () => ({ ok: ++calls === 1, async json() { return calls === 1 ? { access_token: 'token' } : { details: [{ issue: 'INSTRUMENT_DECLINED' }] }; } }));
  await assert.rejects(api('/v2/checkout/orders/ORDER1/capture', { method: 'POST', body: {} }), /INSTRUMENT_DECLINED/);
});
test('un pago QR iniciado bloquea crear/capturar PayPal antes de llamar a la API', async () => {
  for (const action of ['create', 'capture']) {
    const f = fixture(); f.repo.guard = async () => { throw new Error('PAYMENT_METHOD_LOCKED'); };
    await assert.rejects(paymentAction({ ...f, config, auction, action, orderId: 'ORDER1', userId: 'buyer' }), /PAYMENT_METHOD_LOCKED/);
    assert.equal(f.calls.length, 0);
  }
});
