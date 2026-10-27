import { getSupabaseClient } from '../../js/supabaseClient.js';

// Admite el esquema inicial y la tabla existente que usa deadline.
let schema = 'current';
const columns = {
  current: 'id,title,description,category,city,max_budget,ends_at,status',
  legacy: 'id,title,description,max_budget,deadline,status',
};

export function normalizeAuction(auction) {
  return {
    ...auction,
    description: auction.description ?? '',
    category: auction.category || 'Sin categoría',
    city: auction.city || 'Ciudad no especificada',
    ends_at: auction.ends_at ?? auction.deadline,
  };
}

export function getAuctionErrorMessage(error) {
  if (error?.message === 'AUTH_REQUIRED') return 'Inicia sesión para consultar Mi actividad.';
  if (['42703', 'PGRST204'].includes(error?.code)) return 'Las columnas de auctions no coinciden con el catálogo. Revisa el esquema de Supabase.';
  if (['42P01', 'PGRST205'].includes(error?.code)) return 'No se encuentra la tabla auctions. Revisa el esquema de Supabase.';
  if (error?.code === '42501') return 'Supabase no permite leer auctions. Revisa los permisos y las políticas RLS.';
  if (['PGRST301', 'PGRST302', 'PGRST303'].includes(error?.code) || error?.status === 401) return 'Supabase rechazó la autenticación. Revisa la URL y la clave pública y reinicia Vite.';
  return 'No se pudo consultar Supabase. Revisa la conexión, la configuración y el acceso al CDN.';
}

export async function listMyAuctions() {
  const client = await getSupabaseClient();
  if (!client) throw new Error('AUTH_REQUIRED');
  const { data,error } = await client.rpc('list_my_auctions');
  if (error) throw error;
  return data.map(normalizeAuction);
}

async function queryAuctions(client) {
  const deadline = schema === 'legacy' ? 'deadline' : 'ends_at';
  return client.from('auctions')
    .select(columns[schema])
    .eq('status', 'active')
    .gt(deadline, new Date().toISOString())
    .order(deadline, { ascending: true });
}

export async function listActiveAuctions() {
  const client = await getSupabaseClient();
  if (!client) return null;
  let result = await queryAuctions(client);
  if (schema === 'current' && result.error?.code === '42703') {
    schema = 'legacy';
    result = await queryAuctions(client);
    if (result.error) schema = 'current';
  }
  const { data, error } = result;
  if (error) throw error;
  return data.map(normalizeAuction);
}

export async function watchAuctions(onChange, onStatus) {
  const client = await getSupabaseClient();
  if (!client) return () => {};
  const channel = client.channel('public-auctions')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'auctions' }, onChange)
    .subscribe(onStatus);
  return () => { void client.removeChannel(channel); };
}
