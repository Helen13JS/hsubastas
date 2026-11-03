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
const guest = { user: null, session: null, profile: null, loading: false, error: "", service: {}, refresh() {
} };
const member = { ...guest, user: { id: "user-1", email: "persona@example.com" }, profile: { name: "Persona Real", role: "user", whatsapp_phone: "59171234567" } };
function render(element, auth = guest) {
  return renderToStaticMarkup(<AuthContext.Provider value={auth}>{element}</AuthContext.Provider>);
}
assert.equal(resolveRoute("#/publicar").path, "/publicar");
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
assert.match(footer, /instagram.com/);
assert.match(footer, /#\/privacidad/);
console.log("OK: rutas del portal, navegaci\xF3n p\xFAblica/privada, notificaciones reales, cuatro vistas, formulario protegido, perfil y footer.");
