const views = new Set(['/inicio','/subastas','/como-funciona','/publicar','/perfil','/terminos','/privacidad','/preguntas-frecuentes','/proveedores']);
export function resolveRoute(hash='') {
  const raw=hash.replace(/^#/,'');
  // Los fragmentos de confirmación de Auth los procesa Supabase, no el enrutador.
  if(!raw||raw.startsWith('access_token=')||raw.startsWith('error='))return {path:'/inicio',query:new URLSearchParams()};
  const [value,search='']=raw.split('?');
  const path=value.startsWith('/')?value:`/${value}`;
  return {path:views.has(path)?path:'/no-encontrado',query:new URLSearchParams(search)};
}
export function navigate(path){window.location.hash=path;}
