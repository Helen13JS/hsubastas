import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('detalle protegido: no lee datos privados sin sesión, impide puja propia y oculta contacto al salir', async () => {
  const html=await readFile(new URL('../../../index.html',import.meta.url),'utf8');
  const source=(await readFile(new URL('./marketplaceUI.js',import.meta.url),'utf8'))
    .replace("import { createMarketplaceService, marketplaceError, whatsappLink } from './marketplaceService.js';",'const {createMarketplaceService,marketplaceError,whatsappLink} = globalThis.marketUITest;')
    .replace("import { createBidService } from '../bidding/bidService.js';",'const {createBidService} = globalThis.marketUITest;')
    .replace("import './marketplace.css';",'');
  const nodes=new Map();
  class Element {
    constructor(tag='div'){this.tag=tag;this.listeners={};this.children=[];this.dataset={};this.value='';this.open=false;this.hidden=false;this.elements=[];}
    addEventListener(name,fn){this.listeners[name]=fn;}
    append(...items){this.children.push(...items);}
    replaceChildren(...items){this.children=items;}
    removeAttribute(name){delete this[name];}
    click(){this.listeners.click?.();}
    showModal(){this.open=true;}
    close(){this.open=false;this.listeners.close?.();}
  }
  const get=id=>{assert.ok(html.includes(`id="${id}"`),`Missing ${id}`);if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);};
  globalThis.document={hidden:false,getElementById:get,createElement:tag=>new Element(tag),addEventListener(){}};
  const windowEvents={};
  const popups=[];
  globalThis.window={addEventListener(name,fn){windowEvents[name]=fn;},open(url){
    assert.equal(url,'about:blank');
    const popup={opener:window,closed:false,document:{body:{}},url:null,location:{replace(value){popup.url=value;}},close(){this.closed=true;}};
    popups.push(popup);return popup;
  }};
  const row={id:'a',title:'Test',description:'Text',category:'Test',city:'Test',max_budget:100,ends_at:'2099-01-01T00:00:00Z',status:'active',buyer_id:'owner'};
  let auth,privateReads=0,logins=0,awardCalls=0,rejectAward=true;
  get('auth-open-login').addEventListener('click',()=>logins++);
  globalThis.marketUITest={
    createMarketplaceService:()=>({
      async subscribeAuth(fn){auth=fn;return ()=>{};},
      async getAuction(){return row;},
      async getContact(){privateReads++;return '59171234567';},
    }),
    createBidService:()=>({async list(){privateReads++;return [{id:'bid1',provider_name:'Proveedor A',whatsapp_phone:'59171234567',offered_amount:80,created_at:'2099-01-01T00:00:00Z'},{id:'bid2',whatsapp_phone:'59171234567',offered_amount:90,created_at:'2099-01-01T00:00:00Z'}];},async award(id,bidId){assert.equal(id,'a');assert.equal(bidId,'bid2');awardCalls++;if(rejectAward)throw new Error('NOT_AUCTION_OWNER');row.awarded_bid_id=bidId;row.awarded_at='2099-01-01T01:00:00Z';row.status='closed';return {bid_id:bidId,whatsapp_phone:'59176543210'};}}),
    marketplaceError:()=> 'error',whatsappLink:phone=> `https://wa.me/${phone}`,
  };
  const {initMarketplace}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  const ui=initMarketplace();
  const settle=()=>new Promise(resolve=>setTimeout(resolve,10));
  try {
    get('publish-open').click();
    assert.equal(logins,1);
    assert.equal(get('publish-dialog').open,false);
    ui.showDetails(row);await settle();
    assert.equal(privateReads,0);
    assert.equal(get('bid-form').hidden,true);
    auth('SIGNED_IN',{user:{id:'owner'}});await settle();
    assert.equal(get('bid-form').hidden,true);
    assert.equal(get('auction-whatsapp').hidden,true);
    assert.equal(get('bid-list').children.length,2);
    const firstActions=get('bid-list').children[0].children[1];
    assert.match(firstActions.children[0].textContent,/proveedor/);
    assert.equal(firstActions.children[0].href,'https://wa.me/59171234567');
    auth('SIGNED_IN',{user:{id:'provider'}});await settle();
    assert.equal(get('bid-form').hidden,false);
    assert.equal(get('bid-amount').max,'79.99');
    assert.equal(get('auction-whatsapp').hidden,false);
    assert.ok(get('bid-list').children.every(item => item.children[1].children.every(action => action.tag !== 'button')));
    auth('SIGNED_IN',{user:{id:'owner'}});await settle();
    const choose=()=>get('bid-list').children[1].children[1].children.find(action => action.textContent.includes('Adjudic') || action.textContent.includes('Confirmar'));
    choose().click(); assert.equal(awardCalls,0);assert.equal(popups.length,0);
    assert.match(choose().textContent,/Confirmar/);
    choose().click();assert.equal(popups[0].url,null);await settle();
    assert.equal(awardCalls,1);
    assert.equal(popups[0].closed,true);
    assert.equal(popups[0].url,null);
    assert.equal(row.awarded_bid_id,undefined);
    rejectAward=false;
    choose().click();assert.equal(popups[1].url,null);await settle();
    assert.equal(awardCalls,2);
    assert.equal(popups[1].opener,null);
    assert.equal(popups[1].url,'https://wa.me/59176543210');
    assert.equal(get('bid-list').children[1].className,'winning-offer');
    assert.equal(get('bid-form').hidden,true);
    get('publish-open').click();
    assert.equal(get('publish-dialog').open,true);
    auth('SIGNED_OUT',null);await settle();
    assert.equal(get('publish-dialog').open,false);
    assert.equal(get('bid-form').hidden,true);
    assert.equal(get('bid-list').children.length,0);
    assert.equal(get('auction-whatsapp').hidden,true);
    assert.equal(get('auction-whatsapp').href,undefined);
  } finally {windowEvents.pagehide({persisted:false});}
});
