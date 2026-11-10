import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { createChatService, chatError } from '../modules/chat/chatService.js';
const service = createChatService();
export default function ChatPanel({ auctionId, threadId, title = 'Mensajería privada' }) {
  const { user } = useAuth();
  const [thread, setThread] = useState(null), [messages, setMessages] = useState([]), [body, setBody] = useState('');
  const [error, setError] = useState(''), [sending, setSending] = useState(false), [connected, setConnected] = useState(false);
  const alive = useRef(true), end = useRef(null);
  useEffect(() => {
    alive.current = true; let active = true, stop = () => {}, timer, loading = false;
    setThread(null); setMessages([]); setBody(''); setError(''); setConnected(false);
    async function refresh(id) {
      if (loading) return; loading = true;
      try { const rows = await service.list(id); if (active) { setMessages(rows); setError(''); } }
      catch (failure) { if (active) setError(chatError(failure)); }
      finally { loading = false; }
    }
    async function init() {
      try {
        const id = threadId || await service.open(auctionId);
        if (!active) return; setThread(id); await refresh(id);
        if (active) timer = setInterval(() => { if (!document.hidden) void refresh(id); }, 5000);
        try {
          const cleanup = await service.watch(id, () => { void refresh(id); }, status => { if (active) setConnected(status === 'SUBSCRIBED'); });
          if (active) stop = cleanup; else cleanup();
        } catch { if (active) setConnected(false); }
      } catch (failure) { if (active) setError(chatError(failure)); }
    }
    if (user) void init();
    return () => { active = false; alive.current = false; stop(); clearInterval(timer); };
  }, [auctionId, threadId, user?.id]);
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }); }, [messages.length]);
  async function send(event) {
    event.preventDefault(); if (sending || !thread) return; setSending(true); setError('');
    try {
      await service.send(thread, body);
      if (alive.current) setBody('');
      const rows = await service.list(thread);
      if (alive.current) setMessages(rows);
    } catch (failure) { if (alive.current) setError(chatError(failure)); }
    finally { if (alive.current) setSending(false); }
  }
  return <section className="chat-panel" aria-label={title}>
    <div className="flex flex-wrap items-center justify-between gap-2"><strong>{title}</strong><small>{connected ? 'En vivo' : 'Actualización periódica'}</small></div>
    <p className="chat-privacy">Solo los participantes autorizados pueden leer y enviar mensajes. No compartas contraseñas ni datos de tarjetas.</p>
    <div className="chat-messages" role="log" aria-label="Mensajes de la conversación" aria-live="polite" aria-relevant="additions text">
      {!messages.length && <p>{thread ? 'Escribe el primer mensaje.' : 'Conectando al chat…'}</p>}
      {messages.length === 200 && <small>Mostrando los últimos 200 mensajes.</small>}
      {messages.map(message => <article key={message.id} className={`chat-bubble ${message.sender_id === user?.id ? 'chat-bubble-own' : ''}`}>
        <small>{message.sender_id === user?.id ? 'Tú' : auctionId ? 'Contraparte' : 'Atención al cliente / usuario'}</small>
        <p>{message.body}</p><time dateTime={message.created_at}>{new Intl.DateTimeFormat('es-BO', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/La_Paz' }).format(new Date(message.created_at))}</time>
      </article>)}<span ref={end}/>
    </div>
    {error && <p role="alert" className="market-status error">{error}</p>}
    <form onSubmit={send} className="chat-compose"><label className="sr-only" htmlFor={`message-${thread || auctionId || 'support'}`}>Escribe un mensaje</label><textarea id={`message-${thread || auctionId || 'support'}`} value={body} onChange={event => setBody(event.target.value)} maxLength={2000} rows={2} required placeholder="Escribe tu mensaje…" disabled={!thread || sending}/><button type="submit" className="button button-dark" disabled={!thread || sending || !body.trim()}>{sending ? 'Enviando…' : 'Enviar'}</button></form>
  </section>;
}
