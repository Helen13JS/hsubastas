import React from "react";
function Footer() {
  return <footer>
      <div className="container footer-top">
        <div><a className="brand" href="#/inicio"><span className="brand-icon" aria-hidden="true">h<span>↘</span></span>HSubastas.</a><p>Conectamos necesidades con oportunidades.</p></div>
        <div><span className="small-label">COMERCIO ELECTRÓNICO EN BOLIVIA</span><p>Plataforma de subastas inversas C2B / B2B</p><a href="https://hsubastas.com.bo">hsubastas.com.bo <span aria-hidden="true">↗</span></a></div>
        <div className="footer-social"><span className="small-label">HSUBASTAS EN REDES</span>
          {
    /* Perfiles simulados para la presentación académica. Sustituir por los oficiales. */
  }
          <nav aria-label="Redes sociales de HSubastas" className="social-links">
            <a href="https://www.facebook.com/profile.php?id=61595687231821" target="_blank" rel="noopener noreferrer nofollow"><span className="social-icon" aria-hidden="true">f</span> Facebook <span aria-hidden="true">↗</span></a>
            <a href="https://www.instagram.com/hsubastas/" target="_blank" rel="noopener noreferrer nofollow"><svg className="social-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17" cy="7" r="1" fill="currentColor" stroke="none" /></svg> Instagram <span aria-hidden="true">↗</span></a>
          </nav><p className="social-note">Perfiles de demostración.</p>
        </div>
      </div>
      <nav className="container footer-legal" aria-label="Información y ayuda"><a href="#/terminos">Términos y condiciones</a><a href="#/privacidad">Política de privacidad</a><a href="#/preguntas-frecuentes">Preguntas frecuentes</a><a href="#/como-funciona">Cómo funciona</a></nav>
      <div className="container footer-bottom"><span>© <span>{(/* @__PURE__ */ new Date()).getFullYear()}</span> HSubastas. Proyecto individual.</span><span>Construyendo una nueva forma de comprar.</span></div>
    </footer>;
}
export {
  Footer as default
};
