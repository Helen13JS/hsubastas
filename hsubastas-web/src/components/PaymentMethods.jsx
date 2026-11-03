import React from 'react';

export default function PaymentMethods(){
  return <div className="payment-methods"><span>Tarjetas representadas en esta simulación</span><ul aria-label="Visa, Mastercard y Amex">
    <li><svg viewBox="0 0 72 44" role="img" aria-label="Visa"><rect x=".5" y=".5" width="71" height="43" rx="6" fill="white" stroke="#d6deea"/><text x="36" y="29" textAnchor="middle" fill="#1a1f71" fontFamily="Arial, sans-serif" fontWeight="900" fontStyle="italic" fontSize="23">VISA</text></svg></li>
    <li><svg viewBox="0 0 72 44" role="img" aria-label="Mastercard"><rect x=".5" y=".5" width="71" height="43" rx="6" fill="white" stroke="#d6deea"/><circle cx="28" cy="19" r="12" fill="#eb001b"/><circle cx="44" cy="19" r="12" fill="#f79e1b"/><path d="M36 10a12 12 0 0 1 0 18 12 12 0 0 1 0-18Z" fill="#ff5f00"/><text x="36" y="38" textAnchor="middle" fill="#242424" fontFamily="Arial, sans-serif" fontSize="7">mastercard</text></svg></li>
    <li><svg viewBox="0 0 72 44" role="img" aria-label="Amex"><rect x=".5" y=".5" width="71" height="43" rx="6" fill="#2169a8" stroke="#2169a8"/><text x="36" y="20" textAnchor="middle" fill="white" fontFamily="Arial, sans-serif" fontWeight="800" fontSize="10">AMERICAN</text><text x="36" y="31" textAnchor="middle" fill="white" fontFamily="Arial, sans-serif" fontWeight="800" fontSize="11">EXPRESS</text></svg></li>
  </ul></div>;
}
