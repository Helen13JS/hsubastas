// Ficha PDF generada con los datos publicados, sin depender de servicios externos.
export function countdown(endsAt, now = Date.now()) {
  const end = new Date(endsAt).getTime();
  if (!Number.isFinite(end) || end <= now) return '00 : 00 : 00';
  const seconds = Math.ceil((end - now) / 1000);
  const part = number => String(number).padStart(2,'0');
  return `${part(Math.floor(seconds / 3600))} : ${part(Math.floor(seconds % 3600 / 60))} : ${part(seconds % 60)}`;
}

function pdfText(text) {
  return String(text).replace(/[\r\n\t]/g,' ').replace(/[^\x20-\xFF]/g,'?').replace(/[\\()]/g,'\\$&');
}
function wrap(text, width = 88) {
  const lines = [];
  for (const paragraph of String(text).split(/\r?\n/)) {
    let line = '';
    for (const word of paragraph.split(/\s+/)) {
      for (let index = 0; index < word.length; index += width) {
        const piece = word.slice(index,index+width);
        if (line.length + piece.length + 1 > width) { lines.push(line); line = ''; }
        line += (line ? ' ' : '') + piece;
      }
    }
    lines.push(line);
  }
  return lines;
}

export function specificationsPdf(auction) {
  const budget = new Intl.NumberFormat('es-BO',{minimumFractionDigits:2,maximumFractionDigits:2}).format(auction.max_budget);
  const deadline = new Intl.DateTimeFormat('es-BO',{dateStyle:'medium',timeStyle:'short',timeZone:'America/La_Paz'}).format(new Date(auction.ends_at));
  const lines = [
    'HSUBASTAS | ESPECIFICACIONES TECNICAS', 'hsubastas.com.bo', '',
    ...wrap(`Lote: ${auction.title}`), ...wrap(`Referencia: ${auction.id}`),
    `Ubicacion: ${auction.city || 'No especificada'}, Bolivia`,
    `Categoria: ${auction.category || 'Sin categoria'}`, `Presupuesto maximo base: ${budget} BOB`,
    `Cierre (Bolivia): ${deadline}`, '', 'DESCRIPCION Y CONDICIONES PUBLICADAS',
    ...wrap(auction.description || 'Sin descripcion.'), '',
    'Ficha generada a partir del requerimiento publicado en HSubastas.',
  ];
  const pages = [];
  for (let index = 0; index < lines.length; index += 46) pages.push(lines.slice(index,index+46));
  const objects = [];
  const add = value => { objects.push(value); return objects.length; };
  add('<< /Type /Catalog /Pages 2 0 R >>'); add('');
  const font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const pageIds = [];
  for (const [index,pageLines] of pages.entries()) {
    const stream = `BT /F1 11 Tf 15 TL 45 800 Td\n${[...pageLines, '', `Pagina ${index+1} de ${pages.length}`].map(line => `(${pdfText(line)}) Tj T*`).join('\n')}\nET`;
    const content = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    pageIds.push(add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${content} 0 R >>`));
  }
  objects[1] = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;
  let document = '%PDF-1.4\n';
  const offsets = [0];
  for (const [index,object] of objects.entries()) {
    offsets.push(document.length); document += `${index+1} 0 obj\n${object}\nendobj\n`;
  }
  const xref = document.length;
  document += `xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Uint8Array(Array.from(document, character => character.charCodeAt(0)));
}

export function attachSpecifications(link, auction) {
  link.href = '#'; link.download = 'Descargar_Especificaciones_Tecnicas.pdf';
  const download = () => {
    const url = URL.createObjectURL(new Blob([specificationsPdf(auction)],{type:'application/pdf'}));
    link.href = url;
    setTimeout(() => URL.revokeObjectURL(url),60000);
  };
  link.addEventListener('click',download);
  return () => link.removeEventListener('click',download);
}
