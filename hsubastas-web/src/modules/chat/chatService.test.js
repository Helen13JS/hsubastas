import test from 'node:test';
import assert from 'node:assert/strict';
import { createChatService, validateMessage } from './chatService.js';
test('valida mensajes vacíos, tamaño y espacios', () => {
  assert.equal(validateMessage(' Hola '), 'Hola');
  for (const value of ['', '  ', 'a'.repeat(2001)]) assert.throws(() => validateMessage(value), /INVALID_MESSAGE/);
});
test('abre canales diferentes y el servidor decide el remitente', async () => {
  const calls = [];
  const service = createChatService(async () => ({ async rpc(name, params) { calls.push({ name, params }); return { data: 'thread' }; } }));
  await service.open(); await service.open('auction'); await service.send('thread', ' Hola ');
  assert.deepEqual(calls, [
    { name: 'open_chat', params: { p_auction_id: null } },
    { name: 'open_chat', params: { p_auction_id: 'auction' } },
    { name: 'send_chat_message', params: { p_thread_id: 'thread', p_body: 'Hola' } }
  ]);
});
test('rechazo del servidor se conserva y suscripción se elimina', async () => {
  let removed = false, filter;
  const channel = { on(event, options) { filter = options; return this; }, subscribe() { return this; } };
  const service = createChatService(async () => ({ rpc: async () => ({ error: new Error('CHAT_ACCESS_DENIED') }), channel: () => channel, removeChannel: async value => { removed = value === channel; } }));
  await assert.rejects(service.open('foreign'), /CHAT_ACCESS_DENIED/);
  const stop = await service.watch('thread', () => {}); stop();
  assert.equal(removed, true); assert.equal(filter.filter, 'thread_id=eq.thread');
});
