import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import assert from "node:assert/strict";
import { resolveRoute } from "./routing.js";
import { AuthContext } from "./context/AuthContext.jsx";
import Navbar from "./components/Navbar.jsx";
import HomeView from "./views/HomeView.jsx";
import AuctionsView from "./views/AuctionsView.jsx";
import CreateView from "./views/CreateView.jsx";
import ProfileView from "./views/ProfileView.jsx";
import Footer from "./components/Footer.jsx";
import CommercialClosePanel from './components/CommercialClosePanel.jsx';
import SupportWidget from './components/SupportWidget.jsx';
import TechnologyView from './views/TechnologyView.jsx';
import QRCheckout, { qrStatusLabel } from './components/QRCheckout.jsx';
import PaymentAdminPanel from './components/PaymentAdminPanel.jsx';
import PayPalProvider from './context/PayPalProvider.jsx';
import {getSocialLinks} from './socialLinks.js';
const guest = { user: null, session: null, profile: null, loading: false, error: "", service: {}, refresh() {
} };
const member = { ...guest, user: { id: "user-1", email: "persona@example.com" }, profile: { name: "Persona Real", role: "user", whatsapp_phone: "59171234567" } };
function render(element, auth = guest) {
  return renderToStaticMarkup(<AuthContext.Provider value={auth}>{element}</AuthContext.Provider>);
}
assert.equal(render(<PayPalProvider><span>Portal disponible sin sesión</span></PayPalProvider>), '<span>Portal disponible sin sesión</span>');
assert.equal(resolveRoute("#/publicar").path, "/publicar");
assert.equal(resolveRoute('#/tecnologia').path, '/tecnologia');
const technology = render(<TechnologyView/>);
for (const stack of ['React + Vite + Tailwind CSS', 'Supabase', 'PayPal', 'Vercel']) assert.ok(technology.includes(stack));
assert.match(technology, /QR nacional/);
assert.match(render(<QRCheckout auctionId="auction-1"/>), /Pago QR nacional/);
assert.equal(qrStatusLabel('UNDER_REVIEW'), 'Comprobante en revisión');
assert.equal(qrStatusLabel('COMPLETED'), 'Pago QR confirmado');
assert.equal(render(<PaymentAdminPanel/>), '');
assert.equal(resolveRoute("#/subastas?mine=1&auction=test").query.get("auction"), "test");
assert.equal(resolveRoute("#access_token=private").path, "/inicio");
assert.equal(resolveRoute("#/incorrecto").path, "/no-encontrado");
const publicNav = render(<Navbar route="/inicio" openAuth={() => {
}} notifications={[]} />);
for (const label of ["Inicio", "Explorar Subastas", "C\xF3mo Funciona", "Publicar Requerimiento", "Iniciar sesi\xF3n"]) assert.ok(publicNav.includes(label));
assert.ok(!publicNav.includes("sidebar"));
const privateNav = render(<Navbar route="/perfil" openAuth={() => {
}} notifications={[{ id: "a", title: "Resultado real", awarded_bid_id: "b" }]} />, member);
assert.match(privateNav, /Persona Real/);
assert.match(privateNav, /Resultado real/);
assert.ok(!privateNav.includes("Empresa Verificada"));
const home = render(<HomeView navigate={() => {
}} />);
assert.match(home, /Optimiza tus adquisiciones/);
assert.match(home, /Términos y Condiciones/);
assert.match(home, /Preguntas frecuentes/);
const catalog = render(<AuctionsView openAuth={() => {
}} navigate={() => {
}} query={new URLSearchParams()} />);
assert.match(catalog, /Explorar subastas inversas/);
assert.match(catalog, /Mi actividad/);
const gated = render(<CreateView openAuth={() => {
}} navigate={() => {
}} />);
assert.match(gated, /Iniciar sesión para publicar/);
assert.ok(!gated.includes('name="max_budget"'));
const create = render(<CreateView openAuth={() => {
}} navigate={() => {
}} />, member);
for (const name of ["title", "description", "category", "city", "max_budget", "ends_at"]) assert.ok(create.includes(`name="${name}"`));
assert.match(create, /Vista previa del PDF/);
const profile = render(<ProfileView openAuth={() => {
}} />, member);
assert.match(profile, /persona@example.com/);
assert.match(profile, /Guardar WhatsApp/);
assert.match(profile, /Sin verificación empresarial/);
assert.match(profile, /59171234567/);
const footer = render(<Footer />);
assert.match(footer, /facebook.com\/profile.php\?id=61595687231821/);
assert.match(footer, /instagram.com\/hsubastas_123/);
assert.match(footer, /#\/privacidad/);
const channels=getSocialLinks({});
assert.deepEqual(channels.map(channel=>channel.id),['whatsapp','facebook','instagram','youtube','telegram']);
assert.equal(channels[0].href,'https://wa.me/59168647272');
assert.match(footer,/youtube.com\/@hsubastas/);
assert.equal(channels[4].href,null);
assert.match(footer,/Telegram: pendiente de configurar/);
const closure={winning_bid_id:'bid-1',viewer_role:'buyer',provider_name:'Proveedor ganador',buyer_name:'Comprador real',amount:45000,counterpart_phone:'59171234567'};
const awarded={id:'auction-1',title:'Lote',status:'closed',awarded_bid_id:'bid-1'};
const close=render(<CommercialClosePanel auction={awarded} closure={closure}/>);
assert.match(close,/Cierre Comercial/);assert.match(close,/Pago del servicio de plataforma/);assert.match(close,/HTTPS\/TLS/);
assert.match(close,/Actualizar estado del pago/);assert.match(close,/wa.me\/59168647272/);
assert.match(close,/QR nacional/);assert.match(close,/estado transaccional/);
assert.match(close,/Conversar con comprador/);assert.ok(!close.includes('Simular pago'));
assert.match(render(<SupportWidget openAuth={()=>{}}/>),/Abrir soporte en línea/);
for(const card of ['Visa','Mastercard','Amex'])assert.ok(close.includes(`aria-label="${card}"`));
const corporateLink=close.match(/href="(https:\/\/wa.me\/59168647272[^\"]*)"/)[1].replaceAll('&amp;','&');
assert.match(new URL(corporateLink).searchParams.get('text'),/Oferta ganadora: bid-1/);
assert.match(new URL(corporateLink).searchParams.get('text'),/coordinar el cierre comercial/);
assert.ok(!close.includes('type="password"'));assert.ok(!close.includes('paypal.com'));
assert.equal(render(<CommercialClosePanel auction={{id:'active'}} closure={closure}/>),'');
assert.equal(render(<CommercialClosePanel auction={{...awarded,status:'active'}} closure={closure}/>),'');
assert.equal(render(<CommercialClosePanel auction={awarded} closure={{...closure,amount:0}}/>),'');
assert.equal(render(<CommercialClosePanel auction={awarded} closure={{...closure,provider_name:''}}/>),'');
assert.equal(render(<CommercialClosePanel auction={awarded} closure={{...closure,viewer_role:'loser'}}/>),'');
assert.equal(render(<CommercialClosePanel auction={awarded} closure={{...closure,winning_bid_id:'other'}}/>),'');
const missing=render(<CommercialClosePanel auction={awarded} closure={{...closure,counterpart_phone:null}}/>);
assert.match(missing,/wa.me\/59168647272/);
console.log("OK: rutas del portal, navegaci\xF3n p\xFAblica/privada, notificaciones reales, cuatro vistas, formulario protegido, perfil y footer.");
