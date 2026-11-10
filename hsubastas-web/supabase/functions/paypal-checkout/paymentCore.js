// Compartido con pruebas Node; no depende del navegador ni de Deno.
export function commissionQuote(award, rate) {
  const base = String(award ?? ''), conversion = String(rate ?? '');
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(base) || !/^\d{1,6}(\.\d{1,6})?$/.test(conversion)) throw new Error('PAYMENTS_NOT_CONFIGURED');
  const cents = value => { const [whole, fraction = ''] = value.split('.'); return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0')); };
  const format = value => `${value / 100n}.${String(value % 100n).padStart(2, '0')}`;
  const [whole, fraction = ''] = conversion.split('.');
  const rateUnits = BigInt(whole) * 1000000n + BigInt(fraction.padEnd(6, '0'));
  const awardCents = cents(base);
  if (rateUnits <= 0n || awardCents <= 0n) throw new Error('PAYMENTS_NOT_CONFIGURED');
  const feeCents = (awardCents * 3n + 50n) / 100n;
  const usdCents = (feeCents * 1000000n + rateUnits / 2n) / rateUnits;
  if (feeCents < 1n || usdCents < 1n) throw new Error('COMMISSION_TOO_SMALL');
  if (usdCents > 999999999999n) throw new Error('INVALID_COMMISSION_AMOUNT');
  return { amount: format(usdCents), commissionBOB: format(feeCents), awardAmountBOB: format(awardCents), exchangeRate: Number(conversion), commissionPercent: 3 };
}
export function readPaymentConfig(get, awardAmountBOB) {
  const environment = get('PAYPAL_ENVIRONMENT') || 'sandbox';
  if (!['sandbox', 'live'].includes(environment) ||
    !get('PAYPAL_CLIENT_ID') || !get('PAYPAL_CLIENT_SECRET')) throw new Error('PAYMENTS_NOT_CONFIGURED');
  return { ...commissionQuote(awardAmountBOB, get('PAYPAL_BOB_PER_USD')), environment, currency: 'USD', clientId: get('PAYPAL_CLIENT_ID'),
    secret: get('PAYPAL_CLIENT_SECRET'), base: environment === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com' };
}
export function orderBody(payment) {
  return { intent: 'CAPTURE', purchase_units: [{ reference_id: payment.id,
    custom_id: payment.auction_id, description: 'Servicio de plataforma HSubastas',
    amount: { currency_code: payment.currency, value: Number(payment.amount).toFixed(2) } }],
    payment_source: { paypal: { experience_context: { shipping_preference: 'NO_SHIPPING', user_action: 'PAY_NOW' } } } };
}
export function verifyCapture(order, payment) {
  if (order.id !== payment.paypal_order_id || order.intent !== 'CAPTURE' || order.purchase_units?.length !== 1) throw new Error('PAYMENT_MISMATCH');
  const unit = order.purchase_units[0], captures = unit.payments?.captures;
  if (unit.reference_id !== payment.id || unit.custom_id !== payment.auction_id) throw new Error('PAYMENT_MISMATCH');
  if (!captures?.length) {
    if (order.status === 'COMPLETED') throw new Error('PAYMENT_UNCONFIRMED');
    return null;
  }
  if (captures.length !== 1) throw new Error('PAYMENT_MISMATCH');
  const capture = captures[0];
  if (!capture.id || capture.amount?.currency_code !== payment.currency ||
    Number(capture.amount?.value) !== Number(payment.amount)) throw new Error('PAYMENT_MISMATCH');
  if (!['COMPLETED','PENDING','DECLINED','REFUNDED','PARTIALLY_REFUNDED','DENIED','FAILED'].includes(capture.status)) throw new Error('PAYMENT_UNCONFIRMED');
  return { paypal_capture_id: capture.id, status: capture.status === 'COMPLETED' ? 'COMPLETED' :
    capture.status === 'PENDING' ? 'PENDING' : ['REFUNDED','PARTIALLY_REFUNDED'].includes(capture.status) ? 'REFUNDED' : 'DENIED' };
}

export function createPayPalAPI(config, fetcher = fetch) {
  let token;
  return async function paypal(path, { method = 'GET', body, requestId } = {}) {
    if (!token) {
      const auth = await fetcher(`${config.base}/v1/oauth2/token`, { method: 'POST',
        headers: { Authorization: `Basic ${btoa(`${config.clientId}:${config.secret}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=client_credentials', signal: AbortSignal.timeout(15000) });
      const data = await auth.json();
      if (!auth.ok || !data.access_token) throw new Error('PAYPAL_UNAVAILABLE');
      token = data.access_token;
    }
    const response = await fetcher(`${config.base}${path}`, { method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=representation',
        ...(requestId ? { 'PayPal-Request-Id': requestId } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20000) });
    const data = await response.json();
    if (!response.ok) {
      if (data.details?.some(item => item.issue === 'ORDER_ALREADY_CAPTURED')) throw new Error('ORDER_ALREADY_CAPTURED');
      if (data.details?.some(item => item.issue === 'INSTRUMENT_DECLINED')) throw new Error('INSTRUMENT_DECLINED');
      throw new Error('PAYPAL_UNAVAILABLE');
    }
    return data;
  };
}

// Repo se implementa solo con service_role después de verificar Auth y el cierre.
export async function paymentAction({ action, orderId, auction, userId, config, repo, paypal }) {
  if (!['quote','create','capture'].includes(action)) throw new Error('INVALID_REQUEST');
  if (auction.status !== 'closed' || !auction.awarded_bid_id) throw new Error('AWARD_REQUIRED');
  if (action !== 'quote' && auction.buyer_id !== userId) throw new Error('BUYER_PAYMENT_ONLY');
  let payment = await repo.find(auction.id, config.environment);
  if (action === 'capture' && (!payment?.paypal_order_id || orderId !== payment.paypal_order_id)) throw new Error('PAYMENT_MISMATCH');
  if (action !== 'quote' && repo.guard) {
    await repo.guard();
    payment = await repo.find(auction.id, config.environment);
  }
  if (action === 'create' && !payment) payment = await repo.reserve({ auction_id: auction.id, payer_id: userId,
    environment: config.environment, amount: config.amount, currency: config.currency,
    commission_percent: 3, commission_bob: config.commissionBOB, award_amount_bob: config.awardAmountBOB, bob_per_usd: config.exchangeRate });
  if (payment && payment.payer_id !== auction.buyer_id) throw new Error('PAYMENT_MISMATCH');
  let order;
  if (action === 'create' && !payment.paypal_order_id) {
    order = await paypal('/v2/checkout/orders', { method: 'POST', body: orderBody(payment), requestId: payment.id });
    if (!/^[A-Z0-9]+$/.test(order.id || '')) throw new Error('PAYMENT_UNCONFIRMED');
    // Una respuesta concurrente no puede sustituir una orden ya vinculada.
    payment = await repo.attachOrder(payment.id, order.id);
  }
  if (action === 'capture' && (!payment?.paypal_order_id || orderId !== payment.paypal_order_id)) throw new Error('PAYMENT_MISMATCH');
  if (payment?.paypal_order_id) {
    if (action === 'capture' && !payment.paypal_capture_id) {
      try {
        order = await paypal(`/v2/checkout/orders/${payment.paypal_order_id}/capture`, { method: 'POST', body: {}, requestId: `capture-${payment.id}` });
      } catch (error) {
        if (error.message !== 'ORDER_ALREADY_CAPTURED') throw error;
      }
    }
    // Recupera el resultado aun tras cerrar el popup, recargar o perder la respuesta.
    order = await paypal(`/v2/checkout/orders/${payment.paypal_order_id}`);
    let verified = verifyCapture(order, payment);
    if (verified?.paypal_capture_id) {
      const capture = await paypal(`/v2/payments/captures/${verified.paypal_capture_id}`);
      if (capture.id !== verified.paypal_capture_id) throw new Error('PAYMENT_MISMATCH');
      verified = verifyCapture({ ...order, purchase_units: [{ ...order.purchase_units[0], payments: { captures: [capture] } }] }, payment);
      payment = await repo.save(payment.id, verified);
    }
  }
  return { environment: config.environment, clientId: config.clientId, currency: payment?.currency || config.currency,
    commissionPercent: payment ? payment.commission_percent ?? null : config.commissionPercent,
    commissionBOB: payment ? payment.commission_bob ?? null : config.commissionBOB,
    awardAmountBOB: payment ? payment.award_amount_bob ?? null : config.awardAmountBOB,
    exchangeRate: payment ? payment.bob_per_usd ?? null : config.exchangeRate,
    amount: payment ? Number(payment.amount).toFixed(2) : config.amount, status: payment?.status || 'UNPAID',
    orderId: payment?.paypal_order_id || null, captureId: payment?.paypal_capture_id || null,
    orderStatus: order?.status || null, canPay: auction.buyer_id === userId };
}
