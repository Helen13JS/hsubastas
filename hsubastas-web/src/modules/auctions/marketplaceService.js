import { getSupabaseClient } from '../../js/supabaseClient.js';

export const categories = ['Tecnología', 'Construcción', 'Servicios', 'Insumos'];

export function normalizePhone(value) {
  if (!String(value ?? '').trim()) return null;
  const digits = String(value).replace(/[\s()+-]/g, '');
  const phone = /^[67]\d{7}$/.test(digits) ? `591${digits}` : digits;
  if (!/^591[67]\d{7}$/.test(phone)) throw new Error('INVALID_PHONE');
  return phone;
}

export function boliviaDeadline(value) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error('INVALID_DEADLINE');
  const date = new Date(`${value}:00-04:00`);
  if (!Number.isFinite(date.getTime()) || new Date(date.getTime() - 14400000).toISOString().slice(0,16) !== value || date <= new Date()) throw new Error('INVALID_DEADLINE');
  return date.toISOString();
}

export function validateAmount(value) {
  if (!/^\d+(\.\d{1,2})?$/.test(String(value))) throw new Error('INVALID_AMOUNT');
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0 || number > 999999999999.99) throw new Error('INVALID_AMOUNT');
  return number;
}

export function whatsappLink(phone, title) {
  const normalized = normalizePhone(phone);
  return normalized ? `https://wa.me/${normalized}?text=${encodeURIComponent(`Hola, te contacto por el requerimiento «${title}» en HSubastas.`)}` : null;
}

export function marketplaceError(error) {
  const messages = {
    AUTH_REQUIRED: 'Inicia sesión para continuar.', PROFILE_REQUIRED: 'No se encontró tu perfil. Revisa la configuración de usuarios.',
    INVALID_AUCTION: 'Completa título, descripción, categoría y ciudad con datos válidos.',
    INVALID_AMOUNT: 'Ingresa un importe positivo con máximo dos decimales.',
    INVALID_DEADLINE: 'Elige una fecha de cierre futura (hora de Bolivia).',
    INVALID_PHONE: 'Ingresa un celular boliviano de 8 dígitos que empiece por 6 o 7, con o sin +591.',
    AUCTION_UNAVAILABLE: 'El requerimiento ya no está disponible.', AUCTION_CLOSED: 'La subasta ha cerrado. No admite más ofertas.',
    OWN_AUCTION: 'Puedes revisar las ofertas, pero no ofertar en tu propio requerimiento.',
    BID_TOO_HIGH: 'Otra oferta puede haber mejorado el precio. Tu importe debe ser menor al presupuesto y a la mejor oferta actual.',
    NOT_AUCTION_OWNER: 'Solo el comprador propietario puede adjudicar una oferta.',
    ALREADY_AWARDED: 'Este requerimiento ya tiene una oferta adjudicada.',
    INVALID_WINNER: 'La oferta seleccionada no es válida para este requerimiento.',
  };
  if (messages[error?.message]) return messages[error.message];
  if (['PGRST202','42P01','42703','42501'].includes(error?.code)) return 'Revisa que marketplace.sql y awards.sql estén aplicados en Supabase y que tengas acceso.';
  return 'No se pudo completar la operación. Revisa tu conexión antes de reintentar.';
}

export function createMarketplaceService(getClient = getSupabaseClient) {
  async function client() {
    const result = await getClient();
    if (!result) throw new Error('AUTH_REQUIRED');
    return result;
  }
  async function rpc(name, args) {
    const { data, error } = await (await client()).rpc(name, args);
    if (error) throw error;
    return data;
  }
  return {
    async publish(values) {
      const title = values.title.trim(), description = values.description.trim(), city = values.city.trim();
      if (!title || title.length > 160 || !description || description.length > 5000 || !city || city.length > 100 || !categories.includes(values.category)) throw new Error('INVALID_AUCTION');
      return rpc('publish_auction', {
        p_title: title, p_description: description, p_category: values.category, p_city: city,
        p_max_budget: validateAmount(values.max_budget), p_ends_at: boliviaDeadline(values.ends_at),
        p_whatsapp_phone: normalizePhone(values.phone),
      });
    },
    async getAuction(id) {
      const { data, error } = await (await client()).from('auctions')
        .select('id,title,description,category,city,max_budget,ends_at,status,buyer_id,awarded_bid_id,awarded_at').eq('id', id).single();
      if (error) throw error;
      return data;
    },
    getContact(id) { return rpc('get_auction_contact', { p_auction_id: id }); },
    async subscribeAuth(callback) {
      const { data } = (await client()).auth.onAuthStateChange(callback);
      return () => data.subscription.unsubscribe();
    },
  };
}
