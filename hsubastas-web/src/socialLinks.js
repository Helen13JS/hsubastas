import {normalizePhone} from './modules/auctions/marketplaceService.js';
function httpsLink(value,hosts){try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&hosts.includes(url.hostname)?url.href:null;}catch{return null;}}
export function getSocialLinks(env=import.meta.env??{}){
  let whatsapp=null;try{const phone=normalizePhone(env.VITE_CONTACT_WHATSAPP?.trim()||'59168647272');if(phone)whatsapp=`https://wa.me/${phone}`;}catch{/* Canal no válido. */}
  return [
    {id:'whatsapp',label:'WhatsApp',href:whatsapp},
    {id:'facebook',label:'Facebook',href:httpsLink(env.VITE_FACEBOOK_URL?.trim()||'https://www.facebook.com/profile.php?id=61595687231821',['facebook.com','www.facebook.com','m.facebook.com'])},
    {id:'instagram',label:'Instagram',href:httpsLink(env.VITE_INSTAGRAM_URL?.trim()||'https://www.instagram.com/hsubastas/',['instagram.com','www.instagram.com'])},
    {id:'youtube',label:'YouTube',href:httpsLink(env.VITE_YOUTUBE_URL?.trim()||'https://youtube.com/@hsubastas?si=_gJEVwMvPjuUFwO3',['youtube.com','www.youtube.com','youtu.be'])},
    {id:'telegram',label:'Telegram',href:httpsLink(env.VITE_TELEGRAM_URL?.trim()||'',['t.me','telegram.me'])},
  ];
}
