import React from 'react';
export default function TechnologyView() {
  const layers = [
    ['Interfaz', 'React + Vite + Tailwind CSS', 'Vistas independientes, menú superior y diseño responsivo.'],
    ['Datos y acceso', 'Supabase', 'PostgreSQL, autenticación, políticas RLS y mensajes con Realtime.'],
    ['Pagos', 'PayPal API / QR nacional', 'PayPal crea y captura órdenes en el servidor. El QR bancario en BOB se confirma mediante verificación administrativa del abono; los estados se registran en Supabase.'],
    ['Publicación', 'Vercel', 'Configuración de compilación y despliegue preparada. La publicación y el dominio se activan desde la cuenta del proyecto.']
  ];
  return <section className="container section"><div className="view-heading"><div><p className="eyebrow">TECNOLOGÍA Y CONFIANZA</p><h1>Arquitectura de HSubastas</h1><p>Una plataforma modular para publicar, competir y coordinar la entrega.</p></div></div>
    <div className="grid gap-5 md:grid-cols-2">{layers.map(([layer, title, description]) => <article key={layer} className="portal-panel"><span className="status-badge">{layer}</span><h2 className="mt-4">{title}</h2><p>{description}</p></article>)}</div>
    <div className="portal-panel mt-6"><h2>Protección de las operaciones</h2><p>Las credenciales privadas de PayPal permanecen en el servidor. Las conversaciones de negociación solo son accesibles para el comprador y el proveedor adjudicado; soporte tiene su propio canal administrado.</p><p>Los métodos de pago disponibles se muestran al habilitar PayPal para la cuenta del comercio. Una subasta adjudicada y un servicio pagado son estados independientes.</p><a className="text-link" href="#/subastas">Explorar subastas →</a></div>
  </section>;
}
