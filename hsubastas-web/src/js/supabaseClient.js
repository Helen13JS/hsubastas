// Vite sustituye estas variables al compilar. Son públicas en el navegador.
// Nunca colocar service_role, sb_secret_, contraseñas ni credenciales de PostgreSQL.
const environment = import.meta.env ?? {};
const supabaseUrl = environment.VITE_SUPABASE_URL?.trim();
const supabaseKey = environment.VITE_SUPABASE_ANON_KEY?.trim();

let clientPromise;

export function hasSupabaseConfig() {
  return Boolean(supabaseUrl && supabaseKey);
}

export async function getSupabaseClient() {
  if (!hasSupabaseConfig()) return null;
  if (!clientPromise) {
    clientPromise = (async () => {
      const url = new URL(supabaseUrl);
      if (url.protocol !== 'https:') throw new Error('Supabase requiere una URL HTTPS.');
      if (supabaseKey.startsWith('sb_secret_')) throw new Error('Usa una clave pública de Supabase.');
      // Importación ES Modules de la librería oficial mediante CDN.
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
      return createClient(supabaseUrl, supabaseKey);
    })().catch((error) => {
      clientPromise = undefined; // Permite reintentar si falla la carga del CDN.
      throw error;
    });
  }
  return clientPromise;
}
