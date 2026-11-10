import { createClient } from 'npm:@supabase/supabase-js@2';
import { createPayPalAPI, paymentAction, readPaymentConfig } from './paymentCore.js';

Deno.serve(async (request: Request) => {
  const allowed = (Deno.env.get('APP_ORIGINS') || 'http://127.0.0.1:5174,http://localhost:5174').split(',').map(value => value.trim());
  const origin = request.headers.get('origin') || '';
  const headers = { 'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : '',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin', 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
  if (!allowed.includes(origin)) return reply({ error: 'ORIGIN_DENIED' }, 403);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return reply({ error: 'METHOD_NOT_ALLOWED' }, 405);
  try {
    const authorization = request.headers.get('Authorization') || '';
    if (!authorization.startsWith('Bearer ')) return reply({ error: 'AUTH_REQUIRED' }, 401);
    const url = Deno.env.get('SUPABASE_URL')!, anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
    const { data: { user }, error: authError } = await userClient.auth.getUser(authorization.slice(7));
    if (authError || !user) return reply({ error: 'AUTH_REQUIRED' }, 401);
    const input = await request.json();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.auction_id || '') ||
      !['quote','create','capture'].includes(input.action)) return reply({ error: 'INVALID_REQUEST' }, 400);
    // Comprador o ganador; nunca un tercero ni un simple participante sin adjudicar.
    const { data: closure, error: closureError } = await userClient.rpc('get_commercial_close', { p_auction_id: input.auction_id });
    if (closureError) return reply({ error: 'CLOSE_ACCESS_DENIED' }, 403);
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
    const unwrap = ({ data, error }: { data: any; error: any }) => {
      if (error) throw new Error(['PAYMENT_METHOD_LOCKED','BUYER_PAYMENT_ONLY','AWARD_REQUIRED','PAYMENT_MISMATCH','PAYMENTS_NOT_CONFIGURED','COMMISSION_TOO_SMALL'].includes(error.message) ? error.message : 'PAYMENT_STORAGE_ERROR');
      return data;
    };
    const auction = unwrap(await admin.from('auctions').select('id,status,buyer_id,awarded_bid_id').eq('id', input.auction_id).single());
    const repo = {
      async guard() {
        unwrap(await admin.rpc('reserve_paypal_payment', { p_auction_id: auction.id, p_payer_id: user.id,
          p_environment: config.environment, p_amount: config.amount, p_currency: config.currency, p_bob_per_usd: config.exchangeRate }));
      },
      async find(id: string, environment: string) { return unwrap(await admin.from('platform_payments').select('*').eq('auction_id', id).eq('environment', environment).maybeSingle()); },
      async reserve() {
        await this.guard();
        return await this.find(input.auction_id, config.environment);
      },
      async attachOrder(id: string, order: string) {
        unwrap(await admin.from('platform_payments').update({ paypal_order_id: order, updated_at: new Date().toISOString() }).eq('id', id).is('paypal_order_id', null));
        return await this.find(input.auction_id, config.environment);
      },
      async save(id: string, values: object) { return unwrap(await admin.from('platform_payments').update({ ...values, updated_at: new Date().toISOString() }).eq('id', id).select('*').single()); }
    };
    const config = readPaymentConfig((name: string) => Deno.env.get(name), closure.amount);
    return reply(await paymentAction({ action: input.action, orderId: input.order_id, auction, userId: user.id,
      config, repo, paypal: createPayPalAPI(config) }));
  } catch (error) {
    const known = ['PAYMENTS_NOT_CONFIGURED','PAYPAL_UNAVAILABLE','PAYMENT_MISMATCH','PAYMENT_UNCONFIRMED','BUYER_PAYMENT_ONLY','AWARD_REQUIRED','INVALID_REQUEST','PAYMENT_STORAGE_ERROR','INSTRUMENT_DECLINED','PAYMENT_METHOD_LOCKED','COMMISSION_TOO_SMALL','INVALID_COMMISSION_AMOUNT'];
    const code = error instanceof Error && known.includes(error.message) ? error.message : 'PAYMENT_UNAVAILABLE';
    return reply({ error: code }, code === 'BUYER_PAYMENT_ONLY' ? 403 : code === 'INVALID_REQUEST' ? 400 : 503);
  }
});
