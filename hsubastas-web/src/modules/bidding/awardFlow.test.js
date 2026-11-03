import test from 'node:test';
import assert from 'node:assert/strict';
import {awardAndContact} from './awardFlow.js';
const auction={id:'auction',title:'Lote de escritorios',city:'La Paz'};
const bid={id:'bid',provider_name:'Proveedor',offered_amount:800,whatsapp_phone:'59171234567'};
function windowDouble(){const tab={opener:{},document:{body:{}},closed:false,url:null,location:{replace(url){tab.url=url;}},close(){this.closed=true;}};return tab;}
test('la adjudicación usa el teléfono fresco del servidor y abre contacto después de guardarse',async()=>{
  const tab=windowDouble();let resolve;
  const operation=awardAndContact({service:{award:()=>new Promise(done=>{resolve=done;})},auction,bid,openWindow:()=>tab});
  assert.equal(tab.url,null);assert.equal(tab.opener,null);
  resolve({bid_id:'bid',whatsapp_phone:'59176543210'});
  const result=await operation;assert.equal(result.opened,true);
  const url=new URL(tab.url);assert.equal(url.pathname,'/59176543210');assert.match(url.searchParams.get('text'),/Oferta ganadora: bid/);
});
test('un rechazo de autorización cierra la pestaña sin abrir WhatsApp',async()=>{
  const tab=windowDouble();await assert.rejects(awardAndContact({service:{async award(){throw new Error('NOT_AUCTION_OWNER');}},auction,bid,openWindow:()=>tab}),/NOT_AUCTION_OWNER/);
  assert.equal(tab.closed,true);assert.equal(tab.url,null);
});
test('cambiar de sesión durante la adjudicación descarta el contacto y conserva el resultado guardado',async()=>{
  const tab=windowDouble();const result=await awardAndContact({service:{async award(){return {bid_id:'bid',whatsapp_phone:'59176543210'};}},auction,bid,openWindow:()=>tab,isCurrent:()=>false});
  assert.equal(result.stale,true);assert.equal(tab.closed,true);assert.equal(tab.url,null);
});
test('un bloqueo de ventanas no convierte la adjudicación en error',async()=>{
  const result=await awardAndContact({service:{async award(){return {bid_id:'bid',whatsapp_phone:'59176543210'};}},auction,bid,openWindow:()=>null});
  assert.equal(result.opened,false);assert.equal(result.result.bid_id,'bid');
});
