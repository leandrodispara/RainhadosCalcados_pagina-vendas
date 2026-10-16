import {readFile,writeFile,rename} from 'node:fs/promises';
import {driveStorage} from './drive.mjs';

const [catalogPath,configPath,tokenPath]=process.argv.slice(2);
if(!catalogPath||!configPath||!tokenPath)throw Error('Uso: migrate-drive.mjs <catalogo> <configuração> <token>.');

const mediaPath=value=>typeof value==='string'&&/^\/media\/[a-f0-9-]{36}\.webp$/i.test(value);
const productImages=product=>Array.isArray(product?.images)&&product.images.length?product.images:(product?.image?[product.image]:[]);
const imageKnown=(data,image)=>mediaPath(image)&&!!data.media?.[image];

function visibleSample(data){
 const promotion=data?.banners?.promotion||data?.banner;
 if(promotion?.active&&imageKnown(data,promotion.image))return promotion.image;
 const highlight=(data?.banners?.highlights||[]).find(item=>item?.active&&imageKnown(data,item.image));
 if(highlight)return highlight.image;
 const product=(data?.products||[]).find(item=>item?.active&&productImages(item).some(image=>imageKnown(data,image)));
 return product?productImages(product).find(image=>imageKnown(data,image))||'':'';
}

async function writeCatalog(data){
 const temporary=catalogPath+'.drive-migration.tmp';
 await writeFile(temporary,JSON.stringify(data),{encoding:'utf8',mode:0o600});
 await rename(temporary,catalogPath);
}

let data;
let config;
try{data=JSON.parse(await readFile(catalogPath,'utf8'));}catch{throw Error('Não foi possível ler o catálogo atual.');}
try{config=JSON.parse(await readFile(configPath,'utf8'));}catch{throw Error('Não foi possível ler a configuração do Google Drive.');}
if(!data||typeof data!=='object'||Array.isArray(data)||!data.media||typeof data.media!=='object'||Array.isArray(data.media))throw Error('O catálogo não tem uma lista válida de imagens.');
if(!config||typeof config!=='object'||Array.isArray(config)||typeof config.folderId!=='string'||!config.folderId)throw Error('A nova pasta do Google Drive não está configurada.');

const sampleBefore=visibleSample(data);
if(data.storageFolderId===config.folderId){
 console.log('MIGRATION_STATUS=already-current');
 console.log('MIGRATED_MEDIA=0');
 console.log('MIGRATION_SAMPLE='+sampleBefore);
 process.exit(0);
}

const storage=await driveStorage({config,tokenPath});
if(!storage||(typeof storage.ready==='function'&&!storage.ready()))throw Error('A conexão atual com o Google Drive não está pronta. Confirme o compartilhamento temporário da pasta nova.');

const entries=Object.entries(data.media);
const copiedKeys=new Map();
const nextMedia={...data.media};
let copied=0;

for(const [url,entry] of entries){
 if(!mediaPath(url)||!entry||typeof entry.key!=='string'||!entry.key)throw Error('Há uma imagem inválida no catálogo. A migração foi cancelada antes de alterar o cadastro.');
 const oldKey=entry.key;
 let newKey=copiedKeys.get(oldKey);
 if(!newKey){
  process.stdout.write('Copiando imagem '+(copied+1)+' de '+entries.length+'…\n');
  let bytes;
  try{bytes=await storage.get(oldKey);}catch{throw Error('Não foi possível ler uma imagem atual do Drive. Confirme o acesso do Gmail antigo à pasta original.');}
  try{newKey=await storage.put('rainha/'+url.slice('/media/'.length),bytes);}catch{throw Error('Não foi possível gravar uma imagem na nova pasta. Confirme que o Gmail antigo foi adicionado como Editor nela.');}
  if(typeof newKey!=='string'||!newKey)throw Error('O Google Drive não confirmou o salvamento da imagem.');
  copiedKeys.set(oldKey,newKey);
  copied++;
 }
 nextMedia[url]={...entry,key:newKey,migratedAt:new Date().toISOString()};
}

data.media=nextMedia;
data.storageFolderId=config.folderId;
await writeCatalog(data);

console.log('MIGRATION_STATUS=completed');
console.log('MIGRATED_MEDIA='+copied);
console.log('MIGRATION_SAMPLE='+visibleSample(data));
