import { build } from 'vite';
import { mkdir,writeFile,unlink } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
// Compila JSX para comprobar los componentes reales sin iniciar sesión ni crear datos.
const directory=path.resolve('node_modules/.cache/hsubastas-tests');await mkdir(directory,{recursive:true});
const file=path.join(directory,`portal-${Date.now()}.mjs`);
try{
  const result=await build({configFile:false,envFile:false,define:{'import.meta.env':'{}'},logLevel:'silent',build:{ssr:'src/portal.test.jsx',write:false,minify:false,rollupOptions:{output:{format:'es'}}}});
  const outputs=Array.isArray(result)?result[0].output:result.output;
  await writeFile(file,outputs.find(item=>item.type==='chunk'&&item.isEntry).code);await import(pathToFileURL(file).href);
}finally{await unlink(file).catch(()=>{});}
