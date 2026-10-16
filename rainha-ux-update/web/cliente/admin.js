'use strict';

const $=id=>document.getElementById(id);
const blankBanner=()=>({title:'',image:'',link:'',active:false});
const blankHighlight=()=>({id:'',...blankBanner()});
const asHighlight=value=>({id:typeof value?.id==='string'?value.id:'',title:typeof value?.title==='string'?value.title:'',image:typeof value?.image==='string'?value.image:'',link:typeof value?.link==='string'?value.link:'',active:value?.active===true});
const makeHighlightId=()=>globalThis.crypto?.randomUUID?.()||'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,letter=>{const value=Math.floor(Math.random()*16);return (letter==='x'?value:(value&3)|8).toString(16);});

let state={products:[],revision:0,banner:blankBanner(),banners:{highlights:[],promotion:blankBanner()}};
let tab='Calçados',audience='Feminino',current=null,images=[],dirty=false,busy=0,connected=false;
let bannerArea='highlights',currentHighlightId='',bannerImage='';

const el=(tag,className,value)=>{const item=document.createElement(tag);if(className)item.className=className;if(value!==undefined)item.textContent=value;return item;};
const price=value=>value===''?null:Number(value);
const previewURL=url=>url?'/cliente/api/image?id='+encodeURIComponent(url.split('/').at(-1)):'';
const imagesOf=product=>Array.isArray(product?.images)&&product.images.length?product.images:(product?.image?[product.image]:[]);
const tabTitle=()=>tab+' '+audience.toLowerCase();
const productWord=()=>tab==='Perfumes'?'perfume':'calçado';

function message(value,banner=false){$(banner?'banner-status':'status').textContent=value;}
async function request(path,options={}){
  const response=await fetch('/cliente/api/'+path,{...options,headers:{'X-Rainha-Request':'1',...options.headers}});
  let result;try{result=await response.json();}catch{throw Error('O serviço de cadastro não respondeu. Confira a instalação no servidor.');}
  if(!response.ok)throw Error(result.error||'Não foi possível concluir.');return result;
}
function requireConnection(banner=false){
  if(connected)return true;
  message('O catálogo ainda não terminou de carregar. Recarregue a página antes de salvar.',banner);
  return false;
}

function normalizeBanners(source,legacy){
  const raw=source&&typeof source==='object'&&!Array.isArray(source)?source:{};
  const highlights=Array.isArray(raw.highlights)?raw.highlights.slice(0,4).map(asHighlight):[];
  if(!highlights.length&&raw.main)highlights.push(asHighlight(raw.main));
  return {highlights,promotion:{...blankBanner(),...(raw.promotion||legacy||{})}};
}

function adopt(data){
  state={...data,products:Array.isArray(data.products)?data.products:[],banners:normalizeBanners(data.banners,data.banner)};
  state.banner=state.banners.promotion;
  $('connect-drive').hidden=!data.driveConfigured;$('connect-drive').textContent=data.storageReady?'Reconectar Google Drive':'Conectar Google Drive';connected=true;
  $('connection').textContent=data.storageReady?'Cadastro conectado. Salvar publica as alterações no site.':'Catálogo conectado. Conecte o Google Drive para enviar fotos e banners.';
  $('new').disabled=false;$('export').disabled=false;$('import').disabled=false;$('product-fields').disabled=false;$('banner-fields').disabled=false;
  list();
}

function list(){
  const root=$('list');root.replaceChildren();if(tab==='banners'){$('total').textContent='';return;}
  const products=state.products.filter(product=>product.category===tab&&product.audience===audience);
  $('total').textContent=products.length+' produto(s)';
  for(const product of products){
    const button=el('button');button.type='button';button.setAttribute('aria-current',String(product.id===current));
    const quantity=(product.variants||[]).reduce((sum,variant)=>sum+Number(variant.quantity||0),0);
    button.append(el('span','',product.name),el('small','',(product.active?'Visível':'Oculto')+' · '+quantity+' unidade(s) · '+imagesOf(product).length+' foto(s)'));
    button.onclick=()=>{if(canLeave())load(product);};root.append(button);
  }
}

function canLeave(){if(busy){message('Aguarde a operação atual.',tab==='banners');return false;}return !dirty||confirm('Descartar as alterações ainda não salvas?');}

function row(variant={}){
  const perfume=tab==='Perfumes';const item=el('div','variant');
  const fields=perfume?[['ml','Volume (ml)','number'],['concentration','Concentração','text']]:[['color','Cor','text'],['size','Numeração','text']];
  fields.push(['quantity','Quantidade disponível','number'],['price','Preço da opção (R$)','number']);
  for(const [key,title,type] of fields){
    const label=el('label','field',title),input=el('input');input.dataset.field=key;input.type=type;input.value=variant[key]??(key==='quantity'?'0':'');input.required=['ml','color','size','quantity'].includes(key);
    if(type==='number'){input.min=key==='quantity'?'0':'0.01';input.max=key==='quantity'?'100000':key==='ml'?'10000':'999999';input.step=key==='quantity'?'1':'0.01';}else input.maxLength=key==='color'?60:key==='size'?30:80;
    label.append(input);item.append(label);
  }
  const remove=el('button','remove','Remover variação');remove.type='button';remove.onclick=()=>{item.remove();dirty=true;};item.append(remove);$('variants').append(item);
}

function renderPhotos(){
  const root=$('photo-previews');root.replaceChildren();
  images.forEach((url,index)=>{
    const item=el('div','photo-item'),image=el('img');image.src=previewURL(url);image.alt='Foto '+(index+1)+' do produto';
    const remove=el('button','', 'Remover');remove.type='button';remove.onclick=()=>{if(busy)return;images=images.filter((_,position)=>position!==index);renderPhotos();dirty=true;};
    item.append(image);if(index===0)item.append(el('span','photo-main','Capa'));item.append(remove);root.append(item);
  });
  $('photo-help').textContent=images.length?'A primeira foto será a capa da vitrine. '+images.length+'/8 foto(s) selecionada(s).':'Selecione uma ou mais fotos. Você pode enviar até 8 fotos por produto.';
}

function showImage(id,url){const image=$(id);image.hidden=!url;if(url)image.src=previewURL(url);else image.removeAttribute('src');}

function load(product=null){
  current=product?.id??null;images=[...new Set(imagesOf(product))];$('editor').reset();
  for(const id of ['name','brand','description'])$(id).value=product?.[id]??'';
  $('price').value=product?.price??'';$('audience').value=product?.audience||audience;$('active').checked=product?.active??true;
  $('variants').replaceChildren();(product?.variants??[{}]).forEach(row);renderPhotos();$('delete').hidden=!product;
  $('editor-title').textContent=(product?'Editar ':'Novo ')+productWord();$('save').textContent=product?'Salvar e atualizar site':'Publicar produto';message('');dirty=false;list();
}

function currentHighlight(){return state.banners.highlights.find(item=>item.id===currentHighlightId)||null;}

function renderHighlightList(){
  const root=$('highlight-list');root.replaceChildren();const items=state.banners.highlights;
  $('add-highlight').disabled=items.length>=4;
  $('add-highlight').textContent=items.length>=4?'Limite de 4 destaques':' + Adicionar destaque';
  if(!items.length){root.append(el('p','highlight-empty','Nenhum destaque cadastrado. Clique em “Adicionar destaque”.'));return;}
  items.forEach((highlight,index)=>{
    const card=el('article','highlight-card'),preview=el('div','highlight-preview');
    if(highlight.image){const image=el('img');image.src=previewURL(highlight.image);image.alt='Prévia do destaque '+(index+1);preview.append(image);}else preview.append(el('span','highlight-empty','Sem imagem'));
    const details=el('div','highlight-details');details.append(el('strong','',highlight.title||'Destaque '+(index+1)),el('p','',(highlight.active?'Visível na home':'Oculto')+' · Posição '+(index+1)+' de '+items.length));
    const actions=el('div','highlight-actions');
    const edit=el('button','',currentHighlightId===highlight.id?'Editando':'Editar');edit.type='button';edit.onclick=()=>{if(canLeave()){currentHighlightId=highlight.id;loadBannerEditor();}};
    const up=el('button','', '↑');up.type='button';up.title='Mover para cima';up.disabled=index===0;up.onclick=()=>moveHighlight(index,-1);
    const down=el('button','', '↓');down.type='button';down.title='Mover para baixo';down.disabled=index===items.length-1;down.onclick=()=>moveHighlight(index,1);
    const promote=el('button','', 'Usar como promoção');promote.type='button';promote.onclick=()=>promoteHighlight(highlight.id);
    const remove=el('button','', 'Excluir');remove.type='button';remove.onclick=()=>removeHighlight(highlight.id);
    actions.append(edit,up,down,promote,remove);card.append(preview,details,actions);root.append(card);
  });
}

function loadBannerEditor(){
  const isPromotion=bannerArea==='promotion';const value=isPromotion?state.banners.promotion:(currentHighlight()||blankHighlight());
  $('highlight-manager').hidden=isPromotion;
  $('banner-editor-title').textContent=isPromotion?'Promoção fixa':' '+(currentHighlightId?'Editar destaque':'Novo destaque');
  $('banner-description').textContent=isPromotion?'Este banner fica logo depois das boas-vindas, antes dos destaques. Ele é exibido inteiro, sem corte e sem texto por cima.':'Os destaques aparecem depois da promoção. Use uma imagem horizontal; o título é só para identificar o item no painel.';
  $('banner-photo-help').textContent=isPromotion?'A promoção será mostrada inteira, sem corte. Até 10 MB; a otimização é automática.':'Para destaques, prefira imagem horizontal. Até 10 MB; a otimização é automática.';
  $('promotion-preview-note').hidden=!isPromotion;
  $('banner-title').value=value.title||'';$('banner-link').value=value.link||'';$('banner-active').checked=isPromotion?value.active:(currentHighlightId?value.active:true);bannerImage=value.image||'';showImage('banner-preview',bannerImage);
  document.querySelectorAll('[data-banner-area]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.bannerArea===bannerArea)));renderHighlightList();message('',true);dirty=false;
}

function openBannerArea(area,ask=true){
  if(area===bannerArea&&!ask){loadBannerEditor();return;}
  if(ask&&!canLeave())return;
  bannerArea=area;currentHighlightId='';loadBannerEditor();
}

async function persistHighlights(highlights,notice){
  busy++;$('banner-fields').disabled=true;
  try{adopt(await request('banners/highlights',{method:'PUT',headers:{'Content-Type':'application/json','If-Match':String(state.revision)},body:JSON.stringify({highlights})}));dirty=false;renderHighlightList();message(notice,true);}
  catch(error){message(error.message,true);}finally{busy--;$('banner-fields').disabled=false;}
}

async function moveHighlight(index,delta){
  if(busy||!canLeave())return;const next=[...state.banners.highlights];const target=index+delta;if(target<0||target>=next.length)return;
  [next[index],next[target]]=[next[target],next[index]];await persistHighlights(next,'Ordem dos destaques atualizada.');
}

async function removeHighlight(id){
  if(busy||!confirm('Excluir este destaque da home?'))return;
  const next=state.banners.highlights.filter(item=>item.id!==id);if(currentHighlightId===id)currentHighlightId='';await persistHighlights(next,'Destaque removido da home.');loadBannerEditor();
}

async function promoteHighlight(id){
  if(busy||!canLeave())return;
  const highlight=state.banners.highlights.find(item=>item.id===id);
  if(!highlight?.image){message('Este destaque não tem imagem para usar como promoção.',true);return;}
  if(!confirm('Usar este destaque como a promoção fixa? A promoção atual será substituída e este item sairá da lista de destaques.'))return;
  busy++;$('banner-fields').disabled=true;
  try{
    adopt(await request('banners/highlights/'+encodeURIComponent(id)+'/promotion',{method:'POST',headers:{'If-Match':String(state.revision)}}));
    bannerArea='promotion';currentHighlightId='';loadBannerEditor();message('Promoção fixa atualizada. O destaque anterior foi removido da lista.',true);
  }catch(error){message(error.message,true);}finally{busy--;$('banner-fields').disabled=false;}
}

function changeTab(next,gender=''){
  tab=next;audience=gender||'Feminino';const banners=tab==='banners';
  document.querySelectorAll('[data-tab]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.tab===tab&&(button.dataset.audience||'')===(banners?'':audience))));
  $('editor').hidden=banners;$('banner-form').hidden=!banners;$('new').hidden=banners;
  $('heading').textContent=banners?'Home: destaques e promoção':'Cadastro de '+tabTitle();$('new').textContent='+ Cadastrar '+productWord();$('variant-title').textContent=tab==='Perfumes'?'Volumes, concentrações e quantidades':'Cores, numerações e quantidades';
  if(banners){bannerArea='highlights';currentHighlightId='';loadBannerEditor();}else load();
}

document.querySelectorAll('[data-tab]').forEach(button=>button.onclick=()=>{if(canLeave())changeTab(button.dataset.tab,button.dataset.audience);});
document.querySelectorAll('[data-banner-area]').forEach(button=>button.onclick=()=>openBannerArea(button.dataset.bannerArea));
$('add-highlight').onclick=()=>{if(busy||state.banners.highlights.length>=4)return;if(canLeave()){bannerArea='highlights';currentHighlightId='';loadBannerEditor();$('banner-title').focus();}};
$('new').onclick=()=>{if(canLeave())load();};$('add-variant').onclick=()=>{row();dirty=true;};
for(const id of ['editor','banner-form']){['input','change'].forEach(event=>$(id).addEventListener(event,()=>dirty=true));}

async function upload(file,kind){
  if(file.size>10*1024*1024)throw Error('A imagem deve ter até 10 MB.');
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Use JPG, PNG ou WebP.');
  return request('upload',{method:'POST',headers:{'Content-Type':file.type,'X-Image-Kind':kind},body:file});
}

$('photos').onchange=async event=>{
  const files=[...event.target.files];if(!files.length)return;if(!requireConnection()){event.target.value='';return;}if(busy){event.target.value='';return;}if(images.length+files.length>8){message('O produto pode ter no máximo 8 fotos.');event.target.value='';return;}
  busy++;message('Otimizando e enviando '+files.length+' foto(s)…');let sent=0;
  try{for(const file of files){const result=await upload(file,'product');images.push(result.image);sent++;renderPhotos();}dirty=true;message(sent+' foto(s) pronta(s). Salve o produto para publicar.');}
  catch(error){message((sent?'Algumas fotos foram enviadas. ':'')+error.message);}finally{busy--;event.target.value='';}
};

$('banner-photo').onchange=async event=>{
  const file=event.target.files[0];if(!file)return;if(!requireConnection(true)){event.target.value='';return;}if(busy){event.target.value='';return;}
  busy++;message('Otimizando e enviando a imagem…',true);
  try{const result=await upload(file,'banner');bannerImage=result.image;showImage('banner-preview',bannerImage);dirty=true;message('Imagem pronta: '+Math.round(result.size/1024)+' KB. Salve para publicar.',true);}
  catch(error){message(error.message,true);}finally{busy--;event.target.value='';}
};

$('banner-remove').onclick=()=>{if(busy)return;bannerImage='';$('banner-active').checked=false;showImage('banner-preview','');dirty=true;};

$('editor').onsubmit=async event=>{
  event.preventDefault();if(busy||!requireConnection())return;
  const variants=[...$('variants').children].map(rowElement=>{const variant={};rowElement.querySelectorAll('[data-field]').forEach(input=>variant[input.dataset.field]=input.dataset.field==='price'?price(input.value):['quantity','ml'].includes(input.dataset.field)?Number(input.value):input.value.trim());return variant;});
  const product={id:current,name:$('name').value.trim(),brand:$('brand').value.trim(),description:$('description').value.trim(),category:tab,audience:$('audience').value,price:price($('price').value),image:images[0]||'',images,active:$('active').checked,variants};
  busy++;$('product-fields').disabled=true;
  try{adopt(await request('products',{method:'POST',headers:{'Content-Type':'application/json','If-Match':String(state.revision)},body:JSON.stringify(product)}));const saved=current?state.products.find(item=>item.id===current):state.products.at(-1);load(saved);message('Produto salvo. A vitrine já foi atualizada.');}
  catch(error){message(error.message);}finally{busy--;$('product-fields').disabled=false;}
};

$('banner-form').onsubmit=async event=>{
  event.preventDefault();if(busy||!requireConnection(true))return;
  const value={title:$('banner-title').value.trim(),link:$('banner-link').value.trim(),image:bannerImage,active:$('banner-active').checked};
  if(bannerArea==='promotion'){
    busy++;$('banner-fields').disabled=true;
    try{adopt(await request('banners/promotion',{method:'PUT',headers:{'Content-Type':'application/json','If-Match':String(state.revision)},body:JSON.stringify(value)}));dirty=false;loadBannerEditor();message(state.banners.promotion.active?'Promoção fixa publicada logo depois das boas-vindas.':'Promoção salva e ocultada da home.',true);}
    catch(error){message(error.message,true);}finally{busy--;$('banner-fields').disabled=false;}
    return;
  }
  const highlight={id:currentHighlightId||makeHighlightId(),...value};
  const next=[...state.banners.highlights];const index=next.findIndex(item=>item.id===highlight.id);
  if(index>=0)next[index]=highlight;else next.push(highlight);
  if(next.length>4){message('Use no máximo quatro destaques.',true);return;}
  currentHighlightId=highlight.id;await persistHighlights(next,highlight.active?'Destaque salvo após a promoção.':'Destaque salvo como oculto.');loadBannerEditor();
};

$('delete').onclick=async()=>{
  if(busy||!current||!confirm('Excluir este produto do catálogo?'))return;busy++;
  try{adopt(await request('products/'+current,{method:'DELETE',headers:{'If-Match':String(state.revision)}}));load();message('Produto excluído.');}
  catch(error){message(error.message);}finally{busy--;}
};

$('export').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));const link=el('a');link.href=url;link.download='rainha-catalogo.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);};
$('import').onclick=()=>{if(canLeave())$('import-file').click();};
$('import-file').onchange=async event=>{
  const file=event.target.files[0];if(!file)return;busy++;
  try{
    if(file.size>30*1024*1024)throw Error('Arquivo muito grande.');const input=JSON.parse(await file.text());const items=Array.isArray(input)?input:input.products;if(!Array.isArray(items)||items.length>300)throw Error('Cópia de catálogo inválida.');if(!confirm('Recuperar '+items.length+' produtos como ocultos? Confira quantidades e fotos antes de publicar.'))return;
    let imported=0;
    for(const old of items){
      if(!['Calçados','Perfumes'].includes(old.category))continue;const recoveredImages=[];const candidates=Array.isArray(old.images)&&old.images.length?old.images:[old.image];
      for(const candidate of candidates.slice(0,8)){if(typeof candidate==='string'&&/^data:image\/(png|jpeg|webp);base64,/.test(candidate)){const blob=await(await fetch(candidate)).blob();recoveredImages.push((await upload(blob,'product')).image);}}
      const variants=(old.variants?.length?old.variants:[{}]).map(variant=>old.category==='Perfumes'?{ml:Number(variant.ml??parseFloat(variant.attribute1))||100,concentration:String(variant.concentration??variant.attribute2??''),quantity:Number.isInteger(variant.quantity)?variant.quantity:0,price:variant.price??null}:{color:String(variant.color??variant.attribute1??'A conferir'),size:String(variant.size??variant.attribute2??'A conferir'),quantity:Number.isInteger(variant.quantity)?variant.quantity:0,price:variant.price??null});
      adopt(await request('products',{method:'POST',headers:{'Content-Type':'application/json','If-Match':String(state.revision)},body:JSON.stringify({name:old.name,brand:old.brand||'',description:old.description||'',category:old.category,audience:old.audience||'Feminino',price:old.price??null,image:recoveredImages[0]||'',images:recoveredImages,active:false,variants})}));imported++;
    }
    message(imported+' produto(s) recuperado(s) como ocultos. Confira dados, quantidades e fotos.');
  }catch(error){message('Recuperação interrompida: '+error.message+' Os produtos já salvos foram mantidos.');}finally{busy--;event.target.value='';}
};

window.addEventListener('beforeunload',event=>{if(dirty||busy){event.preventDefault();event.returnValue='';}});
request('catalog').then(data=>{adopt(data);changeTab('Calçados','Feminino');}).catch(error=>{connected=false;$('product-fields').disabled=false;$('banner-fields').disabled=false;$('connection').textContent=error.message+' Recarregue a página para tentar novamente; nada foi salvo no navegador.';});
$('connect-drive').onclick=async()=>{
  if(!canLeave())return;if(location.hostname==='www.calcadosrainha.com.br'){location.href='https://calcadosrainha.com.br/cliente/';return;}
  if(!confirm('Você vai autorizar a aplicação no Google. Para usar a pasta já existente, a permissão solicitada abrange o Drive da conta. Este sistema utiliza apenas a pasta de imagens informada. Continuar?'))return;
  try{const result=await request('drive/start',{method:'POST'});dirty=false;location.href=result.url;}catch(error){$('connection').textContent=error.message;}
};
