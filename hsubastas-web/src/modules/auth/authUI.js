import { createAuthService, authErrorMessage } from './authService.js';
import './auth.css';

export async function initAuth() {
  const service = createAuthService();
  const find = (id) => document.getElementById(id);
  const dialog = find('auth-dialog');
  const form = find('auth-form');
  const status = find('auth-status');
  const login = find('auth-open-login');
  const register = find('auth-open-register');
  const account = find('auth-open-account');
  const submit = find('auth-submit');
  const phoneForm = find('account-phone-form');
  let phoneDirty = false;
  const tabs = [...dialog.querySelectorAll('[data-auth-mode]')];
  let mode = 'login';
  let session = null;
  let profile = null;
  let profileError = false;
  let busy = false;
  let revision = 0;
  let alive = true;

  function notify(text = '', error = false) {
    status.textContent = text;
    status.hidden = !text;
    status.dataset.error = String(error);
  }

  function renderAccount() {
    login.hidden = register.hidden = Boolean(session);
    account.hidden = !session;
    account.textContent = profile?.name || 'Mi cuenta';
    account.title = 'Ver mi cuenta';
    find('account-name').textContent = profile?.name || 'Perfil pendiente';
    find('account-email').textContent = session?.user.email || 'Sin correo';
    find('account-role').textContent = profile ? 'Unificada · Comprador y proveedor' : 'No disponible';
    find('account-warning').hidden = !profileError;
    if (!phoneDirty) find('account-phone').value = profile?.whatsapp_phone || '';
    for (const control of phoneForm.elements) control.disabled = busy || !profile;
  }

  function setMode(next) {
    mode = next;
    const isRegister = mode === 'register';
    const isAccount = mode === 'account';
    find('auth-title').textContent = isAccount ? 'Mi cuenta' : isRegister ? 'Crea tu cuenta' : 'Bienvenido de nuevo';
    find('auth-tabs').hidden = isAccount;
    form.hidden = isAccount;
    find('auth-account').hidden = !isAccount;
    find('auth-register-fields').hidden = !isRegister;
    find('auth-name').required = isRegister;
    find('auth-password').minLength = isRegister ? 8 : 1;
    find('auth-password').autocomplete = isRegister ? 'new-password' : 'current-password';
    find('auth-password-help').hidden = !isRegister;
    find('auth-password').value = '';
    submit.textContent = isRegister ? 'Registrarme' : 'Iniciar sesión';
    for (const tab of tabs) tab.setAttribute('aria-pressed', String(tab.dataset.authMode === mode));
    notify();
    renderAccount();
  }

  function open(next) {
    phoneDirty = false;
    setMode(session ? 'account' : next);
    if (!dialog.open) dialog.showModal();
  }

  async function syncSession(next) {
    const request = ++revision;
    const oldId = session?.user.id;
    session = next;
    if (oldId !== next?.user.id) { profile = null; profileError = false; phoneDirty = false; }
    renderAccount();
    if (!next) {
      if (mode === 'account') setMode('login');
      return;
    }
    try {
      const result = await service.getProfile(next.user.id);
      if (!alive || request !== revision) return;
      profile = result;
      profileError = false;
    } catch {
      if (!alive || request !== revision) return;
      profile = null;
      profileError = true;
    }
    renderAccount();
    if (dialog.open && mode !== 'account') setMode('account');
  }

  function setBusy(value) {
    busy = value;
    form.setAttribute('aria-busy', String(value));
    for (const control of form.elements) control.disabled = value;
    for (const tab of tabs) tab.disabled = value;
    find('auth-logout').disabled = value;
    find('auth-retry-profile').disabled = value;
    phoneForm.setAttribute('aria-busy',String(value));
    for (const control of phoneForm.elements) control.disabled = value || !profile;
  }

  login.addEventListener('click', () => open('login'));
  register.addEventListener('click', () => open('register'));
  account.addEventListener('click', () => open('account'));
  for (const tab of tabs) tab.addEventListener('click', () => setMode(tab.dataset.authMode));
  find('auth-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { find('auth-password').value = ''; });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy || !form.reportValidity()) return;
    const values = {
      name: find('auth-name').value, email: find('auth-email').value,
      password: find('auth-password').value,
    };
    const registering = mode === 'register';
    setBusy(true);
    notify(registering ? 'Creando tu cuenta…' : 'Iniciando sesión…');
    try {
      const data = registering ? await service.signUp(values) : await service.signIn(values);
      find('auth-password').value = '';
      if (data.session) {
        await syncSession(data.session);
        setMode('account');
        notify(registering ? 'Tu cuenta está lista.' : 'Has iniciado sesión.');
      } else {
        setMode('login');
        notify('Si el registro procede, recibirás un enlace de confirmación en tu correo. Revisa tu bandeja y spam; luego inicia sesión.');
      }
    } catch (error) {
      notify(authErrorMessage(error), true);
    } finally { setBusy(false); }
  });

  find('auth-logout').addEventListener('click', async () => {
    if (busy) return;
    setBusy(true);
    try {
      await service.signOut();
      await syncSession(null);
      setMode('login');
      notify('Has cerrado la sesión en este navegador.');
    } catch (error) { notify(authErrorMessage(error), true); }
    finally { setBusy(false); }
  });
  find('auth-retry-profile').addEventListener('click', async () => {
    if (!session || busy) return;
    setBusy(true);
    try { await syncSession(session); } finally { setBusy(false); }
  });
  find('account-phone').addEventListener('input',() => { phoneDirty = true; });
  phoneForm.addEventListener('submit',async event => {
    event.preventDefault();
    if (busy || !session || !profile || !phoneForm.reportValidity()) return;
    const userId = session.user.id, request = ++revision;
    setBusy(true); notify('Guardando WhatsApp…');
    try {
      const phone = await service.updateWhatsApp(find('account-phone').value);
      if (!alive || request !== revision || session?.user.id !== userId) return;
      profile = { ...profile,whatsapp_phone: phone }; phoneDirty = false;
      renderAccount(); notify(phone ? 'WhatsApp actualizado.' : 'WhatsApp retirado del perfil.');
    } catch (error) {
      if (alive && request === revision && session?.user.id === userId) notify(authErrorMessage(error),true);
    } finally { setBusy(false); }
  });

  let unsubscribe = () => {};
  try {
    unsubscribe = await service.subscribe((_event, next) => {
      // Fuera del callback de Auth para no bloquear su cerrojo con otra consulta.
      setTimeout(() => { if (alive) void syncSession(next); }, 0);
    });
  } catch (error) { notify(authErrorMessage(error), true); }
  finally { login.disabled = register.disabled = false; }
  window.addEventListener('pagehide', (event) => {
    if (!event.persisted) { alive = false; revision++; unsubscribe(); }
  });
}
