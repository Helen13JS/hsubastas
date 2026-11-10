import { getSupabaseClient } from '../../js/supabaseClient.js';
export function createPaymentService(getClient = getSupabaseClient) {
  return { async request(action, auctionId, orderId) {
    const client = await getClient();
    if (!client) throw new Error('AUTH_REQUIRED');
    const { data, error } = await client.functions.invoke('paypal-checkout', {
      body: { action, auction_id: auctionId, ...(orderId ? { order_id: orderId } : {}) }
    });
    if (error) {
      let code;
      try { code = (await error.context?.json())?.error; } catch { /* Respuesta sin JSON */ }
      throw new Error(code || 'PAYMENT_UNAVAILABLE');
    }
    if (!data || data.error) throw new Error(data?.error || 'PAYMENT_UNAVAILABLE');
    return data;
  } };
}
export function paymentError(error) {
  return ({ AUTH_REQUIRED: 'Inicia sesión para consultar el pago.',
    PAYMENTS_NOT_CONFIGURED: 'Los pagos todavía no están habilitados por HSubastas.',
    COMMISSION_TOO_SMALL: 'La comisión redondeada es demasiado pequeña para procesar este pago.',
    CLIENT_ID_MISMATCH: 'La configuración de PayPal no coincide. Contacta a soporte.',
    BUYER_PAYMENT_ONLY: 'El pago del servicio corresponde al comprador.',
    PAYMENT_METHOD_LOCKED: 'Ya existe una operación con otro método. Actualiza el estado o consulta con soporte antes de pagar nuevamente.',
    INSTRUMENT_DECLINED: 'PayPal rechazó ese medio de pago. Elige otro en PayPal o contacta con soporte.',
    CLOSE_ACCESS_DENIED: 'Solo el comprador y el proveedor ganador pueden consultar este cierre.',
    PAYMENT_MISMATCH: 'No se pudo verificar la orden. Consulta con soporte antes de continuar.',
    PAYMENT_UNCONFIRMED: 'PayPal todavía no confirmó el resultado. Actualiza el estado antes de reintentar.'
  })[error?.message] || 'No pudimos confirmar el pago. Actualiza el estado o contacta a soporte antes de intentar nuevamente.';
}
