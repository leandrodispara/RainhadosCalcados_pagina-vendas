import http from 'node:http';
import {readFile,writeFile,mkdir,rename,copyFile} from 'node:fs/promises';
import {join,resolve,extname} from 'node:path';
import {randomUUID,timingSafeEqual} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import {driveStorage} from './drive.mjs';

export class Problem extends Error {constructor(message,status=400){super(message);this.status=status;}}
const text=(x,max,required=false)=>{if(typeof x!=='string'||x.length>max||(required&&!x.trim()))throw new Problem('Confira os campos obrigatórios.');return x.trim();};
const money=x=>{if(x===null)return null;if(typeof x!=='number'||!Number.isFinite(x)||x<=0||x>999999||Math.abs(x*100-Math.round(x*100))>0.00001)throw new Problem('Informe um preço válido com até duas casas decimais.');return x;};
const integer=(x,max)=>{if(!Number.isInteger(x)||x<0||x>max)throw new Problem('A quantidade deve ser um número inteiro igual ou maior que zero.');return x;};
const bool=x=>{if(typeof x!=='boolean')throw new Problem('Opção inválida.');return x;};
const mediaId=x=>typeof x==='string'&&/^\/media\/[a-f0-9-]{36}\.webp$/.test(x);
const emptyBanner=()=>({title:'',image:'',link:'',active:false});
const emptyHighlight=()=>({id:randomUUID(),...emptyBanner()});
const audienceValue=x=>{const value=text(x,20,true);if(!['Masculino','Feminino'].includes(value))throw new Problem('Selecione Feminino ou Masculino.');return value;};
const productImages=p=>Array.isArray(p?.images)&&p.images.length?p.images:(p?.image?[p.image]:[]);

export function validateProduct(p){
 if(!p||!['Calçados','Perfumes'].includes(p.category))throw new Problem('Escolha Calçados ou Perfumes.');
 if(!Array.isArray(p.variants)||!p.variants.length||p.variants.length>150)throw new Problem('Cadastre pelo menos uma variação (máximo 150).');
 const rawImages=p.images===undefined?(p.image?[p.image]:[]):p.images;
 if(!Array.isArray(rawImages)||rawImages.length>8||rawImages.some(image=>!mediaId(image)))throw new Problem('Use no máximo oito fotos válidas enviadas pelo cadastro.');
 const images=[...new Set(rawImages)];
 const variants=p.variants.map(v=>{
  if(!v||typeof v!=='object')throw new Problem('Variação inválida.');
  const base={quantity:integer(v.quantity,100000),price:money(v.price)};
  if(p.category==='Perfumes'){
   if(typeof v.ml!=='number'||!Number.isFinite(v.ml)||v.ml<=0||v.ml>10000)throw new Problem('Informe o volume em ml.');
   return {...base,ml:v.ml,concentration:text(v.concentration,80)};
  }
  return {...base,color:text(v.color,60,true),size:text(v.size,30,true)};
 });
 const keys=variants.map(v=>p.category==='Perfumes'?v.ml+'|'+v.concentration.toLowerCase():v.color.toLowerCase()+'|'+v.size.toLowerCase());
 if(new Set(keys).size!==keys.length)throw new Problem('Há uma variação repetida.');
 return {name:text(p.name,120,true),brand:text(p.brand,80),description:text(p.description,1500),category:p.category,audience:audienceValue(p.audience||'Feminino'),price:money(p.price),active:bool(p.active),image:images[0]||'',images,variants};
}
export function validateBanner(b){
 if(!b||typeof b!=='object')throw new Problem('Banner inválido.');
 const link=text(b.link??'',1000),image=text(b.image??'',100);
 if(link){if(/^\/(?!\/)/.test(link)){if(/[\\\r\n]/.test(link))throw new Problem('Link inválido.');}else{let url;try{url=new URL(link);}catch{throw new Problem('Use um link completo começando por https://.');}if(url.protocol!=='https:'||url.username||url.password)throw new Problem('Use um link https:// válido.');}}
 if(image&&!mediaId(image))throw new Problem('Envie a imagem do banner.');
 if(b.active&&!image)throw new Problem('Para exibir o banner, envie uma imagem.');
 return {title:text(b.title??'',160),link,image,active:bool(b.active)};
}
export function validateHighlights(value){
 if(!Array.isArray(value)||value.length>4)throw new Problem('Use no máximo quatro destaques.');
 const highlights=value.map(item=>{
  const banner=validateBanner(item);
  const id=typeof item?.id==='string'&&/^[a-f0-9-]{36}$/i.test(item.id)?item.id:randomUUID();
  return {id,...banner};
 });
 if(new Set(highlights.map(item=>item.id)).size!==highlights.length)throw new Problem('Há um destaque duplicado.');
 return highlights;
}
export async function optimize(bytes,kind){
 try{return await sharp(bytes,{limitInputPixels:32000000,animated:false}).rotate().resize({width:kind==='banner'?1920:1400,height:kind==='banner'?1200:1400,fit:'inside',withoutEnlargement:true}).webp({quality:82,effort:4}).toBuffer();}catch{throw new Problem('Não foi possível abrir a imagem. Use JPG, PNG ou WebP de até 32 megapixels.');}
}
const storedBanner=value=>({title:typeof value?.title==='string'?value.title.slice(0,160):'',image:mediaId(value?.image)?value.image:'',link:typeof value?.link==='string'?value.link.slice(0,1000):'',active:value?.active===true});
const storedHighlight=value=>({id:typeof value?.id==='string'&&/^[a-f0-9-]{36}$/i.test(value.id)?value.id:randomUUID(),...storedBanner(value)});
const storedHighlights=value=>Array.isArray(value)?value.slice(0,4).map(storedHighlight).filter(item=>item.image||item.title||item.link||item.active):[];
function normalizeData(input){
 const before=JSON.stringify(input);
 if(!Number.isInteger(input.revision))input.revision=0;
 if(!Array.isArray(input.products))input.products=[];
 if(!input.media||typeof input.media!=='object'||Array.isArray(input.media))input.media={};
 const legacy=storedBanner(input.banner);
 const source=input.banners&&typeof input.banners==='object'&&!Array.isArray(input.banners)?input.banners:{};
 const highlights=storedHighlights(source.highlights);
 if(!highlights.length&&source.main)highlights.push(storedHighlight(source.main));
 input.banners={highlights,promotion:storedBanner(source.promotion||legacy)};
 input.banner=input.banners.promotion;
 input.products=input.products.map(product=>{
  if(!product||typeof product!=='object')return product;
  const raw=productImages(product).filter(mediaId).slice(0,8);
  const images=[...new Set(raw)];
  const audience=['Masculino','Feminino'].includes(product.audience)?product.audience:'Feminino';
  return {...product,audience,image:images[0]||'',images};
 });
 return {data:input,changed:before!==JSON.stringify(input)};
}

export async function createApp({dataDir,secret,storage=null,origin='https://calcadosrainha.com.br',publicDir=resolve('public')}){
 if(!secret||secret.length<32)throw Error('Configure RAINHA_API_KEY com pelo menos 32 caracteres.');
 await mkdir(dataDir,{recursive:true});const file=join(dataDir,'catalog.json');let data;
 try{
  const parsed=JSON.parse(await readFile(file,'utf8'));
  if(!Number.isInteger(parsed.revision)||!Array.isArray(parsed.products)||!parsed.media)throw Error('Formato inválido');
  const normalized=normalizeData(parsed);data=normalized.data;
  if(normalized.changed){await copyFile(file,file+'.previous');await writeFile(file,JSON.stringify(data),{mode:0o600});}
 }catch(e){if(e.code!=='ENOENT')throw e;data={revision:0,products:[],banner:emptyBanner(),banners:{highlights:[],promotion:emptyBanner()},media:{}};await writeFile(file,JSON.stringify(data),{mode:0o600});}
 let queue=Promise.resolve(),processingImages=0;
 const mutate=fn=>{const next=queue.then(async()=>{const draft=structuredClone(data);const value=await fn(draft);normalizeData(draft);await copyFile(file,file+'.previous');await writeFile(file+'.tmp',JSON.stringify(draft),{mode:0o600});await rename(file+'.tmp',file);data=draft;return value;});queue=next.catch(()=>{});return next;};
 const knownImage=(image,draft)=>{if(image&&!draft.media[image])throw new Problem('Esta imagem não está cadastrada. Envie novamente.');};
 const knownImages=(images,draft)=>images.forEach(image=>knownImage(image,draft));
 const adminCatalog=()=>({products:data.products,banner:data.banners.promotion,banners:data.banners,revision:data.revision,storageReady:!!storage&&(storage.ready?.()??true),driveConfigured:!!storage?.configured});
 const publicCatalog=()=>{const highlights=data.banners.highlights.filter(banner=>banner.active&&banner.image);const banners={highlights,main:highlights[0]||null,promotion:data.banners.promotion.active?data.banners.promotion:null};return {products:data.products.filter(p=>p.active),banner:banners.promotion,banners};};
 const json=(res,status,payload)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(payload));};
 const body=async(req,limit)=>{let length=0,chunks=[];for await(const chunk of req){length+=chunk.length;if(length>limit)throw new Problem('Arquivo muito grande. O limite é 10 MB.',413);chunks.push(chunk);}return Buffer.concat(chunks);};
 const decode=async req=>{if(!(req.headers['content-type']||'').startsWith('application/json'))throw new Problem('Envie dados JSON.',415);try{return JSON.parse((await body(req,2000000)).toString());}catch(e){if(e instanceof Problem)throw e;throw new Problem('Dados inválidos.');}};
 const authenticated=req=>{const candidate=Buffer.from(req.headers['x-rainha-key']||'');const expected=Buffer.from(secret);return candidate.length===expected.length&&timingSafeEqual(candidate,expected)&&!!req.headers['x-remote-user'];};
 const allowedOrigins=new Set([origin,origin.replace('://','://www.')]);
 const server=http.createServer(async(req,res)=>{
  try{
   const path=new URL(req.url,'http://localhost').pathname;
   if(path==='/health'&&req.method==='GET')return json(res,200,{ok:true});
   if(path==='/api/catalog'&&req.method==='GET')return json(res,200,publicCatalog());
   if(path.startsWith('/media/')&&req.method==='GET'){
    const referenced=data.products.some(p=>p.active&&productImages(p).includes(path))||data.banners.highlights.some(banner=>banner.active&&banner.image===path)||(data.banners.promotion.active&&data.banners.promotion.image===path);
    if(!mediaId(path)||!data.media[path]||(!referenced&&!authenticated(req)))throw new Problem('Imagem não encontrada.',404);
    if(!storage)throw new Problem('Armazenamento de imagens não configurado.',503);
    let bytes;try{bytes=await storage.get(data.media[path].key);}catch{throw new Problem('Imagem temporariamente indisponível.',502);}
    res.writeHead(200,{'Content-Type':'image/webp','Content-Length':bytes.length,'Cache-Control':referenced?'public, max-age=3600':'private, no-store','X-Content-Type-Options':'nosniff'});return res.end(bytes);
   }
   if(path.startsWith('/cliente/api/')){
    if(!authenticated(req))throw new Problem('Entre na área do colaborador.',401);
    if(req.method!=='GET'&&(!allowedOrigins.has(req.headers.origin)||req.headers['x-rainha-request']!=='1'))throw new Problem('Recarregue a página para continuar.',403);

    if(path==='/cliente/api/drive/start'&&req.method==='POST'){
     if(!storage?.begin)throw new Problem('Configure as credenciais Google no servidor primeiro.',503);
     const start=storage.begin(req.headers['x-remote-user']);res.setHeader('Set-Cookie',start.cookie);return json(res,200,{url:start.url});
    }
    if(path==='/cliente/api/drive/callback'&&req.method==='GET'){
     if(!storage?.finish)throw new Problem('Conexão Google não configurada.',503);
     const query=new URL(req.url,'http://localhost').searchParams;
     const binding=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('__Host-rainha-google='))?.split('=')[1];
     try{await storage.finish({state:query.get('state'),code:query.get('code'),error:query.get('error'),binding,user:req.headers['x-remote-user']});}
     catch(e){res.setHeader('Set-Cookie','__Host-rainha-google=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0');throw e;}
     res.writeHead(303,{'Location':'/cliente/?drive=connected','Cache-Control':'no-store','Referrer-Policy':'no-referrer','Set-Cookie':'__Host-rainha-google=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0'});return res.end();
    }
    if(path==='/cliente/api/catalog'&&req.method==='GET')return json(res,200,adminCatalog());
    if(path==='/cliente/api/image'&&req.method==='GET'){
     const image='/media/'+new URL(req.url,'http://localhost').searchParams.get('id');
     if(!mediaId(image)||!data.media[image])throw new Problem('Imagem não encontrada.',404);
     if(!storage)throw new Problem('Armazenamento não configurado.',503);
     let bytes;try{bytes=await storage.get(data.media[image].key);}catch{throw new Problem('Imagem indisponível.',502);}
     res.writeHead(200,{'Content-Type':'image/webp','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});return res.end(bytes);
    }
    if(path==='/cliente/api/upload'&&req.method==='POST'){
     if(!storage||(storage.ready&&!storage.ready()))throw new Problem('Conecte o Google Drive na Área do colaborador antes de enviar fotos.',503);
     if(processingImages>=2)throw new Problem('Há imagens em processamento. Tente novamente em instantes.',429);
     processingImages++;
     try{
      const input=await body(req,10*1024*1024);const bytes=await optimize(input,req.headers['x-image-kind']);const id=randomUUID();const url='/media/'+id+'.webp';let key='rainha/'+id+'.webp';
      try{const saved=await storage.put(key,bytes);if(typeof saved==='string')key=saved;}catch(e){throw new Problem(e.status?e.message:'Falha ao salvar a imagem no Drive. Tente novamente.',e.status||502);}
      await mutate(draft=>{draft.media[url]={key,size:bytes.length,createdAt:new Date().toISOString()};});return json(res,201,{image:url,originalSize:input.length,size:bytes.length});
     }finally{processingImages--;}
    }
    const slotMatch=path.match(/^\/cliente\/api\/banners\/(main|promotion)$/);
    const highlightsUpdate=req.method==='PUT'&&path==='/cliente/api/banners/highlights';
    const bannerUpdate=req.method==='PUT'&&(path==='/cliente/api/banner'||slotMatch);
    if((path==='/cliente/api/products'&&req.method==='POST')||bannerUpdate||highlightsUpdate||(path.startsWith('/cliente/api/products/')&&req.method==='DELETE')){
     const input=req.method==='DELETE'?null:await decode(req);
     await mutate(draft=>{
      if(req.headers['if-match']!==String(draft.revision))throw new Problem('O catálogo mudou em outra tela. Recarregue a página antes de salvar.',409);
      if(req.method==='DELETE'){const id=path.split('/').at(-1);if(!draft.products.some(p=>p.id===id))throw new Problem('Produto não encontrado.',404);draft.products=draft.products.filter(p=>p.id!==id);}
      else if(highlightsUpdate){const highlights=validateHighlights(input.highlights);highlights.forEach(highlight=>knownImage(highlight.image,draft));draft.banners.highlights=highlights;}
      else if(bannerUpdate){
       const slot=slotMatch?.[1]||'promotion';const banner=validateBanner(input);knownImage(banner.image,draft);
       if(slot==='main'){const current=draft.banners.highlights[0];draft.banners.highlights=[{id:current?.id||randomUUID(),...banner},...draft.banners.highlights.slice(1,4)];}
       else draft.banners.promotion=banner;
      }
      else{const product=validateProduct(input);knownImages(product.images,draft);if(input.id){const index=draft.products.findIndex(p=>p.id===input.id);if(index<0)throw new Problem('Produto não encontrado.',404);draft.products[index]={...product,id:input.id};}else{if(draft.products.length>=5000)throw new Problem('Limite de produtos atingido.');draft.products.push({...product,id:randomUUID()});}}
      draft.revision++;
     });return json(res,200,adminCatalog());
    }
    throw new Problem('Operação não encontrada.',404);
   }
   // Static delivery is handled by Nginx in production. Preview files remain available locally.
   if(path.startsWith('/cliente')&&!authenticated(req))throw new Problem('Entre na área do colaborador.',401);
   if(req.method!=='GET')throw new Problem('Método não permitido.',405);
   const local=resolve(publicDir,'.'+decodeURIComponent(path.endsWith('/')?path+'index.html':path));
   if(!local.startsWith(resolve(publicDir)+String.fromCharCode(process.platform==='win32'?92:47)))throw new Problem('Não encontrado.',404);
   let bytes;try{bytes=await readFile(local);}catch{throw new Problem('Não encontrado.',404);}
   res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.webp':'image/webp'})[extname(local)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'});res.end(bytes);
  }catch(e){if(!res.headersSent)json(res,e.status||500,{error:e.status?e.message:'Não foi possível concluir. Tente novamente.'});else res.end();}
 });return server;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 let config={};try{config=JSON.parse(await readFile(process.env.RAINHA_STORAGE_CONFIG||'/etc/rainha-catalogo/google.json','utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 const server=await createApp({dataDir:process.env.RAINHA_DATA_DIR||'/var/lib/rainha-catalogo',secret:process.env.RAINHA_API_KEY,storage:await driveStorage({config,tokenPath:join(process.env.RAINHA_DATA_DIR||'/var/lib/rainha-catalogo','google-token.json')}),publicDir:join(fileURLToPath(new URL('.',import.meta.url)),'public')});
 server.listen(Number(process.env.PORT||3187),'127.0.0.1',()=>console.log('Rainha: serviço local pronto.'));
}
