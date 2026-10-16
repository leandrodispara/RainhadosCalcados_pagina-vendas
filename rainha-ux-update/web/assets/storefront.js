'use strict';

let catalog=[];
let department='all';
let carouselTimer=null;

const node=(tag,className,text)=>{const item=document.createElement(tag);if(className)item.className=className;if(text!==undefined)item.textContent=text;return item;};
const imagesOf=product=>Array.isArray(product?.images)&&product.images.length?product.images:(product?.image?[product.image]:[]);
const audienceOf=product=>product.audience==='Masculino'?'Masculino':'Feminino';
const productMatches=(product,filter)=>filter==='all'||(filter==='feminino'&&audienceOf(product)==='Feminino')||(filter==='masculino'&&audienceOf(product)==='Masculino')||(filter==='perfumes'&&product.category==='Perfumes');

function productCard(product){
  const card=node('article','editorial-product-card');
  const link=node('a','editorial-product-link');
  link.href='/produto.html?id='+encodeURIComponent(product.id);
  link.setAttribute('aria-label','Ver '+product.name);
  const media=node('div','editorial-product-media');
  const cover=imagesOf(product)[0];
  if(cover){const image=node('img');image.src=cover;image.alt=product.name;image.loading='lazy';media.append(image);}else media.append(node('div','editorial-no-photo','Consulte fotos com a loja'));
  link.append(media,node('h3','editorial-product-name',product.name));card.append(link);return card;
}

function renderProducts(){
  const root=document.getElementById('products');if(!root)return;
  root.replaceChildren();
  const items=catalog.filter(product=>productMatches(product,department));
  document.getElementById('count').textContent=items.length?`${items.length} ${items.length===1?'produto selecionado':'produtos selecionados'}`:'';
  if(!items.length){root.append(node('p','editorial-empty','Estamos preparando esta seleção. Fale com a Rainha pelo WhatsApp.'));return;}
  items.forEach(product=>root.append(productCard(product)));
}

function setDepartment(next,{scroll=true}={}){
  department=next;
  document.querySelectorAll('[data-department]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.department===next)));
  renderProducts();
  if(scroll)document.getElementById('catalogo')?.scrollIntoView({behavior:'smooth',block:'start'});
}

function bannerLink(banner,image){
  if(!banner.link)return image;
  const link=node('a','editorial-banner-link');link.href=banner.link;link.setAttribute('aria-label',banner.title||'Abrir destaque');link.append(image);return link;
}

function renderHighlights(area,highlights){
  if(!area)return;
  const entries=(Array.isArray(highlights)?highlights:[]).filter(item=>item?.image&&item.active!==false);
  if(!entries.length){area.hidden=true;area.replaceChildren();return;}
  if(carouselTimer)window.clearInterval(carouselTimer);
  const frame=node('div','editorial-highlights-frame');
  const heading=node('div','editorial-highlights-heading');heading.append(node('p','editorial-kicker','DESTAQUES DA LOJA'),node('h2','','Novidades para conhecer de perto.'));
  const gallery=node('div','editorial-highlight-gallery');
  const slides=node('div','editorial-highlight-slides');
  const list=[];
  entries.forEach((banner,index)=>{
    const slide=node('article','editorial-highlight-slide');slide.hidden=index!==0;
    const image=node('img');image.src=banner.image;image.alt=banner.title||'Destaque Rainha dos Calçados';image.loading=index?'lazy':'eager';
    slide.append(bannerLink(banner,image));slides.append(slide);list.push(slide);
  });
  gallery.append(slides);
  if(entries.length>1){
    const controls=node('div','editorial-highlight-controls');
    const previous=node('button','editorial-highlight-arrow','‹');previous.type='button';previous.setAttribute('aria-label','Destaque anterior');
    const next=node('button','editorial-highlight-arrow','›');next.type='button';next.setAttribute('aria-label','Próximo destaque');
    const dots=node('div','editorial-highlight-dots');const buttons=[];
    const show=position=>{const index=(position+list.length)%list.length;list.forEach((slide,order)=>slide.hidden=order!==index);buttons.forEach((button,order)=>button.setAttribute('aria-current',String(order===index)));return index;};
    let active=0;
    entries.forEach((banner,index)=>{const button=node('button','editorial-highlight-dot');button.type='button';button.setAttribute('aria-label',`Mostrar destaque ${index+1}`);button.setAttribute('aria-current',String(index===0));button.onclick=()=>{active=show(index);};buttons.push(button);dots.append(button);});
    previous.onclick=()=>{active=show(active-1);};next.onclick=()=>{active=show(active+1);};
    controls.append(previous,next);gallery.append(controls,dots);
    carouselTimer=window.setInterval(()=>{active=show(active+1);},6500);
    const stop=()=>{if(carouselTimer){window.clearInterval(carouselTimer);carouselTimer=null;}};
    const start=()=>{if(!carouselTimer)carouselTimer=window.setInterval(()=>{active=show(active+1);},6500);};
    area.addEventListener('mouseenter',stop);area.addEventListener('mouseleave',start);
    area.addEventListener('focusin',stop);area.addEventListener('focusout',start);
  }
  frame.append(heading,gallery);area.replaceChildren(frame);area.hidden=false;
}

function renderPromotion(area,banner){
  if(!area)return;
  if(!banner?.image){area.hidden=true;area.replaceChildren();return;}
  const frame=node('div','editorial-promotion-frame');
  if(banner.title){const heading=node('div','editorial-promotion-heading');heading.append(node('p','editorial-kicker','PROMOÇÃO DA SEMANA'),node('h2','',banner.title));frame.append(heading);}
  const media=node('div','editorial-promotion-media');
  const image=node('img');image.src=banner.image;image.alt=banner.title||'Promoção da Rainha dos Calçados';image.loading='lazy';
  media.append(bannerLink(banner,image));frame.append(media);area.replaceChildren(frame);area.hidden=false;
}

function setCollectionImage(id,product){
  const panel=document.getElementById(id);if(!panel)return;
  const image=imagesOf(product)[0];
  if(image)panel.style.setProperty('--collection-image',`url("${image}")`);
}

function renderEditorialBlocks(){
  const female=catalog.find(product=>product.category==='Calçados'&&audienceOf(product)==='Feminino')||catalog.find(product=>audienceOf(product)==='Feminino');
  const male=catalog.find(product=>product.category==='Calçados'&&audienceOf(product)==='Masculino')||catalog.find(product=>audienceOf(product)==='Masculino');
  if(female)setCollectionImage('collection-feminine',female);
  if(male)setCollectionImage('collection-masculine',male);
  const image=document.getElementById('perfume-story-image');
  const perfume=catalog.find(product=>product.category==='Perfumes'&&imagesOf(product).length);
  if(perfume&&image){image.src=imagesOf(perfume)[0];image.alt=perfume.name;image.hidden=false;}
  else if(image){image.hidden=true;image.removeAttribute('src');image.alt='';}
}

document.querySelectorAll('[data-department]').forEach(element=>element.addEventListener('click',event=>{const next=element.dataset.department;if(!next)return;event.preventDefault();setDepartment(next);}));

fetch('/api/catalog',{cache:'no-store'}).then(async response=>{
  if(!response.ok)throw Error('Não foi possível carregar a vitrine.');
  const data=await response.json();catalog=Array.isArray(data.products)?data.products:[];
  const banners=data.banners||{};
  renderPromotion(document.getElementById('promotion'),banners.promotion||data.banner);
  renderHighlights(document.getElementById('highlights'),banners.highlights||[banners.main].filter(Boolean));
  renderProducts();renderEditorialBlocks();
}).catch(()=>{
  const root=document.getElementById('products');if(root){root.replaceChildren(node('p','editorial-empty','Não foi possível carregar a vitrine agora. Fale com a Rainha pelo WhatsApp.'));}document.getElementById('count').textContent='';
});
