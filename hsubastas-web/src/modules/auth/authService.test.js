import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuthService, authErrorMessage } from './authService.js';

test('registro unificado: solo nombre en metadatos, sin elegir rol ni escribir perfil desde cliente', async () => {
  globalThis.window = { location: { origin: 'http://127.0.0.1:5174' } };
  let payload;
  const service = createAuthService(async () => ({ auth: { signUp: async (input) => {
    payload = input;
    return { data: { user: { id: 'new-user' }, session: null }, error: null };
  } } }));
  const result = await service.signUp({ name: ' Ana ', email: ' ana@example.com ', password: 'test-password' });
  assert.equal(result.session, null);
  assert.equal(payload.email, 'ana@example.com');
  assert.deepEqual(payload.options.data, { name: 'Ana' });
  assert.equal(payload.options.emailRedirectTo, 'http://127.0.0.1:5174/');
});

test('rechaza nombres vacíos o demasiado largos antes de llamar Auth', async () => {
  const service = createAuthService(async () => { assert.fail('Auth no debe llamarse'); });
  for (const values of [{ name: 'a'.repeat(101) }, { name: ' ' }]) {
    await assert.rejects(service.signUp(values), { code: 'invalid_registration' });
  }
});

test('login conserva contraseña exacta y propaga errores de credenciales', async () => {
  const failure = { code: 'invalid_credentials' };
  const service = createAuthService(async () => ({ auth: { signInWithPassword: async (input) => {
    assert.deepEqual(input, { email: 'ana@example.com', password: ' password ' });
    return { data: null, error: failure };
  } } }));
  await assert.rejects(service.signIn({ email: ' ana@example.com ', password: ' password ' }), error => error === failure);
  assert.match(authErrorMessage(failure), /correo/);
});

test('lectura de perfil se limita al UUID del usuario y distingue perfil ausente', async () => {
  const profile = { id: 'user-1', name: 'Ana', email: 'ana@example.com', role: 'user' };
  let result = { data: profile, error: null };
  const service = createAuthService(async () => ({ from(table) {
    assert.equal(table, 'users');
    return { select(fields) {
      assert.equal(fields, 'id,name,email,role,whatsapp_phone');
      return { eq(field, value) {
        assert.equal(field, 'id'); assert.equal(value, 'user-1');
        return { maybeSingle: async () => result };
      } };
    } };
  } }));
  assert.deepEqual(await service.getProfile('user-1'), profile);
  result = { data: null, error: null };
  await assert.rejects(service.getProfile('user-1'), { code: 'missing_profile' });
});

test('eventos de sesión y limpieza de suscripción; logout local', async () => {
  let listener;
  let unsubscribed = false;
  let eventSeen;
  const service = createAuthService(async () => ({ auth: {
    onAuthStateChange(callback) {
      listener = callback;
      return { data: { subscription: { unsubscribe() { unsubscribed = true; } } } };
    },
    async signOut(options) { assert.deepEqual(options, { scope: 'local' }); return { error: null }; },
  } }));
  const stop = await service.subscribe((event, session) => { eventSeen = [event, session]; });
  listener('SIGNED_OUT', null);
  assert.deepEqual(eventSeen, ['SIGNED_OUT', null]);
  await service.signOut(); stop();
  assert.equal(unsubscribed, true);
});

test('sin configuración no intenta autenticar', async () => {
  await assert.rejects(createAuthService(async () => null).signIn({ email: 'a@b.com', password: 'test' }), { code: 'missing_config' });
});

test('WhatsApp del perfil: normaliza, permite retirar y no acepta un UUID ajeno', async () => {
  const values=[];
  const service=createAuthService(async () => ({async rpc(name,args){
    assert.equal(name,'update_my_whatsapp');
    assert.deepEqual(Object.keys(args),['p_phone']);
    values.push(args.p_phone);return {data:args.p_phone,error:null};
  }}));
  assert.equal(await service.updateWhatsApp('+591 7654-3210'),'59176543210');
  assert.equal(await service.updateWhatsApp(''),null);
  await assert.rejects(service.updateWhatsApp('123'),/INVALID_PHONE/);
  assert.deepEqual(values,['59176543210',null]);
});
