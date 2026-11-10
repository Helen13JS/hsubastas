import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { createChatService, chatError } from '../modules/chat/chatService.js';
import ChatPanel from './ChatPanel.jsx';
const service = createChatService();
function Inbox() {
  const [threads, setThreads] = useState([]), [selected, setSelected] = useState(''), [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    async function load() { try { const data = await service.inbox(); if (active) { setThreads(data); setError(''); } } catch (failure) { if (active) setError(chatError(failure)); } }
    void load(); const timer = setInterval(load, 10000);
    return () => { active = false; clearInterval(timer); };
  }, []);
  return <><label className="chat-inbox">Bandeja de soporte<select value={selected} onChange={event => setSelected(event.target.value)}><option value="">Selecciona una conversación</option>{threads.map(thread => <option key={thread.id} value={thread.id}>{thread.customer_name} · {thread.id.slice(0,8)}</option>)}</select></label>{!threads.length && <p>Aún no hay consultas.</p>}{error && <p role="alert">{error}</p>}{selected && <ChatPanel key={selected} threadId={selected} title="Atención al cliente"/>}</>;
}
export default function SupportWidget({ openAuth }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false), [admin, setAdmin] = useState(false);
  const toggle = useRef(null), close = useRef(null);
  useEffect(() => {
    let active = true; setAdmin(false);
    if (user) void service.isAdmin().then(value => { if (active) setAdmin(value === true); }).catch(() => {});
    return () => { active = false; };
  }, [user?.id]);
  useEffect(() => { if (open) close.current?.focus(); }, [open]);
  function hide() { setOpen(false); toggle.current?.focus(); }
  return <aside className="support-widget" aria-label="Soporte HSubastas">
    {open && <section className="support-window rounded-2xl shadow-xl" role="dialog" aria-labelledby="support-title" onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); hide(); } }}>
      <header className="support-heading"><div><strong id="support-title">{admin ? 'Administración de soporte' : 'Soporte HSubastas'}</strong><small>Atención del equipo · respuestas según disponibilidad</small></div><button type="button" ref={close} onClick={hide} aria-label="Cerrar chat de soporte">×</button></header>
      <div className="support-content">{!user ? <><p>Inicia sesión para conversar con nuestro equipo y conservar tus mensajes.</p><button className="button button-dark" onClick={() => { hide(); openAuth('login'); }}>Iniciar sesión</button></> : admin ? <Inbox/> : <ChatPanel title="Conversación con soporte"/>}</div>
    </section>}
    <button type="button" ref={toggle} className="support-toggle" onClick={() => setOpen(value => !value)} aria-expanded={open} aria-label={open ? 'Cerrar soporte en línea' : 'Abrir soporte en línea'}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-3 2V11.5a10 10 0 0 1 20 0Z"/><path d="M6 11h10M6 15h7"/></svg><span>Soporte</span></button>
  </aside>;
}
