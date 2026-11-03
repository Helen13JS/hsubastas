import React from 'react';
export default function SocialIcon({channel}){
  const common={viewBox:'0 0 24 24','aria-hidden':true};
  if(channel==='instagram')return <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>;
  if(channel==='youtube')return <svg {...common} fill="currentColor"><path d="M22.5 7s-.2-1.6-.9-2.3c-.9-.9-1.9-.9-2.4-1C15.9 3.5 12 3.5 12 3.5s-3.9 0-7.2.2c-.5.1-1.5.1-2.4 1C1.7 5.4 1.5 7 1.5 7S1.3 8.9 1.3 10.8v2.3c0 1.9.2 3.8.2 3.8s.2 1.6.9 2.3c.9.9 2.1.9 2.6 1 1.9.2 7 .3 7 .3s3.9 0 7.2-.3c.5 0 1.5-.1 2.4-1 .7-.7.9-2.3.9-2.3s.2-1.9.2-3.8v-2.3c0-1.9-.2-3.8-.2-3.8ZM9.8 16V8l6.8 4-6.8 4Z"/></svg>;
  if(channel==='telegram')return <svg {...common} fill="currentColor"><path d="m21.5 3.3-3.3 17.2c-.2 1.2-.9 1.4-1.8.9l-5-3.7L9 20c-.3.3-.5.5-1 .5l.4-5.1 9.4-8.5c.4-.4-.1-.6-.6-.2L5.6 14l-5-1.6c-1.1-.3-1.1-1.1.2-1.6L20.3 3c.9-.3 1.6.2 1.2.3Z"/></svg>;
  if(channel==='facebook')return <svg {...common} fill="currentColor"><path d="M14.1 22v-9.1h3.1l.5-3.6h-3.6V7c0-1 .3-1.7 1.8-1.7h1.9V2.1c-.3 0-1.5-.1-2.8-.1-2.8 0-4.7 1.7-4.7 4.9v2.4H7.2v3.6h3.1V22h3.8Z"/></svg>;
  return <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M20.2 3.8A10.8 10.8 0 0 0 3 16.6L1.5 22.5l6-1.5a10.8 10.8 0 0 0 12.7-17.2Z"/><path d="M8 6.5c-.6 0-1.5 1.2-1.5 2.4 0 3.2 5.1 8.1 8.4 8.1 1.2 0 2.7-1 2.7-1.7l-2.8-1.6-1.2 1.1c-1.7-.7-3.1-2.1-3.9-3.8l1.1-1.2L9.2 6.5H8Z"/></svg>;
}
