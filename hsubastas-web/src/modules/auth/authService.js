import { getSupabaseClient } from '../../js/supabaseClient.js';
import { normalizePhone } from '../auctions/marketplaceService.js';

export function createAuthService(getClient = getSupabaseClient) {
  async function client() {
    const result = await getClient();
    if (!result) throw Object.assign(new Error('Configura Supabase para continuar.'), { code: 'missing_config' });
    return result;
  }
  return {
    async signUp({ name, email, password }) {
      name = name.trim();
      if (!name || name.length > 100) {
        throw Object.assign(new Error('Datos de registro inválidos.'), { code: 'invalid_registration' });
      }
      const supabase = await client();
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(), password,
        options: { data: { name }, emailRedirectTo: `${window.location.origin}/` },
      });
      if (error) throw error;
      // El trigger SQL crea public.users incluso si se exige confirmar correo.
      return data;
    },
    async signIn({ email, password }) {
      const { data, error } = await (await client()).auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      return data;
    },
    async signOut() {
      const { error } = await (await client()).auth.signOut({ scope: 'local' });
      if (error) throw error;
    },
    async getProfile(id) {
      const { data, error } = await (await client()).from('users').select('id,name,email,role,whatsapp_phone').eq('id', id).maybeSingle();
      if (error) throw error;
      if (!data) throw Object.assign(new Error('Perfil no encontrado.'), { code: 'missing_profile' });
      return data;
    },
    async updateWhatsApp(phone) {
      const value = normalizePhone(phone);
      const { data,error } = await (await client()).rpc('update_my_whatsapp',{ p_phone: value });
      if (error) throw error;
      return data;
    },
    async subscribe(callback) {
      const { data } = (await client()).auth.onAuthStateChange(callback);
      return () => data.subscription.unsubscribe();
    },
  };
}

export function authErrorMessage(error) {
  if (error?.message === 'INVALID_PHONE') return 'Usa un celular boliviano de 8 dígitos que empiece por 6 o 7, con o sin +591.';
  if (error?.message === 'AUTH_REQUIRED') return 'Inicia sesión para actualizar tu WhatsApp.';
  if (error?.message === 'PROFILE_REQUIRED') return 'No se encontró tu perfil. Actualiza los datos de Mi cuenta.';
  if (['PGRST202','42703','42501'].includes(error?.code)) return 'Revisa que profile-whatsapp.sql esté aplicado en Supabase.';
  const messages = {
    missing_config: 'Configura las variables de Supabase y reinicia Vite para acceder.',
    invalid_registration: 'Ingresa tu nombre completo (máximo 100 caracteres).',
    invalid_credentials: 'El correo o la contraseña no son correctos.',
    email_not_confirmed: 'Confirma tu correo antes de iniciar sesión. Revisa también la carpeta de spam.',
    user_already_exists: 'No se pudo completar el registro. Si ya tienes una cuenta, inicia sesión.',
    signup_disabled: 'El registro de cuentas está deshabilitado en Supabase.',
    weak_password: 'Usa una contraseña más segura que cumpla los requisitos del proyecto.',
    over_email_send_rate_limit: 'Se alcanzó el límite de correos. Espera unos minutos antes de reintentar.',
    over_request_rate_limit: 'Hay demasiados intentos. Espera unos minutos.',
    unexpected_failure: 'No se pudo crear la cuenta. Revisa el trigger de perfiles y los registros de Auth en Supabase.',
  };
  return messages[error?.code] ?? 'No se pudo completar la operación. Revisa tu conexión y vuelve a intentar.';
}
