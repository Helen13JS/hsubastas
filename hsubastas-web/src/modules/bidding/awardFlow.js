import { awardSummary,whatsappLink } from '../auctions/marketplaceService.js';

export async function awardAndContact({ service,auction,bid,openWindow,isCurrent=()=>true }) {
  let popup=null;
  const close=()=>{try{popup?.close();}catch{ /* Cerrada por el usuario. */ }};
  if(bid.whatsapp_phone){try{popup=openWindow('about:blank','_blank');if(popup){popup.opener=null;if(popup.document?.body)popup.document.body.textContent='Registrando adjudicación en HSubastas…';}}catch{popup=null;}}
  try{
    const result=await service.award(auction.id,bid.id);
    if(!isCurrent()){close();return {result,opened:false,stale:true};}
    let opened=false;
    if(result?.whatsapp_phone){try{const url=whatsappLink(result.whatsapp_phone,auction.title,awardSummary(auction,bid));if(popup&&!popup.closed&&url){popup.location.replace(url);opened=true;}}catch{ /* Queda disponible el enlace manual. */ }}
    if(!opened)close();
    return {result,opened,stale:false};
  }catch(error){close();throw error;}
}
