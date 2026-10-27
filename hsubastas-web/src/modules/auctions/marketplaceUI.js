import { createMarketplaceService, marketplaceError, whatsappLink } from './marketplaceService.js';
import { createBidService } from '../bidding/bidService.js';
import './marketplace.css';

export function initMarketplace({ demo = false, onPublished = () => {}, onSessionChange = () => {} } = {}) {
  const service = createMarketplaceService();
  const bids = createBidService();
  const find = id => document.getElementById(id);
  const dialog = find('auction-dialog');
  const publishDialog = find('publish-dialog');
  const publishForm = find('publish-form');
  const bidForm = find('bid-form');
  const money = new Intl.NumberFormat('es-BO', { style:'currency',currency:'BOB',minimumFractionDigits:2 });
  const date = new Intl.DateTimeFormat('es-BO', {dateStyle:'medium',timeStyle:'short',timeZone:'America/La_Paz'});
  let user = null, auction = null, readRevision = 0;
  let publishing = false, bidding = false, disposed = false;
  let offersCache = [], buyerPhone = null, pendingAward = null, awarding = false;
  let unsubscribe = () => {};

  function node(tag, text) { const item = document.createElement(tag); item.textContent = text; return item; }
  function notify(id, text = '', error = false) {
    const target = find(id); target.textContent = text; target.hidden = !text; target.dataset.error = String(error);
  }
  function login() {
    if (dialog.open) dialog.close();
    if (publishDialog.open) publishDialog.close();
    find('auth-open-login').click();
  }
  function paintAuction() {
    find('dialog-title').textContent = auction.title;
    find('dialog-description').textContent = auction.description || '';
    const facts = find('dialog-facts'); facts.replaceChildren();
    for (const [label,value] of [['Presupuesto máximo',money.format(auction.max_budget)],['Categoría',auction.category || 'Sin categoría'],['Ciudad',auction.city || 'No especificada'],['Cierre (Bolivia)',date.format(new Date(auction.ends_at))]]) {
      facts.append(node('dt',label),node('dd',value));
    }
    if (auction.awarded_bid_id) facts.append(node('dt','Resultado'),node('dd',`Oferta adjudicada${auction.awarded_at ? ` · ${date.format(new Date(auction.awarded_at))}` : ''}`));
  }
  function clearPrivateDetails() {
    find('bid-list').replaceChildren();
    offersCache = []; buyerPhone = null;
    find('auction-whatsapp').hidden = true;
    find('auction-whatsapp').removeAttribute('href');
    bidForm.hidden = true;
    find('detail-login').hidden = Boolean(user) || demo;
  }
  function paintParticipation(best) {
    const closed = auction.status !== 'active' || new Date(auction.ends_at) <= new Date();
    const owner = Boolean(user && user.id === auction.buyer_id);
    bidForm.hidden = demo || !user || owner || closed;
    find('detail-login').hidden = demo || Boolean(user);
    find('bid-help').textContent = demo ? 'Ejemplo ilustrativo. Las ofertas requieren una subasta real.'
      : !user ? 'Inicia sesión para ver las ofertas y participar.'
      : auction.awarded_bid_id ? 'Este requerimiento tiene una oferta ganadora. Las pujas están cerradas.'
      : closed ? 'El plazo de ofertas ha terminado. El comprador puede adjudicar una oferta recibida.' : owner ? 'Este es tu requerimiento. Compara las ofertas y adjudica la que elijas.'
      : `Ofrece menos de ${money.format(best ?? auction.max_budget)}. Cada nueva oferta debe mejorar el precio vigente.`;
    // El servidor vuelve a comprobar este límite con bloqueo transaccional.
    find('bid-amount').max = Math.max(0, Number(best ?? auction.max_budget) - 0.01).toFixed(2);
    find('bid-submit').disabled = bidding || Number(best ?? auction.max_budget) <= 0.01;
  }
  function renderOffers() {
    const list = find('bid-list'); list.replaceChildren();
    const owner = Boolean(user && user.id === auction.buyer_id);
    for (const [index,bid] of offersCache.entries()) {
      const item = document.createElement('li');
      const winner = Boolean(auction.awarded_bid_id && auction.awarded_bid_id === bid.id);
      if (winner) item.className = 'winning-offer';
      const summary = node('div',''); summary.className = 'offer-summary';
      const label = node('span',`${winner ? '✓ Oferta adjudicada' : index === 0 ? 'Mejor precio' : `Oferta ${index + 1}`} · ${bid.provider_name || 'Proveedor'}`);
      label.append(node('small',date.format(new Date(bid.created_at))));
      summary.append(label,node('strong',money.format(bid.offered_amount)));
      const actions = node('div',''); actions.className = 'offer-actions';
      const phone = owner ? bid.whatsapp_phone : buyerPhone;
      if (phone) {
        try {
          const link = node('a',owner ? 'WhatsApp del proveedor ↗' : 'WhatsApp del comprador ↗');
          link.href = whatsappLink(phone,auction.title); link.target = '_blank'; link.rel = 'noopener noreferrer'; link.className = 'button whatsapp-button';
          actions.append(link);
        } catch { actions.append(node('small','Contacto no válido')); }
      } else actions.append(node('small',owner ? 'El proveedor no registró WhatsApp en Mi cuenta.' : 'El comprador no agregó WhatsApp.'));
      if (owner && !auction.awarded_bid_id && auction.status === 'active') {
        const selecting = pendingAward === bid.id;
        const button = node('button',awarding && selecting ? 'Adjudicando…' : selecting ? bid.whatsapp_phone ? 'Confirmar y abrir WhatsApp' : 'Confirmar adjudicación' : bid.whatsapp_phone ? 'Adjudicar / Contactar por WhatsApp' : 'Adjudicar esta oferta');
        button.type = 'button'; button.className = 'button button-dark'; button.disabled = awarding;
        button.addEventListener('click',() => {
          if (awarding) return;
          if (pendingAward === bid.id) { void awardOffer(bid); return; }
          pendingAward = bid.id;
          notify('bid-status',`Vas a adjudicar ${money.format(bid.offered_amount)}. Confirma para cerrar las pujas${bid.whatsapp_phone ? ' y abrir el WhatsApp registrado en el perfil del proveedor' : '. El proveedor todavía no registró WhatsApp'}.`);
          renderOffers();
        });
        actions.append(button);
        if (selecting && !awarding) {
          const cancel = node('button','Cancelar'); cancel.type = 'button'; cancel.className = 'text-link';
          cancel.addEventListener('click',() => { pendingAward = null; notify('bid-status'); renderOffers(); }); actions.append(cancel);
        }
      }
      item.append(summary,actions); list.append(item);
    }
    if (!offersCache.length) list.append(node('li','Todavía no hay ofertas.'));
  }
  async function awardOffer(bid) {
    const id = auction.id, userId = user?.id;
    let contactWindow = null;
    // Abrir en el gesto de confirmación evita perder la activación del navegador
    // durante la RPC. El contacto se abre únicamente si la adjudicación se guarda.
    if (bid.whatsapp_phone) {
      try {
        contactWindow = window.open('about:blank','_blank');
        if (contactWindow) {
          contactWindow.opener = null;
          if (contactWindow.document?.body) contactWindow.document.body.textContent = 'Registrando adjudicación en HSubastas…';
        }
      } catch { contactWindow = null; }
    }
    const closeContact = () => { try { contactWindow?.close(); } catch { /* Ventana cerrada. */ } };
    awarding = true; renderOffers();
    try {
      const result = await bids.award(id,bid.id);
      if (disposed || auction?.id !== id || user?.id !== userId || !dialog.open) { closeContact(); return; }
      let opened = false;
      if (result?.whatsapp_phone) {
        try {
          const url = whatsappLink(result.whatsapp_phone,auction.title);
          if (contactWindow && !contactWindow.closed) { contactWindow.location.replace(url); opened = true; }
        } catch { /* El enlace de la oferta permite reintentar el contacto. */ }
      }
      if (!opened) closeContact();
      pendingAward = null;
      await loadDetail();
      notify('bid-status',`Adjudicación registrada. Las pujas están cerradas. ${opened ? 'Se abrió WhatsApp del proveedor.' : result?.whatsapp_phone ? 'Usa WhatsApp del proveedor en la oferta para abrir el contacto.' : 'El proveedor no tiene WhatsApp registrado en su perfil.'}`);
      try { await onPublished(); } catch { /* El resultado ya está registrado. */ }
    } catch (error) {
      closeContact();
      if (auction?.id !== id || user?.id !== userId || !dialog.open) return;
      await loadDetail(); notify('bid-status',marketplaceError(error),true);
    } finally { awarding = false; if (dialog.open && auction?.id === id) renderOffers(); }
  }
  async function loadDetail() {
    if (!auction || !dialog.open || demo) return;
    const revision = ++readRevision, id = auction.id, userId = user?.id;
    const current = () => !disposed && revision === readRevision && dialog.open && userId === user?.id;
    try {
      const fresh = await service.getAuction(id);
      if (!current()) return;
      auction = fresh; paintAuction(); clearPrivateDetails(); paintParticipation();
      find('contact-help').textContent = user ? 'Consultando contacto…' : 'Inicia sesión para consultar el contacto por WhatsApp.';
      if (!user) return;
      const [offers,contact] = await Promise.allSettled([bids.list(id),service.getContact(id)]);
      if (!current()) return;
      if (offers.status === 'fulfilled') {
        offersCache = offers.value;
        paintParticipation(offers.value[0]?.offered_amount);
      } else {
        bidForm.hidden = true;
        notify('bid-status',marketplaceError(offers.reason),true);
      }
      const phone = contact.status === 'fulfilled' ? contact.value : null;
      buyerPhone = phone;
      if (phone && user.id !== auction.buyer_id) {
        try {
          find('auction-whatsapp').href = whatsappLink(phone,auction.title);
          find('auction-whatsapp').hidden = false;
          find('contact-help').textContent = 'Abre WhatsApp para conversar con el comprador. El mensaje solo se envía cuando tú lo confirmes.';
        } catch { find('contact-help').textContent = 'El contacto no tiene un número válido.'; }
      } else find('contact-help').textContent = user.id === auction.buyer_id ? 'Contacta a cada proveedor desde su oferta. Puedes adjudicar cualquier oferta válida; no necesariamente la de menor precio.' : contact.status === 'rejected' ? marketplaceError(contact.reason) : 'El comprador no ha agregado un WhatsApp a este requerimiento.';
      if (offers.status === 'fulfilled') renderOffers();
    } catch (error) {
      if (!current()) return;
      clearPrivateDetails();
      find('bid-help').textContent = 'No se pudo verificar si el requerimiento sigue disponible.';
      find('contact-help').textContent = '';
      notify('bid-status',marketplaceError(error),true);
    }
  }

  function showDetails(value) {
    readRevision++; auction = value; pendingAward = null;
    paintAuction(); clearPrivateDetails(); paintParticipation();
    if (!demo) bidForm.hidden = true; // Esperar la verificación del requerimiento real.
    find('contact-help').textContent = demo ? 'Los ejemplos no incluyen contacto real.' : '';
    notify('bid-status'); find('bid-amount').value = '';
    if (!dialog.open) dialog.showModal();
    void loadDetail();
  }

  find('publish-open').addEventListener('click', () => {
    if (!user) { login(); return; }
    notify('publish-status');
    if (!publishDialog.open) publishDialog.showModal();
  });
  find('publish-close').addEventListener('click', () => publishDialog.close());
  find('detail-login').addEventListener('click', login);
  dialog.addEventListener('close', () => { readRevision++; clearPrivateDetails(); });
  publishForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (publishing || !publishForm.reportValidity()) return;
    if (!user) { login(); return; }
    const values = Object.fromEntries(new FormData(publishForm));
    publishing = true;
    for (const control of publishForm.elements) control.disabled = true;
    notify('publish-status','Publicando requerimiento…');
    try {
      const id = await service.publish(values);
      publishForm.reset();
      notify('publish-status','Requerimiento publicado. Ya aparece en el catálogo.');
      // Actualizar el catálogo no convierte un fallo posterior de lectura en fallo de publicación.
      try { await onPublished(); } catch { /* El catálogo gestiona su propio error. */ }
      try {
        const fresh = await service.getAuction(id);
        if (publishDialog.open) { publishDialog.close(); showDetails(fresh); }
      } catch { notify('publish-status','Se publicó correctamente. Actualiza el catálogo para abrir el detalle.'); }
    } catch (error) { notify('publish-status',marketplaceError(error),true); }
    finally {
      publishing = false;
      for (const control of publishForm.elements) control.disabled = false;
    }
  });
  bidForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (bidding || !bidForm.reportValidity() || !auction) return;
    if (!user) { login(); return; }
    const id = auction.id, userId = user.id;
    bidding = true; find('bid-submit').disabled = true;
    notify('bid-status','Enviando oferta…');
    try {
      await bids.submit(id,find('bid-amount').value);
      if (auction?.id !== id || user?.id !== userId || !dialog.open) return;
      find('bid-amount').value = '';
      await loadDetail();
      notify('bid-status','Tu oferta se registró correctamente.');
    } catch (error) {
      if (auction?.id !== id || user?.id !== userId || !dialog.open) return;
      await loadDetail();
      notify('bid-status',marketplaceError(error),true);
    } finally { bidding = false; find('bid-submit').disabled = false; }
  });

  if (!demo) void service.subscribeAuth((_event,session) => {
    setTimeout(() => {
      if (disposed) return;
      user = session?.user ?? null; readRevision++; pendingAward = null;
      onSessionChange();
      if (!user && publishDialog.open) publishDialog.close();
      if (dialog.open) { clearPrivateDetails(); paintParticipation(); notify('bid-status'); void loadDetail(); }
    },0);
  }).then(stop => { if (disposed) stop(); else unsubscribe = stop; }).catch(() => {});
  const interval = setInterval(() => { if (!document.hidden && dialog.open) void loadDetail(); },15000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && dialog.open) void loadDetail(); });
  window.addEventListener('pagehide',event => { if (!event.persisted) { disposed = true; readRevision++; clearInterval(interval); unsubscribe(); } });
  return { showDetails };
}
