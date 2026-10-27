import { hasSupabaseConfig } from './supabaseClient.js';
import { listActiveAuctions, listMyAuctions, watchAuctions, getAuctionErrorMessage } from '../modules/auctions/auctionService.js';
import { demoAuctions } from '../modules/auctions/demoAuctions.js';
import { initAuth } from '../modules/auth/authUI.js';
import { initMarketplace } from '../modules/auctions/marketplaceUI.js';

void initAuth();

const grid = document.querySelector('#auction-grid');
const search = document.querySelector('#search');
const category = document.querySelector('#category');
const message = document.querySelector('#catalog-message');
const connection = document.querySelector('#connection-status');
const refreshButton = document.querySelector('#refresh');
const dialog = document.querySelector('#auction-dialog');
const demo = !hasSupabaseConfig();
const currency = new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB', minimumFractionDigits: 2 });
let onlyMine = false;
let catalogRevision = 0;
const marketplace = initMarketplace({ demo, onPublished: loadAuctions, onSessionChange() {
  if (onlyMine) { catalogRevision++; auctions = []; render(); void loadAuctions(); }
} });
let auctions = [];
let loading = false;
let failed = false;
let failureMessage = '';
let live = false;
let reloadPending = false;
let disposed = false;
let stopWatching = () => {};

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function remaining(end) {
  const minutes = Math.max(0, Math.ceil((new Date(end) - Date.now()) / 60000));
  if (minutes >= 1440) return `Cierra en ${Math.floor(minutes / 1440)} d ${Math.floor(minutes % 1440 / 60)} h`;
  if (minutes >= 60) return `Cierra en ${Math.floor(minutes / 60)} h ${minutes % 60} min`;
  return `Cierra en ${minutes} min`;
}

function showDetails(auction) {
  marketplace.showDetails(auction);
}

function card(auction) {
  const styles = { 'Tecnología': ['technology', '▱'], 'Construcción': ['construction', '▥'], 'Servicios': ['services', '✳'] };
  const [style, symbol] = styles[auction.category] ?? ['services', '◇'];
  const article = element('article', 'auction-card');
  const art = element('div', `card-art ${style}`);
  const icon = element('span', 'art-symbol', symbol);
  icon.setAttribute('aria-hidden', 'true');
  art.append(element('span', 'card-category', auction.category), icon);
  if (demo) art.append(element('span', 'demo-tag', 'EJEMPLO ILUSTRATIVO'));
  const body = element('div', 'card-body');
  body.append(element('p', 'card-location', `◎ ${auction.city} · Bolivia`), element('h3', '', auction.title), element('p', 'card-description', auction.description), element('span', 'budget-label', 'Presupuesto máximo'), element('strong', 'card-budget', currency.format(auction.max_budget)));
  const bottom = element('div', 'card-bottom');
  const detail = element('button', 'text-link', 'Ver requerimiento ↗');
  detail.type = 'button';
  detail.setAttribute('aria-label', `Ver requerimiento: ${auction.title}`);
  detail.addEventListener('click', () => showDetails(auction));
  bottom.append(element('span', 'deadline', auction.awarded_bid_id ? '✓ Adjudicada' : auction.status !== 'active' ? 'Cerrada' : new Date(auction.ends_at) <= new Date() ? 'Plazo finalizado' : remaining(auction.ends_at)), detail);
  body.append(bottom);
  article.append(art, body);
  return article;
}

function render() {
  const query = search.value.trim().toLocaleLowerCase('es');
  const filtered = auctions.filter((auction) => (onlyMine || new Date(auction.ends_at) > new Date())
    && (!category.value || auction.category === category.value)
    && `${auction.title} ${auction.description} ${auction.city}`.toLocaleLowerCase('es').includes(query));
  grid.replaceChildren(...filtered.map(card));
  if (!filtered.length) grid.append(element('p', 'empty-state', failed
    ? failureMessage
    : auctions.length ? 'No hay requerimientos que coincidan con tu búsqueda.' : onlyMine ? 'Todavía no tienes requerimientos ni ofertas.' : 'No hay subastas activas en este momento. Vuelve pronto.'));
  const count = `${filtered.length} ${filtered.length === 1 ? 'requerimiento' : 'requerimientos'}`;
  message.textContent = failed ? `${failureMessage}${auctions.length ? ' Se muestra la última consulta disponible.' : ''}`
    : demo ? `${count} de ejemplo · Configura Supabase para ver datos reales.` : `${count} disponibles · Presupuestos en bolivianos (BOB).`;
}

async function loadAuctions() {
  if (loading) { reloadPending = true; return; }
  loading = true;
  const revision = catalogRevision;
  refreshButton.disabled = true;
  grid.setAttribute('aria-busy', 'true');
  try {
    const data = demo ? onlyMine ? [] : demoAuctions : onlyMine ? await listMyAuctions() : await listActiveAuctions();
    if (revision !== catalogRevision) { reloadPending = true; return; }
    auctions = data;
    failed = false;
    connection.textContent = demo ? 'Vista de demostración' : live ? '● Actualizaciones en vivo' : 'Catálogo conectado';
  } catch (error) {
    if (revision !== catalogRevision) { reloadPending = true; return; }
    if (onlyMine) auctions = [];
    failed = true;
    failureMessage = getAuctionErrorMessage(error);
    connection.textContent = 'Conexión no disponible';
    // Conserva el último resultado sin confundirlo con información actualizada.
  } finally {
    render();
    loading = false;
    refreshButton.disabled = false;
    grid.setAttribute('aria-busy', 'false');
    if (reloadPending && !disposed) { reloadPending = false; void loadAuctions(); }
  }
}

document.querySelector('#year').textContent = new Date().getFullYear();
search.addEventListener('input', render);
category.addEventListener('change', render);
refreshButton.addEventListener('click', loadAuctions);
for (const [id,mine] of [['catalog-active',false],['catalog-mine',true]]) {
  document.getElementById(id).addEventListener('click',() => {
    onlyMine = mine; catalogRevision++; auctions = []; render();
    document.getElementById('catalog-active').setAttribute('aria-pressed',String(!mine));
    document.getElementById('catalog-mine').setAttribute('aria-pressed',String(mine));
    void loadAuctions();
  });
}
document.querySelector('#close-dialog').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', (event) => { if (event.target === dialog) {
  const rect = dialog.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
} });

async function initialize() {
  await loadAuctions();
  if (demo || disposed) return;
  try {
    stopWatching = await watchAuctions(() => { void loadAuctions(); }, (status) => {
      live = status === 'SUBSCRIBED';
      if (live) { if (!failed) connection.textContent = '● Actualizaciones en vivo'; void loadAuctions(); }
      else if (!failed && ['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) connection.textContent = 'Actualización periódica · 30 s';
    });
  } catch { if (!failed) connection.textContent = 'Actualización periódica · 30 s'; }
}
void initialize();
// También elimina subastas vencidas o que dejaron de ser visibles bajo RLS.
const interval = setInterval(() => { if (!document.hidden) void loadAuctions(); }, 30000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) void loadAuctions(); });
window.addEventListener('pagehide', (event) => { if (!event.persisted) { disposed = true; clearInterval(interval); stopWatching(); } });
