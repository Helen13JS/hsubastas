const environment = import.meta.env ?? {};
export const paypalClientId = (environment.VITE_PAYPAL_CLIENT_ID || '').trim();
export const paypalCurrency = 'USD';
export const paypalSDKOptions = paypalClientId ? {
  clientId: paypalClientId,
  currency: paypalCurrency,
  intent: 'capture',
  components: 'buttons'
} : null;
