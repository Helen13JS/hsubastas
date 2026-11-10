import { getSupabaseClient } from '../../js/supabaseClient.js';
export function validateMessage(body) {
  const value = String(body ?? '').trim();
  if (!value || value.length > 2000) throw new Error('INVALID_MESSAGE');
  return value;
}
export function chatError(error) {
  if (error?.message === 'CHAT_RATE_LIMIT') return 'Espera un momento antes de enviar otro mensaje.';
  if (error?.message === 'INVALID_MESSAGE') return 'Escribe entre 1 y 2000 caracteres.';
  if (error?.message === 'CHAT_ACCESS_DENIED') return 'No tienes acceso a esta conversación.';
  return 'No se pudo conectar al chat. Reintenta en unos momentos.';
}
export function createChatService(getClient = getSupabaseClient) {
  async function client() { const value = await getClient(); if (!value) throw new Error('AUTH_REQUIRED'); return value; }
  async function rpc(name, params) { const { data, error } = await (await client()).rpc(name, params); if (error) throw error; return data; }
  return {
    open: auctionId => rpc('open_chat', { p_auction_id: auctionId || null }),
    isAdmin: () => rpc('is_platform_admin'),
    inbox: () => rpc('list_support_chats'),
    send: (id, body) => rpc('send_chat_message', { p_thread_id: id, p_body: validateMessage(body) }),
    async list(id) {
      const { data, error } = await (await client()).from('chat_messages').select('id,sender_id,body,created_at')
        .eq('thread_id', id).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(200);
      if (error) throw error; return (data || []).reverse();
    },
    async watch(id, onChange, onStatus = () => {}) {
      const connection = await client();
      const channel = connection.channel(`chat:${id}:${globalThis.crypto.randomUUID()}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `thread_id=eq.${id}` }, onChange)
        .subscribe(onStatus);
      return () => { void connection.removeChannel(channel); };
    }
  };
}
