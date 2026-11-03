import test from 'node:test';
import assert from 'node:assert/strict';
import { countdown,specificationsPdf } from './specifications.js';
import { awardSummary,whatsappLink } from './marketplaceService.js';

test('cuenta regresiva incluye segundos y horas acumuladas sin valores negativos',() => {
  const now = Date.parse('2030-01-01T00:00:00Z');
  assert.equal(countdown('2030-01-02T01:02:03Z',now),'25 : 02 : 03');
  assert.equal(countdown('2030-01-01T00:00:00Z',now),'00 : 00 : 00');
  assert.equal(countdown('invalid',now),'00 : 00 : 00');
  assert.equal(countdown('2030-01-01T00:00:00.001Z',now),'00 : 00 : 01');
});

test('PDF descargable conserva datos, escapa sintaxis y apunta a offsets correctos',() => {
  const bytes = specificationsPdf({id:'test-1',title:'Lote (50) escritorios',description:'Acero \\ pintura resistente. Garantía de entrega.',city:'La Paz',category:'Insumos',max_budget:45000,ends_at:'2030-01-01T14:00:00Z'});
  const pdf = Buffer.from(bytes).toString('latin1');
  assert.ok(pdf.startsWith('%PDF-1.4'));
  assert.match(pdf,/Lote \\\(50\\\) escritorios/);
  assert.match(pdf,/Garantía de entrega/);
  const xref = Number(pdf.match(/startxref\n(\d+)/)[1]);
  assert.equal(pdf.slice(xref,xref+4),'xref');
  const entries = [...pdf.matchAll(/(\d{10}) 00000 n/g)];
  entries.forEach((entry,index) => assert.ok(pdf.slice(Number(entry[1])).startsWith(`${index+1} 0 obj`)));
});

test('descripciones largas generan múltiples páginas en el PDF',() => {
  const pdf = Buffer.from(specificationsPdf({id:'test',title:'Requerimiento',description:'Especificación detallada. '.repeat(250),max_budget:45,ends_at:'2030-01-01T14:00:00Z'})).toString('latin1');
  assert.ok(Number(pdf.match(/\/Count (\d+)/)[1]) > 1);
});

test('el enlace de adjudicación incluye resumen real de oferta e importe',() => {
  const summary = awardSummary({id:'auction-1',title:'Lote de escritorios',city:'La Paz'},{id:'bid-1',provider_name:'Proveedor A',offered_amount:39900.5});
  const url = new URL(whatsappLink('71234567','Lote',summary));
  assert.equal(url.hostname,'wa.me');
  assert.equal(url.pathname,'/59171234567');
  assert.match(url.searchParams.get('text'),/auction-1/);
  assert.match(url.searchParams.get('text'),/bid-1/);
  assert.match(url.searchParams.get('text'),/Proveedor A/);
  assert.match(url.searchParams.get('text'),/BOB/);
});
