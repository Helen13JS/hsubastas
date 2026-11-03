import React from "react";
function HomeView({ navigate }) {
  return <div className="home-view">      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <p className="eyebrow"><span className="live-dot" /> ADQUISICIONES B2B / C2B EN BOLIVIA</p>
            <h1>Optimiza tus adquisiciones corporativas. <span>Publica requerimientos, recibe ofertas a la baja y conecta con proveedores en Bolivia.</span></h1>
            <p className="hero-description">HSubastas es el marketplace B2B/C2B donde las empresas y compradores reducen costos mediante subastas inversas transparentes, ágiles y con cierre directo a WhatsApp.</p>
            <div className="hero-actions"><button onClick={() => navigate("/publicar")} type="button" className="button button-dark">Publicar requerimiento <span aria-hidden="true">↗</span></button><a href="#/subastas" className="button button-outline">Explorar subastas activas <span aria-hidden="true">→</span></a></div>
            <div className="hero-note"><span aria-hidden="true">◎</span> Subastas inversas · C2B y B2B · Hecho para Bolivia</div>
          </div>
          <div className="hero-visual" aria-label="Ejemplo ilustrativo de una subasta inversa">
            <div className="visual-topline"><span>EL PRECIO BAJA. LAS OPORTUNIDADES SUBEN.</span><span aria-hidden="true">↘</span></div>
            <div className="example-card">
              <div className="example-label"><span className="pill">Ejemplo ilustrativo</span><span aria-hidden="true">↗</span></div>
              <span className="small-label">REQUERIMIENTO DEL COMPRADOR</span>
              <h2>Equipamos tu<br />próximo gran paso.</h2>
              <p>10 computadoras para oficina</p>
              <div className="example-budget"><span>Presupuesto máximo</span><strong>Bs 45.000</strong></div>
              <div className="offer-row"><span><i className="avatar">A</i> Proveedor A</span><strong>Bs 43.500</strong></div>
              <div className="offer-row"><span><i className="avatar">B</i> Proveedor B</span><strong>Bs 41.800</strong></div>
              <div className="offer-row best"><span><i className="avatar">C</i> Mejor oferta del ejemplo</span><strong>Bs 39.900 <span aria-hidden="true">↘</span></strong></div>
            </div>
            <div className="saving-stamp"><span aria-hidden="true">↘</span><div><strong>Tu presupuesto rinde más</strong><small>La competencia trabaja a tu favor.</small></div></div>
            <span className="visual-caption">Una necesidad. Varios proveedores. Mejores posibilidades.</span>
          </div>
        </div>
      </section>
      <div className="principles"><div className="container principles-row"><span>Un mercado con las reglas a tu favor</span><span>↘ Ofertas a la baja</span><span>◎ Competencia transparente</span><span>↔ Conexión directa</span></div></div>
      <section id="como-funciona" className="how-section"><div className="container"><div className="section-heading"><div><p className="eyebrow">CÓMO FUNCIONA HSUBASTAS</p><h2>Tu requerimiento. Su mejor oferta.</h2></div><p className="section-aside">En una subasta inversa, la competencia reduce el precio y amplía tus opciones.</p></div><div className="steps"><article><span className="step-number">01 /</span><h3>El Comprador publica</h3><p>Las empresas o compradores detallan su requerimiento corporativo (ej. maquinaria, insumos, servicios), estableciendo un <strong>presupuesto máximo</strong> y un plazo límite en cuenta regresiva.</p></article><article><span className="step-number">02 /</span><h3>Los Proveedores pujan a la baja</h3><p>En lugar de subir de precio, los proveedores compiten ofreciendo costos cada vez menores. El sistema actualiza las posiciones en tiempo real para garantizar total transparencia.</p></article><article><span className="step-number">03 /</span><h3>Adjudicación y Cierre Directo</h3><p>Al finalizar el plazo, el comprador evalúa la mejor oferta y adjudica la subasta con un solo clic, conectando de forma inmediata vía WhatsApp con el proveedor ganador.</p></article></div></div></section>
      <section className="container section role-grid"><article id="compradores" className="role-card buyer"><p className="eyebrow">PARA COMPRADORES</p><h2>Tu próxima compra,<br />con más posibilidades.</h2><p>Seas una persona o una empresa, empieza por definir qué necesitas, cuándo y cuánto puedes invertir.</p><a href="#/subastas" className="text-link">Publica tu requerimiento <span aria-hidden="true">↗</span></a><small>Inicia sesión y selecciona Publicar requerimiento. Agrega tu WhatsApp si deseas recibir consultas.</small></article><article id="proveedores" className="role-card supplier"><p className="eyebrow">PARA PROVEEDORES</p><h2>Hay alguien buscando<br />lo que tú ofreces.</h2><p>Explora requerimientos, conoce sus condiciones y descubre oportunidades para tu negocio.</p><a href="#/subastas" className="text-link">Encontrar oportunidades <span aria-hidden="true">↗</span></a><small>Abre un requerimiento y envía una oferta que mejore el precio. Tu misma cuenta permite comprar y proveer.</small></article></section>
      <section id="preguntas-frecuentes" className="section container faq-section" aria-labelledby="faq-title">
        <div><p className="eyebrow">RESOLVEMOS TUS DUDAS</p><h2 id="faq-title">Preguntas frecuentes</h2><p className="section-intro">Todo empieza con una necesidad y una mejor propuesta.</p></div>
        <div className="faq-list"><details open><summary>¿Qué es una subasta inversa?</summary><p>Es un mecanismo de comercio electrónico donde los proveedores compiten entre sí reduciendo el precio inicial propuesto por el comprador para adjudicarse el requerimiento.</p></details><details><summary>¿Cómo se formaliza el trato final?</summary><p>Una vez adjudicada la subasta, la plataforma genera un resumen automático que enlaza directamente con el canal oficial de WhatsApp para coordinar los pagos y la entrega del material.</p></details></div>
      </section>
      <section id="informacion-institucional" className="institutional-section" aria-labelledby="institutional-title"><div className="container section">
        <p className="eyebrow">COMPROMISO CON NUESTROS USUARIOS</p><h2 id="institutional-title">Información institucional y legal</h2>
        <div className="legal-grid"><article id="terminos"><h3>Términos y Condiciones de Uso (Contrato de Adhesión)</h3><p>El uso de la plataforma HSubastas implica la aceptación de los términos de comercio electrónico bajo los lineamientos vigentes en el Estado Plurinacional de Bolivia. Los usuarios (compradores y proveedores) se comprometen a suministrar información veraz, mantener la confidencialidad de sus credenciales y cumplir rigurosamente con los acuerdos de adjudicación pactados a través de nuestros canales de negociación.</p></article><article id="privacidad"><h3>Política de Privacidad y Protección de Datos</h3><p>HSubastas protege la información comercial y los datos de contacto de sus usuarios conforme a los estándares de seguridad web. Los datos de transacciones y montos de puja son tratados de manera exclusiva para la gestión operativa del marketplace.</p></article></div>
      </div></section>
</div>;
}
export {
  HomeView as default
};
