import React from "react";
import SocialIcon from './SocialIcon.jsx';
import {getSocialLinks} from '../socialLinks.js';
function Footer() {
  const channels=getSocialLinks();
  return <footer>
      <div className="container footer-top">
        <div><a className="brand" href="#/inicio"><span className="brand-icon" aria-hidden="true">h<span>↘</span></span>HSubastas.</a><p>Conectamos necesidades con oportunidades.</p></div>
        <div><span className="small-label">COMERCIO ELECTRÓNICO EN BOLIVIA</span><p>Plataforma de subastas inversas C2B / B2B</p><a href="https://hsubastas.com.bo">hsubastas.com.bo <span aria-hidden="true">↗</span></a></div>
        <div className="footer-social"><span className="small-label">HSUBASTAS EN REDES</span>
          <nav aria-label="Redes sociales de HSubastas" className="social-links">
            {channels.map(channel=>channel.href?<a key={channel.id} className="social-channel" href={channel.href} target="_blank" rel="noopener noreferrer" aria-label={`${channel.label} de HSubastas`} title={channel.label}><SocialIcon channel={channel.id}/></a>:<span key={channel.id} className="social-channel social-channel-pending" role="link" aria-disabled="true" tabIndex={0} aria-label={`${channel.label}: pendiente de configurar`} title={`${channel.label}: pendiente de configurar`}><SocialIcon channel={channel.id}/></span>)}
          </nav><p className="social-note">Instagram: perfil de demostración.{!channels.find(channel=>channel.id==='telegram')?.href&&' Telegram pendiente de configurar.'}</p>
        </div>
      </div>
      <nav className="container footer-legal" aria-label="Información y ayuda"><a href="#/terminos">Términos y condiciones</a><a href="#/privacidad">Política de privacidad</a><a href="#/preguntas-frecuentes">Preguntas frecuentes</a><a href="#/como-funciona">Cómo funciona</a></nav>
      <div className="container footer-bottom"><span>© <span>{(/* @__PURE__ */ new Date()).getFullYear()}</span> HSubastas. Proyecto individual.</span><span>Construyendo una nueva forma de comprar.</span></div>
    </footer>;
}
export {
  Footer as default
};
