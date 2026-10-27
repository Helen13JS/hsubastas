import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('modal y header: restaurar sesión, leer perfil, cerrar sesión y registrar con confirmación', async () => {
  const source = (await readFile(new URL('./authUI.js', import.meta.url), 'utf8'))
    .replace("import { createAuthService, authErrorMessage } from './authService.js';", 'const createAuthService = () => globalThis.authUIServiceDouble; const authErrorMessage = () => "Error de acceso";')
    .replace("import './auth.css';", '');
  const html = await readFile(new URL('../../../index.html', import.meta.url), 'utf8');
  const nodes = new Map();
  class Element {
    constructor() { this.value = ''; this.hidden = false; this.listeners = {}; this.dataset = {}; this.open = false; }
    addEventListener(event, callback) { this.listeners[event] = callback; }
    setAttribute(name, value) { this[name] = value; }
    showModal() { this.open = true; }
    close() { this.open = false; this.listeners.close?.(); }
    reportValidity() { return true; }
  }
  const tabs = ['login', 'register'].map(mode => Object.assign(new Element(), { dataset: { authMode: mode } }));
  globalThis.document = { getElementById(id) {
    assert.ok(html.includes(`id="${id}"`), `Falta ${id} en index.html`);
    if (!nodes.has(id)) nodes.set(id, new Element());
    return nodes.get(id);
  } };
  const get = id => document.getElementById(id);
  get('auth-dialog').querySelectorAll = () => tabs;
  get('auth-form').elements = ['auth-name', 'auth-email', 'auth-password', 'auth-submit'].map(get);
  get('account-phone-form').elements = ['account-phone','account-phone-save'].map(get);
  assert.ok(!html.includes('id="auth-role"'));
  globalThis.window = { addEventListener() {} };
  let listener;
  let signedOut = false;
  let registration;
  let phone='59171234567';
  globalThis.authUIServiceDouble = {
    async subscribe(callback) { listener = callback; return () => {}; },
    async getProfile() { return { name: 'Ana', role: 'user',whatsapp_phone:phone }; },
    async updateWhatsApp(value) {assert.equal(value,'76543210');phone='59176543210';return phone;},
    async signOut() { signedOut = true; },
    async signUp(values) { registration = values; return { user: { id: 'new' }, session: null }; },
  };
  const { initAuth } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  await initAuth();
  listener('INITIAL_SESSION', { user: { id: 'ana', email: 'ana@example.com' } });
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(get('auth-open-login').hidden, true);
  assert.equal(get('auth-open-register').hidden, true);
  assert.equal(get('auth-open-account').hidden, false);
  assert.equal(get('auth-open-account').textContent, 'Ana');
  get('auth-open-account').listeners.click();
  assert.equal(get('auth-dialog').open, true);
  assert.equal(get('auth-form').hidden, true);
  assert.equal(get('account-email').textContent, 'ana@example.com');
  assert.match(get('account-role').textContent, /Comprador y proveedor/);
  assert.equal(get('account-phone').value,'59171234567');
  get('account-phone').value='76543210';get('account-phone').listeners.input();
  await get('account-phone-form').listeners.submit({preventDefault(){}});
  assert.equal(get('account-phone').value,'59176543210');
  assert.equal(get('account-phone-save').disabled,false);
  await get('auth-logout').listeners.click();
  assert.equal(signedOut, true);
  assert.equal(get('auth-open-login').hidden, false);
  assert.equal(get('auth-open-account').hidden, true);
  assert.equal(get('account-phone').value,'');
  get('auth-open-register').listeners.click();
  assert.equal(get('auth-name').required, true);
  assert.equal(get('auth-password').minLength, 8);
  get('auth-name').value = 'Nueva cuenta';
  get('auth-email').value = 'test@example.com';
  get('auth-password').value = 'test-password';
  await get('auth-form').listeners.submit({ preventDefault() {} });
  assert.deepEqual(Object.keys(registration).sort(), ['email', 'name', 'password']);
  assert.equal(get('auth-open-account').hidden, true);
  assert.match(get('auth-status').textContent, /confirmaci/);
  assert.equal(get('auth-password').value, '');
  assert.equal(get('auth-submit').disabled, false);
});
