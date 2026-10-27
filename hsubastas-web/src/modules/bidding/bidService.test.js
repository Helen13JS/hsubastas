import test from 'node:test';
import assert from 'node:assert/strict';
import { createBidService } from './bidService.js';

test('listado usa RPC que autoriza contactos y ordena por precio en el servidor', async () => {
  const expected=[{id:'a',offered_amount:12},{id:'b',offered_amount:15}];
  const service=createBidService(async () => ({async rpc(name,args){
    assert.equal(name,'list_auction_offers'); assert.deepEqual(args,{p_auction_id:'auction'});
    return {data:expected,error:null};
  }}));
  assert.deepEqual(await service.list('auction'),expected);
});

test('puja usa función transaccional sin permitir elegir provider_id', async () => {
  const service=createBidService(async () => ({rpc:async (name,args) => {
    assert.equal(name,'submit_bid');
    assert.deepEqual(args,{p_auction_id:'auction',p_amount:12.5});
    return {data:'bid-id',error:null};
  }}));
  assert.equal(await service.submit('auction','12.50'),'bid-id');
});

test('adjudicación envía solo requerimiento y puja, conserva rechazos de autorización', async () => {
  let failure = null;
  const service = createBidService(async () => ({async rpc(name,args){
    assert.equal(name,'award_bid_with_contact'); assert.deepEqual(args,{p_auction_id:'auction',p_bid_id:'winner'});
    return {data:failure ? null : {bid_id:'winner',whatsapp_phone:'59176543210'},error:failure};
  }}));
  assert.deepEqual(await service.award('auction','winner'),{bid_id:'winner',whatsapp_phone:'59176543210'});
  for (const message of ['NOT_AUCTION_OWNER','ALREADY_AWARDED','INVALID_WINNER']) {
    failure = {message}; await assert.rejects(service.award('auction','winner'),error => error.message === message);
  }
});

test('rechazo del servidor por precio concurrente o subasta propia se conserva', async () => {
  for(const message of ['BID_TOO_HIGH','OWN_AUCTION','AUCTION_CLOSED']) {
    const service=createBidService(async () => ({rpc:async () => ({data:null,error:{code:'P0001',message}})}));
    await assert.rejects(service.submit('auction','12'),error => error.message===message);
  }
});
