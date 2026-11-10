import React from 'react';
import { PayPalScriptProvider } from '@paypal/react-paypal-js';
import { paypalSDKOptions } from '../modules/payments/paypalConfig.js';

// Una sola instancia del SDK oficial para todo el portal, también sin sesión.
// Solo carga el SDK público; crear/capturar órdenes sigue requiriendo el cierre autorizado.
export default function PayPalProvider({ children }) {
  if (!paypalSDKOptions) return <>{children}</>;
  return <PayPalScriptProvider options={paypalSDKOptions}>{children}</PayPalScriptProvider>;
}
