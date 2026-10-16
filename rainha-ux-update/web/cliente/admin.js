'use strict';
const $=id=>document.getElementById(id);
const blankBanner=()=>({title:'',image:'',link:'',active:false});
const blankHighlight=()=>({id:'',...blankBanner()});
let state={products:[],revision:0,banner:blankBanner(),banners:{highlights:[],promotion:blankBanner()}},tab='Calçados',audience='Feminino',current=null,images=[],bannerArea='highlights',editingHighlightId='',bannerImage='',dirty=false,busy=0,connected=false;

const el=(tag,cls,value)=>{const item=document.createElement(tag);if(cls)item.className=cls;if(value!==undefined)item.textContent=value;return item;};
const price=value=>value===''?null:Number(value);
const previewURL=url=>url?'/cliente/api/image?id='+encodeURIComponent(url.split('/').at(-1)):'';
const imagesOf=product=>Array.isArray(product?.images)&&product.images.length?product.images:(product?.image?[product.image]:[]);
const tabTitle=()=>tab+' '+audience.toLowerCase();
const productWord=()=>tab==='Perfumes'?'perfume':'calçado';
const highlights=()=>Array.isArray(state.banners?.highlights)?state.banners.highlights:[];
function message(value,banner=false){$(banner?'banner-status':'status').textContent=value;}
async function request(path,options={}){
 const response=await fetch('/cliente/api/'+path,{...options,headers:{'X-Rainha-Request':'1',...options.headers}});
 let result;try{result=await response.json();}catch{throw Error('O serviço de cadastro não respondeu. Confira a instalação no servidor.');}
 if(!response.ok)throw Error(result.error||'Não foi possível concluir.');
 return result;
}

function adopt(data){
 const banners=data.banners&&typeof data.banners==='object'?data.banners:{};
 const fallbackMain=banners.main&&typeof banners.main==='object'?[{id:banners.main.id||'',...banners.main}]:[];
 state={
  ...data,
  products:Array.isArray(data.products)?data.products:[],
  banners:{
   highlights:(Array.isArray(banners.highlights)?banners.highlights:fallbackMain).slice(0,3).map(item=>({...blankHighlight(),...item})),
   promotion:{...blankBanner(),...(banners.promotion||data.banner||{})}
  }
 };
 state.banner=state.banners.promotion;
 $('connect-drive').hidden=!data.driveConfigured;
 $('connect-drive').textContent=data.storageReady?'Reconectar Google Drive':'Conectar Google Drive';
 connected=true;
 $('connection').textContent=data.storageReady?'Cadastro conectado. Salvar publica as alterações no site.':'Catálogo conectado. Conecte o Google Drive para enviar fotos e banners.';
 $('new').disabled=false;$('export').disabled=false;$('import').disabled=false;$('product-fields').disabled=false;$('banner-fields').disabled=false;
 list();
}

function list(){
 $('list').replaceChildren();
 if(tab==='banners'){$('total').textContent='';return;}
 const products=state.products.filter(product=>product.category===tab&&product.audience===audience);
 $('total').textContent=products.length+' produto(s)';
 for(const product of products){
  const button=el('button');button.type='button';button.setAttribute('aria-current',String(product.id===current));
  button.append(el('span','',product.name),el('small','',(product.active?'Visível':'Oculto')+' · '+product.variants.reduce((sum,variant)=>sum+variant.quantity,0)+' unidade(s) · '+imagesOf(product).length+' foto(s)'));
  button.onclick=()=>{if(canLeave())load(product);};
  $('list').append(button);
 }
}

function canLeave(){
 if(busy){message('Aguarde a operação atual.',tab==='banners');return false;}
 return !dirty||confirm('Descartar as alterações ainda não salvas?');
}

function row(variant={}){
 const perfume=tab==='Perfumes',item=el('div','variant');
 const fields=perfume?[['ml','Volume (ml)','number'],['concentration','Concentração','text']]:[['color','Cor','text'],['size','Numeração','text']];
 fields.push(['quantity','Quantidade disponível','number'],['price','Preço da opção (R$)','number']);
 for(const [key,title,type] of fields){
  const label=el('label','field',title),input=el('input');
  input.dataset.field=key;input.type=type;input.value=variant[key]??(key==='quantity'?'0':'');
  input.required=['ml','color','size','quantity'].includes(key);
  if(type==='number'){input.min=key==='quantity'?'0':'0.01';input.max=key==='quantity'?'100000':key==='ml'?'10000':'999999';input.step=key==='quantity'?'1':'0.01';}
  else input.maxLength=key==='color'?60:key==='size'?30:80;
  label.append(input);item.append(label);
 }
 const remove=el('button','remove','Remover variação');remove.type='button';remove.onclick=()=>{item.remove();dirty=true;};item.append(remove);
 $('variants').append(item);
}

function renderPhotos(){
 const root=$('photo-previews');root.replaceChildren();
 images.forEach((url,index)=>{
  const item=el('div','photo-item'),image=el('img');
  image.src=previewURL(url);image.alt='Foto '+(index+1)+' do produto';
  const remove=el('button','', 'Remover');remove.type='button';
  remove.onclick=()=>{if(busy)return;images=images.filter((_,position)=>position!==index);renderPhotos();dirty=true;};
  item.append(image);if(index===0)item.append(el('span','photo-main','Capa'));item.append(remove);root.append(item);
 });
 $('photo-help').textContent=images.length?'A primeira foto será a capa da vitrine. '+images.length+'/8 foto(s) selecionada(s).':'Selecione uma ou mais fotos. Você pode enviar até 8 fotos por produto.';
}

function showImage(id,url){
 $(id).hidden=!url;
 if(url)$(id).src=previewURL(url);
 else $(id).removeAttribute('src');
}

function load(product=null){
 current=product?.id??null;images=[...new Set(imagesOf(product))];$('editor').reset();
 for(const id of ['name','brand','description'])$(id).value=product?.[id]??'';
 $('price').value=product?.price??'';$('audience').value=product?.audience||audience;$('active').checked=product?.active??true;
 $('variants').replaceChildren();(product?.variants??[{}]).forEach(row);renderPhotos();
 $('delete').hidden=!product;$('editor-title').textContent=(product?'Editar ':'Novo ')+productWord();
 $('save').textContent=product?'Salvar e atualizar site':'Publicar produto';
 message('');dirty=false;list();
}

function fillBannerEditor(banner){
 $('banner-title').value=banner.title||'';
 $('banner-link').value=banner.link||'';
 $('banner-active').checked=!!banner.active;
 bannerImage=banner.image||'';
 showImage('banner-preview',bannerImage);
}

function renderHighlights(){
 const root=$('highlights-list');root.replaceChildren();
 const items=highlights();
 $('new-highlight').disabled=items.length>=3;
 if(!items.length){
  root.append(el('p','empty','Nenhum destaque cadastrado. Adicione o primeiro banner para recepcionar quem entra na loja.'));
 }else{
  items.forEach((item,index)=>{
   const card=el('article','highlight-card');
   const preview=el('div','highlight-preview');
   if(item.image){const image=el('img');image.src=previewURL(item.image);image.alt=item.title||'Destaque '+(index+1);preview.append(image);}
   else preview.append(el('span','highlight-empty','Sem imagem'));
   const details=el('div','highlight-details');
   details.append(el('strong','',item.title||'Destaque sem título'),el('p','',(item.active?'Publicado':'Oculto')+' · Posição '+(index+1)));
   const actions=el('div','highlight-actions');
   const edit=el('button','btn secondary','Editar');edit.type='button';
   edit.onclick=()=>{if(canLeave())openHighlight(item.id);};
   const remove=el('button','remove','Excluir');remove.type='button';
   remove.onclick=()=>{if(canLeave())removeHighlight(item.id);};
   actions.append(edit,remove);card.append(preview,details,actions);root.append(card);
  });
 }
 $('highlights-help').textContent=items.length+'/3 destaque(s) cadastrado(s). Eles aparecem no carrossel na ordem mostrada acima.';
}

function showHighlightEditor(item=null){
 bannerArea='highlights';
 editingHighlightId=item?.id||'';
 fillBannerEditor(item||{...blankBanner(),active:true});
 $('banner-editor-panel').hidden=false;
 $('banner-heading').textContent=item?'Editar destaque':'Adicionar destaque';
 $('banner-description').textContent=item?'Este banner faz parte do carrossel do topo. Você pode ocultá-lo ou excluí-lo quando quiser.':'Este banner será exibido no carrossel do topo quando estiver ativo.';
 $('banner-photo-help').textContent='Use imagem horizontal de aproximadamente 1600 × 500 px. O carrossel mostra um destaque por vez.';
 $('banner-save').textContent=item?'Salvar destaque':'Adicionar destaque';
 $('banner-cancel').hidden=false;
 $('banner-remove').hidden=!item;
 $('banner-remove').textContent='Excluir destaque';
 message('',true);dirty=false;
}

function openHighlight(id){
 const item=highlights().find(highlight=>highlight.id===id);
 if(!item){message('Destaque não encontrado. Recarregue a página.',true);return;}
 showHighlightEditor(item);
}

function startHighlight(){
 if(highlights().length>=3){message('Use no máximo três destaques na página inicial.',true);return;}
 showHighlightEditor();
}

function loadPromotion(){
 bannerArea='promotion';editingHighlightId='';
 const banner=state.banners.promotion||blankBanner();
 fillBannerEditor(banner);
 $('banner-editor-panel').hidden=false;
 $('banner-heading').textContent='Banner fixo de promoções';
 $('banner-description').textContent='Este banner fica abaixo do carrossel de destaques. Ele é independente e não se sobrepõe aos outros banners.';
 $('banner-photo-help').textContent='A imagem é exibida inteira, sem ser colocada sobre os destaques.';
 $('banner-save').textContent='Salvar banner de promoções';
 $('banner-cancel').hidden=true;
 $('banner-remove').hidden=!bannerImage;
 $('banner-remove').textContent='Remover imagem';
 message('',true);dirty=false;
}

function selectBannerArea(area){
 bannerArea=area;
 document.querySelectorAll('[data-banner-area]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.bannerArea===area)));
 const highlightsArea=area==='highlights';
 $('highlights-panel').hidden=!highlightsArea;
 if(highlightsArea){
  editingHighlightId='';bannerImage='';
  $('banner-editor-panel').hidden=true;
  renderHighlights();message('',true);dirty=false;
 }else loadPromotion();
}

function changeTab(next,gender=''){
 tab=next;audience=gender||'Feminino';
 const banners=tab==='banners';
 document.querySelectorAll('[data-tab]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.tab===tab&&(button.dataset.audience||'')===(banners?'':audience))));
 $('editor').hidden=banners;$('banner-form').hidden=!banners;$('new').hidden=banners;
 $('heading').textContent=banners?'Banners da página inicial':'Cadastro de '+tabTitle();
 $('new').textContent='+ Cadastrar '+productWord();
 $('variant-title').textContent=tab==='Perfumes'?'Volumes, concentrações e quantidades':'Cores, numerações e quantidades';
 if(banners)selectBannerArea('highlights');else load();
}

document.querySelectorAll('[data-tab]').forEach(button=>button.onclick=()=>{if(canLeave())changeTab(button.dataset.tab,button.dataset.audience);});
document.querySelectorAll('[data-banner-area]').forEach(button=>button.onclick=()=>{if(button.dataset.bannerArea!==bannerArea&&canLeave())selectBannerArea(button.dataset.bannerArea);});
$('new').onclick=()=>{if(canLeave())load();};
$('add-variant').onclick=()=>{row();dirty=true;};
$('new-highlight').onclick=()=>{if(canLeave())startHighlight();};
$('banner-cancel').onclick=()=>{if(bannerArea==='highlights'){editingHighlightId='';bannerImage='';$('banner-editor-panel').hidden=true;renderHighlights();message('',true);dirty=false;}};
for(const id of ['editor','banner-form']){['input','change'].forEach(event=>$(id).addEventListener(event,()=>dirty=true));}

async function upload(file,kind){
 if(file.size>10*1024*1024)throw Error('A imagem deve ter até 10 MB.');
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Use JPG, PNG ou WebP.');
 return request('upload',{method:'POST',headers:{'Content-Type':file.type,'X-Image-Kind':kind},body:file});
}

$('photos').onchange=async event=>{
 const files=[...event.target.files];
 if(!files.length)return;
 if(busy){event.target.value='';return;}
 if(images.length+files.length>8){message('O produto pode ter no máximo 8 fotos.');event.target.value='';return;}
 busy++;message('Otimizando e enviando '+files.length+' foto(s)…');let sent=0;
 try{
  for(const file of files){const result=await upload(file,'product');images.push(result.image);sent++;renderPhotos();}
  dirty=true;message(sent+' foto(s) pronta(s). Salve o produto para publicar.');
 }catch(error){message((sent?'Algumas fotos foram enviadas. ':'')+error.message);}
 finally{busy--;event.target.value='';}
};

$('banner-photo').onchange=async event=>{
 const file=event.target.files[0];
 if(!file)return;
 if(busy){event.target.value='';return;}
 busy++;message('Otimizando e enviando a imagem…',true);
 try{
  const result=await upload(file,'banner');
  bannerImage=result.image;showImage('banner-preview',result.image);
  if(bannerArea==='promotion')$('banner-remove').hidden=false;
  dirty=true;message('Imagem pronta: '+Math.round(result.size/1024)+' KB. Salve para publicar.',true);
 }catch(error){message(error.message,true);}
 finally{busy--;event.target.value='';}
};

$('banner-remove').onclick=()=>{
 if(busy)return;
 if(bannerArea==='highlights'&&editingHighlightId){removeHighlight(editingHighlightId);return;}
 bannerImage='';$('banner-active').checked=false;showImage('banner-preview','');$('banner-remove').hidden=true;dirty=true;
 message('Imagem removida. Salve o banner para atualizar a vitrine.',true);
};

$('editor').onsubmit=async event=>{
 event.preventDefault();
 if(busy||!connected)return;
 const variants=[...$('variants').children].map(rowElement=>{
  const variant={};
  rowElement.querySelectorAll('[data-field]').forEach(input=>variant[input.dataset.field]=input.dataset.field==='price'?price(input.value):['quantity','ml'].includes(input.dataset.field)?Number(input.value):input.value.trim());
  return variant;
 });
 const product={id:current,name:$('name').value.trim(),brand:$('brand').value.trim(),description:$('description').value.trim(),category:tab,audience:$('audience').value,price:price($('price').value),image:images[0]||'',images,active:$('active').checked,variants};
 busy++;$('product-fields').disabled=true;
 try{
  adopt(await request('products',{method:'POST',headers:{'Content-Type':'application/json','If-Match':String(state.revision)},body:JSON.stringify(product)}));
  const saved=current?state.products.find(item=>item.id===current):state.products.at(-1);
  load(saved);message('Produto salvo. A vitrine já foi atualizada.');
 }catch(error){message(error.message);}
 finally{busy--;$('product-fields').disabled=false;}
};

$('banner-form').onsubmit=async event=>{
 event.preventDefault();
 if(busy||!connected)return;
 const payload={title:$('banner-title').value.trim(),link:$('banner-link').value.trim(),image:bannerImage,active:$('banner-active').checked};
 const isPromotion=bannerArea==='promotion';
 const path=isPromotion?'banners/promotion':editingHighlightId?'highlights/'+editingHighlightId:'highlights';
 const method=isPromotion||editingHighlightId?'PUT':'POST';
 busy++;$('banner-fields').disabled=true;
 try{
  adopt(await request(path,{method,headers:{'Content-Type':'application/json','If-Match':String(state.revision)},body:JSON.stringify(payload)}));
  dirty=false;
  if(isPromotion){
   loadPromotion();
   message(state.banners.promotion.active?'Banner de promoções publicado no site.':'Banner de promoções salvo e oculto na vitrine.',true);
  }else{
   const saved=editingHighlightId?highlights().find(item=>item.id===editingHighlightId):highlights().at(-1);
   if(saved)openHighlight(saved.id);
   renderHighlights();
   message(saved?.active?'Destaque publicado no carrossel.':'Destaque salvo e oculto no carrossel.',true);
  }
 }catch(error){message(error.message,true);}
 finally{busy--;$('banner-fields').disabled=false;}
};

async function removeHighlight(id){
 if(busy||!id)return;
 if(!confirm('Excluir este destaque da página inicial?'))return;
 busy++;$('banner-fields').disabled=true;
 try{
  adopt(await request('highlights/'+id,{method:'DELETE',headers:{'If-Match':String(state.revision)}}));
  editingHighlightId='';bannerImage='';$('banner-editor-panel').hidden=true;renderHighlights();dirty=false;
  message('Destaque removido da página inicial.',true);
 }catch(error){message(error.message,true);}
 finally{busy--;$('banner-fields').disabled=false;}
}

$('delete').onclick=async()=>{
 if(busy||!current||!confirm('Excluir este produto do catálogo?'))return;
 busy++;
 try{adopt(await request('products/'+current,{method:'DELETE',headers:{'If-Match':String(state.revision)}}));load();message('Produto excluído.');}
 catch(error){message(error.message);}
 finally{busy--;}
};

$('export').onclick=()=>{
 const url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));
 const link=el('a');link.href=url;link.download='rainha-catalogo.json';link.click();
 setTimeout(()=>URL.revokeObjectURL(url),10000);
};

$('import').onclick=()=>{if(canLeave())$('import-file').click();};
$('import-file').onchange=async event=>{
 const file=event.target.files[0];
 if(!file)return;
 busy++;
 try{
  if(file.size>30*1024*1024)throw Error('Arquivo muito grande.');
  const input=JSON.parse(await file.text());
  const items=Array.isArray(input)?input:input.products;
  if(!Array.isArray(items)||items.length>300)throw Error('Cópia de catálogo inválida.');
  if(!confirm('Recuperar '+items.length+' produtos como ocultos? Confira quantidades e fotos antes de publicar.'))return;
  let imported=0;
  for(const old of items){
   if(!['Calçados','Perfumes'].includes(old.category))continue;
   const recoveredImages=[];
   const candidates=Array.isArray(old.images)&&old.images.length?old.images:[old.image];
   for(const candidate of candidates.slice(0,8)){
    if(typeof candidate==='string'&&/^data:image\/(png|jpeg|webp);base64,/.test(candidate)){
     const blob=await(await fetch(candidate)).blob();
     recoveredImages.push((await upload(blob,'product')).image);
    }
   }
   const variants=(old.variants?.length?old.variants:[{}]).map(variant=>old.category==='Perfumes'?{ml:Number(variant.ml??parseFloat(variant.attribute1))||100,concentration:String(variant.concentration??variant.attribute2??''),quantity:Number.isInteger(variant.quantity)?variant.quantity:0,price:variant.price??null}:{color:String(variant.color??variant.attribute1??'A conferir'),size:String(variant.size??variant.attribute2??'A conferir'),quantity:Number.isInteger(variant.quantity)?variant.quantity:0,price:variant.price??null});
   adopt(await request('products',{method:'POST',headers:{'Content-Type':'application/json','If-Match':String(state.revision)},body:JSON.stringify({name:old.name,brand:old.brand||'',description:old.description||'',category:old.category,audience:old.audience||'Feminino',price:old.price??null,image:recoveredImages[0]||'',images:recoveredImages,active:false,variants})}));
   imported++;
  }
  message(imported+' produto(s) recuperado(s) como ocultos. Confira dados, quantidades e fotos.');
 }catch(error){message('Recuperação interrompida: '+error.message+' Os produtos já salvos foram mantidos.');}
 finally{busy--;event.target.value='';}
};

window.addEventListener('beforeunload',event=>{if(dirty||busy){event.preventDefault();event.returnValue='';}});
request('catalog').then(data=>{adopt(data);changeTab('Calçados','Feminino');}).catch(error=>{$('connection').textContent=error.message+' Nenhum dado foi salvo no navegador.';});
$('connect-drive').onclick=async()=>{
 if(!canLeave())return;
 if(location.hostname==='www.calcadosrainha.com.br'){location.href='https://calcadosrainha.com.br/cliente/';return;}
 if(!confirm('Você vai autorizar a aplicação no Google. Para usar a pasta já existente, a permissão solicitada abrange o Drive da conta. Este sistema utiliza apenas a pasta de imagens informada. Continuar?'))return;
 try{const result=await request('drive/start',{method:'POST'});dirty=false;location.href=result.url;}
 catch(error){$('connection').textContent=error.message;}
};
