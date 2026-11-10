import { readFile } from 'node:fs/promises';
import { transformWithEsbuild } from 'vite';
await transformWithEsbuild(await readFile('supabase/functions/paypal-checkout/index.ts', 'utf8'), 'index.ts', { target: 'es2022' });
console.log('OK: sintaxis TypeScript de paypal-checkout (la ejecución remota requiere desplegar en Supabase).');
