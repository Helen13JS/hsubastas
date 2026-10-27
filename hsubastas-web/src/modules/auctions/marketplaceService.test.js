import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhone, whatsappLink, validateAmount, boliviaDeadline, createMarketplaceService } from './marketplaceService.js';

test('contacto boliviano opcional: normaliza número local y rechaza enlaces/números inválidos', () => {
  assert.equal(normalizePhone('71234567'),'59171234567');
  assert.equal(normalizePhone('+591 (7) 123-4567'),'59171234567');
  assert.equal(normalizePhone(''),null);
  for (const input of ['12345678','5917123456','https://evil.test','59171234567/other']) assert.throws(() => normalizePhone(input),/INVALID_PHONE/);
  const link = new URL(whatsappLink('71234567','Obra & materiales? #1'));
  assert.equal(link.hostname,'wa.me');
  assert.equal(link.pathname,'/59171234567');
  assert.match(link.searchParams.get('text'),/Obra & materiales\? #1/);
  assert.equal(whatsappLink(null,'Test'),null);
});

test('importes monetarios: rechaza cero, negativos, no finitos y más de dos decimales', () => {
  assert.equal(validateAmount('0.01'),0.01);
  assert.equal(validateAmount('45000.50'),45000.5);
  for (const value of ['0','-1','NaN','Infinity','1.001','1e6','1000000000000']) assert.throws(() => validateAmount(value),/INVALID_AMOUNT/);
});

test('fecha de cierre se interpreta en Bolivia, valida calendario y requiere futuro', () => {
  assert.equal(boliviaDeadline('2099-01-01T10:30'),'2099-01-01T14:30:00.000Z');
  for (const value of ['2000-01-01T10:30','2099-02-30T10:30','2099-01-01','invalid']) assert.throws(() => boliviaDeadline(value),/INVALID_DEADLINE/);
});

test('publicación usa RPC validada y nunca acepta propietario/estado del formulario', async () => {
  let call;
  const service = createMarketplaceService(async () => ({rpc:async (name,args) => { call={name,args}; return {data:'auction-id',error:null}; }}));
  assert.equal(await service.publish({title:' Equipos ',description:' Diez equipos ',category:'Tecnología',city:' La Paz ',max_budget:'45000',ends_at:'2099-01-01T10:30',phone:'71234567',buyer_id:'someone-else',status:'closed'}),'auction-id');
  assert.equal(call.name,'publish_auction');
  assert.equal(call.args.p_title,'Equipos');
  assert.equal(call.args.p_whatsapp_phone,'59171234567');
  assert.ok(!('buyer_id' in call.args));
  assert.ok(!('status' in call.args));
});

test('errores de servidor se propagan; sin sesión/configuración no hay RPC', async () => {
  const failure = {code:'P0001',message:'AUTH_REQUIRED'};
  const service = createMarketplaceService(async () => ({rpc:async () => ({data:null,error:failure})}));
  await assert.rejects(service.getContact('test'),error => error === failure);
  await assert.rejects(createMarketplaceService(async () => null).getAuction('test'),/AUTH_REQUIRED/);
});
